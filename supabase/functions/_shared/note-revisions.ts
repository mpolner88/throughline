import { canonicalJson, sha256Hex } from "../../../core/inference-contract.mjs";
import {
  PRIVATE_EVALUATION_DISCLOSURE_VERSION,
  PRIVATE_EVALUATION_NOTICE_VERSION,
  PRIVATE_EVALUATION_POLICY_VERSION,
} from "./evaluation-contract.ts";

export const EDITABLE_CORRECTION_FIELDS = Object.freeze(
  [
    "title",
    "summary",
    "most_important",
    "todos",
  ] as const,
);

type EditableCorrectionField = typeof EDITABLE_CORRECTION_FIELDS[number];
type MutationKind = "user_content_correction" | "action_state";

type CurrentRevision = {
  revision_id: string;
  processing_operation_id: string;
  canonical_snapshot: Record<string, unknown>;
  production_schema_sha256: string;
  production_normalizer_sha256: string;
  canonical_keyset_sha256: string;
};

export type UserMutationCommitV1 = {
  recording_id: string;
  auth_user_id: string;
  idempotency_key: string;
  expected_current_revision_id: string;
  transcript_after: string;
  material_change: boolean;
  eligibility_source: "content_correction" | null;
  revision: {
    revision_id: string;
    recording_id: string;
    processing_operation_id: string;
    base_revision_id: string;
    revision_kind: MutationKind;
    canonical_snapshot: Record<string, unknown>;
    canonical_output_sha256: string;
    production_schema_sha256: string;
    production_normalizer_sha256: string;
    canonical_keyset_sha256: string;
    editable_correction_mask: EditableCorrectionField[];
    transcript_explicitly_corrected: boolean;
    created_at: string;
  } | null;
  contribution: {
    contribution_id: string;
    recording_id: string;
    auth_user_id: string;
    note_revision_id: string;
    idempotency_key: string;
    event_kind: "created";
    eligibility_source: "content_correction";
    notice_version: typeof PRIVATE_EVALUATION_NOTICE_VERSION;
    disclosure_version: typeof PRIVATE_EVALUATION_DISCLOSURE_VERSION;
    policy_version: typeof PRIVATE_EVALUATION_POLICY_VERSION;
    created_at: string;
  } | null;
};

export async function canonicalContentFingerprint(
  canonicalSnapshot: Record<string, unknown>,
  transcript: string,
) {
  const editable = Object.fromEntries(
    EDITABLE_CORRECTION_FIELDS.map((field) => [
      field,
      structuredClone(canonicalSnapshot[field]),
    ]),
  );
  return {
    editable_sha256: await sha256Hex(canonicalJson(editable)),
    transcript_sha256: await sha256Hex(transcript),
  };
}

export async function buildUserMutationCommit(input: {
  recording_id: string;
  auth_user_id: string;
  idempotency_key: string;
  revision_id: string;
  contribution_id?: string;
  current_revision: CurrentRevision;
  changes: Record<string, unknown>;
  transcript_before: string;
  transcript_after: string;
  mutation_kind?: MutationKind;
  notice_version: string;
  disclosure_version: string;
  policy_version: string;
  created_at: string;
}): Promise<UserMutationCommitV1> {
  const kind = input.mutation_kind ?? "user_content_correction";
  assertCurrentVersions(input);
  if (
    !input.changes || typeof input.changes !== "object" ||
    Array.isArray(input.changes)
  ) {
    throw new Error("user_mutation_changes_invalid");
  }

  const before = structuredClone(input.current_revision.canonical_snapshot);
  const after = structuredClone(before);
  for (const field of EDITABLE_CORRECTION_FIELDS) {
    if (Object.hasOwn(input.changes, field)) {
      after[field] = normalizeEditableValue(field, input.changes[field]);
    }
  }

  const editableMask = EDITABLE_CORRECTION_FIELDS.filter((field) =>
    canonicalJson(before[field]) !== canonicalJson(after[field])
  );
  const transcriptBefore = normalizeTranscript(input.transcript_before);
  const transcriptAfter = normalizeTranscript(input.transcript_after);
  const transcriptCorrected = transcriptBefore !== transcriptAfter;
  const materialChange = editableMask.length > 0 || transcriptCorrected;

  if (!materialChange) {
    return {
      recording_id: input.recording_id,
      auth_user_id: input.auth_user_id,
      idempotency_key: input.idempotency_key,
      expected_current_revision_id: input.current_revision.revision_id,
      transcript_after: transcriptAfter,
      material_change: false,
      eligibility_source: null,
      revision: null,
      contribution: null,
    };
  }

  const revision = {
    revision_id: input.revision_id,
    recording_id: input.recording_id,
    processing_operation_id: input.current_revision.processing_operation_id,
    base_revision_id: input.current_revision.revision_id,
    revision_kind: kind,
    canonical_snapshot: after,
    canonical_output_sha256: await sha256Hex(canonicalJson(after)),
    production_schema_sha256: input.current_revision.production_schema_sha256,
    production_normalizer_sha256:
      input.current_revision.production_normalizer_sha256,
    canonical_keyset_sha256: input.current_revision.canonical_keyset_sha256,
    editable_correction_mask: kind === "user_content_correction"
      ? editableMask
      : [],
    transcript_explicitly_corrected: kind === "user_content_correction" &&
      transcriptCorrected,
    created_at: input.created_at,
  };
  const eligible = kind === "user_content_correction";
  return {
    recording_id: input.recording_id,
    auth_user_id: input.auth_user_id,
    idempotency_key: input.idempotency_key,
    expected_current_revision_id: input.current_revision.revision_id,
    transcript_after: transcriptAfter,
    material_change: true,
    eligibility_source: eligible ? "content_correction" : null,
    revision,
    contribution: eligible
      ? {
        contribution_id: input.contribution_id ?? crypto.randomUUID(),
        recording_id: input.recording_id,
        auth_user_id: input.auth_user_id,
        note_revision_id: input.revision_id,
        idempotency_key: input.idempotency_key,
        event_kind: "created",
        eligibility_source: "content_correction",
        notice_version: PRIVATE_EVALUATION_NOTICE_VERSION,
        disclosure_version: PRIVATE_EVALUATION_DISCLOSURE_VERSION,
        policy_version: PRIVATE_EVALUATION_POLICY_VERSION,
        created_at: input.created_at,
      }
      : null,
  };
}

function assertCurrentVersions(input: {
  notice_version: string;
  disclosure_version: string;
  policy_version: string;
}) {
  if (input.notice_version !== PRIVATE_EVALUATION_NOTICE_VERSION) {
    throw new Error("user_mutation_notice_version_invalid");
  }
  if (input.disclosure_version !== PRIVATE_EVALUATION_DISCLOSURE_VERSION) {
    throw new Error("user_mutation_disclosure_version_invalid");
  }
  if (input.policy_version !== PRIVATE_EVALUATION_POLICY_VERSION) {
    throw new Error("user_mutation_policy_version_invalid");
  }
}

function normalizeEditableValue(
  field: EditableCorrectionField,
  value: unknown,
) {
  if (field === "title" || field === "summary") {
    if (typeof value !== "string") {
      throw new Error(`${field}_correction_invalid`);
    }
    const text = value.trim();
    if (!text || (field === "title" && text.length > 80)) {
      throw new Error(`${field}_correction_invalid`);
    }
    return text;
  }
  if (!Array.isArray(value)) throw new Error(`${field}_correction_invalid`);
  return structuredClone(value);
}

function normalizeTranscript(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("transcript_correction_invalid");
  }
  return value.trim();
}
