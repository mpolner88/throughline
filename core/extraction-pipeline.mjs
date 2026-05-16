import { spawnSync } from "node:child_process";

export const OUTPUT_FIELDS = [
  "type",
  "title",
  "summary",
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

const ARRAY_FIELDS = new Set([
  "todos",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
]);

const VALID_TYPES = new Set(["morning", "evening", "weekly_review", "freeform"]);
const VALID_MOODS = new Set([
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
const VALID_PRIORITIES = new Set(["high", "medium", "low"]);
const VALID_CENTERS = new Set(["health", "relationships", "passions", "purpose", "profession"]);

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

export function runCommandExtractor(command, input) {
  const result = spawnSync(command, {
    input: JSON.stringify(input),
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 5,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Extractor command failed with exit ${result.status}: ${result.stderr || result.stdout}`,
    );
  }

  return extractJsonFromText(result.stdout);
}

export function userLocalDateFromTime(userLocalTime) {
  if (typeof userLocalTime !== "string") return null;

  const match = userLocalTime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function postprocessExtraction(actual, metadata) {
  deriveTomorrowTodos(actual, metadata);
  return actual;
}

function normalizeTodo(todo, metadata = {}) {
  return {
    text: stringOrEmpty(todo?.text),
    status: "open",
    priority: normalizeEnum(todo?.priority, VALID_PRIORITIES),
    due: normalizeDateValue(todo?.due, metadata),
    for_date: normalizeDateValue(todo?.for_date, metadata),
    context: nullableString(todo?.context),
  };
}

function stringOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEnum(value, allowed) {
  return allowed.has(value) ? value : null;
}

function normalizeDateValue(value, metadata) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower === "today") return metadata?.user_local_date ?? null;
  if (lower === "tomorrow" || lower === "next day") return nextIsoDate(metadata?.user_local_date);

  return nextWeekdayIsoDate(metadata?.user_local_date, lower);
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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
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

function nextIsoDate(isoDate) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeForComparison(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
