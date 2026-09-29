import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDeletionResponse,
  assertPrivacySafeText,
  canaryResourceNames,
  createContractOnlyRuntime,
  parseCliArgs,
  publishedPort,
  runArtifactDeletionCanary,
} from "./verify-evaluation-artifact-canary.mjs";

test("CLI defaults to the real fail-closed canary and supports contract-only", () => {
  assert.deepEqual(parseCliArgs([]), { contractOnly: false });
  assert.deepEqual(parseCliArgs(["--contract-only"]), { contractOnly: true });
  assert.throws(() => parseCliArgs(["--unknown"]), /Unknown argument/u);
});

test("parses Docker IPv4 and IPv6 dynamic port mappings", () => {
  assert.equal(publishedPort("127.0.0.1:49152\n", 3000), 49152);
  assert.equal(publishedPort("[::]:49153\n", 8080), 49153);
  assert.throws(() => publishedPort("", 3000), /did not publish/u);
});

test("deletion receipts have one exact bounded public shape", () => {
  assert.deepEqual(
    assertDeletionResponse({ status: "deleted", deleted_count: 2 }, 200),
    { status: "deleted", deleted_count: 2 },
  );
  assert.deepEqual(
    assertDeletionResponse({ status: "not_found", deleted_count: 0 }, 200),
    { status: "not_found", deleted_count: 0 },
  );
  assert.deepEqual(assertDeletionResponse(null, 404), {
    status: "not_found",
    deleted_count: 0,
  });

  for (const invalid of [
    [{ status: "deleted", deleted_count: -1 }, 200],
    [{ status: "deleted", deleted_count: 1, receipt: "secret" }, 200],
    [{ status: "not_found", deleted_count: 1 }, 200],
    [{ status: "other", deleted_count: 0 }, 200],
    [{ status: "deleted", deleted_count: 1 }, 201],
  ]) {
    assert.throws(
      () => assertDeletionResponse(invalid[0], invalid[1]),
      /deletion response/u,
    );
  }
});

test("privacy scanner rejects credentials, receipts, paths, and private content", () => {
  assert.equal(assertPrivacySafeText("artifact canary: PASS"), true);
  for (const unsafe of [
    `token=${"t".repeat(24)}`,
    `receipt=${"a".repeat(64)}`,
    "private/case/input.wav",
    "materializer_receipt_sha256",
    "synthetic private sentinel",
  ]) {
    assert.throws(() => assertPrivacySafeText(unsafe), /privacy-safe/u);
  }
});

test("contract-only runtime proves auth, shape, scope, idempotency, sibling survival, privacy, and cleanup", async () => {
  const runtime = createContractOnlyRuntime();
  const result = await runArtifactDeletionCanary({ runtime });

  assert.deepEqual(result, {
    mode: "contract-only",
    status: "pass",
    checks: [
      "health",
      "auth",
      "request_shape",
      "receipt_scope",
      "idempotency",
      "sibling_survival",
      "privacy",
      "cleanup",
    ],
  });
  assert.equal(runtime.state.cleanupCalls, 1);
  assert.equal(runtime.state.active, false);
});

test("cleanup still runs after a contract failure", async () => {
  const runtime = createContractOnlyRuntime({ corruptFirstDeletion: true });
  await assert.rejects(
    runArtifactDeletionCanary({ runtime }),
    /deletion response/u,
  );
  assert.equal(runtime.state.cleanupCalls, 1);
  assert.equal(runtime.state.active, false);
});

test("real mode fails closed when Docker cannot be started", async () => {
  const runtime = {
    mode: "container-postgrest",
    state: { cleanupCalls: 0 },
    async setup() {
      const error = new Error("docker command unavailable");
      error.code = "ENOENT";
      throw error;
    },
    async cleanup() {
      this.state.cleanupCalls += 1;
    },
  };

  await assert.rejects(
    runArtifactDeletionCanary({ runtime }),
    /docker command unavailable/u,
  );
  assert.equal(runtime.state.cleanupCalls, 1);
});

test("every disposable runtime resource is uniquely namespaced", () => {
  assert.deepEqual(canaryResourceNames("synthetic-prefix"), {
    network: "synthetic-prefix-network",
    postgres: "synthetic-prefix-postgres",
    postgrest: "synthetic-prefix-postgrest",
    service: "synthetic-prefix-service",
    serviceImage: "synthetic-prefix:local",
    volume: "synthetic-prefix-volume",
  });
});
