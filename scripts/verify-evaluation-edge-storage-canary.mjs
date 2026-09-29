#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { lstat, open, readFile, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const RECEIPT_PATTERN = /^[0-9a-f]{64}$/u;
const STATE_FILE_PATTERN = /^throughline-evaluation-edge-canary-[a-z0-9-]+\.json$/u;
const ALLOWED_TEMP_ROOTS = new Set(["/private/tmp", "/tmp"]);
const AUTHORIZATION_GATE = "THROUGHLINE_EVALUATION_HOSTED_CANARY_AUTHORIZED";
const DEFAULT_BUCKET = "throughline-audio";
const DEFAULT_PREFIX = "evaluation-artifacts";
const DEFAULT_STALE_SECONDS = 3600;
const EXPECTED_ORIGIN = "https://ywsenspsfyrdhgyxgcrv.supabase.co";
const MAX_RESPONSE_BYTES = 32_768;
const HTTP_TIMEOUT_MS = 30_000;

const PREFLIGHT_CHECKS = [
  "synthetic_upload",
  "edge_storage_delete",
  "target_absence",
  "sibling_survival",
  "idempotency",
  "cleanup",
  "privacy",
];
const PREPARE_CHECKS = [
  "registry_reservation",
  "synthetic_upload",
  "sibling_seed",
  "state_sealed",
  "privacy",
];
const EXERCISE_CHECKS = [
  "api_edge_reconciliation",
  "deletion_edge_storage",
  "target_absence",
  "sibling_survival",
  "registry_terminal",
  "idempotency",
  "cleanup",
  "privacy",
];

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

