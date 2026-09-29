import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  purgeCorpusCaseArtifacts,
  removeEvaluationContribution,
  selectRetentionAction,
} from "./evaluation-retention.ts";

Deno.test("only an active current contribution protects retained audio", () => {
  assertEquals(
    selectRetentionAction({
      candidate_reason: "active_current_contribution",
      disclosure_current: true,
      audio_available: true,
    }),
    "protect_evaluation",
  );
  assertEquals(
    selectRetentionAction({
      candidate_reason: "historical_or_no_active_contribution",
      disclosure_current: false,
      audio_available: true,
    }),
    "delete_standard",
  );
  assertEquals(
    selectRetentionAction({
      candidate_reason: "eligibility_ended",
      disclosure_current: true,
      audio_available: true,
    }),
    "delete_eligibility_ended",
  );
});

Deno.test("withdrawal deletes audio and private artifacts before invalidation", async () => {
  const calls: string[] = [];
  const result = await removeEvaluationContribution({
    recording_id: "private-recording-id",
    contribution_id: "00000000-0000-4000-8000-000000000801",
    auth_user_id: "00000000-0000-4000-8000-000000000802",
    idempotency_key: "00000000-0000-4000-8000-000000000803",
    audio: { bucket: "throughline-audio", object_path: "private/audio.m4a" },
    artifact_scope: { materializer_receipt_sha256: "a".repeat(64) },
  }, {
    async deleteAudio() {
      calls.push("storage.delete_audio");
      return { status: "deleted" };
    },
    async deletePrivateRaw() {
      calls.push("artifacts.delete_private_raw");
      return { status: "deleted", deleted_count: 2 };
    },
    async removeAndInvalidate() {
      calls.push("rpc.remove_contribution_and_invalidate");
      return { invalidated_case_count: 1 };
    },
  });
  assertEquals(calls, [
    "storage.delete_audio",
    "artifacts.delete_private_raw",
    "rpc.remove_contribution_and_invalidate",
  ]);
  assertEquals(result, {
    withdrawn: true,
    audio_deleted: true,
    private_artifacts_deleted: 2,
    invalidated_case_count: 1,
  });
  assert(!JSON.stringify(result).includes("private-recording-id"));
  assert(!JSON.stringify(result).includes("private/audio.m4a"));
});

Deno.test("retryable deletion failure preserves eligibility", async () => {
  let rpcCalled = false;
  await assertRejects(
    () =>
      removeEvaluationContribution({
        recording_id: "private-recording-id",
        contribution_id: "00000000-0000-4000-8000-000000000811",
        auth_user_id: "00000000-0000-4000-8000-000000000812",
        idempotency_key: "00000000-0000-4000-8000-000000000813",
        audio: {
          bucket: "throughline-audio",
          object_path: "private/audio.m4a",
        },
        artifact_scope: { materializer_receipt_sha256: "b".repeat(64) },
      }, {
        deleteAudio() {
          throw new Error("storage_unavailable");
        },
        async deletePrivateRaw() {
          return { status: "deleted", deleted_count: 1 };
        },
        async removeAndInvalidate() {
          rpcCalled = true;
          return { invalidated_case_count: 1 };
        },
      }),
    Error,
    "evaluation_withdrawal_retryable",
  );
  assertEquals(rpcCalled, false);
});

Deno.test("404 deletion is idempotent and artifact receipts expose counts only", async () => {
  const receipt = await purgeCorpusCaseArtifacts({
    materializer_receipt_sha256: "c".repeat(64),
  }, {
    async deletePrivateRaw() {
      return { status: "not_found", deleted_count: 0 };
    },
  });
  assertEquals(receipt, {
    deleted: true,
    deleted_count: 0,
    already_absent: true,
  });
  assert(!JSON.stringify(receipt).includes("c".repeat(64)));
});

Deno.test("an unmaterialized contribution withdraws without a private artifact scope", async () => {
  let artifactDeleteCalled = false;
  const result = await removeEvaluationContribution({
    recording_id: "private-recording-id",
    contribution_id: "00000000-0000-4000-8000-000000000821",
    auth_user_id: "00000000-0000-4000-8000-000000000822",
    idempotency_key: "00000000-0000-4000-8000-000000000823",
    audio: { bucket: "throughline-audio", object_path: "private/audio.m4a" },
    artifact_scope: null,
  }, {
    async deleteAudio() {
      return { status: "deleted" };
    },
    async deletePrivateRaw() {
      artifactDeleteCalled = true;
      return { status: "deleted", deleted_count: 1 };
    },
    async removeAndInvalidate() {
      return { invalidated_case_count: 0 };
    },
  });
  assertEquals(artifactDeleteCalled, false);
  assertEquals(result, {
    withdrawn: true,
    audio_deleted: true,
    private_artifacts_deleted: 0,
    invalidated_case_count: 0,
  });
});
