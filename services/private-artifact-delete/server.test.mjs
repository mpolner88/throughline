import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  createApp,
  createTokenDigest,
  deleteReceiptArtifacts,
  isAuthorized,
  preparePrivateRoot,
  validateDeletePayload,
} from "./server.mjs";

const RECEIPT = "a".repeat(64);
const TOKEN = "synthetic-delete-token";
const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

test("validates the exact receipt-only payload", () => {
  assert.equal(validateDeletePayload({ materializer_receipt_sha256: RECEIPT }), RECEIPT);
  assert.equal(validateDeletePayload({ materializer_receipt_sha256: RECEIPT.toUpperCase() }), null);
  assert.equal(validateDeletePayload({ materializer_receipt_sha256: RECEIPT, path: "ignored" }), null);
  assert.equal(validateDeletePayload([RECEIPT]), null);
});

test("compares bearer credentials through fixed-length digests", () => {
  const digest = createTokenDigest(TOKEN);
  assert.equal(isAuthorized(`Bearer ${TOKEN}`, digest), true);
  assert.equal(isAuthorized("Bearer wrong", digest), false);
  assert.equal(isAuthorized(`bearer ${TOKEN}`, digest), false);
  assert.equal(isAuthorized(undefined, digest), false);
});

test("deletes the complete direct receipt child and is idempotent", async () => {
  const fixture = await createFixture();
  const receiptRoot = path.join(fixture.root, RECEIPT);
  await mkdir(path.join(receiptRoot, "cases", "synthetic-case"), { recursive: true });
  await writeFile(path.join(receiptRoot, "cases", "synthetic-case", "artifact.bin"), "synthetic");

  assert.deepEqual(await deleteReceiptArtifacts(fixture.root, RECEIPT), {
    status: "deleted",
    deleted_count: 1,
  });
  assert.deepEqual(await deleteReceiptArtifacts(fixture.root, RECEIPT), {
    status: "not_found",
    deleted_count: 0,
  });
});

test("finishes a crash-left tombstone without requiring the receipt root", async () => {
  const fixture = await createFixture();
  const tombstone = path.join(
    fixture.root,
    `.throughline-delete-in-progress-${RECEIPT}`,
  );
  await mkdir(tombstone);
  await writeFile(path.join(tombstone, "synthetic.bin"), "synthetic");

  assert.deepEqual(await deleteReceiptArtifacts(fixture.root, RECEIPT), {
    status: "deleted",
    deleted_count: 1,
  });
});

test("concurrent retries safely converge on one absent receipt root", async () => {
  const fixture = await createFixture();
  const receiptRoot = path.join(fixture.root, RECEIPT);
  await mkdir(path.join(receiptRoot, "nested"), { recursive: true });
  await writeFile(path.join(receiptRoot, "nested", "synthetic.bin"), "synthetic");

  const results = await Promise.all(
    Array.from({ length: 12 }, () => deleteReceiptArtifacts(fixture.root, RECEIPT)),
  );
  assert.equal(results.some((result) => result.status === "deleted"), true);
  assert.deepEqual(await deleteReceiptArtifacts(fixture.root, RECEIPT), {
    status: "not_found",
    deleted_count: 0,
  });
});

test("rejects symlinks and non-directory receipt children", async () => {
  const fixture = await createFixture();
  const outside = path.join(fixture.base, "outside.txt");
  await writeFile(outside, "synthetic");
  await symlink(outside, path.join(fixture.root, RECEIPT));

  await assert.rejects(
    deleteReceiptArtifacts(fixture.root, RECEIPT),
    { code: "invalid_artifact_root" },
  );
  assert.equal(await readFile(outside, "utf8"), "synthetic");
});

test("rejects a configured private root that is itself a symlink", async () => {
  const fixture = await createFixture();
  const linkedRoot = path.join(fixture.base, "linked-root");
  await symlink(fixture.root, linkedRoot);
  await assert.rejects(preparePrivateRoot(linkedRoot), /private_root_invalid/u);
});

test("HTTP contract authenticates, validates, caps, deletes, and returns aggregates", async () => {
  const fixture = await createFixture();
  const receiptRoot = path.join(fixture.root, RECEIPT);
  await mkdir(receiptRoot);
  await writeFile(path.join(receiptRoot, "synthetic.bin"), "synthetic");
  const service = await startFixtureServer(fixture.root, 256);

  const unauthorized = await request(service.url, {
    body: { materializer_receipt_sha256: RECEIPT },
  });
  assert.equal(unauthorized.status, 401);
  assert.deepEqual(unauthorized.json, { error: "unauthorized" });

  const extraKey = await request(service.url, {
    token: TOKEN,
    body: { materializer_receipt_sha256: RECEIPT, path: "synthetic" },
  });
  assert.equal(extraKey.status, 400);
  assert.deepEqual(extraKey.json, { error: "invalid_request" });

  const duplicateKey = await request(service.url, {
    token: TOKEN,
    rawBody: `{"materializer_receipt_sha256":"${RECEIPT}","materializer_receipt_sha256":"${RECEIPT}"}`,
  });
  assert.equal(duplicateKey.status, 400);
  assert.deepEqual(duplicateKey.json, { error: "invalid_request" });

  const tooLarge = await request(service.url, {
    token: TOKEN,
    rawBody: JSON.stringify({ padding: "x".repeat(300) }),
  });
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(tooLarge.json, { error: "request_too_large" });

  const deleted = await request(service.url, {
    token: TOKEN,
    body: { materializer_receipt_sha256: RECEIPT },
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.json, { status: "deleted", deleted_count: 1 });

  const notFound = await request(service.url, {
    token: TOKEN,
    body: { materializer_receipt_sha256: RECEIPT },
  });
  assert.equal(notFound.status, 200);
  assert.deepEqual(notFound.json, { status: "not_found", deleted_count: 0 });

  const health = await fetch(`${service.origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
});

test("HTTP contract rejects a receipt child that is not a directory", async () => {
  const fixture = await createFixture();
  await writeFile(path.join(fixture.root, RECEIPT), "synthetic");
  const service = await startFixtureServer(fixture.root);
  const response = await request(service.url, {
    token: TOKEN,
    body: { materializer_receipt_sha256: RECEIPT },
  });
  assert.equal(response.status, 409);
  assert.deepEqual(response.json, { error: "invalid_artifact_root" });
});

async function createFixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "throughline-artifact-delete-"));
  const root = path.join(base, "private-root");
  await mkdir(root, { mode: 0o700 });
  cleanups.push(() => import("node:fs/promises").then(({ rm }) => rm(base, {
    recursive: true,
    force: true,
  })));
  return { base, root };
}

async function startFixtureServer(privateRoot, maxRequestBytes = 4_096) {
  const app = createApp({
    privateRoot,
    tokenDigest: createTokenDigest(TOKEN),
    maxRequestBytes,
  });
  const server = http.createServer((request, response) => {
    Promise.resolve(app(request, response)).catch(() => response.destroy());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return { origin, url: `${origin}/delete` };
}

async function request(url, { token, body, rawBody } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: rawBody ?? JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}
