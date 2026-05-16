import fs from "node:fs/promises";
import path from "node:path";

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

const TOOL_DEFINITIONS = [
  {
    name: "get_today",
    description: "Return all processed notes for a local day.",
    input_schema: objectSchema({
      date: DATE_PROPERTY,
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
    description: "Return open todos and tomorrow carry-forward items extracted from notes.",
    input_schema: objectSchema({
      ...FILTER_PROPERTIES,
      limit: { ...LIMIT_PROPERTY, maximum: 200 },
      priority: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Optional priority filter.",
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
  const date = normalizeDate(input.date) || todayIsoDate();
  const filtered = filterRecordings(recordings, { ...input, start_date: date, end_date: date });
  return {
    recordings: filtered.map(toAgentRecording),
    count: filtered.length,
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
  const todos = [];

  for (const recording of filterRecordings(recordings, input).reverse()) {
    const note = recording.structured_note;
    if (!note) continue;

    const seen = new Set();
    for (const todo of note.todos ?? []) {
      if (todo.status && todo.status !== "open") continue;
      if (priority && todo.priority !== priority) continue;

      seen.add(normalizeForComparison(todo.text));
      todos.push({
        ...todo,
        recording_id: recording.id,
        recording_created_at: recording.created_at,
        recording_title: note.title,
      });
    }

    for (const text of note.tomorrow_todos ?? []) {
      const key = normalizeForComparison(text);
      if (seen.has(key)) continue;
      todos.push({
        text,
        status: "open",
        priority: null,
        due: null,
        for_date: null,
        context: "tomorrow",
        recording_id: recording.id,
        recording_created_at: recording.created_at,
        recording_title: note.title,
      });
    }
  }

  return { todos: todos.slice(0, limit) };
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

function normalizeForComparison(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
