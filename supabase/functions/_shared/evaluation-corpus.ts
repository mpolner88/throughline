import {
  canonicalJson,
  sha256Hex,
  validateCanonicalExtractionSnapshot,
} from "../../../core/inference-contract.mjs";
import {
  PRIVATE_EVALUATION_DISCLOSURE_VERSION,
  PRIVATE_EVALUATION_POLICY_VERSION,
} from "./evaluation-contract.ts";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const EDITABLE_FIELDS = new Set([
  "title",
  "summary",
  "most_important",
  "todos",
]);
const MATERIALIZE_KEYS = new Set(["policyVersion", "privateRoot"]);
const REVALIDATE_KEYS = new Set([
  "materializerReceiptSha256",
  "predictionBundleSha256",
]);

type ResolvedContract = Awaited<
  ReturnType<
    typeof import("../../../core/inference-contract.mjs").resolveInferenceContract
  >
>;

type Candidate = Record<string, any>;

type CorpusDeps = {
  contract: ResolvedContract;
  requireService(): void;
  fetchActiveCandidates(policyVersion: string): Promise<Candidate[]>;
  stageCase(
    candidate: Candidate,
    identity: { case_key: string; stable_split: string; private_root: string },
  ): Promise<Record<string, any>>;
  beforePersistMaterialization?: (
    value: Record<string, unknown>,
  ) => Promise<void>;
  persistMaterialization(value: Record<string, unknown>): Promise<unknown>;
  fetchActiveReceipt(
    materializerReceiptSha256: string,
    predictionBundleSha256: string,
  ): Promise<Record<string, any> | null>;
  persistRevalidation?: (value: Record<string, unknown>) => Promise<unknown>;
  now?: () => string;
  newUuid?: () => string;
};

