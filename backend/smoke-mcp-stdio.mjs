#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "mcp-stdio-server.mjs");
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-mcp-stdio-"));

let child;

try {
  const recordingsDir = path.join(tmpDir, "recordings");
  await fs.mkdir(recordingsDir, { recursive: true });
  await writeRecording(recordingsDir, morningRecording());
  await writeRecording(recordingsDir, eveningRecording());

  child = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      THROUGHLINE_STUB_DATA_DIR: tmpDir,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const client = createJsonRpcClient(child);

  const initialize = await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "throughline-smoke",
      version: "0.0.0",
    },
  });
  assert.equal(initialize.protocolVersion, "2025-06-18");
  assert.ok(initialize.capabilities.tools);

  client.notify("notifications/initialized", {});

  const tools = await client.request("tools/list", {});
  assert.ok(tools.tools.some((tool) => tool.name === "search" && tool.annotations.readOnlyHint));
  assert.ok(tools.tools.some((tool) => tool.name === "get_daily_loop"));

  const search = await client.request("tools/call", {
    name: "search",
    arguments: {
      query: "Sarah pricing",
      start_date: "2026-05-02",
      end_date: "2026-05-02",
    },
  });
  assert.equal(search.content[0].type, "text");
  assert.equal(JSON.parse(search.content[0].text).results.length, 2);
  assert.equal(search.structuredContent.results.length, 2);

  const daily = await client.request("tools/call", {
    name: "get_daily_loop",
    arguments: {
      date: "2026-05-02",
    },
  });
  assert.deepEqual(daily.structuredContent.completion.satisfied.map((item) => item.item), ["Call Sarah about pricing"]);
  assert.deepEqual(daily.structuredContent.completion.outstanding, ["Rewrite the pricing note"]);

  console.log("mcp stdio smoke passed");
} finally {
  if (child && !child.killed) {
    child.kill();
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
}

function createJsonRpcClient(childProcess) {
  let id = 0;
  let stdoutBuffer = "";
  let stderrBuffer = "";
  const pending = new Map();

  childProcess.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString("utf8");
    while (true) {
      const newlineIndex = stdoutBuffer.indexOf("\n");
      if (newlineIndex === -1) return;

      const line = stdoutBuffer.slice(0, newlineIndex);
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!line.trim()) continue;

      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;

      pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    }
  });

  childProcess.stderr.on("data", (chunk) => {
    stderrBuffer += chunk.toString("utf8");
  });

  childProcess.on("exit", (code) => {
    for (const request of pending.values()) {
      request.reject(new Error(`MCP server exited with code ${code}: ${stderrBuffer}`));
    }
    pending.clear();
  });

  return {
    request(method, params) {
      const requestId = ++id;
      const payload = {
        jsonrpc: "2.0",
        id: requestId,
        method,
        params,
      };

      const promise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Timed out waiting for ${method}: ${stderrBuffer}`));
        }, 5000);

        pending.set(requestId, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });

      childProcess.stdin.write(`${JSON.stringify(payload)}\n`);
      return promise;
    },
    notify(method, params) {
      childProcess.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
  };
}

async function writeRecording(recordingsDir, recording) {
  await fs.writeFile(
    path.join(recordingsDir, `${recording.id}.json`),
    `${JSON.stringify(recording, null, 2)}\n`,
  );
}

function morningRecording() {
  return {
    id: "rec_morning",
    created_at: "2026-05-02T13:00:00.000Z",
    user_local_time: "2026-05-02T09:00:00-04:00",
    timezone: "America/New_York",
    type: "morning",
    processing_status: "processed",
    transcript_raw: "Morning note. Priority is call Sarah about pricing before lunch. Tomorrow rewrite the pricing note. I feel focused.",
    structured_note: {
      type: "morning",
      title: "Morning plan",
      summary: "Priority is call Sarah about pricing before lunch. Tomorrow rewrite the pricing note.",
      todos: [
        {
          text: "Rewrite the pricing note",
          status: "open",
          priority: "medium",
          due: null,
          for_date: "2026-05-03",
          context: "tomorrow",
        },
      ],
      priorities: ["Call Sarah about pricing"],
      intentions: [],
      accomplishments: [],
      tomorrow_todos: ["Rewrite the pricing note"],
      mood: "focused",
      people: ["Sarah"],
      projects: ["pricing"],
      tags: ["pricing"],
      centers_of_balance: ["profession"],
    },
  };
}

function eveningRecording() {
  return {
    id: "rec_evening",
    created_at: "2026-05-03T00:00:00.000Z",
    user_local_time: "2026-05-02T20:00:00-04:00",
    timezone: "America/New_York",
    type: "evening",
    processing_status: "processed",
    transcript_raw: "Evening note. I called Sarah about pricing and got energy from the quiet walk. Energy sapper was Slack. I feel grateful.",
    structured_note: {
      type: "evening",
      title: "Evening reflection",
      summary: "Evening note. I called Sarah about pricing and got energy from the quiet walk. Energy sapper was Slack. I feel grateful.",
      todos: [],
      priorities: [],
      intentions: [],
      accomplishments: ["Called Sarah about pricing"],
      tomorrow_todos: [],
      mood: "grateful",
      people: ["Sarah"],
      projects: ["pricing"],
      tags: ["pricing", "energy"],
      centers_of_balance: ["relationships", "profession"],
    },
  };
}
