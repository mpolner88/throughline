import {
  canonicalExtractionFields,
  canonicalJson,
  sha256Hex,
  validateCanonicalExtractionSnapshot,
} from "../../../core/inference-contract.mjs";

type ResolvedContract = Awaited<
  ReturnType<
    typeof import("../../../core/inference-contract.mjs").resolveInferenceContract
  >
>;

export const PRIVATE_EVALUATION_NOTICE_VERSION =
  "private_evaluation_notice_v1" as const;
export const PRIVATE_EVALUATION_DISCLOSURE_VERSION =
  "private_evaluation_disclosure_v1" as const;
export const PRIVATE_EVALUATION_POLICY_VERSION =
  "private_evaluation_policy_v1" as const;
export const AGENT_READINESS_PREVIEW_VERSION =
  "throughline-agent-readiness-preview-v1" as const;

export const EVALUATION_ISSUE_CODES = Object.freeze(
  [
    "missed_action",
    "unsupported_action",
    "wrong_importance",
    "meaning_changed",
    "weak_summary",
    "transcription_error",
    "schema_invalid",
    "other_structured",
  ] as const,
);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;

export type EvaluationRequestV1 = {
  evaluation_id: string;
  evaluated_revision_id: string;
  idempotency_key: string;
  rubric_version: string;
  notice_version: typeof PRIVATE_EVALUATION_NOTICE_VERSION;
  disclosure_version: typeof PRIVATE_EVALUATION_DISCLOSURE_VERSION;
  policy_version: typeof PRIVATE_EVALUATION_POLICY_VERSION;
  score: number;
  issue_codes: string[];
  agent_ready: boolean;
  agent_readiness_preview: AgentReadinessPreviewV1 | null;
  explanation: string | null;
};

export type AgentReadinessPreviewV1 = {
  preview_version: typeof AGENT_READINESS_PREVIEW_VERSION;
  revision_id: string;
  canonical_fields: Array<{ field: string; value: unknown }>;
  canonical_payload_sha256: string;
  production_schema_sha256: string;
  production_normalizer_sha256: string;
  canonical_keyset_sha256: string;
  preview_sha256: string;
};

export type NoteRevisionForPreview = {
  revision_id: string;
  canonical_snapshot: Record<string, unknown>;
  canonical_output_sha256: string;
  production_schema_sha256: string;
  production_normalizer_sha256: string;
  canonical_keyset_sha256: string;
};

export function normalizeEvaluationRequest(
  value: unknown,
): EvaluationRequestV1 {
  const input = objectValue(value, "evaluation_request_invalid");
  assertUuid(input.evaluation_id, "evaluation_id_invalid");
  assertUuid(input.evaluated_revision_id, "evaluated_revision_id_invalid");
  assertUuid(input.idempotency_key, "evaluation_idempotency_key_invalid");

  const score = Number(input.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error("evaluation_score_invalid");
  }
  if (!Array.isArray(input.issue_codes) || input.issue_codes.length > 8) {
    throw new Error("evaluation_issue_codes_invalid");
  }
  const allowed = new Set<string>(EVALUATION_ISSUE_CODES);
  const issueCodes: string[] = [];
  for (const rawCode of input.issue_codes) {
    if (typeof rawCode !== "string" || !allowed.has(rawCode)) {
      throw new Error("evaluation_issue_code_invalid");
    }
    if (!issueCodes.includes(rawCode)) issueCodes.push(rawCode);
  }

  if (input.notice_version !== PRIVATE_EVALUATION_NOTICE_VERSION) {
    throw new Error("evaluation_notice_version_invalid");
  }
  if (input.disclosure_version !== PRIVATE_EVALUATION_DISCLOSURE_VERSION) {
    throw new Error("evaluation_disclosure_version_invalid");
  }
  if (input.policy_version !== PRIVATE_EVALUATION_POLICY_VERSION) {
    throw new Error("evaluation_policy_version_invalid");
  }

  const agentReady = input.agent_ready === true;
  const preview = input.agent_readiness_preview;
  if (
    agentReady &&
    (!preview || typeof preview !== "object" || Array.isArray(preview))
  ) {
    throw new Error("agent_readiness_preview_required");
  }
  if (!agentReady && preview != null) {
    throw new Error("agent_readiness_preview_without_acceptance");
  }

  return {
    evaluation_id: String(input.evaluation_id).toLowerCase(),
    evaluated_revision_id: String(input.evaluated_revision_id).toLowerCase(),
    idempotency_key: String(input.idempotency_key).toLowerCase(),
    rubric_version: normalizeVersion(
      input.rubric_version,
      "throughline_extraction_quality_v1",
      "evaluation_rubric_version_invalid",
    ),
    notice_version: PRIVATE_EVALUATION_NOTICE_VERSION,
    disclosure_version: PRIVATE_EVALUATION_DISCLOSURE_VERSION,
    policy_version: PRIVATE_EVALUATION_POLICY_VERSION,
    score,
    issue_codes: issueCodes,
    agent_ready: agentReady,
    agent_readiness_preview: agentReady
      ? structuredClone(preview) as AgentReadinessPreviewV1
      : null,
    explanation: normalizeExplanation(input.explanation),
  };
}

