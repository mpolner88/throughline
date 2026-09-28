import assert from "node:assert/strict";
import { lstat } from "node:fs/promises";
import test from "node:test";

import {
  assertExecutionAuthorized,
  assertPrivacySafeCanaryOutput,
  createCanaryStateStore,
  exerciseReconciliationCanary,
  parseCliArgs,
  prepareReconciliationCanary,
  readHostedCanaryConfig,
  runEdgeStoragePreflight,
  validateStateFilePath,
} from "./verify-evaluation-edge-storage-canary.mjs";

const TARGET = "a".repeat(64);
const SIBLING = "b".repeat(64);
const PROJECT = "c".repeat(64);
const STATE_FILE = "/private/tmp/throughline-evaluation-edge-canary-test.json";
const START = Date.parse("2026-08-22T12:00:00.000Z");

function createRuntime({
  failTargetUpload = false,
  idempotentReservation = false,
  preexistingTarget = false,
} = {}) {
  const trace = [];
  const counts = new Map(preexistingTarget ? [[TARGET, 1]] : []);
  const state = { value: null, removed: false };
  let reserved = false;
  let terminal = false;

  return {
    trace,
    state,
    projectIdentity: PROJECT,
    stateStore: {
      async write(value) {
        trace.push(`state:${value.phase}`);
        state.value = structuredClone(value);
      },
      async read() {
        trace.push("state:read");
        return structuredClone(state.value);
      },
      async remove() {
        trace.push("state:remove");
        state.removed = true;
      },
    },
    generateReceipts() {
      trace.push("generate");
      return { targetReceipt: TARGET, siblingReceipt: SIBLING };
    },
    async reserveReceipt(receipt) {
      trace.push(receipt === TARGET ? "reserve:target" : "reserve:other");
      if (terminal) return { state: "terminal" };
      reserved = true;
      return { state: "pending", idempotent: idempotentReservation };
    },
    async uploadSynthetic(receipt, count) {
      const role = receipt === TARGET ? "target" : "sibling";
      trace.push(`upload:${role}:${count}`);
      if (failTargetUpload && receipt === TARGET) throw new Error("upload_failed");
      counts.set(receipt, count);
    },
    async inspectReceipt(receipt) {
      const role = receipt === TARGET ? "target" : "sibling";
      trace.push(`inspect:${role}`);
      return counts.get(receipt) ?? 0;
    },
    async deleteReceipt(receipt) {
      const role = receipt === TARGET ? "target" : "sibling";
      trace.push(`delete:${role}`);
      const count = counts.get(receipt) ?? 0;
      counts.set(receipt, 0);
      return count > 0
        ? { status: "deleted", deleted_count: 1 }
        : { status: "not_found", deleted_count: 0 };
    },
    async reconcile() {
      trace.push("reconcile");
      if (!reserved) throw new Error("not_reserved");
      const count = counts.get(TARGET) ?? 0;
      counts.set(TARGET, 0);
      terminal = true;
      return {
        stale_after_seconds: 3600,
        cutoff: "2026-08-22T12:00:01.000Z",
        scanned: 1,
        deleted: count > 0 ? 1 : 0,
        not_found: count > 0 ? 0 : 1,
        acknowledged: 1,
        errors: {},
      };
    },
    async assertReceiptTerminal(receipt) {
      trace.push(receipt === TARGET ? "terminal:target" : "terminal:other");
      return terminal;
    },
  };
}

test("CLI requires an explicit phase, hosted flag, and state where needed", () => {
  assert.deepEqual(
    parseCliArgs(["--execute-hosted", "--phase", "edge-preflight"]),
    { executeHosted: true, phase: "edge-preflight", stateFile: null },
  );
  assert.deepEqual(
    parseCliArgs([
      "--execute-hosted",
      "--phase",
      "prepare",
      "--state-file",
      STATE_FILE,
    ]),
    { executeHosted: true, phase: "prepare", stateFile: STATE_FILE },
  );
  assert.throws(() => parseCliArgs([]), /phase is required/u);
  assert.throws(
    () => parseCliArgs(["--phase", "prepare"]),
    /state file is required/iu,
  );
  assert.throws(
    () => parseCliArgs(["--phase", "unknown"]),
    /invalid canary phase/iu,
  );
  assert.throws(
    () => parseCliArgs(["--phase", "edge-preflight", "--unknown"]),
    /unknown argument/iu,
  );
});

