// GENERATED FILE. Do not edit by hand.
// Source: core/extraction-contract.mjs
// Regenerate with: node scripts/sync-extraction-contract.mjs (or npm run contract:sync)
// Verify with: node scripts/sync-extraction-contract.mjs --check (or npm run contract:check)

// Extraction contract shared by the eval runner, the local backend stub, and the
// Supabase Edge Function. Pure ESM: no node: imports, no Deno or Node globals.
//
// supabase/functions/_shared/extraction-contract.mjs is generated from this file
// by scripts/sync-extraction-contract.mjs. Edit this file, then run
// `npm run contract:sync`.
//
// When the eval pipeline and the Edge Function copies were unified (phase 0 of
// the running list plan) two small differences were resolved in favour of the
// production copy: a `due` or `for_date` of "today" resolves only when
// metadata.user_local_date is a string, and stableActionItemId uses a
// deterministic hash fallback instead of "act_item" or a random suffix.

export const OUTPUT_FIELDS = [
  "type",
  "title",
  "summary",
  "most_important",
  "todos",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "mood",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
];

export const ARRAY_FIELDS = new Set([
  "todos",
  "most_important",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
]);

export const VALID_TYPES = new Set(["morning", "evening", "weekly_review", "freeform"]);
export const VALID_MOODS = new Set([
  "focused",
  "energized",
  "grateful",
  "calm",
  "anxious",
  "frustrated",
  "tired",
  "sad",
  "neutral",
]);
// "medium" and "low" are still accepted from older notes and edits, but the
// prompt asks the model for "high" or null only, and the task list collapses
// anything else to null.
export const VALID_PRIORITIES = new Set(["high", "medium", "low"]);
export const VALID_TIMEFRAMES = new Set(["today", "this_week", "later"]);
export const VALID_CENTERS = new Set(["health", "relationships", "passions", "purpose", "profession"]);

export function buildExtractionInput({ id, metadata = {}, transcript, prompt }) {
  return {
    id,
    metadata,
    transcript,
    prompt,
  };
}

export function normalizeExtraction(raw, metadata = {}) {
  const actual = {};

  for (const field of OUTPUT_FIELDS) {
    if (field === "type") {
      actual.type = VALID_TYPES.has(raw?.type) ? raw.type : "freeform";
    } else if (field === "title") {
      actual.title = stringOrEmpty(raw?.title).slice(0, 80);
    } else if (field === "summary") {
      actual.summary = stringOrEmpty(raw?.summary);
    } else if (field === "todos") {
      actual.todos = Array.isArray(raw?.todos)
        ? raw.todos.map((todo) => normalizeTodo(todo, metadata)).filter((todo) => todo.text)
        : [];
    } else if (field === "mood") {
      actual.mood = normalizeEnum(raw?.mood, VALID_MOODS);
    } else if (field === "centers_of_balance") {
      actual.centers_of_balance = normalizeCenters(raw?.centers_of_balance);
    } else if (ARRAY_FIELDS.has(field)) {
      actual[field] = normalizeStringArray(raw?.[field]);
    }
  }

  return postprocessExtraction(actual, metadata);
}

export function extractJsonFromText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Extractor returned empty output");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Extractor did not return parseable JSON");
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

export function userLocalDateFromTime(userLocalTime) {
  if (typeof userLocalTime !== "string") return null;

  const match = userLocalTime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function metadataForRecording(recording) {
  return {
    user_local_date: userLocalDateFromTime(recording.user_local_time)
      || new Date(recording.created_at).toISOString().slice(0, 10),
    scenario: recording.type || "freeform",
    recording_context: recording.upload_source || "unknown",
  };
}

export function deriveActionItems(actual) {
  const items = [];

  for (const todo of actual.todos ?? []) {
    addActionItem(items, todo.text, "todo", todo.status, todo.completed_at, {
      timeframe: normalizeEnum(todo.timeframe, VALID_TIMEFRAMES),
      due: todo.due ?? todo.for_date ?? null,
      priority: normalizeEnum(todo.priority, VALID_PRIORITIES),
    });
  }

  for (const text of actual.most_important ?? []) {
    addActionItem(items, text, "most_important");
  }

  actual.action_items = items;
}

// Places a task in today, this_week, or later for the user's local `date`
// (YYYY-MM-DD) and the Sunday that ends its Monday..Sunday week (`weekEnd`).
// A resolvable date wins over the spoken timeframe. Completion and the carry
// ceiling for stale items are handled by the task list, not here, so `status`
// is accepted for shape compatibility and does not change the result.
export function deriveBucket(
  { due = null, for_date = null, timeframe = null, status = "open" } = {},
  { date, weekEnd } = {},
) {
  void status;
  const dueEffective = isoDateOrNull(due) ?? isoDateOrNull(for_date);

  if (dueEffective && isoDateOrNull(date)) {
    if (dueEffective <= date) return "today";
    if (isoDateOrNull(weekEnd) && dueEffective <= weekEnd) return "this_week";
    return "later";
  }

  if (timeframe === "today") return "today";
  if (timeframe === "this_week") return "this_week";
  return "later";
}

export function stableActionItemId(text) {
  const normalized = normalizeForComparison(text)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized) {
    return `act_${normalized.slice(0, 80)}`;
  }

  // The slug is empty when the text has no ASCII letters or digits (for example a
  // note written entirely in another script). The two previous copies disagreed
  // here: the eval pipeline returned "act_item", which collides across items, and
  // the edge function returned a random hex suffix, which changed every time the
  // items were re-derived. A short hash of the text keeps ids unique and stable.
  const source = normalizeForComparison(text) || String(text ?? "");
  return `act_${hashHex(source)}`;
}

