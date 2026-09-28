#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  resolveInferenceContract,
  sha256Hex,
} from "../core/inference-contract.mjs";
import {
  materializeActiveEvaluationCorpus,
} from "../supabase/functions/_shared/evaluation-corpus.ts";
import {
  PRIVATE_EVALUATION_POLICY_VERSION,
} from "../supabase/functions/_shared/evaluation-contract.ts";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const STORAGE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/u;
const MAX_MATERIALIZED_CASES = 249;

export function resolvePrivateArtifactStoreMode(env) {
  if (env?.THROUGHLINE_PRIVATE_ARTIFACT_STORE !== "supabase_storage_v1") {
    throw new Error("private_artifact_store_invalid");
  }
  return "supabase_storage_v1";
}

export function createSupabaseArtifactStore({
  supabaseUrl,
  serviceRoleKey,
  fetchImpl = fetch,
  bucket = "throughline-audio",
  prefix = "evaluation-artifacts",
}) {
  const baseUrl = requiredUrl(supabaseUrl, "supabase_url_invalid");
  const serviceKey = requiredString(
    serviceRoleKey,
    "service_role_key_invalid",
  );
  const storageBucket = safeStoragePath(bucket, "artifact_bucket_invalid");
  const storagePrefix = safeStoragePath(prefix, "artifact_prefix_invalid");

  async function removeUploadedObjects(uploaded) {
    for (const objectPath of [...uploaded].reverse()) {
      const encodedObject = objectPath.split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      const response = await fetchImpl(
        `${baseUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${encodedObject}`,
        {
          method: "DELETE",
          headers: serviceHeaders(serviceKey),
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(`artifact_rollback_failed_${response.status}`);
      }
    }
  }

  return {
    async seal({ stagingRoot, receipt, manifest }) {
      assertHash(
        receipt?.receipt_sha256,
        "materializer_receipt_sha256_invalid",
      );
      const root = path.resolve(
        requiredString(stagingRoot, "private_staging_root_invalid"),
      );
      await writePrivateJson(path.join(root, "manifest.json"), manifest);
      const files = await listPrivateFiles(root);
      files.sort((left, right) => {
        if (left === "manifest.json") return 1;
        if (right === "manifest.json") return -1;
        return left.localeCompare(right);
      });
      const objectPrefix = `${storagePrefix}/${receipt.receipt_sha256}`;
      const uploaded = [];
      try {
        for (const relativePath of files) {
          const objectPath = `${objectPrefix}/${relativePath}`;
          const encodedObject = objectPath.split("/")
            .map((segment) => encodeURIComponent(segment))
            .join("/");
          const response = await fetchImpl(
            `${baseUrl}/storage/v1/object/${encodeURIComponent(storageBucket)}/${encodedObject}`,
            {
              method: "POST",
              headers: {
                ...serviceHeaders(serviceKey),
                "Content-Type": "application/octet-stream",
                "x-upsert": "false",
              },
              body: await fs.readFile(path.join(root, relativePath)),
            },
          );
          if (!response.ok) {
            throw new Error(`artifact_upload_failed_${response.status}`);
          }
          uploaded.push(objectPath);
        }
      } catch (error) {
        await removeUploadedObjects(uploaded);
        throw error;
      }
      return {
        stagingRoot: root,
        uploaded,
        locator: {
          storage: "supabase",
          bucket: storageBucket,
          object_prefix: objectPrefix,
          file_count: uploaded.length,
        },
      };
    },
    async commit(handle) {
      await fs.rm(handle.stagingRoot, { recursive: true, force: true });
    },
    async rollback(handle) {
      await removeUploadedObjects(handle.uploaded);
      await fs.rm(handle.stagingRoot, { recursive: true, force: true });
    },
  };
}

async function listPrivateFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!STORAGE_SEGMENT_PATTERN.test(entry.name)) {
      throw new Error("artifact_path_invalid");
    }
    const target = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPrivateFiles(root, target));
    } else if (entry.isFile()) {
      files.push(path.relative(root, target).split(path.sep).join("/"));
    } else {
      throw new Error("artifact_path_invalid");
    }
  }
  return files;
}

function safeStoragePath(value, code) {
  const normalized = requiredString(value, code);
  if (
    normalized.split("/").some((segment) =>
      !segment || !STORAGE_SEGMENT_PATTERN.test(segment)
    )
  ) throw new Error(code);
  return normalized;
}