export async function buildAgentReadinessPreview(
  revision: NoteRevisionForPreview,
  contract: ResolvedContract,
): Promise<AgentReadinessPreviewV1> {
  assertUuid(revision.revision_id, "evaluation_revision_id_invalid");
  const canonical = validateCanonicalExtractionSnapshot(
    revision.canonical_snapshot,
    contract,
  ) as Record<string, unknown>;
  const canonicalPayloadSha256 = await sha256Hex(canonicalJson(canonical));
  if (
    revision.canonical_output_sha256 !== canonicalPayloadSha256 ||
    revision.production_schema_sha256 !== contract.schema.sha256 ||
    revision.production_normalizer_sha256 !== contract.normalizer.sha256 ||
    revision.canonical_keyset_sha256 !== contract.schema.keyset_sha256
  ) throw new Error("agent_readiness_revision_contract_invalid");

  const canonicalFields = canonicalExtractionFields(contract).map((field) => ({
    field,
    value: structuredClone(canonical[field]),
  }));
  const unsigned = {
    preview_version: AGENT_READINESS_PREVIEW_VERSION,
    revision_id: revision.revision_id.toLowerCase(),
    canonical_fields: canonicalFields,
    canonical_payload_sha256: canonicalPayloadSha256,
    production_schema_sha256: contract.schema.sha256,
    production_normalizer_sha256: contract.normalizer.sha256,
    canonical_keyset_sha256: contract.schema.keyset_sha256,
  };
  return {
    ...unsigned,
    preview_sha256: await sha256Hex(canonicalJson(unsigned)),
  };
}

export async function validateAgentReadinessBinding(
  request: EvaluationRequestV1,
  revision: NoteRevisionForPreview,
  contract: ResolvedContract,
): Promise<AgentReadinessPreviewV1> {
  if (!request.agent_ready || !request.agent_readiness_preview) {
    throw new Error("agent_readiness_preview_required");
  }
  if (request.evaluated_revision_id !== revision.revision_id.toLowerCase()) {
    throw new Error("agent_readiness_preview_stale");
  }
  const current = await buildAgentReadinessPreview(revision, contract);
  if (
    canonicalJson(request.agent_readiness_preview) !== canonicalJson(current) ||
    !HASH_PATTERN.test(request.agent_readiness_preview.preview_sha256)
  ) throw new Error("agent_readiness_preview_stale");
  return current;
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

function normalizeVersion(value: unknown, fallback: string, code: string) {
  const version = typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
  if (!/^[a-z0-9_]{1,80}$/u.test(version)) throw new Error(code);
  return version;
}

function normalizeExplanation(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("evaluation_explanation_invalid");
  }
  const text = value.trim();
  if (!text || text.length > 2000) {
    throw new Error("evaluation_explanation_invalid");
  }
  return text;
}