test("hosted execution has a double authorization lock", () => {
  assert.throws(
    () => assertExecutionAuthorized({ executeHosted: false, env: {} }),
    /explicit hosted execution flag/iu,
  );
  assert.throws(
    () => assertExecutionAuthorized({ executeHosted: true, env: {} }),
    /authorization environment gate/iu,
  );
  assert.equal(
    assertExecutionAuthorized({
      executeHosted: true,
      env: { THROUGHLINE_EVALUATION_HOSTED_CANARY_AUTHORIZED: "true" },
    }),
    true,
  );
});

test("hosted configuration is fixed to the approved project and Storage contract", () => {
  const env = {
    SUPABASE_URL: "https://ywsenspsfyrdhgyxgcrv.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role",
    THROUGHLINE_API_TOKEN: "synthetic-api-token",
    THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN: "synthetic-delete-token",
    THROUGHLINE_AUDIO_BUCKET: "throughline-audio",
    THROUGHLINE_PRIVATE_ARTIFACT_PREFIX: "evaluation-artifacts",
    THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS: "3600",
  };
  const config = readHostedCanaryConfig(env);
  assert.equal(config.origin, env.SUPABASE_URL);
  assert.equal(config.bucket, "throughline-audio");
  assert.equal(config.prefix, "evaluation-artifacts");
  assert.equal(config.staleSeconds, 3600);
  for (const override of [
    { SUPABASE_URL: "https://other-project.supabase.co" },
    { THROUGHLINE_AUDIO_BUCKET: "other-bucket" },
    { THROUGHLINE_PRIVATE_ARTIFACT_PREFIX: "other-prefix" },
    { THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS: "300" },
  ]) {
    assert.throws(
      () => readHostedCanaryConfig({ ...env, ...override }),
      /configuration/iu,
    );
  }
});

test("state files are restricted to an exact private temporary namespace", () => {
  assert.equal(validateStateFilePath(STATE_FILE), STATE_FILE);
  for (const unsafe of [
    "relative.json",
    "/private/tmp/unrelated.json",
    "/tmp/throughline-evaluation-edge-canary-test.txt",
    "/home/example/throughline-evaluation-edge-canary-test.json",
  ]) {
    assert.throws(() => validateStateFilePath(unsafe), /state file path/u);
  }
});

test("real state storage creates a private regular file and removes only that file", async () => {
  const path = `/private/tmp/throughline-evaluation-edge-canary-${process.pid}.json`;
  const store = createCanaryStateStore(path);
  await store.write({ phase: "synthetic" });
  const metadata = await lstat(path);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.equal(metadata.mode & 0o777, 0o600);
  assert.deepEqual(await store.read(), { phase: "synthetic" });
  await store.remove();
  await assert.rejects(lstat(path), /ENOENT/u);
});

test("privacy guard rejects receipts, credentials, URLs, and object paths", () => {
  assert.equal(
    assertPrivacySafeCanaryOutput({ status: "pass", wait_until: "2026-08-22T13:00:00.000Z" }),
    true,
  );
  for (const unsafe of [
    TARGET,
    "Bearer synthetic-credential",
    "https://project.supabase.co/functions/v1/api",
    "evaluation-artifacts/object-name",
    "service_role_key=not-safe",
  ]) {
    assert.throws(
      () => assertPrivacySafeCanaryOutput(unsafe),
      /privacy-safe/u,
    );
  }
});

test("direct Edge preflight proves scope, idempotency, sibling survival, and cleanup", async () => {
  const runtime = createRuntime();
  const result = await runEdgeStoragePreflight({ runtime });

  assert.deepEqual(result, {
    mode: "hosted-edge-preflight",
    status: "pass",
    checks: [
      "synthetic_upload",
      "edge_storage_delete",
      "target_absence",
      "sibling_survival",
      "idempotency",
      "cleanup",
      "privacy",
    ],
  });
  assert.deepEqual(runtime.trace, [
    "generate",
    "inspect:target",
    "inspect:sibling",
    "upload:target:2",
    "upload:sibling:1",
    "inspect:target",
    "inspect:sibling",
    "delete:target",
    "inspect:target",
    "inspect:sibling",
    "delete:target",
    "delete:sibling",
    "inspect:sibling",
    "delete:sibling",
  ]);
});