export async function materializePrivateCorpus(options) {
  if (options?.authorized !== true) {
    throw new Error("private_materialization_not_authorized");
  }
  const supabaseUrl = requiredUrl(
    options.supabaseUrl,
    "supabase_url_invalid",
  );
  const serviceRoleKey = requiredString(
    options.serviceRoleKey,
    "service_role_key_invalid",
  );
  const privateBaseRoot = path.resolve(
    requiredString(options.privateRoot, "private_root_invalid"),
  );
  const stagingRoot = path.join(
    privateBaseRoot,
    `.staging-${crypto.randomUUID()}`,
  );
  assertChildPath(privateBaseRoot, stagingRoot, "private_staging_root_invalid");
  const fetchImpl = options.fetchImpl ?? fetch;
  const artifactStore = options.artifactStore ?? null;
  const contract = options.contract ?? await resolveInferenceContract({});
  let preparedSourceSetSha256 = null;
  let artifactRoot = null;
  let artifactHandle = null;
  let registrationCommitted = false;
  let registrationFailureAmbiguous = false;

  await fs.mkdir(privateBaseRoot, { recursive: true, mode: 0o700 });
  await fs.chmod(privateBaseRoot, 0o700);
  await fs.mkdir(stagingRoot, { mode: 0o700 });

  try {
    const result = await materializeActiveEvaluationCorpus(
      {
        policyVersion: PRIVATE_EVALUATION_POLICY_VERSION,
        privateRoot: stagingRoot,
      },
      {
      contract,
      requireService() {},
      async fetchActiveCandidates(policyVersion) {
        const prepared = await callRpc({
          supabaseUrl,
          serviceRoleKey,
          fetchImpl,
          name: "throughline_materialize_evaluation_corpus_v1",
          payload: {
            mode: "prepare",
            policy_version: policyVersion,
            production_schema_sha256: contract.schema.sha256,
            production_normalizer_sha256: contract.normalizer.sha256,
            canonical_keyset_sha256: contract.schema.keyset_sha256,
          },
        });
        assertHash(prepared?.source_set_sha256, "source_set_sha256_invalid");
        if (
          !Array.isArray(prepared?.candidates) ||
          prepared.case_count !== prepared.candidates.length
        ) throw new Error("corpus_prepare_result_invalid");
        if (prepared.case_count > MAX_MATERIALIZED_CASES) {
          throw new Error("corpus_case_limit_exceeded");
        }
        preparedSourceSetSha256 = prepared.source_set_sha256;
        return prepared.candidates;
      },
      stageCase(candidate, identity) {
        return stagePrivateCase({
          candidate,
          identity,
          supabaseUrl,
          serviceRoleKey,
          fetchImpl,
        });
      },
        async beforePersistMaterialization({ receipt, manifest }) {
          assertHash(receipt?.receipt_sha256, "materializer_receipt_sha256_invalid");
          if (artifactStore) {
            const reservation = await callRpc({
              supabaseUrl,
              serviceRoleKey,
              fetchImpl,
              name: "throughline_reserve_evaluation_artifact_receipt_v1",
              payload: {
                materializer_receipt_sha256: receipt.receipt_sha256,
              },
            });
            if (reservation?.state !== "pending") {
              throw new Error("artifact_receipt_reservation_invalid");
            }
            artifactHandle = await artifactStore.seal({
              stagingRoot,
              receipt,
              manifest,
            });
            return;
          }
          const sealedRoot = path.join(
            privateBaseRoot,
            receipt.receipt_sha256,
          );
          assertChildPath(
            privateBaseRoot,
            sealedRoot,
            "corpus_receipt_root_invalid",
          );
          await writePrivateJson(path.join(stagingRoot, "manifest.json"), manifest);
          try {
            await fs.rename(stagingRoot, sealedRoot);
          } catch (error) {
            if (error?.code === "EEXIST" || error?.code === "ENOTEMPTY") {
              throw new Error("corpus_receipt_root_exists");
            }
            throw error;
          }
          artifactRoot = sealedRoot;
        },
        async persistMaterialization({ receipt }) {
        assertHash(preparedSourceSetSha256, "source_set_sha256_invalid");
        let committed;
        try {
          committed = await callRpc({
            supabaseUrl,
            serviceRoleKey,
            fetchImpl,
            name: "throughline_materialize_evaluation_corpus_v1",
            payload: {
              mode: "commit",
              policy_version: receipt.policy_version,
              production_schema_sha256: receipt.production_schema_sha256,
              production_normalizer_sha256: receipt.production_normalizer_sha256,
              canonical_keyset_sha256: receipt.canonical_keyset_sha256,
              source_set_sha256: preparedSourceSetSha256,
              stable_split_sha256: receipt.stable_split_sha256,
              content_set_sha256: receipt.content_set_sha256,
              label_contract_set_sha256: receipt.label_contract_set_sha256,
              materializer_receipt_sha256: receipt.receipt_sha256,
              materialized_at: receipt.materialized_at,
            },
          });
        } catch (error) {
          registrationFailureAmbiguous = isAmbiguousCommitFailure(error);
          throw error;
        }
        if (
          committed?.receipt_sha256 !== receipt.receipt_sha256 ||
          committed?.case_count !== receipt.case_count
        ) {
          registrationFailureAmbiguous = true;
          throw new Error("corpus_commit_receipt_mismatch");
        }
        return committed;
      },
        fetchActiveReceipt(materializerReceiptSha256, predictionBundleSha256) {
        return callRpc({
          supabaseUrl,
          serviceRoleKey,
          fetchImpl,
          name: "throughline_revalidate_evaluation_corpus_v1",
          payload: {
            materializer_receipt_sha256: materializerReceiptSha256,
            prediction_bundle_sha256: predictionBundleSha256,
          },
        });
      },
        now: options.now,
        newUuid: options.newUuid,
      },
    );
    registrationCommitted = true;
    if (artifactHandle) await artifactStore.commit(artifactHandle);
    if (artifactStore) {
      return {
        ...result,
        artifactLocator: artifactHandle.locator,
      };
    }
    if (!artifactRoot) throw new Error("corpus_receipt_root_missing");
    return {
      ...result,
      artifactRoot,
      manifestPath: path.join(artifactRoot, "manifest.json"),
    };
  } catch (error) {
    if (
      artifactHandle && !registrationCommitted &&
      !registrationFailureAmbiguous
    ) {
      await artifactStore.rollback(artifactHandle);
    } else if (artifactRoot && !registrationFailureAmbiguous) {
      await fs.rm(artifactRoot, { recursive: true, force: true });
    } else if (!artifactRoot && !artifactHandle) {
      await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }
}

function isAmbiguousCommitFailure(error) {
  const match = /corpus_rpc_failed_(\d{3})/u.exec(
    error instanceof Error ? error.message : String(error),
  );
  if (!match) return true;
  const status = Number(match[1]);
  return status === 408 || status >= 500;
}

async function stagePrivateCase({
  candidate,
  identity,
  supabaseUrl,
  serviceRoleKey,
  fetchImpl,
}) {
  const caseRoot = path.resolve(
    identity.private_root,
    "cases",
    identity.case_key,
  );
  assertChildPath(
    path.resolve(identity.private_root),
    caseRoot,
    "corpus_case_path_invalid",
  );
  await fs.mkdir(caseRoot, { recursive: true, mode: 0o700 });
  await fs.chmod(caseRoot, 0o700);

  const audioBytes = await downloadPrivateAudio({
    candidate,
    supabaseUrl,
    serviceRoleKey,
    fetchImpl,
  });
  const actualAudioSha256 = await sha256Hex(audioBytes);
  if (actualAudioSha256 !== candidate.audio_sha256) {
    throw new Error("corpus_audio_hash_mismatch");
  }
  const extension = safeAudioExtension(
    candidate.audio_mime_type,
    candidate.audio_object_path,
  );
  const audioPath = path.join(caseRoot, `audio.${extension}`);
  await writePrivateBytes(audioPath, audioBytes);
  const staged = {
    audio: {
      path: relativePrivatePath(identity.private_root, audioPath),
      sha256: actualAudioSha256,
      mime_type: candidate.audio_mime_type,
      format: extension,
      duration_ms: candidate.audio_duration_ms,
    },
    reviewed_fields: null,
    canonical_output: null,
    transcript: null,
  };

  const mask = candidate.editable_correction_mask;
  if (candidate.eligibility_source === "content_correction" && mask.length) {
    const fields = Object.fromEntries(
      mask.map((field) => [field, candidate.canonical_snapshot[field]]),
    );
    staged.reviewed_fields = await stageJsonArtifact(
      identity.private_root,
      path.join(caseRoot, "reviewed-fields.json"),
      { mask, fields },
    );
  }
  if (candidate.transcript_explicitly_corrected === true) {
    if (typeof candidate.transcript_snapshot !== "string") {
      throw new Error("corpus_transcript_snapshot_invalid");
    }
    const transcriptPath = path.join(caseRoot, "transcript.txt");
    const transcriptBytes = new TextEncoder().encode(
      candidate.transcript_snapshot,
    );
    await writePrivateBytes(transcriptPath, transcriptBytes);
    staged.transcript = {
      path: relativePrivatePath(identity.private_root, transcriptPath),
      sha256: await sha256Hex(transcriptBytes),
    };
  }
  if (candidate.agent_ready === true) {
    staged.canonical_output = await stageJsonArtifact(
      identity.private_root,
      path.join(caseRoot, "canonical-output.json"),
      candidate.canonical_snapshot,
    );
  }
  return staged;
}

async function downloadPrivateAudio({
  candidate,
  supabaseUrl,
  serviceRoleKey,
  fetchImpl,
}) {
  const bucket = requiredString(
    candidate.audio_bucket,
    "corpus_audio_bucket_invalid",
  );
  const objectPath = requiredString(
    candidate.audio_object_path,
    "corpus_audio_object_path_invalid",
  );
  if (
    objectPath.split("/").some((segment) =>
      !segment || segment === "." || segment === ".."
    )
  ) throw new Error("corpus_audio_object_path_invalid");
  const encodedObject = [bucket, ...objectPath.split("/")]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const response = await fetchImpl(
    `${supabaseUrl}/storage/v1/object/authenticated/${encodedObject}`,
    { headers: serviceHeaders(serviceRoleKey) },
  );
  if (!response.ok) {
    throw new Error(`corpus_audio_download_failed_${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function stageJsonArtifact(privateRoot, targetPath, value) {
  const bytes = new TextEncoder().encode(`${canonicalJson(value)}\n`);
  await writePrivateBytes(targetPath, bytes);
  return {
    path: relativePrivatePath(privateRoot, targetPath),
    sha256: await sha256Hex(bytes),
  };
}

async function callRpc({
  supabaseUrl,
  serviceRoleKey,
  fetchImpl,
  name,
  payload,
}) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceRoleKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });
  if (!response.ok) throw new Error(`corpus_rpc_failed_${response.status}`);
  return response.json();
}

function serviceHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

async function writePrivateJson(targetPath, value) {
  const bytes = new TextEncoder().encode(
    `${JSON.stringify(value, null, 2)}\n`,
  );
  await writePrivateBytes(targetPath, bytes);
}

async function writePrivateBytes(targetPath, bytes) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  const temporaryPath =
    `${targetPath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temporaryPath, bytes, { mode: 0o600, flag: "wx" });
    await fs.chmod(temporaryPath, 0o600);
    await fs.rename(temporaryPath, targetPath);
    await fs.chmod(targetPath, 0o600);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

function relativePrivatePath(privateRoot, targetPath) {
  const absoluteRoot = path.resolve(privateRoot);
  const absoluteTarget = path.resolve(targetPath);
  assertChildPath(absoluteRoot, absoluteTarget, "corpus_case_path_invalid");
  return path.relative(absoluteRoot, absoluteTarget);
}

function assertChildPath(root, candidate, code) {
  if (
    candidate === root ||
    !candidate.startsWith(`${root}${path.sep}`)
  ) throw new Error(code);
}

function safeAudioExtension(mimeType, objectPath) {
  const mimeSubtype = typeof mimeType === "string"
    ? mimeType.split("/")[1]?.split(";")[0]
    : null;
  const objectExtension = typeof objectPath === "string"
    ? path.extname(objectPath).slice(1)
    : null;
  const candidate = (mimeSubtype || objectExtension || "bin").toLowerCase();
  return /^[a-z0-9]{1,12}$/u.test(candidate) ? candidate : "bin";
}

function requiredUrl(value, code) {
  const normalized = requiredString(value, code).replace(/\/+$/u, "");
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(code);
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1") {
    throw new Error(code);
  }
  return normalized;
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function assertHash(value, code) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(code);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (
    !args.has("--execute-real-private") ||
    process.env.THROUGHLINE_REAL_PRIVATE_MATERIALIZATION_AUTHORIZED !== "true"
  ) throw new Error("private_materialization_not_authorized");
  resolvePrivateArtifactStoreMode(process.env);
  const artifactStore = createSupabaseArtifactStore({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const result = await materializePrivateCorpus({
    authorized: true,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    privateRoot: process.env.THROUGHLINE_PRIVATE_CORPUS_ROOT,
    artifactStore,
  });
  console.log(JSON.stringify({
    ok: true,
    purpose: "real_private_quality",
    case_count: result.receipt.case_count,
    diagnostic_count: result.receipt.diagnostic_case_count,
    reviewed_count: result.receipt.reviewed_field_case_count,
    accepted_count: result.receipt.accepted_full_output_case_count,
  }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
