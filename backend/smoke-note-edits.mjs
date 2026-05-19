#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "throughline-note-edits-"));
const port = 5400 + Math.floor(Math.random() * 1000);
const baseURL = `http://127.0.0.1:${port}`;
const token = "test-token";
let server;

try {
  server = spawn(process.execPath, ["backend/stub-server.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      THROUGHLINE_API_TOKEN: token,
      THROUGHLINE_STUB_DATA_DIR: tmpDir,
      THROUGHLINE_EXTRACTOR_COMMAND: "./backend/dev-extractor.mjs",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForServer();

  const created = await request("/recordings", {
    method: "POST",
    body: {
      type: "freeform",
      duration_seconds: 8,
      transcript_raw:
        "Tomorrow update the launch checklist and call Sam about the Throughline beta.",
    },
  });

  const recordingId = created.id;
  assert.ok(recordingId, "recording id should be returned");
  assert.equal(created.recording.processing_status, "processed");

  const edited = await request(`/recordings/${encodeURIComponent(recordingId)}`, {
    method: "PATCH",
    body: {
      title: "Edited launch memory",
      summary: "Corrected summary for the agent to read.",
      transcript:
        "Corrected transcript. The important next step is edited follow-up with Sam.",
      most_important: [
        "Edited follow-up with Sam",
        "Ship the updated checklist",
      ],
      todos: [
        "Edited follow-up with Sam",
      ],
    },
  });

  assert.equal(edited.recording.transcript_raw, "Corrected transcript. The important next step is edited follow-up with Sam.");
  assert.equal(edited.recording.structured_note.title, "Edited launch memory");
  assert.equal(edited.recording.structured_note.summary, "Corrected summary for the agent to read.");
  assert.deepEqual(edited.recording.structured_note.most_important, [
    "Edited follow-up with Sam",
    "Ship the updated checklist",
  ]);
  assert.deepEqual(edited.recording.structured_note.todos.map((todo) => todo.text), [
    "Edited follow-up with Sam",
  ]);
  assert.deepEqual(
    edited.recording.structured_note.action_items.map((item) => ({
      text: item.text,
      status: item.status,
      source: item.source,
    })),
    [
      { text: "Edited follow-up with Sam", status: "open", source: "todo" },
      { text: "Ship the updated checklist", status: "open", source: "most_important" },
    ],
  );

  const search = await request("/agent/tools/search", {
    method: "POST",
    body: { query: "edited follow-up with Sam", limit: 5 },
  });
  assert.equal(search.output.results[0].recording.id, recordingId);

  const todos = await request("/agent/tools/list_open_todos", {
    method: "POST",
    body: { limit: 10 },
  });
  assert.deepEqual(todos.output.todos.map((todo) => todo.text), [
    "Edited follow-up with Sam",
    "Ship the updated checklist",
  ]);

  console.log("note edit smoke passed");
} finally {
  server?.kill("SIGTERM");
  await rm(tmpDir, { recursive: true, force: true });
}

async function waitForServer() {
  const deadline = Date.now() + 5000;
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`stub server exited early: ${stderr}`);
    }

    try {
      const response = await fetch(`${baseURL}/health`);
      if (response.ok) return;
    } catch {
      // Keep polling until the server binds the port.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`stub server did not start: ${stderr}`);
}

async function request(pathname, { method, body }) {
  const response = await fetch(`${baseURL}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed ${response.status}: ${text}`);
  }

  return payload;
}
