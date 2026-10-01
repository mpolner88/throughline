import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  createRuntime,
  generatedTone,
  newState,
  openJournal,
  readConfig,
  runCanary,
} from "./verify-capture-hosted-canary.mjs";
const OWNER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
function environment() {
  return {
    SUPABASE_URL: "https://ywsenspsfyrdhgyxgcrv.supabase.co",
    SUPABASE_ANON_KEY: "synthetic-public-key",
    THROUGHLINE_CAPTURE_CANARY_ACCESS_TOKEN: "synthetic-private-jwt",
    THROUGHLINE_CAPTURE_CANARY_OWNER_ID: OWNER,
    THROUGHLINE_CAPTURE_CANARY_STATE_FILE:
      "/private/tmp/canary-private/state.json",
    THROUGHLINE_CAPTURE_CANARY_SYNTHETIC_ACCOUNT_CONFIRMED: "true",
    THROUGHLINE_CAPTURE_HOSTED_CANARY_AUTHORIZED: "true",
  };
}
function fixture(overrides = {}) {
  const state = newState(OWNER, new Date("2026-09-29T00:00:00Z"));
  const receipt = {
    version: 1,
    owner_id: OWNER,
    capture_id: state.capture_id,
    recording_id: "rec_synthetic_capture_canary",
    accepted_at: "2026-09-29T00:01:00Z",
    audio_sha256: state.audio_sha256,
    audio_bytes: state.audio_bytes,
    captured_at: state.captured_at,
  };
  let accepted = false, deleted = false;
  const calls = [];
  const saves = [];
  let removed = false;
  const deletedResult = () => ({
    status: 200,
    body: {
      capture_outcome: "owner_deleted",
      owner_deleted: {
        owner_id: OWNER,
        capture_id: state.capture_id,
        deleted_at: "2026-09-29T00:02:00Z",
      },
    },
  });
  const acceptedResult = () => ({
    status: 202,
    body: { capture_outcome: "accepted", capture_receipt: { ...receipt } },
  });
  const runtime = {
    async identity() {
      calls.push("identity");
      return OWNER;
    },
    async status() {
      calls.push("status");
      return deleted
        ? deletedResult()
        : accepted
        ? acceptedResult()
        : { status: 200, body: { capture_outcome: "nothing_held" } };
    },
    async upload() {
      calls.push("upload");
      assert.equal(state.may_have_sent, true);
      accepted = true;
      return deleted ? deletedResult() : acceptedResult();
    },
    async list() {
      calls.push("list");
      return {
        status: 200,
        body: {
          recordings: accepted && !deleted
            ? [{ id: receipt.recording_id, capture_id: state.capture_id }]
            : [],
        },
      };
    },
    async detail(id) {
      calls.push("detail");
      assert.equal(id, receipt.recording_id);
      return deleted ? { status: 404, body: null } : {
        status: 200,
        body: {
          recording: {
            id,
            auth_user_id: OWNER,
            capture_id: state.capture_id,
            processing_status: "needs_transcript",
          },
        },
      };
    },
    async delete(id) {
      calls.push("delete");
      assert.equal(id, receipt.recording_id);
      deleted = true;
      return { status: 200, body: { deleted: true } };
    },
    async sleep() {},
    ...overrides,
  };
  const journal = {
    state,
    async save(value) {
      saves.push(structuredClone(value));
    },
    async remove() {
      removed = true;
    },
  };
  return {
    runtime,
    journal,
    receipt,
    calls,
    saves,
    get removed() {
      return removed;
    },
    set accepted(value) {
      accepted = value;
    },
    acceptedResult,
    deletedResult,
  };
}
test("execution requires explicit CLI, authorization and synthetic-account designation", () => {
  assert.equal(
    readConfig(environment(), ["--execute-hosted"]).cleanupOnly,
    false,
  );
  assert.equal(readConfig(environment(), ["--cleanup-only"]).cleanupOnly, true);
  for (const args of [[], ["--execute-hosted", "--force"], ["--other"]]) {
    assert.throws(() => readConfig(environment(), args));
  }
  for (
    const key of [
      "THROUGHLINE_CAPTURE_HOSTED_CANARY_AUTHORIZED",
      "THROUGHLINE_CAPTURE_CANARY_SYNTHETIC_ACCOUNT_CONFIRMED",
      "THROUGHLINE_CAPTURE_CANARY_ACCESS_TOKEN",
      "SUPABASE_ANON_KEY",
      "THROUGHLINE_CAPTURE_CANARY_OWNER_ID",
    ]
  ) {
    assert.throws(() =>
      readConfig({ ...environment(), [key]: "" }, ["--execute-hosted"])
    );
  }
  for (
    const url of [
      "https://different.test",
      "https://ywsenspsfyrdhgyxgcrv.supabase.co/redirect",
      "http://ywsenspsfyrdhgyxgcrv.supabase.co",
    ]
  ) {
    assert.throws(() =>
      readConfig({ ...environment(), SUPABASE_URL: url }, ["--execute-hosted"])
    );
  }
});
test("two-second PCM tone is deterministic and created entirely in memory", () => {
  const audio = generatedTone();
  assert.equal(audio.toString("ascii", 0, 4), "RIFF");
  assert.equal(audio.length, 64044);
  assert.equal(audio.readUInt32LE(24), 16000);
  assert.equal(audio.readUInt32LE(40), 64000);
  assert.deepEqual(audio, generatedTone());
  assert.equal(
    createHash("sha256").update(audio).digest("hex"),
    newState(OWNER).audio_sha256,
  );
});
test("successful canary validates concurrency, immutable replay, one row and exact deletion", async () => {
  const f = fixture();
  const result = await runCanary(f);
  assert.equal(result.status, "pass");
  assert.equal(result.cleanup, "confirmed");
  assert.equal(result.processing_status, "needs_transcript");
  assert.equal(result.processing_claim_count_verified, false);
  assert.equal(result.audio_object_count_verified, false);
  assert.equal(f.calls.filter((c) => c === "upload").length, 6);
  assert.equal(f.calls.filter((c) => c === "delete").length, 1);
  assert.equal(f.removed, true);
  assert.equal(f.saves[0].may_have_sent, true);
  const output = JSON.stringify(result);
  for (
    const value of [
      OWNER,
      f.journal.state.capture_id,
      f.receipt.recording_id,
      f.receipt.audio_sha256,
      "synthetic-private-jwt",
    ]
  ) assert.ok(!output.includes(value));
});
test("wrong account refuses before any upload or cleanup request", async () => {
  const f = fixture({
    async identity() {
      return OTHER;
    },
  });
  f.journal.state.may_have_sent = true;
  const result = await runCanary({ ...f, cleanupOnly: true });
  assert.equal(result.status, "fail");
  assert.equal(result.stage, "identity");
  assert.deepEqual(f.calls, []);
  assert.equal(f.removed, false);
});
test("lost upload responses recover exact receipt before cleanup", async () => {
  const f = fixture();
  f.runtime.upload = async () => {
    f.accepted = true;
    return { status: 0, body: null };
  };
  const result = await runCanary(f);
  assert.equal(result.status, "fail");
  assert.equal(result.cleanup, "confirmed");
  assert.equal(f.calls.filter((c) => c === "delete").length, 1);
});
test("all concurrent uploads settle before cleanup starts after one failure", async () => {
  const f = fixture();
  let started = 0;
  let completed = 0;
  f.runtime.upload = async () => {
    const n = ++started;
    if (n === 1) throw new Error("synthetic-error-not-to-print");
    await new Promise((resolve) => setTimeout(resolve, 5));
    completed++;
    f.accepted = true;
    return f.acceptedResult();
  };
  const original = f.runtime.delete;
  f.runtime.delete = async (id) => {
    assert.equal(started, 4);
    assert.equal(completed, 3);
    return original(id);
  };
  const result = await runCanary(f);
  assert.equal(result.cleanup, "confirmed");
  assert.equal(result.status, "fail");
});
test("cleanup-only handles accepted capture after interruption without uploading", async () => {
  const f = fixture();
  f.accepted = true;
  f.journal.state.may_have_sent = true;
  const result = await runCanary({ ...f, cleanupOnly: true });
  assert.equal(result.status, "pass");
  assert.equal(result.cleanup, "confirmed");
  assert.ok(!f.calls.includes("upload"));
});
test("incomplete or uncertain capture stays pending with journal and no broad deletion", async () => {
  for (const outcome of ["incomplete", "nothing_held", "unconfirmed"]) {
    const f = fixture({
      async status() {
        return { status: 200, body: { capture_outcome: outcome } };
      },
    });
    f.journal.state.may_have_sent = true;
    const result = await runCanary({ ...f, cleanupOnly: true });
    assert.equal(result.status, "fail");
    assert.equal(result.cleanup, "pending");
    assert.equal(f.removed, false);
    assert.ok(!f.calls.includes("delete"));
    assert.ok(!f.calls.includes("upload"));
  }
});
test("mismatched receipt or detail never authorizes deletion", async () => {
  for (const mismatch of ["receipt", "detail"]) {
    const f = fixture();
    f.accepted = true;
    f.journal.state.may_have_sent = true;
    if (mismatch === "receipt") f.receipt.owner_id = OTHER;
    else {f.runtime.detail = async () => ({
        status: 200,
        body: {
          recording: {
            id: f.receipt.recording_id,
            capture_id: f.journal.state.capture_id,
            auth_user_id: OTHER,
          },
        },
      });}
    const result = await runCanary({ ...f, cleanupOnly: true });
    assert.equal(result.status, "fail");
    assert.equal(result.cleanup, "pending");
    assert.ok(!f.calls.includes("delete"));
    assert.equal(f.removed, false);
  }
});
test("journal refuses reuse, tracked directory, broad permissions and stores no credentials", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "capture-canary-test-"),
  );
  await fs.chmod(directory, 0o700);
  const config = {
    ...readConfig(environment(), ["--execute-hosted"]),
    stateFile: path.join(directory, "state.json"),
  };
  try {
    const journal = await openJournal(config);
    assert.equal((await fs.stat(config.stateFile)).mode & 0o777, 0o600);
    assert.ok(
      !(await fs.readFile(config.stateFile, "utf8")).includes(
        config.accessToken,
      ),
    );
    await assert.rejects(openJournal(config));
    await assert.rejects(
      openJournal({
        ...config,
        stateFile: path.join(process.cwd(), "state.json"),
      }),
    );
    const resumed = await openJournal({ ...config, cleanupOnly: true });
    assert.equal(resumed.state.capture_id, journal.state.capture_id);
    await fs.chmod(config.stateFile, 0o644);
    await assert.rejects(openJournal({ ...config, cleanupOnly: true }));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
test("runtime sends only exact routes, never redirects credentials and emits no account operations", async () => {
  const requests = [];
  const runtime = createRuntime(
    readConfig(environment(), ["--execute-hosted"]),
    {
      fetcher: async (url, options) => {
        requests.push({ url, options });
        return Response.json({ id: OWNER });
      },
    },
  );
  await runtime.identity();
  await runtime.upload(newState(OWNER));
  await runtime.delete("rec_synthetic");
  assert.equal(requests.length, 3);
  for (const { url, options } of requests) {
    assert.ok(url.startsWith("https://ywsenspsfyrdhgyxgcrv.supabase.co/"));
    assert.equal(options.redirect, "error");
    assert.ok(!url.includes("/account"));
  }
});

test("changed replay receipt fails even with the same owner and recording", async () => {
  const f = fixture();
  const original = f.runtime.upload;
  let uploads = 0;
  f.runtime.upload = async () => {
    const result = await original();
    if (++uploads === 5) {
      result.body.capture_receipt.accepted_at = "2026-09-29T00:03:00Z";
    }
    return result;
  };
  const result = await runCanary(f);
  assert.equal(result.status, "fail");
  assert.equal(result.stage, "receipt");
  assert.equal(result.cleanup, "confirmed");
});

test("duplicate owner-list binding fails and never broadens deletion", async () => {
  const f = fixture();
  const original = f.runtime.list;
  f.runtime.list = async () => {
    const result = await original();
    if (result.body.recordings.length) {
      result.body.recordings.push({
        id: "rec_unmatched_synthetic",
        capture_id: f.journal.state.capture_id,
      });
    }
    return result;
  };
  const result = await runCanary(f);
  assert.equal(result.status, "fail");
  assert.equal(result.stage, "reconciliation");
  assert.equal(f.calls.filter((call) => call === "delete").length, 1);
});