test("direct Edge preflight refuses a non-empty generated scope without deleting it", async () => {
  const runtime = createRuntime({ preexistingTarget: true });
  await assert.rejects(
    runEdgeStoragePreflight({ runtime }),
    /scope is not empty/iu,
  );
  assert.deepEqual(runtime.trace, ["generate", "inspect:target"]);
});

test("prepare reserves before upload, persists 0600-backed state, and establishes the wait gate", async () => {
  const runtime = createRuntime();
  const result = await prepareReconciliationCanary({
    runtime,
    nowMs: START,
    staleSeconds: 3600,
  });

  assert.deepEqual(result, {
    mode: "hosted-reconciliation-prepare",
    status: "pending",
    wait_until: "2026-08-22T13:00:00.000Z",
    checks: ["registry_reservation", "synthetic_upload", "sibling_seed", "state_sealed", "privacy"],
  });
  assert.deepEqual(runtime.trace, [
    "generate",
    "state:generated",
    "reserve:target",
    "state:reserved",
    "inspect:target",
    "inspect:sibling",
    "upload:target:2",
    "upload:sibling:1",
    "inspect:target",
    "inspect:sibling",
    "state:prepared",
  ]);
  assert.equal(runtime.state.value.phase, "prepared");
  assert.equal(runtime.state.value.notBefore, "2026-08-22T13:00:00.000Z");
});

test("prepare rejects an idempotent reservation without touching its receipt scope", async () => {
  const runtime = createRuntime({ idempotentReservation: true });
  await assert.rejects(
    prepareReconciliationCanary({ runtime, nowMs: START, staleSeconds: 3600 }),
    /pre-existing receipt/iu,
  );
  assert.deepEqual(runtime.trace, [
    "generate",
    "state:generated",
    "reserve:target",
  ]);
});

test("prepare retains recovery state and removes partial objects after failure", async () => {
  const runtime = createRuntime({ failTargetUpload: true });
  await assert.rejects(
    prepareReconciliationCanary({ runtime, nowMs: START, staleSeconds: 3600 }),
    /synthetic upload failed/iu,
  );
  assert.equal(runtime.state.value.phase, "reserved");
  assert.deepEqual(runtime.trace.slice(-2), ["upload:target:2", "delete:target"]);
  assert.equal(runtime.state.removed, false);
});

test("exercise refuses to run before the stale window", async () => {
  const runtime = createRuntime();
  await prepareReconciliationCanary({ runtime, nowMs: START, staleSeconds: 3600 });
  await assert.rejects(
    exerciseReconciliationCanary({ runtime, nowMs: START + 3_599_000 }),
    /stale window has not elapsed/u,
  );
  assert.equal(runtime.trace.includes("reconcile"), false);
});

test("exercise proves API to deletion Edge to Storage, terminal acknowledgment, idempotency, and cleanup", async () => {
  const runtime = createRuntime();
  await prepareReconciliationCanary({ runtime, nowMs: START, staleSeconds: 3600 });
  runtime.trace.length = 0;

  const result = await exerciseReconciliationCanary({
    runtime,
    nowMs: START + 3_601_000,
  });

  assert.deepEqual(result, {
    mode: "hosted-reconciliation-exercise",
    status: "pass",
    checks: [
      "api_edge_reconciliation",
      "deletion_edge_storage",
      "target_absence",
      "sibling_survival",
      "registry_terminal",
      "idempotency",
      "cleanup",
      "privacy",
    ],
  });
  assert.deepEqual(runtime.trace, [
    "state:read",
    "inspect:target",
    "inspect:sibling",
    "reconcile",
    "inspect:target",
    "inspect:sibling",
    "terminal:target",
    "delete:target",
    "delete:sibling",
    "inspect:sibling",
    "delete:sibling",
    "state:remove",
  ]);
  assert.equal(runtime.state.removed, true);
});
