import fs from "node:fs/promises";
import path from "node:path";

import { normalizeForComparison } from "../core/extraction-contract.mjs";
import { buildTaskList, localDateInZone } from "../core/task-list.mjs";

const FILTER_PROPERTIES = {
  start_date: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "Inclusive local start date, YYYY-MM-DD.",
  },
  end_date: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "Inclusive local end date, YYYY-MM-DD.",
  },
  type: {
    type: "string",
    enum: ["morning", "evening", "weekly_review", "freeform"],
    description: "Optional recording type filter.",
  },
};

const DATE_PROPERTY = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  description: "Local date, YYYY-MM-DD.",
};

const LIMIT_PROPERTY = {
  type: "integer",
  minimum: 1,
  description: "Maximum number of items to return.",
};

const TIME_ZONE_PROPERTY = {
  type: "string",
  description: "IANA time zone used to resolve today and day boundaries, for example America/New_York. Defaults to UTC.",
};

const BUCKET_PROPERTY = {
  type: "string",
  enum: ["today", "this_week", "later"],
  description: "Optional bucket filter: today, this_week, or later.",
};

const TOOL_DEFINITIONS = [
  {
    name: "get_today",
    description: "Return all processed notes for a local day plus the tasks in that day's today bucket, merged across every note.",
    input_schema: objectSchema({
      date: DATE_PROPERTY,
      tz: TIME_ZONE_PROPERTY,
      type: FILTER_PROPERTIES.type,
    }),
  },
  {
    name: "get_daily_loop",
    description: "Return the morning note, evening note, and a conservative completion summary for a local day.",
    input_schema: objectSchema({
      date: DATE_PROPERTY,
    }),
  },
  {
    name: "get_recordings",
    description: "Page through processed notes, newest first.",
    input_schema: objectSchema({
      ...FILTER_PROPERTIES,
      limit: { ...LIMIT_PROPERTY, maximum: 100 },
      cursor: {
        type: "string",
        description: "Opaque cursor returned by a previous get_recordings call.",
      },
    }),
  },
  {
    name: "get_recording",
    description: "Return one processed note by recording id.",
    input_schema: objectSchema({
      id: {
        type: "string",
        description: "Recording id.",
      },
    }, ["id"]),
  },
  {
    name: "search",
    description: "Search note transcripts and extracted memory fields with a lexical query.",
    input_schema: objectSchema({
      query: {
        type: "string",
        description: "Search query.",
      },
      ...FILTER_PROPERTIES,
      limit: { ...LIMIT_PROPERTY, maximum: 50 },
    }, ["query"]),
  },
  {
    name: "list_open_todos",
    description: "Return open tasks merged across notes, each once, with the bucket (today, this_week, later) it falls in for the given local date. Open most-important action items follow the tasks when no bucket or priority filter is set. Set include_completed to also see cleared tasks with status completed.",
    input_schema: objectSchema({
      ...FILTER_PROPERTIES,
      date: DATE_PROPERTY,
      tz: TIME_ZONE_PROPERTY,
      bucket: BUCKET_PROPERTY,
      include_completed: {
        type: "boolean",
        description: "Also return completed tasks, after the open ones, with status completed. Defaults to false.",
      },
      limit: { ...LIMIT_PROPERTY, maximum: 200 },
      priority: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Optional priority filter. Tasks carry high or null, so medium and low match nothing new.",
      },
    }),
  },
  {
    name: "get_recent_reflections",
    description: "Return recent evening or weekly reflections with mood and accomplishment context.",
    input_schema: objectSchema({
      ...FILTER_PROPERTIES,
      days: {
        type: "integer",
        minimum: 1,
        description: "Lookback window in days when start_date is not provided.",
      },
      limit: { ...LIMIT_PROPERTY, maximum: 100 },
      mood: {
        type: "string",
        description: "Optional exact mood filter.",
      },
    }),
  },
  {
    name: "get_energy_patterns",
    description: "Return repeated energy givers, sappers, and recovery patterns found in notes.",
    input_schema: objectSchema({
      ...FILTER_PROPERTIES,
      days: {
        type: "integer",
        minimum: 1,
        description: "Lookback window in days when start_date is not provided.",
      },
    }),
  },
  {
    name: "get_balance_snapshot",
    description: "Summarize extracted notes by the five Throughline centers of balance.",
    input_schema: objectSchema({
      date: DATE_PROPERTY,
      ...FILTER_PROPERTIES,
    }),
  },
];

