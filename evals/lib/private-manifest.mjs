import fs from "node:fs/promises";
import path from "node:path";

import {
  canonicalJson,
  sha256Hex,
  validateCanonicalExtractionSnapshot,
} from "../../core/inference-contract.mjs";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const PURPOSES = new Set(["synthetic_plumbing", "real_private_quality"]);
const LABEL_KINDS = new Set([
  "diagnostic_grade",
  "reviewed_fields",
  "accepted_full_output",
]);
const EDITABLE_FIELDS = new Set([
  "type",
  "title",
  "summary",
  "most_important",
  "todos",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "mood",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
]);

export function buildAdapterInput(caseRecord, contractHash) {
  assertHash(caseRecord?.audio?.sha256, "audio_sha256_invalid");
  assertHash(contractHash, "prediction_contract_invalid");
  if (typeof caseRecord?.id !== "string" || !caseRecord.id) {
    throw new Error("manifest_case_invalid");
  }
  if (typeof caseRecord.audio.path !== "string" || !caseRecord.audio.path) {
    throw new Error("manifest_audio_path_invalid");
  }
  return Object.freeze({
    case_id: caseRecord.id,
    audio_path: caseRecord.verified_audio_path ?? caseRecord.audio.path,
    audio_sha256: caseRecord.audio.sha256,
    audio_mime_type: caseRecord.audio.mime_type,
    contract_sha256: contractHash,
  });
}

export function validateAcceptedFullOutput(snapshot, label, contract) {
  if (
    label?.kind !== "accepted_full_output" ||
    label.schema_sha256 !== contract?.schema?.sha256 ||
    label.normalizer_sha256 !== contract?.normalizer?.sha256 ||
    label.keyset_sha256 !== contract?.schema?.keyset_sha256
  ) throw new Error("accepted_full_output_contract_invalid");
  return validateCanonicalExtractionSnapshot(snapshot, contract);
}

export async function validatePrivateManifest(
  raw,
  root,
  { contract, verifyMaterializerReceipt } = {},
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("private_manifest_invalid");
  }
  if (
    raw.manifest_version !== "throughline-private-audio-manifest-v1" ||
    !PURPOSES.has(raw.purpose) ||
    !Array.isArray(raw.cases) ||
    !raw.cases.length
  ) throw new Error("private_manifest_invalid");
  if (
    !contract ||
    raw.inference_contract?.contract_sha256 !== contract.contract_sha256
  ) {
    throw new Error("prediction_contract_mismatch");
  }
  assertContractHashes(raw.inference_contract, contract);
  for (
    const key of ["split_hash", "content_set_hash", "label_contract_set_hash"]
  ) {
    assertHash(raw[key], `manifest_${key}_invalid`);
  }

  let receipt = null;
  if (raw.purpose === "real_private_quality") {
    if (
      !raw.materializer_receipt ||
      typeof verifyMaterializerReceipt !== "function"
    ) {
      throw new Error("materializer_receipt_required");
    }
    receipt = await verifyMaterializerReceipt(raw.materializer_receipt, raw);
    assertReceipt(receipt, raw, contract);
  } else if (raw.materializer_receipt !== null) {
    throw new Error("synthetic_materializer_receipt_forbidden");
  }

  const absoluteRoot = path.resolve(root);
  const seen = new Set();
  const cases = [];
  for (const caseRecord of raw.cases) {
    validateCaseRecord(caseRecord, contract, raw.purpose);
    if (seen.has(caseRecord.id)) throw new Error("duplicate_manifest_case");
    seen.add(caseRecord.id);
    const audioPath = safeChildPath(absoluteRoot, caseRecord.audio.path);
    const bytes = new Uint8Array(await fs.readFile(audioPath));
    if (await sha256Hex(bytes) !== caseRecord.audio.sha256) {
      throw new Error("manifest_audio_hash_mismatch");
    }
    cases.push(
      deepFreeze({
        ...structuredClone(caseRecord),
        verified_audio_path: audioPath,
      }),
    );
  }

  const manifestSha256 = await sha256Hex(canonicalJson(raw));
  return deepFreeze({
    ...structuredClone(raw),
    cases,
    manifest_sha256: manifestSha256,
    quality_eligible: raw.purpose === "real_private_quality" &&
      receipt.valid === true,
  });
}

