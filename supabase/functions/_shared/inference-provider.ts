import { canonicalJson, sha256Hex } from "../../../core/inference-contract.mjs";

export type SafeFailureCode =
  | "configuration_missing"
  | "input_missing"
  | "timeout"
  | "rate_limited"
  | "provider_http"
  | "provider_response_invalid"
  | "storage_failed"
  | "unknown";

export type ProviderAttemptOutcome<T> =
  | {
    ok: true;
    value: T;
    usage?: Record<string, unknown> | null;
    cost_microunits?: number | null;
  }
  | {
    ok: false;
    failure_code: SafeFailureCode;
    retryable: boolean;
    private_body?: unknown;
  };

export type InferenceAttemptV1 = {
  attempt_id: string;
  operation_id: string;
  recording_id: string;
  stage: "transcription" | "extraction";
  attempt_number: number;
  status: "succeeded" | "failed";
  safe_failure_code: SafeFailureCode | null;
  input_sha256: string;
  output_sha256: string | null;
  private_input_snapshot: Record<string, unknown>;
  private_output_snapshot: Record<string, unknown> | null;
  latency_ms: number;
  usage_snapshot: Record<string, unknown> | null;
  cost_microunits: number | null;
  started_at: string;
  finished_at: string;
};

export class ProviderStageError extends Error {
  safeFailureCode: SafeFailureCode;
  attempts: InferenceAttemptV1[];

  constructor(code: SafeFailureCode, attempts: InferenceAttemptV1[]) {
    super(code);
    this.name = "ProviderStageError";
    this.safeFailureCode = code;
    this.attempts = attempts;
  }
}

export async function runInferenceProviderStage<T>(options: {
  operationId: string;
  recordingId: string;
  stage: "transcription" | "extraction";
  maxRetries: number;
  inputSnapshot: Record<string, unknown>;
  runAttempt: (attemptNumber: number) => Promise<ProviderAttemptOutcome<T>>;
  newUuid?: () => string;
  now?: () => string;
  monotonicNow?: () => number;
  sleep?: (attemptNumber: number) => Promise<void>;
}) {
  const attempts: InferenceAttemptV1[] = [];
  const newUuid = options.newUuid ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date().toISOString());
  const monotonicNow = options.monotonicNow ?? (() => performance.now());
  const sleep = options.sleep ?? (() => Promise.resolve());
  const inputSnapshot = structuredClone(options.inputSnapshot);
  const inputSha256 = await sha256Hex(canonicalJson(inputSnapshot));

  for (let index = 0; index <= options.maxRetries; index += 1) {
    const attemptNumber = index + 1;
    const startedAt = now();
    const startedMs = monotonicNow();
    let outcome: ProviderAttemptOutcome<T>;
    try {
      outcome = await options.runAttempt(attemptNumber);
    } catch {
      outcome = {
        ok: false,
        failure_code: "unknown",
        retryable: index < options.maxRetries,
      };
    }
    const finishedAt = now();
    const latencyMs = Math.max(0, Math.round(monotonicNow() - startedMs));

    if (outcome.ok) {
      const outputSnapshot = snapshotValue(outcome.value);
      attempts.push({
        attempt_id: newUuid(),
        operation_id: options.operationId,
        recording_id: options.recordingId,
        stage: options.stage,
        attempt_number: attemptNumber,
        status: "succeeded",
        safe_failure_code: null,
        input_sha256: inputSha256,
        output_sha256: await sha256Hex(canonicalJson(outputSnapshot)),
        private_input_snapshot: structuredClone(inputSnapshot),
        private_output_snapshot: outputSnapshot,
        latency_ms: latencyMs,
        usage_snapshot: outcome.usage ? structuredClone(outcome.usage) : null,
        cost_microunits: validCost(outcome.cost_microunits),
        started_at: startedAt,
        finished_at: finishedAt,
      });
      return { value: outcome.value, attempts };
    }

    attempts.push({
      attempt_id: newUuid(),
      operation_id: options.operationId,
      recording_id: options.recordingId,
      stage: options.stage,
      attempt_number: attemptNumber,
      status: "failed",
      safe_failure_code: outcome.failure_code,
      input_sha256: inputSha256,
      output_sha256: null,
      private_input_snapshot: structuredClone(inputSnapshot),
      private_output_snapshot: null,
      latency_ms: latencyMs,
      usage_snapshot: null,
      cost_microunits: null,
      started_at: startedAt,
      finished_at: finishedAt,
    });
    if (!outcome.retryable || index === options.maxRetries) {
      throw new ProviderStageError(outcome.failure_code, attempts);
    }
    await sleep(attemptNumber);
  }

  throw new ProviderStageError("unknown", attempts);
}

function snapshotValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return structuredClone(value) as Record<string, unknown>;
  }
  return { value: structuredClone(value) };
}

function validCost(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}
