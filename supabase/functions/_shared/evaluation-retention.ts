const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type RetentionCandidate = {
  candidate_reason: string;
  disclosure_current: boolean;
  audio_available: boolean;
};

type ArtifactScope = {
  materializer_receipt_sha256: string;
};

type DeletionResult = {
  status: "deleted" | "not_found";
  deleted_count?: number;
};

type WithdrawalInput = {
  recording_id: string;
  contribution_id: string;
  auth_user_id: string;
  idempotency_key: string;
  audio: { bucket: string; object_path: string };
  artifact_scope: ArtifactScope | null;
};

export function selectRetentionAction(
  candidate: RetentionCandidate,
): "delete_standard" | "protect_evaluation" | "delete_eligibility_ended" {
  if (
    candidate?.candidate_reason === "active_current_contribution" &&
    candidate.disclosure_current === true &&
    candidate.audio_available === true
  ) return "protect_evaluation";
  if (candidate?.candidate_reason === "eligibility_ended") {
    return "delete_eligibility_ended";
  }
  return "delete_standard";
}

export async function purgeCorpusCaseArtifacts(
  scope: ArtifactScope | null,
  deps: { deletePrivateRaw(scope: ArtifactScope): Promise<DeletionResult> },
) {
  if (scope === null) {
    return Object.freeze({
      deleted: true,
      deleted_count: 0,
      already_absent: true,
    });
  }
  if (
    !scope ||
    !HASH_PATTERN.test(scope.materializer_receipt_sha256 ?? "")
  ) throw new Error("artifact_scope_invalid");
  const result = await deps.deletePrivateRaw(structuredClone(scope));
  if (
    !result ||
    !["deleted", "not_found"].includes(result.status) ||
    !Number.isInteger(result.deleted_count ?? 0) ||
    (result.deleted_count ?? 0) < 0
  ) throw new Error("artifact_deletion_receipt_invalid");
  return Object.freeze({
    deleted: true,
    deleted_count: result.deleted_count ?? 0,
    already_absent: result.status === "not_found",
  });
}

export async function removeEvaluationContribution(
  input: WithdrawalInput,
  deps: {
    deleteAudio(input: WithdrawalInput): Promise<DeletionResult>;
    deletePrivateRaw(scope: ArtifactScope): Promise<DeletionResult>;
    removeAndInvalidate(payload: Record<string, unknown>): Promise<{
      invalidated_case_count: number;
    }>;
  },
) {
  validateWithdrawalInput(input);
  try {
    const audioResult = await deps.deleteAudio(structuredClone(input));
    if (
      !audioResult || !["deleted", "not_found"].includes(audioResult.status)
    ) {
      throw new Error("audio_deletion_receipt_invalid");
    }
    const artifactReceipt = await purgeCorpusCaseArtifacts(
      input.artifact_scope,
      { deletePrivateRaw: deps.deletePrivateRaw },
    );
    const removed = await deps.removeAndInvalidate({
      recording_id: input.recording_id,
      contribution_id: input.contribution_id,
      auth_user_id: input.auth_user_id,
      idempotency_key: input.idempotency_key,
      source_audio_deleted: true,
      raw_artifacts_deleted: true,
      raw_artifacts_deleted_count: artifactReceipt.deleted_count,
    });
    if (
      !removed ||
      !Number.isInteger(removed.invalidated_case_count) ||
      removed.invalidated_case_count < 0
    ) throw new Error("withdrawal_receipt_invalid");
    return Object.freeze({
      withdrawn: true,
      audio_deleted: true,
      private_artifacts_deleted: artifactReceipt.deleted_count,
      invalidated_case_count: removed.invalidated_case_count,
    });
  } catch {
    throw new Error("evaluation_withdrawal_retryable");
  }
}

function validateWithdrawalInput(input: WithdrawalInput) {
  if (
    !input ||
    typeof input.recording_id !== "string" ||
    !input.recording_id ||
    !UUID_PATTERN.test(input.contribution_id ?? "") ||
    !UUID_PATTERN.test(input.auth_user_id ?? "") ||
    !UUID_PATTERN.test(input.idempotency_key ?? "") ||
    typeof input.audio?.bucket !== "string" ||
    !input.audio.bucket ||
    typeof input.audio?.object_path !== "string" ||
    !input.audio.object_path ||
    input.artifact_scope !== null &&
      !HASH_PATTERN.test(
        input.artifact_scope?.materializer_receipt_sha256 ?? "",
      )
  ) throw new Error("evaluation_withdrawal_invalid");
}