export function normalizeForComparison(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nextIsoDate(isoDate) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

export function normalizeEnum(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

export function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function postprocessExtraction(actual, metadata) {
  deriveTomorrowTodos(actual, metadata);
  deriveMostImportant(actual);
  deriveActionItems(actual);
  return actual;
}

function normalizeTodo(todo, metadata = {}) {
  return {
    text: stringOrEmpty(todo?.text),
    status: "open",
    priority: normalizeEnum(todo?.priority, VALID_PRIORITIES),
    due: normalizeDateValue(todo?.due, metadata),
    for_date: normalizeDateValue(todo?.for_date, metadata),
    timeframe: normalizeEnum(todo?.timeframe, VALID_TIMEFRAMES),
    context: nullableString(todo?.context),
  };
}

function isoDateOrNull(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeDateValue(value, metadata) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  const userLocalDate = metadata?.user_local_date;
  if (lower === "today") return typeof userLocalDate === "string" ? userLocalDate : null;
  if (lower === "tomorrow" || lower === "next day") return nextIsoDate(userLocalDate);

  return nextWeekdayIsoDate(userLocalDate, lower);
}

function nextWeekdayIsoDate(baseIsoDate, weekdayName) {
  const weekdayIndexes = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  const targetDay = weekdayIndexes[weekdayName];
  if (targetDay === undefined) return null;
  if (typeof baseIsoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(baseIsoDate)) return null;

  const date = new Date(`${baseIsoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  const currentDay = date.getUTCDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilTarget);
  return date.toISOString().slice(0, 10);
}

function normalizeCenters(value) {
  return normalizeStringArray(value).filter((item) => VALID_CENTERS.has(item));
}

function deriveTomorrowTodos(actual, metadata) {
  const tomorrowDate = nextIsoDate(metadata?.user_local_date);
  if (!tomorrowDate) return;

  const tomorrowTodoTexts = new Set(actual.tomorrow_todos.map(normalizeForComparison));

  for (const todo of actual.todos) {
    if (todo.for_date !== tomorrowDate) continue;

    const key = normalizeForComparison(todo.text);
    if (!key || tomorrowTodoTexts.has(key)) continue;

    actual.tomorrow_todos.push(todo.text);
    tomorrowTodoTexts.add(key);
  }
}

// most_important holds what an agent should remember from the note: decisions,
// constraints, and context. Tasks live in todos and action_items, so anything
// whose text matches a todo is left out, and there are no fallbacks. An empty
// list is a valid result.
function deriveMostImportant(actual) {
  const todoKeys = new Set(
    (actual.todos ?? []).map((todo) => normalizeForComparison(todo.text)).filter(Boolean),
  );
  const values = [];

  addUniqueImportant(values, actual.most_important ?? [], todoKeys);
  addUniqueImportant(values, actual.priorities ?? [], todoKeys);
  addUniqueImportant(values, actual.intentions ?? [], todoKeys);

  actual.most_important = values.slice(0, 5);
}

function addActionItem(items, candidate, source, status = null, completedAt = null, extra = null) {
  const text = nullableString(candidate);
  if (!text) return;

  const key = normalizeForComparison(text);
  if (!key || items.some((item) => normalizeForComparison(item.text) === key)) return;

  const normalizedStatus = status === "completed" || status === "done" ? "completed" : "open";
  items.push({
    id: stableActionItemId(text),
    text,
    status: normalizedStatus,
    source,
    completed_at: normalizedStatus === "completed" ? nullableString(completedAt) : null,
    ...(extra ?? {}),
  });
}

function addUniqueImportant(values, candidates, exclude = new Set()) {
  const seen = new Set(values.map(normalizeForComparison));

  for (const candidate of candidates) {
    const text = nullableString(candidate);
    if (!text) continue;

    const key = normalizeForComparison(text);
    if (!key || seen.has(key) || exclude.has(key)) continue;

    values.push(text.slice(0, 180));
    seen.add(key);
  }
}

// FNV-1a over UTF-16 code units, rendered as eight lowercase hex digits.
function hashHex(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