const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name);
const TASK_BUCKETS = ["today", "this_week", "later"];
const CENTERS = ["health", "relationships", "passions", "purpose", "profession"];
const STOP_TOKENS = new Set([
  "about",
  "after",
  "and",
  "before",
  "evening",
  "feel",
  "felt",
  "for",
  "from",
  "morning",
  "note",
  "priority",
  "the",
  "today",
  "todo",
  "tomorrow",
  "was",
  "were",
  "with",
]);

function objectSchema(properties, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

export function listMemoryTools() {
  return getMemoryToolDefinitions().map((tool) => ({
    ...tool,
    read_only: true,
  }));
}

export function getMemoryToolDefinitions() {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: JSON.parse(JSON.stringify(tool.input_schema)),
  }));
}

export async function runMemoryTool(name, input = {}, options = {}) {
  if (!TOOL_NAMES.includes(name)) {
    throw new Error(`Unknown memory tool: ${name}`);
  }

  const recordings = sortRecordings(options.recordings ?? await loadRecordings(options.recordingsDir));

  if (name === "get_today") return getToday(recordings, input);
  if (name === "get_daily_loop") return getDailyLoop(recordings, input);
  if (name === "get_recordings") return getRecordings(recordings, input);
  if (name === "get_recording") return getRecording(recordings, input);
  if (name === "search") return search(recordings, input);
  if (name === "list_open_todos") return listOpenTodos(recordings, input);
  if (name === "get_recent_reflections") return getRecentReflections(recordings, input);
  if (name === "get_energy_patterns") return getEnergyPatterns(recordings, input);
  if (name === "get_balance_snapshot") return getBalanceSnapshot(recordings, input);

  throw new Error(`Unhandled memory tool: ${name}`);
}

