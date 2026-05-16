#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { listMemoryTools, runMemoryTool } from "./memory-tools.mjs";

const expectedTools = [
  "get_today",
  "get_daily_loop",
  "get_recordings",
  "get_recording",
  "search",
  "list_open_todos",
  "get_recent_reflections",
  "get_energy_patterns",
  "get_balance_snapshot",
];

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-memory-tools-"));

try {
  const recordingsDir = path.join(tmpDir, "recordings");
  await fs.mkdir(recordingsDir, { recursive: true });

  await writeRecording(recordingsDir, {
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
  });

  await writeRecording(recordingsDir, {
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
  });

  const options = { recordingsDir };
  const tool = (name, input) => runMemoryTool(name, input, options);

  assert.deepEqual(listMemoryTools().map((item) => item.name), expectedTools);

  const today = await tool("get_today", { date: "2026-05-02" });
  assert.equal(today.count, 2);

  const daily = await tool("get_daily_loop", { date: "2026-05-02" });
  assert.deepEqual(daily.completion.satisfied.map((item) => item.item), ["Call Sarah about pricing"]);
  assert.deepEqual(daily.completion.outstanding, ["Rewrite the pricing note"]);

  const recordings = await tool("get_recordings", { limit: 1 });
  assert.equal(recordings.recordings.length, 1);
  assert.equal(recordings.next_cursor, "1");

  const recording = await tool("get_recording", { id: "rec_morning" });
  assert.equal(recording.recording.id, "rec_morning");

  const search = await tool("search", { query: "Sarah pricing", limit: 5 });
  assert.equal(search.results.length, 2);

  const todos = await tool("list_open_todos", {});
  assert.equal(todos.todos.length, 1);
  assert.equal(todos.todos[0].text, "Rewrite the pricing note");

  const reflections = await tool("get_recent_reflections", {
    start_date: "2026-05-02",
    end_date: "2026-05-02",
  });
  assert.equal(reflections.reflections.length, 1);
  assert.equal(reflections.reflections[0].mood, "grateful");

  const energy = await tool("get_energy_patterns", {
    start_date: "2026-05-02",
    end_date: "2026-05-02",
  });
  assert.deepEqual(energy.givers, [{ item: "quiet walk", count: 1 }]);
  assert.deepEqual(energy.sappers, [{ item: "Slack", count: 1 }]);

  const balance = await tool("get_balance_snapshot", { date: "2026-05-02" });
  assert.equal(balance.relationships.count, 1);
  assert.equal(balance.profession.count, 2);

  console.log("memory tools smoke passed");
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function writeRecording(recordingsDir, recording) {
  await fs.writeFile(
    path.join(recordingsDir, `${recording.id}.json`),
    `${JSON.stringify(recording, null, 2)}\n`,
  );
}
