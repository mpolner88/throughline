#!/usr/bin/env node

// Prepared verification only. Hosted execution requires both authorization gates.
// Audio exists only in memory. The private recovery journal never contains JWTs,
// audio, transcripts, notes, or raw server responses.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const ORIGIN = "https://ywsenspsfyrdhgyxgcrv.supabase.co";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RECORDING = /^rec_[a-z0-9_-]{1,124}$/iu;
const TERMINAL = new Set([
  "processed",
  "needs_transcript",
  "needs_extractor",
  "transcription_failed",
  "extraction_failed",
  "processing_failed",
]);
const SAFE_STAGES = new Set([
  "configuration",
  "authorization",
  "identity",
  "journal",
  "preflight",
  "upload",
  "receipt",
  "replay",
  "reconciliation",
  "processing",
  "cleanup",
  "complete",
]);
const MAX_RESPONSE_BYTES = 1_048_576;

class CanaryError extends Error {
  constructor(stage) {
    super("Capture canary check failed");
    this.stage = SAFE_STAGES.has(stage) ? stage : "configuration";
  }
}
function requireCheck(value, stage) {
  if (!value) throw new CanaryError(stage);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${canonical(value[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value);
}

export function readConfig(env, args) {
  requireCheck(
    args.length === 1 &&
      ["--execute-hosted", "--cleanup-only"].includes(args[0]),
    "authorization",
  );
  requireCheck(
    env.THROUGHLINE_CAPTURE_HOSTED_CANARY_AUTHORIZED === "true",
    "authorization",
  );
  requireCheck(
    env.THROUGHLINE_CAPTURE_CANARY_SYNTHETIC_ACCOUNT_CONFIRMED === "true",
    "authorization",
  );
  const url = new URL(env.SUPABASE_URL || ORIGIN);
  requireCheck(url.href === ORIGIN + "/", "configuration");
  const accessToken = env.THROUGHLINE_CAPTURE_CANARY_ACCESS_TOKEN?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  const owner = env.THROUGHLINE_CAPTURE_CANARY_OWNER_ID?.toLowerCase();
  const stateFile = env.THROUGHLINE_CAPTURE_CANARY_STATE_FILE;
  requireCheck(
    accessToken && anonKey && UUID.test(owner || "") && stateFile &&
      path.isAbsolute(stateFile),
    "configuration",
  );
  return {
    origin: ORIGIN,
    accessToken,
    anonKey,
    owner,
    stateFile,
    cleanupOnly: args[0] === "--cleanup-only",
  };
}

export function generatedTone() {
  const sampleRate = 16000;
  const samples = sampleRate * 2;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    buffer.writeInt16LE(
      Math.round(327 * Math.sin(2 * Math.PI * 440 * i / sampleRate)),
      44 + i * 2,
    );
  }
  return buffer;
}

export function newState(owner, now = new Date()) {
  const audio = generatedTone();
  return {
    format: "throughline-capture-canary-v1",
    owner_id: owner,
    capture_id: randomUUID(),
    captured_at: now.toISOString(),
    audio_sha256: createHash("sha256").update(audio).digest("hex"),
    audio_bytes: audio.length,
    may_have_sent: false,
    receipt: null,
    cleanup_confirmed: false,
  };
}

function validateState(state, owner) {
  const audio = generatedTone();
  requireCheck(
    state?.format === "throughline-capture-canary-v1" &&
      state.owner_id === owner && UUID.test(state.capture_id || "") &&
      Number.isFinite(Date.parse(state.captured_at)) &&
      state.audio_bytes === audio.length &&
      state.audio_sha256 === createHash("sha256").update(audio).digest("hex") &&
      typeof state.may_have_sent === "boolean" &&
      typeof state.cleanup_confirmed === "boolean",
    "journal",
  );
  if (state.receipt) validateReceipt(state.receipt, state);
  return state;
}

export function validateReceipt(receipt, state) {
  requireCheck(
    receipt?.version === 1 && receipt.owner_id === state.owner_id &&
      receipt.capture_id === state.capture_id &&
      RECORDING.test(receipt.recording_id || "") &&
      Number.isFinite(Date.parse(receipt.accepted_at)) &&
      receipt.audio_sha256 === state.audio_sha256 &&
      receipt.audio_bytes === state.audio_bytes &&
      Date.parse(receipt.captured_at) === Date.parse(state.captured_at),
    "receipt",
  );
  if (state.receipt) {
    requireCheck(canonical(receipt) === canonical(state.receipt), "receipt");
  }
  return receipt;
}

export async function openJournal(config) {
  const directory = await fs.realpath(path.dirname(config.stateFile));
  const workspace = await fs.realpath(
    fileURLToPath(new URL("../", import.meta.url)),
  );
  requireCheck(
    directory !== workspace && !directory.startsWith(workspace + path.sep),
    "journal",
  );
  const parentStat = await fs.stat(directory);
  requireCheck((parentStat.mode & 0o077) === 0, "journal");
  const target = path.join(directory, path.basename(config.stateFile));
  if (config.cleanupOnly) {
    const stat = await fs.lstat(target);
    requireCheck(
      stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 &&
        stat.size <= 8192,
      "journal",
    );
    const state = validateState(
      JSON.parse(await fs.readFile(target, "utf8")),
      config.owner,
    );
    return {
      state,
      save: (value) => saveJournal(target, value),
      remove: () => fs.unlink(target),
    };
  }
  const state = newState(config.owner);
  const handle = await fs.open(target, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(state));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(directory);
  return {
    state,
    save: (value) => saveJournal(target, value),
    remove: () => fs.unlink(target),
  };
}
async function syncDirectory(directory) {
  const handle = await fs.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function saveJournal(target, value) {
  const temporary = target + "." + randomUUID();
  const handle = await fs.open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value));
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, target);
  await syncDirectory(path.dirname(target));
}

