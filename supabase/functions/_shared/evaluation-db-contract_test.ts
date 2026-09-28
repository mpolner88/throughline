import {
  assertCorpusRevalidationReceipt,
  assertEvaluationCommitPayload,
  assertProcessingCommitPayload,
  type ProcessingOperationV1,
} from "./evaluation-db-contract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("processing operation contract requires immutable lineage identifiers", () => {
  const operation: ProcessingOperationV1 = {
    operation_id: "00000000-0000-4000-8000-000000000101",
    recording_id: "rec_test",
    inference_contract_id: "00000000-0000-4000-8000-000000000104",
    status: "succeeded",
    safe_failure_code: null,
    started_at: "2026-08-22T00:00:00.000Z",
    finished_at: "2026-08-22T00:00:01.000Z",
  };
  assertProcessingCommitPayload({ operation, attempts: [], revision: null });
});

Deno.test("processing payload rejects missing operation lineage", () => {
  let rejected = false;
  try {
    assertProcessingCommitPayload({ attempts: [], revision: null });
  } catch {
    rejected = true;
  }
  assert(rejected, "Missing processing operation must fail closed");
});

Deno.test("evaluation payload requires explicit operation and revision", () => {
  assertEvaluationCommitPayload({
    evaluation_id: "00000000-0000-4000-8000-000000000102",
    recording_id: "rec_test",
    processing_operation_id: "00000000-0000-4000-8000-000000000101",
    note_revision_id: "00000000-0000-4000-8000-000000000103",
    evaluator_kind: "recording_user",
    contribution: { opted_in: false },
  });
});

Deno.test("corpus revalidation receipt binds the prediction seal and active cases", () => {
  const receipt = assertCorpusRevalidationReceipt({
    receipt_version: "throughline-corpus-revalidation-receipt-v1",
    materializer_receipt_sha256: "a".repeat(64),
    prediction_bundle_sha256: "b".repeat(64),
    active_content_set_sha256: "c".repeat(64),
    active_label_contract_set_sha256: "d".repeat(64),
    production_schema_sha256: "e".repeat(64),
    production_normalizer_sha256: "f".repeat(64),
    canonical_keyset_sha256: "1".repeat(64),
    active_case_count: 1,
    active_accepted_full_output_case_count: 1,
    revalidated_at: "2026-08-22T00:00:02.000Z",
    receipt_sha256: "2".repeat(64),
  });
  assert(receipt.active_case_count === 1, "Expected active case binding");
});
