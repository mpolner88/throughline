const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

export type ProcessingOperationV1 = {
  operation_id: string;
  recording_id: string;
  inference_contract_id: string;
  status: "started" | "succeeded" | "failed";
  safe_failure_code: string | null;
  started_at: string;
  finished_at: string | null;
};

export type CorpusRevalidationReceiptV1 = {
  receipt_version: "throughline-corpus-revalidation-receipt-v1";
  materializer_receipt_sha256: string;
  prediction_bundle_sha256: string;
  active_content_set_sha256: string;
  active_label_contract_set_sha256: string;
  production_schema_sha256: string;
  production_normalizer_sha256: string;
  canonical_keyset_sha256: string;
  active_case_count: number;
  active_accepted_full_output_case_count: number;
  revalidated_at: string;
  receipt_sha256: string;
};

export function assertProcessingCommitPayload(value: unknown) {
  const payload = objectValue(value, "processing_commit_invalid");
  const operation = objectValue(
    payload.operation,
    "processing_operation_required",
  );
  assertUuid(operation.operation_id, "processing_operation_id_invalid");
  assertNonemptyString(
    operation.recording_id,
    "processing_recording_id_invalid",
  );
  assertUuid(operation.inference_contract_id, "inference_contract_id_invalid");
  if (
    !["started", "succeeded", "failed"].includes(String(operation.status))
  ) {
    throw new Error("processing_status_invalid");
  }
  assertNullableSafeCode(operation.safe_failure_code);
  assertTimestamp(operation.started_at, "processing_started_at_invalid");
  if (operation.finished_at !== null) {
    assertTimestamp(operation.finished_at, "processing_finished_at_invalid");
  }
  if (!Array.isArray(payload.attempts)) {
    throw new Error("processing_attempts_invalid");
  }
  for (const attemptValue of payload.attempts) {
    const attempt = objectValue(attemptValue, "inference_attempt_invalid");
    assertUuid(attempt.attempt_id, "inference_attempt_id_invalid");
    if (attempt.operation_id !== operation.operation_id) {
      throw new Error("inference_attempt_operation_mismatch");
    }
    if (!["transcription", "extraction"].includes(String(attempt.stage))) {
      throw new Error("inference_attempt_stage_invalid");
    }
  }
  return structuredClone(payload);
}

export function assertEvaluationCommitPayload(value: unknown) {
  const payload = objectValue(value, "evaluation_commit_invalid");
  assertUuid(payload.evaluation_id, "evaluation_id_invalid");
  assertNonemptyString(payload.recording_id, "evaluation_recording_id_invalid");
  assertUuid(
    payload.processing_operation_id,
    "evaluation_operation_id_invalid",
  );
  assertUuid(payload.note_revision_id, "evaluation_revision_id_invalid");
  if (payload.evaluator_kind !== "recording_user") {
    throw new Error("evaluation_evaluator_invalid");
  }
  objectValue(payload.contribution, "evaluation_contribution_invalid");
  return structuredClone(payload);
}

export function assertCorpusRevalidationReceipt(
  value: unknown,
): CorpusRevalidationReceiptV1 {
  const receipt = objectValue(value, "corpus_revalidation_receipt_invalid");
  if (
    receipt.receipt_version !==
      "throughline-corpus-revalidation-receipt-v1"
  ) {
    throw new Error("corpus_revalidation_receipt_invalid");
  }
  for (
    const key of [
      "materializer_receipt_sha256",
      "prediction_bundle_sha256",
      "active_content_set_sha256",
      "active_label_contract_set_sha256",
      "production_schema_sha256",
      "production_normalizer_sha256",
      "canonical_keyset_sha256",
      "receipt_sha256",
    ]
  ) {
    assertHash(receipt[key], `corpus_${key}_invalid`);
  }
  if (
    !Number.isInteger(receipt.active_case_count) ||
    Number(receipt.active_case_count) < 0 ||
    !Number.isInteger(receipt.active_accepted_full_output_case_count) ||
    Number(receipt.active_accepted_full_output_case_count) < 0 ||
    Number(receipt.active_accepted_full_output_case_count) >
      Number(receipt.active_case_count)
  ) throw new Error("corpus_active_case_count_invalid");
  assertTimestamp(receipt.revalidated_at, "corpus_revalidated_at_invalid");
  return structuredClone(receipt) as CorpusRevalidationReceiptV1;
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as Record<string, unknown>;
}

function assertUuid(value: unknown, code: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(code);
  }
}

function assertHash(value: unknown, code: string) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(code);
  }
}

function assertNonemptyString(value: unknown, code: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
}

function assertTimestamp(value: unknown, code: string) {
  if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) {
    throw new Error(code);
  }
}

function assertNullableSafeCode(value: unknown) {
  if (value === null) return;
  if (typeof value !== "string" || !/^[a-z0-9_]{1,80}$/u.test(value)) {
    throw new Error("safe_failure_code_invalid");
  }
}