export async function materializeActiveEvaluationCorpus(
  input: { policyVersion: string; privateRoot: string },
  deps: CorpusDeps,
) {
  deps.requireService();
  assertExactKeys(input, MATERIALIZE_KEYS, "corpus_request_field_forbidden");
  if (input.policyVersion !== PRIVATE_EVALUATION_POLICY_VERSION) {
    throw new Error("corpus_policy_version_invalid");
  }
  if (typeof input.privateRoot !== "string" || !input.privateRoot.trim()) {
    throw new Error("corpus_private_root_invalid");
  }

  const candidates = await deps.fetchActiveCandidates(input.policyVersion);
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("corpus_no_active_cases");
  }

  const cases = [];
  const persistenceCases = [];
  for (const candidate of candidates) {
    validateCandidateBase(candidate, deps.contract, input.policyVersion);
    const caseKey = await caseKeyFor(candidate.contribution_id);
    const split = candidate.stable_split ?? await stableSplitFor(
      candidate.contribution_id,
    );
    if (!["development", "sealed_holdout"].includes(split)) {
      throw new Error("corpus_stable_split_invalid");
    }
    const label = deriveLabel(candidate, deps.contract);
    const staged = await deps.stageCase(candidate, {
      case_key: caseKey,
      stable_split: split,
      private_root: input.privateRoot,
    });
    validateStagedArtifacts(staged, label);
    const manifestCase = buildManifestCase(
      caseKey,
      split,
      candidate,
      label,
      staged,
    );
    cases.push(manifestCase);
    persistenceCases.push({
      contribution_id: candidate.contribution_id,
      case_key: caseKey,
      stable_split: split,
      label_kind: label.kind,
      label_completeness: label.completeness,
      editable_correction_mask: label.editable_correction_mask,
      transcript_explicitly_corrected: label.transcript_explicitly_corrected,
      readiness_preview_sha256: candidate.readiness_preview_sha256 ?? null,
      canonical_output_sha256: label.kind === "accepted_full_output"
        ? candidate.canonical_output_sha256
        : null,
      audio_sha256: candidate.audio_sha256,
      reviewed_fields_sha256: staged.reviewed_fields?.sha256 ?? null,
      transcript_sha256: staged.transcript?.sha256 ?? null,
      label_provenance_sha256: await labelProvenanceHash(label, candidate),
    });
  }

  cases.sort((left, right) => left.id.localeCompare(right.id));
  persistenceCases.sort((left, right) =>
    left.case_key.localeCompare(right.case_key)
  );
  const stableSplitSha256 = await sha256Hex(canonicalJson(
    cases.map((item) => ({ id: item.id, split: item.split })),
  ));
  const contentSetSha256 = await sha256Hex(canonicalJson(
    cases.map((item) => ({
      id: item.id,
      audio_sha256: item.audio.sha256,
      reviewed_fields_sha256: item.label.reviewed_fields_artifact?.sha256 ??
        null,
      canonical_output_sha256: item.label.canonical_output_artifact?.sha256 ??
        null,
      transcript_sha256: item.label.transcript_artifact?.sha256 ?? null,
    })),
  ));
  const labelContractSetSha256 = await sha256Hex(canonicalJson(
    cases.map((item) => ({
      id: item.id,
      kind: item.label.kind,
      completeness: item.label.completeness,
      editable_correction_mask: item.label.editable_correction_mask,
      transcript_explicitly_corrected:
        item.label.transcript_explicitly_corrected,
      readiness_preview_sha256: item.label.inspected_preview?.preview_sha256 ??
        null,
      canonical_output_sha256: item.label.canonical_output_artifact?.sha256 ??
        null,
    })),
  ));
  const now = deps.now ?? (() => new Date().toISOString());
  const newUuid = deps.newUuid ?? (() => crypto.randomUUID());
  const materializedAt = now();
  const unsignedReceipt = {
    receipt_version: "throughline-corpus-materializer-receipt-v1" as const,
    corpus_id: newUuid(),
    policy_version: input.policyVersion,
    disclosure_version: PRIVATE_EVALUATION_DISCLOSURE_VERSION,
    stable_split_sha256: stableSplitSha256,
    content_set_sha256: contentSetSha256,
    label_contract_set_sha256: labelContractSetSha256,
    production_schema_sha256: deps.contract.schema.sha256,
    production_normalizer_sha256: deps.contract.normalizer.sha256,
    canonical_keyset_sha256: deps.contract.schema.keyset_sha256,
    case_count: cases.length,
    diagnostic_case_count:
      cases.filter((item) => item.label.kind === "diagnostic_grade").length,
    reviewed_field_case_count:
      cases.filter((item) => item.label.kind === "reviewed_fields").length,
    accepted_full_output_case_count:
      cases.filter((item) => item.label.kind === "accepted_full_output").length,
    materialized_at: materializedAt,
  };
  const receipt = {
    ...unsignedReceipt,
    receipt_sha256: await sha256Hex(canonicalJson(unsignedReceipt)),
  };
  const manifest = {
    manifest_version: "throughline-private-audio-manifest-v1",
    purpose: "real_private_quality",
    created_at: materializedAt,
    disclosure_version: PRIVATE_EVALUATION_DISCLOSURE_VERSION,
    policy_version: input.policyVersion,
    split_hash: stableSplitSha256,
    content_set_hash: contentSetSha256,
    label_contract_set_hash: labelContractSetSha256,
    inference_contract: {
      contract_sha256: deps.contract.contract_sha256,
      schema_sha256: deps.contract.schema.sha256,
      normalizer_sha256: deps.contract.normalizer.sha256,
      keyset_sha256: deps.contract.schema.keyset_sha256,
    },
    materializer_receipt: { receipt_sha256: receipt.receipt_sha256 },
    cases,
  };

  const materialization = {
    receipt,
    cases: persistenceCases,
    manifest,
  };
  await deps.beforePersistMaterialization?.(materialization);
  await deps.persistMaterialization({ receipt, cases: persistenceCases });
  return deepFreeze({ receipt, manifest });
}