export function createRuntime(
  config,
  {
    fetcher = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  async function call(
    route,
    { method = "GET", headers = {}, body, authRoute = false } = {},
  ) {
    try {
      const response = await fetcher(
        config.origin + (authRoute ? route : "/functions/v1/api" + route),
        {
          method,
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            apikey: config.anonKey,
            ...headers,
          },
          body,
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        },
      );
      const reader = response.body?.getReader();
      const chunks = [];
      let length = 0;
      if (reader) {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new CanaryError("reconciliation");
          }
          chunks.push(part.value);
        }
      }
      let payload = null;
      if (length) {
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch { /* bounded invalid response */ }
      }
      return { status: response.status, body: payload };
    } catch {
      return { status: 0, body: null };
    }
  }
  return {
    sleep,
    async identity() {
      const result = await call("/auth/v1/user", { authRoute: true });
      return result.status === 200 ? result.body?.id : null;
    },
    status: (state) => call(`/captures/${state.capture_id}`),
    upload: (state) =>
      call("/recordings", {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
          "x-throughline-capture-id": state.capture_id,
          "x-throughline-audio-sha256": state.audio_sha256,
          "x-throughline-audio-bytes": String(state.audio_bytes),
          "x-throughline-captured-at": state.captured_at,
          "x-throughline-user-local-time": state.captured_at,
          "x-throughline-timezone": "UTC",
          "x-throughline-duration-seconds": "2",
          "x-throughline-recording-type": "freeform",
        },
        body: generatedTone(),
      }),
    list: () => call("/recordings"),
    detail: (id) => call(`/recordings/${encodeURIComponent(id)}`),
    delete: (id) =>
      call(`/recordings/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}
function ownedRows(result, state) {
  requireCheck(
    result.status === 200 && Array.isArray(result.body?.recordings) &&
      result.body.recordings.length < 1000,
    "reconciliation",
  );
  return result.body.recordings.filter((row) =>
    row.capture_id === state.capture_id
  );
}
function deletedOutcome(result, state) {
  return result.status === 200 &&
    result.body?.capture_outcome === "owner_deleted" &&
    result.body.owner_deleted?.owner_id === state.owner_id &&
    result.body.owner_deleted?.capture_id === state.capture_id &&
    Number.isFinite(Date.parse(result.body.owner_deleted?.deleted_at));
}

export async function cleanupCanary(runtime, journal) {
  const state = journal.state;
  if (!state.may_have_sent) return "not_needed";
  let status = await runtime.status(state);
  if (!deletedOutcome(status, state)) {
    if (status.status !== 202 || status.body?.capture_outcome !== "accepted") {
      return "pending";
    }
    const receipt = validateReceipt(status.body.capture_receipt, state);
    state.receipt = receipt;
    await journal.save(state);
    const detail = await runtime.detail(receipt.recording_id);
    if (detail.status !== 404) {
      requireCheck(
        detail.status === 200 &&
          detail.body?.recording?.auth_user_id === state.owner_id &&
          detail.body.recording.capture_id === state.capture_id &&
          detail.body.recording.id === receipt.recording_id,
        "cleanup",
      );
      const deleted = await runtime.delete(receipt.recording_id);
      if (deleted.status !== 200 && deleted.status !== 404) return "pending";
    }
    status = await runtime.status(state);
  }
  if (!deletedOutcome(status, state)) return "pending";
  // Tombstone is expected to remain until account deletion. The canary never
  // deletes accounts, tombstones, unrelated notes, or Storage objects directly.
  if (ownedRows(await runtime.list(), state).length !== 0) return "pending";
  if (
    state.receipt &&
    (await runtime.detail(state.receipt.recording_id)).status !== 404
  ) return "pending";
  state.cleanup_confirmed = true;
  await journal.save(state);
  return "confirmed";
}

export async function runCanary({ runtime, journal, cleanupOnly = false }) {
  const state = journal.state;
  let stage = "identity";
  let processing = "not_observed";
  let cleanup = "not_started";
  let passed = false;
  let identityVerified = false;
  let concurrentRequests = 0;
  try {
    requireCheck(await runtime.identity() === state.owner_id, "identity");
    identityVerified = true;
    if (cleanupOnly) {
      stage = "cleanup";
      cleanup = await cleanupCanary(runtime, journal);
      passed = ["confirmed", "not_needed"].includes(cleanup);
    } else {
      stage = "preflight";
      const before = await runtime.status(state);
      requireCheck(
        before.status === 200 &&
          before.body?.capture_outcome === "nothing_held",
        stage,
      );
      requireCheck(ownedRows(await runtime.list(), state).length === 0, stage);
      state.may_have_sent = true;
      await journal.save(state);
      stage = "upload";
      // Wait for every dispatched request before cleanup. A rejected promise must
      // never race a still-running parallel upload against the deletion check.
      concurrentRequests = 4;
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => runtime.upload(state)),
      );
      for (const result of results) {
        requireCheck(
          result.status === "fulfilled" && result.value.status === 202 &&
            result.value.body?.capture_outcome === "accepted",
          stage,
        );
        state.receipt = validateReceipt(
          result.value.body.capture_receipt,
          state,
        );
        await journal.save(state);
      }
      stage = "replay";
      const replay = await runtime.upload(state);
      requireCheck(
        replay.status === 202 && replay.body?.capture_outcome === "accepted",
        stage,
      );
      validateReceipt(replay.body.capture_receipt, state);
      const reconciled = await runtime.status(state);
      requireCheck(
        reconciled.status === 202 &&
          reconciled.body?.capture_outcome === "accepted",
        stage,
      );
      validateReceipt(reconciled.body.capture_receipt, state);
      stage = "reconciliation";
      const rows = ownedRows(await runtime.list(), state);
      requireCheck(
        rows.length === 1 && rows[0].id === state.receipt.recording_id,
        stage,
      );
      stage = "processing";
      for (let attempt = 0; attempt < 10; attempt++) {
        const detail = await runtime.detail(state.receipt.recording_id);
        requireCheck(
          detail.status === 200 &&
            detail.body?.recording?.capture_id === state.capture_id &&
            detail.body.recording.auth_user_id === state.owner_id,
          stage,
        );
        const observed = detail.body.recording.processing_status;
        requireCheck(
          TERMINAL.has(observed) ||
            ["uploaded", "transcribed"].includes(observed),
          stage,
        );
        processing = TERMINAL.has(observed) ? observed : "unfinished";
        if (TERMINAL.has(observed)) break;
        if (attempt < 9) await runtime.sleep(5000);
      }
      stage = "cleanup";
      cleanup = await cleanupCanary(runtime, journal);
      requireCheck(cleanup === "confirmed", stage);
      const deletedReplay = await runtime.upload(state);
      requireCheck(deletedOutcome(deletedReplay, state), stage);
      requireCheck(ownedRows(await runtime.list(), state).length === 0, stage);
      passed = true;
    }
  } catch (error) {
    if (error instanceof CanaryError) stage = error.stage;
  } finally {
    if (!passed && state.may_have_sent && identityVerified) {
      try {
        cleanup = await cleanupCanary(runtime, journal);
      } catch {
        cleanup = "pending";
      }
    }
    if (
      ["confirmed", "not_needed"].includes(cleanup) ||
      (!state.may_have_sent && !cleanupOnly)
    ) {
      try {
        await journal.remove();
      } catch { /* private state may remain for inspection */ }
    }
  }
  return {
    mode: "hosted-capture-canary",
    status: passed ? "pass" : "fail",
    stage: passed ? "complete" : stage,
    cleanup,
    concurrent_requests: concurrentRequests,
    processing_status: processing,
    processing_claim_count_verified: false,
    audio_object_count_verified: false,
    physical_audio_cleanup_verified: false,
    provider_execution: "standard_pipeline_may_run",
    tombstone_expected_after_cleanup: cleanup === "confirmed",
  };
}

export async function main(args = process.argv.slice(2), env = process.env) {
  let result;
  try {
    const config = readConfig(env, args);
    const journal = await openJournal(config);
    result = await runCanary({
      runtime: createRuntime(config),
      journal,
      cleanupOnly: config.cleanupOnly,
    });
  } catch (error) {
    result = {
      mode: "hosted-capture-canary",
      status: "fail",
      stage: error instanceof CanaryError ? error.stage : "configuration",
      cleanup: "not_started",
    };
  }
  // Fixed keys and bounded category values only. Never serialize an Error,
  // response payload, URL, journal, credential, or identifier.
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.status !== "pass") process.exitCode = 1;
  return result;
}
if (
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
) await main();
