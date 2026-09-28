import {
  canonicalExtractionFields,
  canonicalJson,
  normalizeExtraction,
  sha256Hex,
  validateCanonicalExtractionSnapshot,
} from "../../../core/inference-contract.mjs";
import {
  type InferenceAttemptV1,
  type ProviderAttemptOutcome,
  ProviderStageError,
  runInferenceProviderStage,
  type SafeFailureCode,
} from "./inference-provider.ts";

type ResolvedContract = Awaited<
  ReturnType<
    typeof import("../../../core/inference-contract.mjs").resolveInferenceContract
  >
>;

export type ProcessingCommitV1 = {
  contract: ResolvedContract & { id: string };
  operation: {
    operation_id: string;
    recording_id: string;
    inference_contract_id: string;
    status: "succeeded" | "failed";
    safe_failure_code: SafeFailureCode | null;
    started_at: string;
    finished_at: string;
  };
  attempts: InferenceAttemptV1[];
  original_revision: {
    revision_id: string;
    recording_id: string;
    processing_operation_id: string;
    revision_kind: "original_model";
    canonical_output: Record<string, unknown>;
    canonical_output_sha256: string;
    production_schema_sha256: string;
    production_normalizer_sha256: string;
    canonical_keyset_sha256: string;
    created_at: string;
  } | null;
};

export async function runRecordingOperation(
  input: {
    recording_id: string;
    audio_bytes: Uint8Array | null;
    mime_type: string | null;
    existing_transcript?: string | null;
    metadata: Record<string, unknown>;
  },
  deps: {
    contract: ResolvedContract;
    transcribeAttempt: (
      attemptNumber: number,
    ) => Promise<ProviderAttemptOutcome<string>>;
    extractAttempt?: (
      attemptNumber: number,
      transcript: string,
    ) => Promise<ProviderAttemptOutcome<Record<string, unknown>>>;
    newUuid?: () => string;
    now?: () => string;
    monotonicNow?: () => number;
    sleep?: (attemptNumber: number) => Promise<void>;
  },
): Promise<ProcessingCommitV1> {
  const newUuid = deps.newUuid ?? (() => crypto.randomUUID());
  const now = deps.now ?? (() => new Date().toISOString());
  const operationId = newUuid();
  const contractId = newUuid();
  const startedAt = now();
  const attempts: InferenceAttemptV1[] = [];
  const contract = Object.freeze({ ...deps.contract, id: contractId });
  let transcript = input.existing_transcript?.trim() || null;

  if (!transcript) {
    if (!input.audio_bytes?.byteLength) {
      return failedCommit(
        contract,
        operationId,
        input.recording_id,
        startedAt,
        now(),
        "input_missing",
        attempts,
      );
    }
    try {
      const audioSha256 = await sha256Hex(input.audio_bytes);
      const result = await runInferenceProviderStage({
        operationId,
        recordingId: input.recording_id,
        stage: "transcription",
        maxRetries: deps.contract.transcription.max_retries,
        inputSnapshot: {
          audio_sha256: audioSha256,
          audio_bytes: input.audio_bytes.byteLength,
          mime_type: input.mime_type,
          model: deps.contract.transcription.model,
          request_config: {
            response_format: deps.contract.transcription.response_format,
            timeout_ms: deps.contract.transcription.timeout_ms,
          },
        },
        runAttempt: deps.transcribeAttempt,
        newUuid,
        now,
        monotonicNow: deps.monotonicNow,
        sleep: deps.sleep,
      });
      transcript = result.value.trim();
      attempts.push(...result.attempts);
      if (!transcript) {
        return failedCommit(
          contract,
          operationId,
          input.recording_id,
          startedAt,
          now(),
          "provider_response_invalid",
          attempts,
        );
      }
    } catch (error) {
      if (error instanceof ProviderStageError) {
        attempts.push(...error.attempts);
        return failedCommit(
          contract,
          operationId,
          input.recording_id,
          startedAt,
          now(),
          error.safeFailureCode,
          attempts,
        );
      }
      return failedCommit(
        contract,
        operationId,
        input.recording_id,
        startedAt,
        now(),
        "unknown",
        attempts,
      );
    }
  }

  if (!deps.extractAttempt) {
    return failedCommit(
      contract,
      operationId,
      input.recording_id,
      startedAt,
      now(),
      "configuration_missing",
      attempts,
    );
  }

  try {
    const transcriptSha256 = await sha256Hex(transcript);
    const result = await runInferenceProviderStage({
      operationId,
      recordingId: input.recording_id,
      stage: "extraction",
      maxRetries: deps.contract.extraction.max_retries,
      inputSnapshot: {
        transcript,
        transcript_sha256: transcriptSha256,
        metadata: structuredClone(input.metadata),
        model: deps.contract.extraction.model,
        prompt_sha256: deps.contract.prompt.sha256,
        request_config: {
          response_format: deps.contract.extraction.response_format,
          temperature: deps.contract.extraction.temperature,
          timeout_ms: deps.contract.extraction.timeout_ms,
        },
      },
      runAttempt: (attemptNumber) =>
        deps.extractAttempt!(attemptNumber, transcript!),
      newUuid,
      now,
      monotonicNow: deps.monotonicNow,
      sleep: deps.sleep,
    });
    attempts.push(...result.attempts);
    const normalized = normalizeExtraction(result.value, input.metadata);
    delete normalized.action_items;
    const canonicalOutput = validateCanonicalExtractionSnapshot(
      normalized,
      deps.contract,
    );
    const finishedAt = now();
    const revision = {
      revision_id: newUuid(),
      recording_id: input.recording_id,
      processing_operation_id: operationId,
      revision_kind: "original_model" as const,
      canonical_output: canonicalOutput,
      canonical_output_sha256: await sha256Hex(canonicalJson(canonicalOutput)),
      production_schema_sha256: deps.contract.schema.sha256,
      production_normalizer_sha256: deps.contract.normalizer.sha256,
      canonical_keyset_sha256: deps.contract.schema.keyset_sha256,
      created_at: finishedAt,
    };
    if (
      Object.keys(revision.canonical_output).join("|") !==
        canonicalExtractionFields(deps.contract).join("|")
    ) throw new Error("canonical_keyset_mismatch");
    return {
      contract,
      operation: {
        operation_id: operationId,
        recording_id: input.recording_id,
        inference_contract_id: contractId,
        status: "succeeded",
        safe_failure_code: null,
        started_at: startedAt,
        finished_at: finishedAt,
      },
      attempts,
      original_revision: revision,
    };
  } catch (error) {
    if (error instanceof ProviderStageError) {
      attempts.push(...error.attempts);
      return failedCommit(
        contract,
        operationId,
        input.recording_id,
        startedAt,
        now(),
        error.safeFailureCode,
        attempts,
      );
    }
    return failedCommit(
      contract,
      operationId,
      input.recording_id,
      startedAt,
      now(),
      "provider_response_invalid",
      attempts,
    );
  }
}

function failedCommit(
  contract: ProcessingCommitV1["contract"],
  operationId: string,
  recordingId: string,
  startedAt: string,
  finishedAt: string,
  code: SafeFailureCode,
  attempts: InferenceAttemptV1[],
): ProcessingCommitV1 {
  return {
    contract,
    operation: {
      operation_id: operationId,
      recording_id: recordingId,
      inference_contract_id: contract.id,
      status: "failed",
      safe_failure_code: code,
      started_at: startedAt,
      finished_at: finishedAt,
    },
    attempts,
    original_revision: null,
  };
}
