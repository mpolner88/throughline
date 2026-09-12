// GENERATED FILE. Do not edit by hand.
// Source: core/task-list.mjs
// Regenerate with: node scripts/sync-extraction-contract.mjs (or npm run contract:sync)
// Verify with: node scripts/sync-extraction-contract.mjs --check (or npm run contract:check)

// Running task list shared by the local backend stub, the Supabase Edge
// Function, and the MCP memory tools. Pure ESM: no node: imports, no Deno or
// Node globals. Imports only from ./extraction-contract.mjs so the generated
// copy under supabase/functions/_shared/ works with the same relative import.
//
// supabase/functions/_shared/task-list.mjs is generated from this file by
// scripts/sync-extraction-contract.mjs. Edit this file, then run
// `npm run contract:sync`.
//
// Spec: docs/superpowers/specs/2026-09-09-throughline-running-list-design.md
// sections 3, 4, and 5. Buckets are never stored; they are derived here from
// due, timeframe, and the user's local date.

import {
  deriveActionItems,
  deriveBucket,
  normalizeForComparison,
  nullableString,
  stableActionItemId,
  userLocalDateFromTime,
  VALID_PRIORITIES,
  VALID_TIMEFRAMES,
} from "./extraction-contract.mjs";

export const TASK_BUCKETS = ["today", "this_week", "later"];
export const TASK_TIMEFRAMES = VALID_TIMEFRAMES;

// Open items whose due date is further back than this many days drop from
// today to later (spec section 5, Q5). They keep the carried marker.
export const CARRY_CEILING_DAYS = 7;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// ISO date of the Sunday that ends the Monday..Sunday week containing date.
export function weekEndFor(date) {
  const parsed = parseIsoDate(date);
  if (!parsed) return null;

  const daysToSunday = (7 - parsed.getUTCDay()) % 7;
  parsed.setUTCDate(parsed.getUTCDate() + daysToSunday);
  return parsed.toISOString().slice(0, 10);
}

// YYYY-MM-DD for a timestamp as seen in timeZone. An invalid or missing zone
// falls back to UTC; an invalid timestamp returns null.
export function localDateInZone(isoTimestamp, timeZone) {
  const instant = new Date(isoTimestamp ?? NaN);
  if (Number.isNaN(instant.getTime())) return null;

  const formatter = dateFormatter(timeZone) ?? dateFormatter("UTC");
  const formatted = formatter.format(instant);
  const match = formatted.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : instant.toISOString().slice(0, 10);
}