export async function revalidateSealedCorpus(
  input: {
    materializerReceiptSha256: string;
    predictionBundleSha256: string;
  },
  deps: CorpusDeps,
) {
  deps.requireService();
  assertExactKeys(input, REVALIDATE_KEYS, "corpus_request_field_forbidden");
  assertHash(
    input.materializerReceiptSha256,
    "materializer_receipt_sha256_invalid",
  );
  assertHash(input.predictionBundleSha256, "prediction_bundle_sha256_invalid");
  const active = await deps.fetchActiveReceipt(
    input.materializerReceiptSha256,
    input.predictionBundleSha256,
  );
  if (!active?.valid) {
    throw new Error(active?.reason_code || "stale_or_revoked_case");
  }
  for (
    const [actual, expected] of [
      [active.production_schema_sha256, deps.contract.schema.sha256],
      [active.production_normalizer_sha256, deps.contract.normalizer.sha256],
      [active.canonical_keyset_sha256, deps.contract.schema.keyset_sha256],
    ]
  ) {
    if (actual !== expected) throw new Error("stale_or_revoked_case");
  }
  assertHash(
    active.active_content_set_sha256,
    "active_content_set_sha256_invalid",
  );
  assertHash(
    active.active_label_contract_set_sha256,
    "active_label_contract_set_sha256_invalid",
  );
  if (
    !Number.isInteger(active.active_case_count) ||
    active.active_case_count < 1 ||
    !Number.isInteger(active.active_accepted_full_output_case_count) ||
    active.active_accepted_full_output_case_count < 0 ||
    active.active_accepted_full_output_case_count > active.active_case_count
  ) throw new Error("corpus_active_case_count_invalid");

  const now = deps.now ?? (() => new Date().toISOString());
  const unsigned = {
    receipt_version: "throughline-corpus-revalidation-receipt-v1" as const,
    materializer_receipt_sha256: input.materializerReceiptSha256,
    prediction_bundle_sha256: input.predictionBundleSha256,
    active_content_set_sha256: active.active_content_set_sha256,
    active_label_contract_set_sha256: active.active_label_contract_set_sha256,
    production_schema_sha256: active.production_schema_sha256,
    production_normalizer_sha256: active.production_normalizer_sha256,
    canonical_keyset_sha256: active.canonical_keyset_sha256,
    active_case_count: active.active_case_count,
    active_accepted_full_output_case_count:
      active.active_accepted_full_output_case_count,
    revalidated_at: now(),
  };
  const receipt = {
    ...unsigned,
    receipt_sha256: await sha256Hex(canonicalJson(unsigned)),
  };
  await deps.persistRevalidation?.({ receipt });
  return deepFreeze(receipt);
}

function deriveLabel(candidate: Candidate, contract: ResolvedContract) {
  const mask = normalizeMask(candidate.editable_correction_mask);
  const transcriptCorrected =
    candidate.transcript_explicitly_corrected === true;
  if (candidate.eligibility_source === "content_correction") {
    if (!mask.length && !transcriptCorrected) {
      throw new Error("reviewed_fields_label_invalid");
    }
    return {
      kind: "reviewed_fields",
      completeness: "reviewed_fields_only",
      editable_correction_mask: mask,
      transcript_explicitly_corrected: transcriptCorrected,
    };
  }
  if (candidate.eligibility_source !== "explicit_grade") {
    throw new Error("corpus_eligibility_source_invalid");
  }
  if (candidate.agent_ready !== true) {
    return {
      kind: "diagnostic_grade",
      completeness: "diagnostic_only",
      editable_correction_mask: [],
      transcript_explicitly_corrected: false,
    };
  }
  if (
    !HASH_PATTERN.test(candidate.readiness_preview_sha256 ?? "") ||
    candidate.production_schema_sha256 !== contract.schema.sha256 ||
    candidate.production_normalizer_sha256 !== contract.normalizer.sha256 ||
    candidate.canonical_keyset_sha256 !== contract.schema.keyset_sha256
  ) throw new Error("accepted_full_output_contract_invalid");
  try {
    validateCanonicalExtractionSnapshot(candidate.canonical_snapshot, contract);
  } catch {
    throw new Error("accepted_full_output_contract_invalid");
  }
  return {
    kind: "accepted_full_output",
    completeness: "complete_structured_output",
    editable_correction_mask: [],
    transcript_explicitly_corrected: false,
  };
}