export function parseCliArgs(args) {
  if (!Array.isArray(args)) throw new TypeError("CLI arguments must be an array");
  let executeHosted = false;
  let phase = null;
  let stateFile = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--execute-hosted") {
      executeHosted = true;
      continue;
    }
    if (argument === "--phase" || argument === "--state-file") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument.slice(2)} value is required`);
      }
      if (argument === "--phase") phase = value;
      else stateFile = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!phase) throw new Error("Canary phase is required");
  if (!new Set(["edge-preflight", "prepare", "exercise"]).has(phase)) {
    throw new Error("Invalid canary phase");
  }
  if (phase !== "edge-preflight" && !stateFile) {
    throw new Error("State file is required for this phase");
  }
  if (phase === "edge-preflight" && stateFile) {
    throw new Error("State file is not accepted for the Edge preflight");
  }
  if (stateFile) validateStateFilePath(stateFile);
  return { executeHosted, phase, stateFile };
}

export function assertExecutionAuthorized({ executeHosted, env }) {
  if (executeHosted !== true) {
    throw new Error("Explicit hosted execution flag is required");
  }
  if (env?.[AUTHORIZATION_GATE] !== "true") {
    throw new Error("Hosted canary authorization environment gate is required");
  }
  return true;
}

export function validateStateFilePath(value) {
  if (typeof value !== "string" || !isAbsolute(value)) {
    throw new Error("Invalid canary state file path");
  }
  const normalized = resolve(value);
  if (
    !ALLOWED_TEMP_ROOTS.has(dirname(normalized)) ||
    !STATE_FILE_PATTERN.test(basename(normalized))
  ) {
    throw new Error("Invalid canary state file path");
  }
  return normalized;
}

export function assertPrivacySafeCanaryOutput(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const unsafe = [
    /\b[0-9a-f]{64}\b/iu,
    /\bbearer\s+\S+/iu,
    /https?:\/\/\S+/iu,
    /(?:^|[\s"'])evaluation-artifacts\/[A-Za-z0-9._/-]+/iu,
    /(?:service[_-]?role[_-]?key|credential|secret|token)\s*[:=]\s*\S+/iu,
  ];
  if (unsafe.some((pattern) => pattern.test(text))) {
    throw new Error("Hosted canary output is not privacy-safe");
  }
  return true;
}

function assertRuntime(runtime, methods) {
  if (!runtime || typeof runtime !== "object") {
    throw new TypeError("Hosted canary runtime is required");
  }
  for (const method of methods) {
    if (typeof runtime[method] !== "function") {
      throw new TypeError(`Hosted canary runtime is missing ${method}`);
    }
  }
  if (!RECEIPT_PATTERN.test(runtime.projectIdentity ?? "")) {
    throw new Error("Hosted canary project identity is invalid");
  }
}

function assertReceipts(value) {
  if (
    !exactKeys(value, ["targetReceipt", "siblingReceipt"]) ||
    !RECEIPT_PATTERN.test(value.targetReceipt ?? "") ||
    !RECEIPT_PATTERN.test(value.siblingReceipt ?? "") ||
    value.targetReceipt === value.siblingReceipt
  ) {
    throw new Error("Synthetic receipt generation failed");
  }
  return value;
}

function assertDeletionProof(value, expectedStatus) {
  if (
    !exactKeys(value, ["status", "deleted_count"]) ||
    !["deleted", "not_found"].includes(value.status) ||
    !Number.isSafeInteger(value.deleted_count) ||
    value.deleted_count < 0 ||
    (value.status === "not_found" && value.deleted_count !== 0) ||
    value.status !== expectedStatus
  ) {
    throw new Error("Hosted deletion proof is invalid");
  }
  return value;
}

async function bestEffortDelete(runtime, receipts) {
  for (const receipt of receipts) {
    try {
      await runtime.deleteReceipt(receipt);
    } catch {
      // Recovery state or the caller's failure remains authoritative.
    }
  }
}

export async function runEdgeStoragePreflight({ runtime }) {
  assertRuntime(runtime, [
    "generateReceipts",
    "uploadSynthetic",
    "inspectReceipt",
    "deleteReceipt",
  ]);
  const { targetReceipt, siblingReceipt } = assertReceipts(
    runtime.generateReceipts(),
  );
  let complete = false;
  let ownsTargetScope = false;
  let ownsSiblingScope = false;
  try {
    if (await runtime.inspectReceipt(targetReceipt) !== 0) {
      throw new Error("Generated target scope is not empty");
    }
    if (await runtime.inspectReceipt(siblingReceipt) !== 0) {
      throw new Error("Generated sibling scope is not empty");
    }
    ownsTargetScope = true;
    await runtime.uploadSynthetic(targetReceipt, 2);
    ownsSiblingScope = true;
    await runtime.uploadSynthetic(siblingReceipt, 1);
    if (
      await runtime.inspectReceipt(targetReceipt) !== 2 ||
      await runtime.inspectReceipt(siblingReceipt) !== 1
    ) throw new Error("Synthetic upload verification failed");

    assertDeletionProof(await runtime.deleteReceipt(targetReceipt), "deleted");
    if (
      await runtime.inspectReceipt(targetReceipt) !== 0 ||
      await runtime.inspectReceipt(siblingReceipt) !== 1
    ) throw new Error("Hosted deletion scope verification failed");
    assertDeletionProof(await runtime.deleteReceipt(targetReceipt), "not_found");

    assertDeletionProof(await runtime.deleteReceipt(siblingReceipt), "deleted");
    if (await runtime.inspectReceipt(siblingReceipt) !== 0) {
      throw new Error("Hosted preflight cleanup verification failed");
    }
    assertDeletionProof(await runtime.deleteReceipt(siblingReceipt), "not_found");
    complete = true;
  } finally {
    if (!complete) {
      await bestEffortDelete(runtime, [
        ...(ownsTargetScope ? [targetReceipt] : []),
        ...(ownsSiblingScope ? [siblingReceipt] : []),
      ]);
    }
  }
  const result = {
    mode: "hosted-edge-preflight",
    status: "pass",
    checks: [...PREFLIGHT_CHECKS],
  };
  assertPrivacySafeCanaryOutput(result);
  return result;
}

export async function prepareReconciliationCanary({
  runtime,
  nowMs = Date.now(),
  staleSeconds = DEFAULT_STALE_SECONDS,
}) {
  assertRuntime(runtime, [
    "generateReceipts",
    "reserveReceipt",
    "uploadSynthetic",
    "inspectReceipt",
    "deleteReceipt",
  ]);
  if (
    !runtime.stateStore || typeof runtime.stateStore.write !== "function" ||
    !Number.isSafeInteger(nowMs) || !Number.isSafeInteger(staleSeconds) ||
    staleSeconds < 300 || staleSeconds > 30 * 24 * 60 * 60
  ) throw new Error("Hosted reconciliation preparation is invalid");

  const { targetReceipt, siblingReceipt } = assertReceipts(
    runtime.generateReceipts(),
  );
  const createdAt = new Date(nowMs).toISOString();
  const notBefore = new Date(nowMs + staleSeconds * 1000).toISOString();
  const baseState = {
    version: 1,
    phase: "generated",
    projectIdentity: runtime.projectIdentity,
    targetReceipt,
    siblingReceipt,
    targetObjectCount: 2,
    siblingObjectCount: 1,
    staleSeconds,
    createdAt,
    notBefore,
  };
  let stateWritten = false;
  let ownsTargetScope = false;
  let ownsSiblingScope = false;
  try {
    await runtime.stateStore.write(baseState);
    stateWritten = true;
    const reservation = await runtime.reserveReceipt(targetReceipt);
    if (
      !reservation || reservation.state !== "pending" ||
      typeof reservation.idempotent !== "boolean"
    ) throw new Error("Synthetic registry reservation failed");
    if (reservation.idempotent) {
      throw new Error("Generated a pre-existing receipt");
    }
    await runtime.stateStore.write({ ...baseState, phase: "reserved" });
    if (
      await runtime.inspectReceipt(targetReceipt) !== 0 ||
      await runtime.inspectReceipt(siblingReceipt) !== 0
    ) throw new Error("Generated receipt scope is not empty");
    ownsTargetScope = true;
    await runtime.uploadSynthetic(targetReceipt, 2);
    ownsSiblingScope = true;
    await runtime.uploadSynthetic(siblingReceipt, 1);
    if (
      await runtime.inspectReceipt(targetReceipt) !== 2 ||
      await runtime.inspectReceipt(siblingReceipt) !== 1
    ) throw new Error("Synthetic upload verification failed");
    await runtime.stateStore.write({ ...baseState, phase: "prepared" });
  } catch (error) {
    if (stateWritten) {
      await bestEffortDelete(runtime, [
        ...(ownsTargetScope ? [targetReceipt] : []),
        ...(ownsSiblingScope ? [siblingReceipt] : []),
      ]);
    }
    if (/pre-existing receipt/iu.test(String(error?.message))) throw error;
    throw new Error(
      /upload/iu.test(String(error?.message))
        ? "Synthetic upload failed"
        : "Hosted reconciliation preparation failed",
      { cause: error },
    );
  }

  const result = {
    mode: "hosted-reconciliation-prepare",
    status: "pending",
    wait_until: notBefore,
    checks: [...PREPARE_CHECKS],
  };
  assertPrivacySafeCanaryOutput(result);
  return result;
}

function validateStoredState(value, projectIdentity) {
  const keys = [
    "createdAt",
    "notBefore",
    "phase",
    "projectIdentity",
    "siblingObjectCount",
    "siblingReceipt",
    "staleSeconds",
    "targetObjectCount",
    "targetReceipt",
    "version",
  ];
  if (
    !exactKeys(value, keys) || value.version !== 1 ||
    value.phase !== "prepared" || value.projectIdentity !== projectIdentity ||
    !RECEIPT_PATTERN.test(value.targetReceipt ?? "") ||
    !RECEIPT_PATTERN.test(value.siblingReceipt ?? "") ||
    value.targetReceipt === value.siblingReceipt ||
    value.targetObjectCount !== 2 || value.siblingObjectCount !== 1 ||
    !Number.isSafeInteger(value.staleSeconds) || value.staleSeconds < 300 ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.notBefore))
  ) throw new Error("Hosted canary state is invalid");
  return value;
}

function assertReconciliationProof(value, staleSeconds) {
  const keys = [
    "acknowledged",
    "cutoff",
    "deleted",
    "errors",
    "not_found",
    "scanned",
    "stale_after_seconds",
  ];
  if (
    !exactKeys(value, keys) || value.stale_after_seconds !== staleSeconds ||
    !Number.isFinite(Date.parse(value.cutoff)) ||
    !Number.isSafeInteger(value.scanned) || value.scanned < 1 ||
    !Number.isSafeInteger(value.deleted) || value.deleted < 1 ||
    !Number.isSafeInteger(value.not_found) || value.not_found < 0 ||
    !Number.isSafeInteger(value.acknowledged) || value.acknowledged < 1 ||
    !exactKeys(value.errors, [])
  ) throw new Error("Hosted reconciliation proof is invalid");
  assertPrivacySafeCanaryOutput(value);
  return value;
}

export async function exerciseReconciliationCanary({
  runtime,
  nowMs = Date.now(),
}) {
  assertRuntime(runtime, [
    "inspectReceipt",
    "reconcile",
    "assertReceiptTerminal",
    "deleteReceipt",
  ]);
  if (
    !runtime.stateStore || typeof runtime.stateStore.read !== "function" ||
    typeof runtime.stateStore.remove !== "function" ||
    !Number.isSafeInteger(nowMs)
  ) throw new Error("Hosted reconciliation exercise is invalid");

  const state = validateStoredState(
    await runtime.stateStore.read(),
    runtime.projectIdentity,
  );
  if (nowMs < Date.parse(state.notBefore)) {
    throw new Error("The stale window has not elapsed");
  }
  if (
    await runtime.inspectReceipt(state.targetReceipt) !==
      state.targetObjectCount ||
    await runtime.inspectReceipt(state.siblingReceipt) !==
      state.siblingObjectCount
  ) throw new Error("Hosted canary seed state changed before exercise");

  assertReconciliationProof(await runtime.reconcile(), state.staleSeconds);
  if (
    await runtime.inspectReceipt(state.targetReceipt) !== 0 ||
    await runtime.inspectReceipt(state.siblingReceipt) !==
      state.siblingObjectCount
  ) throw new Error("Hosted reconciliation scope verification failed");
  if (!await runtime.assertReceiptTerminal(state.targetReceipt)) {
    throw new Error("Hosted registry acknowledgment is not terminal");
  }
  assertDeletionProof(
    await runtime.deleteReceipt(state.targetReceipt),
    "not_found",
  );

  assertDeletionProof(
    await runtime.deleteReceipt(state.siblingReceipt),
    "deleted",
  );
  if (await runtime.inspectReceipt(state.siblingReceipt) !== 0) {
    throw new Error("Hosted reconciliation cleanup verification failed");
  }
  assertDeletionProof(
    await runtime.deleteReceipt(state.siblingReceipt),
    "not_found",
  );
  await runtime.stateStore.remove();

  const result = {
    mode: "hosted-reconciliation-exercise",
    status: "pass",
    checks: [...EXERCISE_CHECKS],
  };
  assertPrivacySafeCanaryOutput(result);
  return result;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function readHostedCanaryConfig(env) {
  const rawUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const apiToken = env.THROUGHLINE_API_TOKEN?.trim();
  const deleteToken = env.THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN?.trim();
  const bucket = env.THROUGHLINE_AUDIO_BUCKET?.trim() || DEFAULT_BUCKET;
  const prefix = env.THROUGHLINE_PRIVATE_ARTIFACT_PREFIX?.trim() ||
    DEFAULT_PREFIX;
  const staleSeconds = Number(
    env.THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS ?? DEFAULT_STALE_SECONDS,
  );
  if (
    !rawUrl || !serviceRoleKey || !apiToken || !deleteToken ||
    bucket !== DEFAULT_BUCKET || prefix !== DEFAULT_PREFIX ||
    !Number.isSafeInteger(staleSeconds) || staleSeconds !== DEFAULT_STALE_SECONDS
  ) throw new Error("Hosted canary configuration is incomplete");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Hosted canary configuration is invalid");
  }
  if (
    url.origin !== EXPECTED_ORIGIN || url.protocol !== "https:" ||
    url.pathname !== "/" || url.search ||
    url.hash || url.username || url.password
  ) throw new Error("Hosted canary configuration is invalid");
  return {
    origin: url.origin,
    projectIdentity: sha256(url.origin),
    serviceRoleKey,
    apiToken,
    deleteToken,
    bucket,
    prefix,
    staleSeconds,
  };
}

async function boundedJson(response) {
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
    throw new Error("Hosted response exceeded the safety bound");
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Hosted response was not valid JSON");
  }
}

function requestHeaders(config, json = true) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function hostedFetch(fetchImpl, url, init) {
  return fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
}

export function createCanaryStateStore(stateFile) {
  const filePath = validateStateFilePath(stateFile);
  let initialized = false;
  return {
    async write(value) {
      const serialized = `${JSON.stringify(value)}\n`;
      if (!initialized) {
        const handle = await open(filePath, "wx", 0o600);
        try {
          await handle.writeFile(serialized, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        initialized = true;
        return;
      }
      const metadata = await lstat(filePath);
      if (!metadata.isFile() || metadata.isSymbolicLink() ||
        (metadata.mode & 0o777) !== 0o600) {
        throw new Error("Hosted canary state permissions are invalid");
      }
      const handle = await open(filePath, "r+");
      try {
        await handle.truncate(0);
        await handle.writeFile(serialized, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    },
    async read() {
      const metadata = await lstat(filePath);
      if (!metadata.isFile() || metadata.isSymbolicLink() ||
        (metadata.mode & 0o777) !== 0o600) {
        throw new Error("Hosted canary state permissions are invalid");
      }
      const text = await readFile(filePath, "utf8");
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
        throw new Error("Hosted canary state exceeded the safety bound");
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Hosted canary state is invalid");
      }
    },
    async remove() {
      const metadata = await lstat(filePath);
      if (!metadata.isFile() || metadata.isSymbolicLink() ||
        (metadata.mode & 0o777) !== 0o600) {
        throw new Error("Hosted canary state permissions are invalid");
      }
      await unlink(filePath);
    },
  };
}

function createHostedRuntime({ env, fetchImpl = fetch, stateFile }) {
  const config = readHostedCanaryConfig(env);
  const stateStore = stateFile ? createCanaryStateStore(stateFile) : null;
  return {
    projectIdentity: config.projectIdentity,
    stateStore,
    generateReceipts() {
      let targetReceipt = randomBytes(32).toString("hex");
      let siblingReceipt = randomBytes(32).toString("hex");
      while (siblingReceipt === targetReceipt) {
        siblingReceipt = randomBytes(32).toString("hex");
      }
      return { targetReceipt, siblingReceipt };
    },
    async reserveReceipt(receipt) {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/rest/v1/rpc/throughline_reserve_evaluation_artifact_receipt_v1`,
        {
          method: "POST",
          headers: requestHeaders(config),
          body: JSON.stringify({
            payload: { materializer_receipt_sha256: receipt },
          }),
        },
      );
      const body = await boundedJson(response);
      if (!response.ok || !exactKeys(body, ["idempotent", "state"])) {
        throw new Error("Hosted registry reservation failed");
      }
      return body;
    },
    async uploadSynthetic(receipt, count) {
      for (let index = 0; index < count; index += 1) {
        const objectPath = `${config.prefix}/${receipt}/canary-${index}.bin`;
        const response = await hostedFetch(
          fetchImpl,
          `${config.origin}/storage/v1/object/${config.bucket}/${objectPath}`,
          {
            method: "POST",
            headers: {
              ...requestHeaders(config, false),
              "Content-Type": "application/octet-stream",
              "x-upsert": "false",
            },
            body: randomBytes(32),
          },
        );
        if (!response.ok) throw new Error("Synthetic upload failed");
      }
    },
    async inspectReceipt(receipt) {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/storage/v1/object/list/${config.bucket}`,
        {
          method: "POST",
          headers: requestHeaders(config),
          body: JSON.stringify({
            prefix: `${config.prefix}/${receipt}`,
            limit: 100,
            offset: 0,
            sortBy: { column: "name", order: "asc" },
          }),
        },
      );
      const body = await boundedJson(response);
      if (!response.ok || !Array.isArray(body) || body.length > 2) {
        throw new Error("Hosted synthetic inspection failed");
      }
      let count = 0;
      for (const entry of body) {
        if (
          !entry || typeof entry !== "object" ||
          typeof entry.name !== "string" ||
          !/^canary-[01]\.bin$/u.test(entry.name) ||
          typeof entry.id !== "string" || !entry.id
        ) throw new Error("Hosted synthetic inspection failed");
        count += 1;
      }
      return count;
    },
    async deleteReceipt(receipt) {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/functions/v1/private-artifact-delete`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.deleteToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ materializer_receipt_sha256: receipt }),
        },
      );
      const body = await boundedJson(response);
      if (!response.ok) throw new Error("Hosted deletion Edge call failed");
      return body;
    },
    async reconcile() {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/functions/v1/api/maintenance/evaluation-artifact-reconciliation`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiToken}` },
        },
      );
      const body = await boundedJson(response);
      if (!response.ok) throw new Error("Hosted API reconciliation failed");
      return body;
    },
    async assertReceiptTerminal(receipt) {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/rest/v1/rpc/throughline_reserve_evaluation_artifact_receipt_v1`,
        {
          method: "POST",
          headers: requestHeaders(config),
          body: JSON.stringify({
            payload: { materializer_receipt_sha256: receipt },
          }),
        },
      );
      const body = await boundedJson(response);
      return !response.ok && body?.message === "artifact_receipt_terminal";
    },
  };
}

function safeErrorCode(error) {
  const message = String(error?.message ?? "");
  if (/authorization|execution flag/iu.test(message)) return "authorization_required";
  if (/state/iu.test(message)) return "state_invalid";
  if (/stale window/iu.test(message)) return "stale_window_pending";
  if (/configuration/iu.test(message)) return "configuration_invalid";
  if (/cleanup/iu.test(message)) return "cleanup_failed";
  return "hosted_canary_failed";
}

async function main() {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    assertExecutionAuthorized({ executeHosted: args.executeHosted, env: process.env });
    const runtime = createHostedRuntime({
      env: process.env,
      stateFile: args.stateFile,
    });
    let result;
    if (args.phase === "edge-preflight") {
      result = await runEdgeStoragePreflight({ runtime });
    } else if (args.phase === "prepare") {
      result = await prepareReconciliationCanary({
        runtime,
        staleSeconds: readHostedCanaryConfig(process.env).staleSeconds,
      });
    } else {
      result = await exerciseReconciliationCanary({ runtime });
    }
    assertPrivacySafeCanaryOutput(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = { status: "fail", error: safeErrorCode(error) };
    console.error(JSON.stringify(result));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
