#!/usr/bin/env node

// Smoke test for the running task list: merged buckets across notes, the
// completion and move actions on action items, the correction feedback rows
// they leave behind, and the memory tools that read the same list.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "throughline-task-list-"));
const port = 5400 + Math.floor(Math.random() * 1000);
const baseURL = `http://127.0.0.1:${port}`;
const token = "test-token";
let server;

const today = new Date().toISOString().slice(0, 10);
const yesterday = shiftIsoDate(today, -1);
const tomorrow = shiftIsoDate(today, 1);
const tenDaysAgo = shiftIsoDate(today, -10);
const twelveDaysOut = shiftIsoDate(today, 12);

const DUPLICATE = "Send the shared launch checklist";
const CARRIED = "Return the library books";
const PRIORITY = "Finish the board deck";
const THIS_WEEK = "Book the dentist appointment";
const FAR_OUT = "Renew the passport";
const LATER = "Plan the garden overhaul";
const TODAY_CUE = "Water the plants";
const OLD_CUE = "Sort the receipts";
const GHOST = "Confirm the hotel booking";

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

  // Two older notes whose todos say "today" without a date: one from yesterday
  // (carried) and one from ten days ago (carried and aged out to later).
  const prior = await request("/recordings", {
    method: "POST",
    body: {
      type: "morning",
      duration_seconds: 5,
      user_local_time: `${yesterday}T08:00:00Z`,
      timezone: "UTC",
      transcript_raw: "This morning I want to water the plants.",
    },
  });
  const old = await request("/recordings", {
    method: "POST",
    body: {
      type: "morning",
      duration_seconds: 5,
      user_local_time: `${tenDaysAgo}T08:00:00Z`,
      timezone: "UTC",
      transcript_raw: "Tonight I should sort the receipts.",
    },
  });

  const first = await request("/recordings", {
    method: "POST",
    body: {
      type: "morning",
      duration_seconds: 9,
      user_local_time: `${today}T08:00:00Z`,
      timezone: "UTC",
      transcript_raw: "Today I need to send the shared launch checklist and finish the board deck.",
    },
  });
  const second = await request("/recordings", {
    method: "POST",
    body: {
      type: "freeform",
      duration_seconds: 7,
      user_local_time: `${today}T12:00:00Z`,
      timezone: "UTC",
      transcript_raw: "Send the shared launch checklist. Renew the passport before the trip.",
    },
  });

  assert.ok(first.id, "first recording id should be returned");
  assert.ok(second.id, "second recording id should be returned");
  assert.equal(first.recording.processing_status, "processed");
  assert.equal(second.recording.processing_status, "processed");

  // Explicit todos so the buckets do not depend on what the dev extractor found.
  await request(`/recordings/${encodeURIComponent(prior.id)}`, {
    method: "PATCH",
    body: {
      most_important: [],
      todos: [{ text: TODAY_CUE, due: null, timeframe: "today", priority: null }],
    },
  });
  await request(`/recordings/${encodeURIComponent(old.id)}`, {
    method: "PATCH",
    body: {
      most_important: [],
      todos: [{ text: OLD_CUE, due: null, timeframe: "today", priority: null }],
    },
  });
  await request(`/recordings/${encodeURIComponent(first.id)}`, {
    method: "PATCH",
    body: {
      most_important: [],
      todos: [
        { text: DUPLICATE, due: today, timeframe: "today", priority: null },
        { text: CARRIED, due: yesterday, timeframe: "today", priority: null },
        { text: PRIORITY, due: today, timeframe: "today", priority: "high" },
        { text: THIS_WEEK, due: null, timeframe: "this_week", priority: null },
      ],
    },
  });
  await request(`/recordings/${encodeURIComponent(second.id)}`, {
    method: "PATCH",
    body: {
      most_important: [],
      todos: [
        { text: DUPLICATE, due: today, timeframe: "today", priority: null },
        { text: FAR_OUT, due: twelveDaysOut, timeframe: null, priority: null },
        { text: LATER, due: null, timeframe: "later", priority: null },
      ],
    },
  });

  const tasks = await request(`/tasks?date=${today}&tz=UTC`, { method: "GET" });
  assert.equal(tasks.date, today);

  const allTexts = [...tasks.today, ...tasks.this_week, ...tasks.later, ...tasks.done].map((task) => task.text);
  assert.equal(allTexts.filter((text) => text === DUPLICATE).length, 1, "duplicate text should appear once");

  assert.deepEqual(texts(tasks.today).sort(), [CARRIED, DUPLICATE, PRIORITY, TODAY_CUE].sort(), "today bucket");
  assert.deepEqual(texts(tasks.this_week), [THIS_WEEK], "this_week bucket");
  assert.deepEqual(texts(tasks.later).sort(), [FAR_OUT, LATER, OLD_CUE].sort(), "later bucket");
  assert.deepEqual(tasks.done, [], "nothing is done yet");

  const carried = tasks.today[0];
  assert.equal(carried.text, CARRIED, "carried item should be first in today");
  assert.equal(carried.carried, true, "yesterday item should be marked carried");
  assert.equal(carried.due, yesterday);

  // A dateless "today" todo recorded yesterday carries like a dated one.
  const todayCue = tasks.today[1];
  assert.equal(todayCue.text, TODAY_CUE, "timeframe-today item from yesterday should follow the dated carried item");
  assert.equal(todayCue.carried, true, "timeframe-today item from yesterday should be marked carried");
  assert.equal(todayCue.due, null, "timeframe-today item should not gain a due date");

  const oldCue = tasks.later.find((task) => task.text === OLD_CUE);
  assert.equal(oldCue?.carried, true, "timeframe-today item from ten days ago should stay carried");

  const priorityIndex = texts(tasks.today).indexOf(PRIORITY);
  const duplicateIndex = texts(tasks.today).indexOf(DUPLICATE);
  assert.ok(priorityIndex >= 0 && duplicateIndex >= 0, "priority and duplicate items should be in today");
  assert.ok(priorityIndex < duplicateIndex, "priority item should precede a non-priority item");
  assert.equal(tasks.today[priorityIndex].priority, "high");

  assert.deepEqual(tasks.counts, {
    today: tasks.today.length,
    this_week: tasks.this_week.length,
    later: tasks.later.length,
  }, "counts should match list lengths");

  // Completing a task moves it to done without a feedback row.
  const feedbackBeforeCompletion = await feedbackRows();
  const completed = await request(`/recordings/${encodeURIComponent(first.id)}/action-items?tz=UTC`, {
    method: "PATCH",
    body: { text: PRIORITY, completed: true },
  });
  assert.ok(completed.tasks, "completion response should include tasks");
  assert.ok(!Object.hasOwn(completed, "feedback_error"), "completion should not report a feedback error");
  assert.ok(texts(completed.tasks.done).includes(PRIORITY), "completed item should be in done");
  assert.ok(!texts(completed.tasks.today).includes(PRIORITY), "completed item should leave today");

  const feedbackAfterCompletion = await feedbackRows();
  assert.equal(
    feedbackAfterCompletion.length,
    feedbackBeforeCompletion.length,
    "completion toggle should not create a feedback row",
  );

  // Moving a task to another bucket is a correction and leaves a feedback row.
  const moved = await request(`/recordings/${encodeURIComponent(first.id)}/action-items?tz=UTC`, {
    method: "PATCH",
    body: { text: CARRIED, timeframe: "later", local_date: today },
  });
  assert.ok(moved.tasks, "move response should include tasks");
  assert.ok(!Object.hasOwn(moved, "feedback_error"), "move should not report a feedback error");
  assert.ok(texts(moved.tasks.later).includes(CARRIED), "moved item should be in later");
  assert.ok(!texts(moved.tasks.today).includes(CARRIED), "moved item should leave today");

  const movedTodo = moved.recording.structured_note.todos.find((todo) => todo.text === CARRIED);
  assert.equal(movedTodo?.timeframe, "later");
  assert.equal(movedTodo?.due, null);

  const feedbackAfterMove = await feedbackRows();
  assert.equal(feedbackAfterMove.length, feedbackAfterCompletion.length + 1, "move should create one feedback row");
  const moveRow = feedbackAfterMove.find((row) => row.source === "task_move");
  assert.ok(moveRow, "feedback should contain a task_move row");
  assert.equal(moveRow.status, "eval_candidate");
  assert.equal(moveRow.recording_id, first.id);

  const moveFeedback = await request(`/feedback/${encodeURIComponent(moveRow.id)}`, { method: "GET" });
  assert.equal(moveFeedback.feedback.answers.rubric_version, "note_edit_v1");
  assert.equal(moveFeedback.feedback.answers.should_remember, true);
  assert.equal(
    moveFeedback.feedback.recording_snapshot.structured_note.todos.find((todo) => todo.text === CARRIED)?.timeframe,
    "today",
    "snapshot should hold the todo before the move",
  );
  assert.equal(
    moveFeedback.feedback.expected.todos.find((todo) => todo.text === CARRIED)?.timeframe,
    "later",
    "expected should hold the todo after the move",
  );

  // Repeating the same move changes nothing, so it is not a correction.
  const repeated = await request(`/recordings/${encodeURIComponent(first.id)}/action-items?tz=UTC`, {
    method: "PATCH",
    body: { text: CARRIED, timeframe: "later", local_date: today },
  });
  assert.ok(repeated.tasks, "repeated move response should include tasks");
  assert.equal((await feedbackRows()).length, feedbackAfterMove.length, "a no-op move should not create a feedback row");

  // Neither is an edit with nothing in it.
  await request(`/recordings/${encodeURIComponent(second.id)}`, { method: "PATCH", body: {} });
  assert.equal((await feedbackRows()).length, feedbackAfterMove.length, "an empty edit should not create a feedback row");

  // Editing a note is a correction as well.
  const edited = await request(`/recordings/${encodeURIComponent(second.id)}`, {
    method: "PATCH",
    body: { title: "Edited passport note" },
  });
  assert.equal(edited.recording.structured_note.title, "Edited passport note");
  assert.ok(!Object.hasOwn(edited, "feedback_error"), "edit should not report a feedback error");

  const feedbackAfterEdit = await feedbackRows();
  assert.equal(feedbackAfterEdit.length, feedbackAfterMove.length + 1, "edit should create one feedback row");
  const editRow = feedbackAfterEdit.find(
    (row) => row.source === "note_edit" && row.recording_id === second.id
      && !feedbackAfterMove.some((known) => known.id === row.id),
  );
  assert.ok(editRow, "feedback should contain a note_edit row for the edit");
  assert.equal(editRow.status, "eval_candidate");

  const editFeedback = await request(`/feedback/${encodeURIComponent(editRow.id)}`, { method: "GET" });
  assert.equal(editFeedback.feedback.expected.title, "Edited passport note");
  assert.notEqual(editFeedback.feedback.recording_snapshot.structured_note.title, "Edited passport note");

  // Completing a text the note never had adds a manual action item, which a
  // later move on the same note must not throw away.
  const ghost = await request(`/recordings/${encodeURIComponent(second.id)}/action-items?tz=UTC`, {
    method: "PATCH",
    body: { text: GHOST, completed: true },
  });
  assert.ok(texts(ghost.tasks.done).includes(GHOST), "manual item should be in done");
  assert.ok(
    ghost.recording.structured_note.action_items.some((item) => item.text === GHOST && item.source === "manual"),
    "manual item should be in action_items",
  );

  const movedAfterGhost = await request(`/recordings/${encodeURIComponent(second.id)}/action-items?tz=UTC`, {
    method: "PATCH",
    body: { text: LATER, timeframe: "this_week", local_date: today },
  });
  assert.ok(texts(movedAfterGhost.tasks.this_week).includes(LATER), "moved item should be in this_week");
  assert.ok(texts(movedAfterGhost.tasks.done).includes(GHOST), "manual item should survive a move on the same note");
  assert.ok(
    movedAfterGhost.recording.structured_note.action_items.some(
      (item) => item.text === GHOST && item.source === "manual" && item.status === "completed",
    ),
    "manual item should stay in action_items after a move",
  );

  // The memory tools read the same list.
  const openTodos = await request("/agent/tools/list_open_todos", {
    method: "POST",
    body: { date: today, tz: "UTC", bucket: "today" },
  });
  assert.ok(openTodos.output.todos.length > 0, "today bucket should have open todos");
  assert.ok(
    openTodos.output.todos.every((todo) => todo.bucket === "today"),
    "bucket filter should return only today rows",
  );
  assert.deepEqual(texts(openTodos.output.todos).sort(), [DUPLICATE, TODAY_CUE].sort(), "today should hold what is left");

  const todayTool = await request("/agent/tools/get_today", {
    method: "POST",
    body: { date: today },
  });
  assert.ok(Array.isArray(todayTool.output.tasks), "get_today should include tasks");
  assert.deepEqual(texts(todayTool.output.tasks), texts(openTodos.output.todos));

  // Cleared tasks stay out of the open list unless asked for, and then keep
  // showing up after the day boundary with status completed.
  const allOpen = await request("/agent/tools/list_open_todos", {
    method: "POST",
    body: { date: today, tz: "UTC" },
  });
  assert.ok(!texts(allOpen.output.todos).includes(PRIORITY), "completed task should not be an open todo by default");

  for (const date of [today, tomorrow]) {
    const withCompleted = await request("/agent/tools/list_open_todos", {
      method: "POST",
      body: { date, tz: "UTC", include_completed: true },
    });
    const completedRows = withCompleted.output.todos.filter((todo) => todo.status === "completed");
    assert.deepEqual(texts(completedRows).sort(), [GHOST, PRIORITY].sort(), `completed tasks should be listed for ${date}`);
    const lastOpenIndex = withCompleted.output.todos.findLastIndex((todo) => todo.status === "open");
    const firstCompletedIndex = withCompleted.output.todos.findIndex((todo) => todo.status === "completed");
    assert.ok(lastOpenIndex < firstCompletedIndex, "completed tasks should follow the open ones");
  }

  const nextDay = await request(`/tasks?date=${tomorrow}&tz=UTC`, { method: "GET" });
  assert.deepEqual(nextDay.done, [], "done should be empty for the app on the next local day");

  console.log("task list smoke passed");
} catch (error) {
  process.exitCode = 1;
  console.error(`task list smoke failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  server?.kill("SIGTERM");
  await rm(tmpDir, { recursive: true, force: true });
}

function texts(items) {
  return (items ?? []).map((item) => item.text);
}

function shiftIsoDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function feedbackRows() {
  const payload = await request("/feedback", { method: "GET" });
  return payload.feedback;
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