function buildManifestCase(
  caseKey: string,
  split: string,
  candidate: Candidate,
  label: Record<string, any>,
  staged: Record<string, any>,
) {
  return {
    id: caseKey,
    split,
    active: true,
    audio: staged.audio,
    label: {
      kind: label.kind,
      completeness: label.completeness,
      editable_correction_mask: label.editable_correction_mask,
      transcript_explicitly_corrected: label.transcript_explicitly_corrected,
      agent_ready: label.kind === "accepted_full_output",
      exact_revision_id: label.kind === "accepted_full_output"
        ? candidate.revision_id
        : null,
      inspected_preview: label.kind === "accepted_full_output"
        ? {
          revision_id: candidate.revision_id,
          preview_sha256: candidate.readiness_preview_sha256,
        }
        : null,
      reviewed_fields: label.kind === "reviewed_fields"
        ? label.editable_correction_mask
        : null,
      reviewed_fields_artifact: staged.reviewed_fields,
      canonical_output: label.kind === "accepted_full_output"
        ? structuredClone(candidate.canonical_snapshot)
        : null,
      canonical_output_artifact: staged.canonical_output,
      transcript: label.transcript_explicitly_corrected
        ? staged.transcript
        : null,
      transcript_artifact: staged.transcript,
      schema_sha256: candidate.production_schema_sha256,
      normalizer_sha256: candidate.production_normalizer_sha256,
      keyset_sha256: candidate.canonical_keyset_sha256,
    },
  };
}

function validateCandidateBase(
  candidate: Candidate,
  contract: ResolvedContract,
  policyVersion: string,
) {
  if (
    !candidate || typeof candidate !== "object" ||
    typeof candidate.contribution_id !== "string" ||
    candidate.disclosure_version !== PRIVATE_EVALUATION_DISCLOSURE_VERSION ||
    candidate.policy_version !== policyVersion ||
    candidate.production_schema_sha256 !== contract.schema.sha256 ||
    candidate.production_normalizer_sha256 !== contract.normalizer.sha256 ||
    candidate.canonical_keyset_sha256 !== contract.schema.keyset_sha256
  ) throw new Error("corpus_candidate_contract_invalid");
  assertHash(candidate.audio_sha256, "corpus_audio_sha256_invalid");
  if (
    typeof candidate.audio_mime_type !== "string" ||
    !Number.isInteger(candidate.audio_duration_ms) ||
    candidate.audio_duration_ms < 1
  ) throw new Error("corpus_audio_unavailable");
}

function validateStagedArtifacts(
  staged: Record<string, any>,
  label: Record<string, any>,
) {
  if (!staged?.audio) throw new Error("corpus_audio_unavailable");
  assertHash(staged.audio.sha256, "corpus_audio_sha256_invalid");
  if (
    label.kind === "reviewed_fields" && label.editable_correction_mask.length
  ) {
    assertHash(
      staged.reviewed_fields?.sha256,
      "reviewed_fields_artifact_invalid",
    );
  }
  if (label.transcript_explicitly_corrected) {
    assertHash(staged.transcript?.sha256, "transcript_artifact_invalid");
  }
  if (label.kind === "accepted_full_output") {
    assertHash(
      staged.canonical_output?.sha256,
      "canonical_output_artifact_invalid",
    );
  }
}

async function caseKeyFor(contributionId: string) {
  return (await sha256Hex(`throughline-corpus-case-v1:${contributionId}`))
    .slice(
      0,
      32,
    );
}

async function stableSplitFor(contributionId: string) {
  const hash = await sha256Hex(`throughline-corpus-split-v1:${contributionId}`);
  return Number.parseInt(hash.slice(0, 2), 16) < 51
    ? "sealed_holdout"
    : "development";
}

async function labelProvenanceHash(
  label: Record<string, any>,
  candidate: Candidate,
) {
  return sha256Hex(canonicalJson({
    contribution_id: candidate.contribution_id,
    revision_id: candidate.revision_id,
    eligibility_source: candidate.eligibility_source,
    kind: label.kind,
    completeness: label.completeness,
    editable_correction_mask: label.editable_correction_mask,
    transcript_explicitly_corrected: label.transcript_explicitly_corrected,
    readiness_preview_sha256: candidate.readiness_preview_sha256 ?? null,
    canonical_output_sha256: candidate.canonical_output_sha256,
  }));
}

function normalizeMask(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("editable_correction_mask_invalid");
  }
  const mask: string[] = [];
  for (const field of value) {
    if (typeof field !== "string" || !EDITABLE_FIELDS.has(field)) {
      throw new Error("editable_correction_mask_invalid");
    }
    if (!mask.includes(field)) mask.push(field);
  }
  return mask;
}

function assertExactKeys(
  value: unknown,
  allowed: Set<string>,
  code: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(code);
  }
}

function assertHash(value: unknown, code: string) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(code);
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