// The local date a recording was made on, as the recorder reported it, or the
// UTC date of created_at when the local time was not sent.
export function recordingLocalDate(recording) {
  const local = userLocalDateFromTime(recording?.user_local_time);
  if (local) return local;

  const created = String(recording?.created_at ?? "");
  const match = created.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

// Merge every recording's todos into one deduplicated list, bucketed for the
// given local date. See the module comment for the rules. done holds only the
// items completed on that date unless includeAllDone is set, which keeps every
// completed item (the memory tools use it to show what was cleared).
export function buildTaskList(recordings, { date, timeZone, includeAllDone } = {}) {
  const zone = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "UTC";
  const today = normalizeIsoDate(date) || localDateInZone(new Date().toISOString(), zone);
  const weekEnd = weekEndFor(today);
  const merged = mergeTaskOccurrences(recordings);

  const lists = { today: [], this_week: [], later: [], done: [] };

  for (const entry of merged.values()) {
    const task = finalizeTask(entry, { date: today, weekEnd, timeZone: zone, includeAllDone: includeAllDone === true });
    if (!task) continue;

    if (task.status === "completed") {
      lists.done.push(task);
    } else {
      lists[task.bucket].push(task);
    }
  }

  lists.today.sort(compareToday);
  lists.this_week.sort(compareThisWeek);
  lists.later.sort(compareLater);
  lists.done.sort(compareDone);

  return {
    date: today,
    week_end: weekEnd,
    today: lists.today,
    this_week: lists.this_week,
    later: lists.later,
    done: lists.done,
    counts: {
      today: lists.today.length,
      this_week: lists.this_week.length,
      later: lists.later.length,
    },
  };
}

// Mark an action item (and its todo twin) completed or open. Adds a manual
// action item when nothing in the note matches the text.
export function updateActionItemCompletion(note, text, completed) {
  note.action_items = Array.isArray(note.action_items) ? note.action_items : [];

  if (!note.action_items.length) {
    deriveActionItems(note);
  }

  const key = normalizeForComparison(text);
  const completedAt = completed ? new Date().toISOString() : null;
  let matched = false;

  for (const item of note.action_items) {
    if (normalizeForComparison(item.text) !== key) continue;

    item.status = completed ? "completed" : "open";
    item.completed_at = completedAt;
    matched = true;
  }

  if (!matched) {
    note.action_items.push({
      id: stableActionItemId(text),
      text,
      status: completed ? "completed" : "open",
      source: "manual",
      completed_at: completedAt,
    });
  }

  for (const todo of note.todos ?? []) {
    if (normalizeForComparison(todo.text) !== key) continue;

    todo.status = completed ? "completed" : "open";
    todo.completed_at = completedAt;
  }
}

// Move a task to another bucket by rewriting its todo's timeframe. "today"
// pins due to the caller's local date so the item stays in today across day
// boundaries; the other buckets clear the dates and rely on timeframe alone.
// Returns { changed, todo }; todo is null when nothing in the note matched.
export function applyTaskMove(note, text, timeframe, localDate) {
  if (!TASK_TIMEFRAMES.has(timeframe)) {
    throw new Error("Task timeframe must be today, this_week, or later");
  }

  const date = normalizeIsoDate(localDate);
  if (!date) {
    throw new Error("Task move requires local_date as YYYY-MM-DD");
  }

  const key = normalizeForComparison(text);
  if (!key) return { changed: false, todo: null };

  note.todos = Array.isArray(note.todos) ? note.todos : [];
  note.action_items = Array.isArray(note.action_items) ? note.action_items : [];

  let todo = note.todos.find((candidate) => normalizeForComparison(candidate?.text) === key) ?? null;
  let created = false;

  if (!todo) {
    const manualItem = note.action_items.find(
      (item) => item?.source === "manual" && normalizeForComparison(item.text) === key,
    );
    if (!manualItem) return { changed: false, todo: null };

    const status = normalizeCompletionStatus(manualItem.status);
    todo = {
      text: manualItem.text,
      status,
      priority: null,
      due: null,
      for_date: null,
      timeframe: null,
      context: "manual_move",
      completed_at: status === "completed" ? nullableString(manualItem.completed_at) : null,
    };
    note.todos.push(todo);
    created = true;
  }

  const before = { timeframe: todo.timeframe ?? null, due: todo.due ?? null, for_date: todo.for_date ?? null };

  todo.timeframe = timeframe;
  if (timeframe === "today") {
    todo.due = date;
    todo.for_date = null;
  } else {
    todo.due = null;
    todo.for_date = null;
  }

  refreshActionItems(note);

  const changed = created
    || before.timeframe !== todo.timeframe
    || before.due !== todo.due
    || before.for_date !== todo.for_date;

  return { changed, todo };
}

// Rebuild action_items from todos and most_important the way deriveActionItems
// does, keeping the ids and completion state of items that were already there.
// Manual items (completion recorded for a text the note never had) are not
// derivable from anything, so they are carried over as they are.
export function refreshActionItems(note) {
  const previous = Array.isArray(note.action_items) ? note.action_items : [];
  const previousByText = new Map(
    previous.map((item) => [normalizeForComparison(item.text), item]),
  );
  const items = [];

  for (const todo of note.todos ?? []) {
    addEditedActionItem(items, todo.text, "todo", todo.status, todo.completed_at, previousByText, {
      timeframe: TASK_TIMEFRAMES.has(todo.timeframe) ? todo.timeframe : null,
      due: todo.due ?? todo.for_date ?? null,
      priority: typeof todo.priority === "string" && VALID_PRIORITIES.has(todo.priority) ? todo.priority : null,
    });
  }

  for (const text of note.most_important ?? []) {
    addEditedActionItem(items, text, "most_important", null, null, previousByText);
  }

  for (const item of previous) {
    if (item?.source !== "manual") continue;
    addEditedActionItem(items, item.text, "manual", item.status, item.completed_at, previousByText);
  }

  note.action_items = items;
}

export function addEditedActionItem(
  items,
  candidate,
  source,
  status = null,
  completedAt = null,
  previousByText = new Map(),
  extra = null,
) {
  const text = nullableString(candidate);
  if (!text) return;

  const key = normalizeForComparison(text);
  if (!key || items.some((item) => normalizeForComparison(item.text) === key)) return;

  const previous = previousByText.get(key);
  const normalizedStatus = normalizeCompletionStatus(status ?? previous?.status);
  items.push({
    id: previous?.id || stableActionItemId(text),
    text,
    status: normalizedStatus,
    source,
    completed_at: normalizedStatus === "completed" ? nullableString(completedAt ?? previous?.completed_at) : null,
    ...(extra ?? {}),
  });
}

export function normalizeCompletionStatus(value) {
  return value === "completed" || value === "done" ? "completed" : "open";
}

export function normalizeTaskPriority(value) {
  return value === "high" ? "high" : null;
}

export function normalizeIsoDate(value) {
  return typeof value === "string" && ISO_DATE_PATTERN.test(value) ? value : null;
}

// Whole days from earlier to later; negative when later precedes earlier.
export function daysBetween(earlierIsoDate, laterIsoDate) {
  const earlier = parseIsoDate(earlierIsoDate);
  const later = parseIsoDate(laterIsoDate);
  if (!earlier || !later) return null;

  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

function mergeTaskOccurrences(recordings) {
  const merged = new Map();
  const sorted = (Array.isArray(recordings) ? recordings : [])
    .filter((recording) => recording?.structured_note)
    .sort(compareRecordingsNewestFirst);

  for (const recording of sorted) {
    const note = recording.structured_note;
    const localDate = recordingLocalDate(recording);
    const actionItems = Array.isArray(note.action_items) ? note.action_items : [];
    const todos = Array.isArray(note.todos) ? note.todos : [];
    const actionByKey = new Map();
    for (const item of actionItems) {
      const key = normalizeForComparison(item?.text);
      if (key && !actionByKey.has(key)) actionByKey.set(key, item);
    }

    const seen = new Set();

    todos.forEach((todo, index) => {
      const text = nullableString(todo?.text);
      const key = normalizeForComparison(text);
      if (!text || !key || seen.has(key)) return;
      seen.add(key);

      const twin = actionByKey.get(key);
      const completed = normalizeCompletionStatus(todo.status) === "completed"
        || normalizeCompletionStatus(twin?.status) === "completed";

      addOccurrence(merged, key, {
        text,
        completed,
        completed_at: completed
          ? nullableString(todo.completed_at) ?? nullableString(twin?.completed_at)
          : null,
        due: normalizeIsoDate(todo.due),
        for_date: normalizeIsoDate(todo.for_date),
        timeframe: TASK_TIMEFRAMES.has(todo.timeframe) ? todo.timeframe : null,
        priority: normalizeTaskPriority(todo.priority),
        context: nullableString(todo.context),
        source: "todo",
        spoken_index: index,
        recording,
        note,
        local_date: localDate,
      });
    });

    actionItems.forEach((item, index) => {
      if (item?.source !== "manual") return;

      const text = nullableString(item.text);
      const key = normalizeForComparison(text);
      if (!text || !key || seen.has(key)) return;
      seen.add(key);

      const completed = normalizeCompletionStatus(item.status) === "completed";
      addOccurrence(merged, key, {
        text,
        completed,
        completed_at: completed ? nullableString(item.completed_at) : null,
        due: null,
        for_date: null,
        timeframe: null,
        priority: null,
        context: "manual",
        source: "manual",
        spoken_index: index,
        recording,
        note,
        local_date: localDate,
      });
    });
  }

  return merged;
}

// Recordings arrive newest first, so the first occurrence of a key owns the
// text, dates, and provenance. Later (older) occurrences only contribute
// completion and the earliest local date.
function addOccurrence(merged, key, occurrence) {
  const existing = merged.get(key);

  if (!existing) {
    merged.set(key, {
      ...occurrence,
      first_seen_local_date: occurrence.local_date,
    });
    return;
  }

  if (occurrence.completed) {
    existing.completed = true;
    existing.completed_at = existing.completed_at ?? occurrence.completed_at;
  }

  if (occurrence.local_date && (!existing.first_seen_local_date || occurrence.local_date < existing.first_seen_local_date)) {
    existing.first_seen_local_date = occurrence.local_date;
  }
}

function finalizeTask(entry, { date, weekEnd, timeZone, includeAllDone }) {
  const dueEffective = entry.due ?? entry.for_date;
  const status = entry.completed ? "completed" : "open";

  if (status === "completed" && !includeAllDone) {
    const completedDate = entry.completed_at
      ? localDateInZone(entry.completed_at, timeZone)
      : entry.local_date;
    if (completedDate !== date) return null;
  }

  let bucket = deriveBucket(
    { due: entry.due, for_date: entry.for_date, timeframe: entry.timeframe, status },
    { date, weekEnd },
  );
  let carried = false;

  // A todo the speaker tied to today without a date ("this morning", "tonight")
  // is anchored to the day it was recorded, so it carries and ages the same way
  // a dated item does instead of sitting in today for good.
  const carryAnchor = dueEffective ?? (entry.timeframe === "today" ? entry.local_date : null);

  // The ceiling re-bucket applies to completed rows too so a task cleared from
  // the later tab stays in later's done group instead of jumping to today's
  // (spec §3.2: a done item stays in the bucket it was completed in). Only open
  // rows show the carried marker.
  if (carryAnchor && carryAnchor < date) {
    if (status === "open") carried = true;
    const age = daysBetween(carryAnchor, date);
    if (age !== null && age > CARRY_CEILING_DAYS) {
      bucket = "later";
    }
  }

  return {
    id: stableActionItemId(entry.text),
    text: entry.text,
    status,
    bucket,
    timeframe: entry.timeframe,
    due: dueEffective,
    priority: entry.priority,
    recording_id: entry.recording.id ?? null,
    recording_title: nullableString(entry.note.title),
    recording_created_at: entry.recording.created_at ?? null,
    spoken_index: entry.spoken_index,
    first_seen_local_date: entry.first_seen_local_date,
    carried,
    completed_at: status === "completed" ? entry.completed_at : null,
    context: entry.context,
    source: entry.source,
  };
}

function compareRecordingsNewestFirst(a, b) {
  return timestampValue(b?.created_at) - timestampValue(a?.created_at)
    || String(b?.id ?? "").localeCompare(String(a?.id ?? ""));
}

function compareNewestRecording(a, b) {
  return timestampValue(b.recording_created_at) - timestampValue(a.recording_created_at)
    || String(b.recording_id ?? "").localeCompare(String(a.recording_id ?? ""))
    || a.spoken_index - b.spoken_index
    || sourceRank(a) - sourceRank(b)
    || String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

// Todos precede manual action items on a full tie so the order matches the
// Swift client's rederived list exactly.
function sourceRank(task) {
  return task.source === "todo" ? 0 : 1;
}

function comparePriority(a, b) {
  return Number(b.priority === "high") - Number(a.priority === "high");
}

function compareToday(a, b) {
  return Number(b.carried) - Number(a.carried)
    || comparePriority(a, b)
    || compareNewestRecording(a, b);
}

function compareThisWeek(a, b) {
  if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
  if (Boolean(a.due) !== Boolean(b.due)) return a.due ? -1 : 1;
  return comparePriority(a, b) || compareNewestRecording(a, b);
}

function compareLater(a, b) {
  return compareNewestRecording(a, b);
}

function compareDone(a, b) {
  return timestampValue(b.completed_at) - timestampValue(a.completed_at)
    || compareNewestRecording(a, b);
}

function timestampValue(value) {
  const time = new Date(value ?? NaN).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function parseIsoDate(value) {
  const normalized = normalizeIsoDate(value);
  if (!normalized) return null;

  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateFormatter(timeZone) {
  if (typeof timeZone !== "string" || !timeZone.trim()) return null;

  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone.trim(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return null;
  }
}