async function loadRecordings(recordingsDir) {
  if (!recordingsDir) return [];

  let files;
  try {
    files = await fs.readdir(recordingsDir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const recordings = [];
  for (const file of files.filter((item) => item.endsWith(".json")).sort()) {
    const recording = JSON.parse(await fs.readFile(path.join(recordingsDir, file), "utf8"));
    recordings.push(recording);
  }

  return sortRecordings(recordings);
}

function sortRecordings(recordings) {
  return [...recordings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getToday(recordings, input) {
  const timeZone = timeZoneInput(input);
  const date = normalizeDate(input.date) || todayIsoDate(timeZone);
  const filtered = filterRecordings(recordings, { ...input, start_date: date, end_date: date });
  const tasks = buildTaskList(recordings, { date, timeZone });
  return {
    recordings: filtered.map(toAgentRecording),
    count: filtered.length,
    tasks: tasks.today,
  };
}

function getDailyLoop(recordings, input) {
  const date = normalizeDate(input.date) || todayIsoDate();
  const daily = filterRecordings(recordings, { start_date: date, end_date: date });
  const morning = daily.find((recording) => recording.type === "morning") ?? null;
  const evening = daily.find((recording) => recording.type === "evening") ?? null;

  return {
    date,
    morning: morning ? toAgentRecording(morning) : null,
    evening: evening ? toAgentRecording(evening) : null,
    completion: completionSummary(morning, evening),
  };
}

function getRecordings(recordings, input) {
  const limit = clampLimit(input.limit, 20, 100);
  const cursor = Math.max(0, Number(input.cursor || 0));
  const filtered = filterRecordings(recordings, input);
  const page = filtered.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < filtered.length ? String(cursor + limit) : null;

  return {
    recordings: page.map(toAgentRecording),
    next_cursor: nextCursor,
  };
}

function getRecording(recordings, input) {
  const id = typeof input.id === "string" ? input.id : "";
  const recording = recordings.find((item) => item.id === id);
  return {
    recording: recording ? toAgentRecording(recording) : null,
  };
}

function search(recordings, input) {
  const query = String(input.query ?? "").trim();
  if (!query) return { results: [] };

  const limit = clampLimit(input.limit, 10, 50);
  const queryTokens = contentTokens(query);
  const filtered = filterRecordings(recordings, input);

  const results = filtered
    .map((recording) => {
      const haystack = searchableText(recording);
      const haystackTokens = contentTokens(haystack);
      const score = queryTokens.length === 0
        ? 0
        : queryTokens.filter((token) => haystackTokens.includes(token)).length / queryTokens.length;

      return {
        recording,
        score,
        matched_excerpt: matchedExcerpt(recording, queryTokens),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((result) => ({
      recording: toAgentRecording(result.recording),
      score: Number(result.score.toFixed(3)),
      matched_excerpt: result.matched_excerpt,
    }));

  return { results };
}

function listOpenTodos(recordings, input) {
  const limit = clampLimit(input.limit, 50, 200);
  const priority = typeof input.priority === "string" ? input.priority : null;
  const bucket = TASK_BUCKETS.includes(input.bucket) ? input.bucket : null;
  const includeCompleted = input.include_completed === true;
  const timeZone = timeZoneInput(input);
  const date = normalizeDate(input.date) || todayIsoDate(timeZone);
  const filtered = filterRecordings(recordings, input);
  const taskList = buildTaskList(filtered, { date, timeZone, includeAllDone: includeCompleted });
  const todos = [];
  const seen = new Set();

  for (const bucketName of TASK_BUCKETS) {
    if (bucket && bucketName !== bucket) continue;

    for (const task of taskList[bucketName]) {
      if (priority && task.priority !== priority) continue;

      seen.add(normalizeForComparison(task.text));
      todos.push(taskToTodo(task));
    }
  }

  // Cleared tasks leave the app's list at the day boundary but stay visible
  // here on request, in the bucket they would fall in, after the open ones.
  if (includeCompleted) {
    for (const task of taskList.done) {
      if (bucket && task.bucket !== bucket) continue;
      if (priority && task.priority !== priority) continue;

      seen.add(normalizeForComparison(task.text));
      todos.push(taskToTodo(task));
    }
  }

  // Most-important action items are not tasks, but agents have always seen them
  // here. They keep their place at the end when no task filter is set.
  if (!bucket && !priority) {
    for (const recording of filtered) {
      const note = recording.structured_note;
      if (!note) continue;

      for (const item of note.action_items ?? []) {
        if (item.status && item.status !== "open") continue;
        if (item.source === "todo" || item.source === "manual") continue;

        const key = normalizeForComparison(item.text);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        todos.push({
          id: item.id ?? null,
          text: item.text,
          status: item.status ?? "open",
          bucket: null,
          timeframe: null,
          due: null,
          priority: null,
          carried: false,
          context: item.source ?? "most_important",
          recording_id: recording.id,
          recording_created_at: recording.created_at,
          recording_title: note.title,
        });
      }
    }
  }

  return { date, todos: todos.slice(0, limit) };
}

function taskToTodo(task) {
  return {
    id: task.id,
    text: task.text,
    status: task.status,
    completed_at: task.completed_at ?? null,
    bucket: task.bucket,
    timeframe: task.timeframe,
    due: task.due,
    priority: task.priority,
    carried: task.carried,
    first_seen_local_date: task.first_seen_local_date,
    context: task.context,
    recording_id: task.recording_id,
    recording_created_at: task.recording_created_at,
    recording_title: task.recording_title,
  };
}

function getRecentReflections(recordings, input) {
  const limit = clampLimit(input.limit, 20, 100);
  const mood = typeof input.mood === "string" ? input.mood : null;
  const filtered = filterRecordings(recordings, dateScopedInput(input, 14));

  const reflections = filtered
    .filter((recording) => ["evening", "weekly_review"].includes(recording.type))
    .filter((recording) => !mood || recording.structured_note?.mood === mood)
    .slice(0, limit)
    .map((recording) => ({
      recording_id: recording.id,
      recording_created_at: recording.created_at,
      date: recordingLocalDate(recording),
      type: recording.type,
      title: recording.structured_note?.title ?? null,
      summary: recording.structured_note?.summary ?? null,
      mood: recording.structured_note?.mood ?? null,
      accomplishments: recording.structured_note?.accomplishments ?? [],
      intentions: recording.structured_note?.intentions ?? [],
    }));

  return { reflections };
}

function getEnergyPatterns(recordings, input) {
  const filtered = filterRecordings(recordings, dateScopedInput(input, 30));
  const buckets = {
    givers: new Map(),
    sappers: new Map(),
    recoverers: new Map(),
  };

  for (const recording of filtered) {
    const text = uniqueText([recording.transcript_raw, recording.structured_note?.summary]);
    addEnergyMatches(buckets.givers, text, [
      /energy (?:giver|givers?) (?:was|were)\s+([^.!?]+)/gi,
      /got energy from\s+([^.!?]+)/gi,
      /energized by\s+([^.!?]+)/gi,
    ], new Set());
    addEnergyMatches(buckets.sappers, text, [
      /energy (?:sapper|sappers?) (?:was|were)\s+([^.!?]+)/gi,
      /drained by\s+([^.!?]+)/gi,
      /draining\s+([^.!?]+)/gi,
    ], new Set());
    addEnergyMatches(buckets.recoverers, text, [
      /recovered by\s+([^.!?]+)/gi,
      /recovery (?:was|came from)\s+([^.!?]+)/gi,
    ], new Set());
  }

  return {
    givers: mapToCounts(buckets.givers),
    sappers: mapToCounts(buckets.sappers),
    recoverers: mapToCounts(buckets.recoverers),
  };
}

function getBalanceSnapshot(recordings, input) {
  const scopedInput = input.date ? { ...input, start_date: input.date, end_date: input.date } : input;
  const filtered = filterRecordings(recordings, scopedInput);
  const snapshot = Object.fromEntries(
    CENTERS.map((center) => [center, { count: 0, examples: [] }]),
  );

  for (const recording of filtered) {
    const note = recording.structured_note;
    if (!note) continue;

    for (const center of note.centers_of_balance ?? []) {
      if (!snapshot[center]) continue;

      snapshot[center].count += 1;
      if (snapshot[center].examples.length < 3) {
        snapshot[center].examples.push({
          recording_id: recording.id,
          date: recordingLocalDate(recording),
          title: note.title,
          excerpt: note.summary || excerpt(recording.transcript_raw),
        });
      }
    }
  }

  return snapshot;
}

function filterRecordings(recordings, input = {}) {
  const startDate = normalizeDate(input.start_date);
  const endDate = normalizeDate(input.end_date);
  const type = typeof input.type === "string" ? input.type : null;

  return recordings.filter((recording) => {
    const date = recordingLocalDate(recording);
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    if (type && recording.type !== type) return false;
    return true;
  });
}

function dateScopedInput(input = {}, defaultDays) {
  const date = normalizeDate(input.date);
  if (date) return { ...input, start_date: date, end_date: date };
  if (normalizeDate(input.start_date)) return input;

  const days = Math.max(1, Number(input.days || defaultDays));
  if (!Number.isFinite(days)) return input;

  return {
    ...input,
    start_date: addDays(todayIsoDate(), -Math.floor(days) + 1),
  };
}

function completionSummary(morning, evening) {
  const morningItems = [
    ...(morning?.structured_note?.priorities ?? []),
    ...(morning?.structured_note?.todos ?? []).map((todo) => todo.text),
  ];
  const eveningItems = [
    ...(evening?.structured_note?.accomplishments ?? []),
    evening?.structured_note?.summary ?? "",
  ].filter(Boolean);

  const satisfied = [];
  const outstanding = [];
  for (const item of morningItems) {
    const match = eveningItems.find((candidate) => completionMatches(item, candidate));
    if (match) {
      satisfied.push({ item, evidence: match });
    } else {
      outstanding.push(item);
    }
  }

  const unplanned = eveningItems.filter(
    (item) => !morningItems.some((candidate) => completionMatches(candidate, item)),
  );

  return { satisfied, outstanding, unplanned };
}

function toAgentRecording(recording) {
  return {
    id: recording.id,
    created_at: recording.created_at,
    user_local_time: recording.user_local_time,
    date: recordingLocalDate(recording),
    timezone: recording.timezone,
    type: recording.type,
    processing_status: recording.processing_status,
    transcript_raw: recording.transcript_raw,
    structured_note: recording.structured_note ?? null,
  };
}

function searchableText(recording) {
  const note = recording.structured_note ?? {};
  return [
    recording.transcript_raw,
    note.title,
    note.summary,
    ...(note.most_important ?? []),
    ...(note.action_items ?? []).map((item) => item.text),
    ...(note.todos ?? []).map((todo) => todo.text),
    ...(note.priorities ?? []),
    ...(note.intentions ?? []),
    ...(note.accomplishments ?? []),
    ...(note.tomorrow_todos ?? []),
    ...(note.people ?? []),
    ...(note.projects ?? []),
    ...(note.tags ?? []),
    ...(note.centers_of_balance ?? []),
  ].filter(Boolean).join(" ");
}

function matchedExcerpt(recording, queryTokens) {
  const candidates = [
    recording.structured_note?.summary,
    ...(recording.structured_note?.most_important ?? []),
    ...(recording.structured_note?.action_items ?? []).map((item) => item.text),
    recording.transcript_raw,
    ...(recording.structured_note?.todos ?? []).map((todo) => todo.text),
    ...(recording.structured_note?.intentions ?? []),
    ...(recording.structured_note?.accomplishments ?? []),
  ].filter(Boolean);

  return candidates.find((candidate) => {
    const tokens = contentTokens(candidate);
    return queryTokens.some((token) => tokens.includes(token));
  }) ?? excerpt(recording.transcript_raw);
}

function addEnergyMatches(bucket, text, patterns, seenKeys) {
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const items = splitItems(match[1]);
      for (const item of items) {
        const key = normalizeForComparison(item);
        if (!key || seenKeys.has(key)) continue;

        seenKeys.add(key);
        increment(bucket, item, key);
      }
    }
  }
}

function splitItems(value) {
  return String(value ?? "")
    .split(/\s+and\s+|,/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^the\s+/i, ""))
    .map((item) => item.slice(0, 80));
}

function increment(map, item, providedKey) {
  const key = providedKey ?? normalizeForComparison(item);
  if (!key) return;

  const current = map.get(key) ?? { item, count: 0 };
  current.count += 1;
  map.set(key, current);
}

function mapToCounts(map) {
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.item.localeCompare(b.item))
    .slice(0, 20);
}

function contentTokens(value) {
  return normalizeForComparison(value)
    .split(" ")
    .map(stemToken)
    .filter((token) => token.length > 2 && !STOP_TOKENS.has(token));
}

function textSimilarity(left, right) {
  const leftTokens = new Set(contentTokens(left));
  const rightTokens = new Set(contentTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / leftTokens.size;
}

function completionMatches(expected, evidence) {
  const expectedTokens = new Set(contentTokens(expected));
  const evidenceTokens = new Set(contentTokens(evidence));
  if (expectedTokens.size === 0 || evidenceTokens.size === 0) return false;

  let overlap = 0;
  for (const token of expectedTokens) {
    if (evidenceTokens.has(token)) overlap += 1;
  }

  if (expectedTokens.size === 1) return overlap === 1;
  return overlap >= 2 && overlap / expectedTokens.size >= 0.67;
}

function uniqueText(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  ).join(" ");
}

function stemToken(token) {
  const irregular = {
    called: "call",
    calling: "call",
    rewrote: "rewrite",
    rewritten: "rewrite",
  };
  if (irregular[token]) return irregular[token];
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
  return token;
}

function recordingLocalDate(recording) {
  const localTime = String(recording.user_local_time ?? "");
  const match = localTime.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  return String(recording.created_at ?? "").slice(0, 10);
}

function normalizeDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayIsoDate(timeZone = "UTC") {
  return localDateInZone(new Date().toISOString(), timeZone);
}

function timeZoneInput(input) {
  return typeof input.tz === "string" && input.tz.trim() ? input.tz.trim() : "UTC";
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampLimit(value, defaultLimit, maxLimit) {
  const limit = Number(value || defaultLimit);
  if (!Number.isFinite(limit) || limit <= 0) return defaultLimit;
  return Math.min(Math.floor(limit), maxLimit);
}

function excerpt(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}