function validateCaseRecord(caseRecord, contract, purpose) {
  if (
    !caseRecord || typeof caseRecord !== "object" ||
    typeof caseRecord.id !== "string" || !caseRecord.id ||
    typeof caseRecord.split !== "string" || !caseRecord.split ||
    caseRecord.active !== true ||
    !caseRecord.audio || typeof caseRecord.audio.path !== "string" ||
    typeof caseRecord.audio.mime_type !== "string"
  ) throw new Error("manifest_case_invalid");
  assertHash(caseRecord.audio.sha256, "manifest_audio_hash_invalid");
  const label = caseRecord.label;
  if (!label || !LABEL_KINDS.has(label.kind)) {
    throw new Error("label_contract_invalid");
  }

  if (label.kind === "diagnostic_grade") {
    if (
      label.reviewed_fields !== null || label.canonical_output !== null ||
      label.transcript !== null ||
      label.transcript_explicitly_corrected !== false ||
      label.agent_ready === true
    ) throw new Error("diagnostic_grade_label_invalid");
  } else if (label.kind === "reviewed_fields") {
    if (
      !Array.isArray(label.reviewed_fields) || !label.reviewed_fields.length ||
      new Set(label.reviewed_fields).size !== label.reviewed_fields.length ||
      label.reviewed_fields.some((field) => !EDITABLE_FIELDS.has(field)) ||
      label.canonical_output !== null ||
      (label.transcript !== null &&
        label.transcript_explicitly_corrected !== true)
    ) throw new Error("reviewed_fields_label_invalid");
  } else {
    if (
      label.agent_ready !== true ||
      typeof label.exact_revision_id !== "string" ||
      !label.exact_revision_id ||
      label.inspected_preview?.revision_id !== label.exact_revision_id ||
      label.reviewed_fields !== null || label.transcript !== null ||
      label.transcript_explicitly_corrected !== false
    ) throw new Error("accepted_full_output_provenance_invalid");
    validateAcceptedFullOutput(label.canonical_output, label, contract);
  }
  if (
    purpose === "synthetic_plumbing" && label.kind === "accepted_full_output"
  ) {
    throw new Error("synthetic_quality_label_forbidden");
  }
}

function assertContractHashes(candidate, contract) {
  if (
    candidate?.schema_sha256 !== contract.schema.sha256 ||
    candidate?.normalizer_sha256 !== contract.normalizer.sha256 ||
    candidate?.keyset_sha256 !== contract.schema.keyset_sha256
  ) throw new Error("manifest_contract_hash_mismatch");
}

function assertReceipt(receipt, manifest, contract) {
  if (
    !receipt || receipt.valid !== true ||
    receipt.split_hash !== manifest.split_hash ||
    receipt.content_set_hash !== manifest.content_set_hash ||
    receipt.label_contract_set_hash !== manifest.label_contract_set_hash ||
    receipt.disclosure_version !== manifest.disclosure_version ||
    receipt.policy_version !== manifest.policy_version ||
    receipt.schema_sha256 !== contract.schema.sha256 ||
    receipt.normalizer_sha256 !== contract.normalizer.sha256 ||
    receipt.keyset_sha256 !== contract.schema.keyset_sha256
  ) throw new Error("materializer_receipt_invalid");
}

function safeChildPath(root, relativePath) {
  if (path.isAbsolute(relativePath)) {
    throw new Error("manifest_audio_path_invalid");
  }
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("manifest_audio_path_invalid");
  }
  return resolved;
}

function assertHash(value, code) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(code);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
