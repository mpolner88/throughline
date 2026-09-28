const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;

export const PRODUCTION_EXTRACTION_PROMPT = `# Throughline Note Extraction v0

You extract structure from one Throughline voice note.

The user-facing product is simple: a person speaks anything into Throughline, and that note becomes available to their AI agent. Your job is to preserve what they said and extract only the useful structure an agent may need later.

## Non-negotiable rules

- Do not invent facts, tasks, people, projects, dates, or mood.
- If a field is not supported by the transcript, return an empty array or null.
- Prefer missing data over invented data.
- Keep the user's meaning. Do not turn a vague thought into a specific commitment.
- Todos must be imperative: Call Sarah, not I should call Sarah.
- Do not turn product opinions, design principles, or "the app should..." statements into todos unless the user clearly asks to do the work. Put those in intentions.
- Only set due or for_date when the transcript clearly implies a date.
- tomorrow_todos are strings only: the text of tasks explicitly assigned to tomorrow or the next day.
- Never put todo objects inside tomorrow_todos.
- Every tomorrow_todos item must also appear in todos with for_date set.
- accomplishments are things the user says they completed or did.
- Preserve named people exactly as spoken when possible.
- Use concise titles, 80 characters or fewer.
- Use one or two sentence summaries.
- most_important must be an array of 1-5 concise strings that capture the highest-signal takeaways, actions, decisions, risks, or reminders for an agent. Each item must be grounded in the transcript.
- Fill every applicable field. Empty arrays are correct only when the transcript gives no evidence.
- Use neutral for mood when the note has no clear emotional signal. Use null only when the transcript is too thin to judge mood at all.

## Type selection

Choose exactly one:

- morning: planning, priorities, intentions, what is on the user's mind for the day.
- evening: reflection, accomplishments, what happened, what carries into tomorrow.
- weekly_review: weekly retrospective or next-week planning.
- freeform: any other note, idea, reminder, or thought.

Use transcript content first. Use metadata only as a tiebreaker.

## Mood

Choose one or null:

focused, energized, grateful, calm, anxious, frustrated, tired, sad, neutral

Only choose a non-neutral mood when the transcript supports it.

Mood mapping guidance:

- nervous or worried -> anxious
- relieved -> calm
- clear or locked in -> focused
- drained or done -> tired

## Centers of balance

Choose zero or more:

- health
- relationships
- passions
- purpose
- profession

Use centers when the note clearly touches that life area. Examples:

- work, product, engineering, billing, launch, support -> profession
- meaning, personal direction, constraints, values, decisions -> purpose
- running, lunch, dentist, physical therapy, rest -> health
- family, friends, apology, dinner with someone -> relationships
- music, album, guitar, creative work -> passions

## Field guidance

- priorities: the main things for the day/week, especially when the user says priority, important, first, first thing, or carry forward.
- most_important: a short ranked list of the items an agent should notice first. Prefer explicit priorities, high-impact todos, decisions, blockers, and durable context. Do not duplicate near-identical items.
- intentions: constraints, posture, or how the user wants to approach something. Capture explicit constraints like do not overbuild the dashboard, not perfect it, without explaining too much, or keep it small. Do not invent intentions from generic worry or stress.
- accomplishments: completed actions only. Example: I called Aaron, I got the outline done, I shipped the beta invite.
- projects: named workstreams, objects, products, or recurring efforts mentioned directly. Example: Stripe, pricing page, metrics doc, README, dashboard, TestFlight. Avoid generic projects like the app unless no clearer project noun exists.
- tags: short retrieval labels based on explicit topics in the transcript. Tags may be topical, but must be grounded in the note. Prefer 1-4 useful retrieval tags when the note has clear topics.
- people: named people mentioned directly, including family labels like Mom or Dad.

For negative instructions, do not create a todo unless the user frames it as an action. Put durable constraints in intentions.

Before returning, check:

- If a todo is for tomorrow, it appears in both todos and tomorrow_todos.
- If the transcript names a product, doc, API, feature, or workstream, projects is not empty.
- If the transcript has clear topics, tags is not empty.
- If the transcript touches work, health, family/friends, creative work, or values, centers_of_balance is not empty.
- If the transcript contains actions, decisions, priorities, blockers, or durable context, most_important is not empty.
- If the transcript says what matters most, priorities is not empty.
- If the transcript says how to approach the work, intentions is not empty.

Return one JSON object with exactly these fields and shapes:

{
  "type": "morning | evening | weekly_review | freeform",
  "title": "a concise non-empty title",
  "summary": "a concise non-empty one or two sentence summary",
  "most_important": ["high-signal item"],
  "todos": [{"text":"imperative task","priority":"high | medium | low | null","due":"YYYY-MM-DD | null","for_date":"YYYY-MM-DD | null","context":"short context | null"}],
  "priorities": ["priority"],
  "intentions": ["intention or constraint"],
  "accomplishments": ["completed action"],
  "tomorrow_todos": ["task text"],
  "mood": "focused | energized | grateful | calm | anxious | frustrated | tired | sad | neutral | null",
  "people": ["person"],
  "projects": ["project"],
  "tags": ["tag"],
  "centers_of_balance": ["health | relationships | passions | purpose | profession"]
}

When the user says they need to, should, have to, plan to, want to remember to, or asks to be reminded to do something, include it in todos as an imperative task. Never return an empty title or summary when a transcript is present.

Return strict JSON only. No markdown. No commentary.`;

const CANONICAL_EXTRACTION_FIELDS = Object.freeze([
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
]);

const STRING_ARRAY_FIELDS = Object.freeze([
  "most_important",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "people",
  "projects",
  "tags",
]);
const TODO_FIELDS = Object.freeze([
  "text",
  "status",
  "priority",
  "due",
  "for_date",
  "context",
]);
const VALID_TYPES = Object.freeze([
  "morning",
  "evening",
  "weekly_review",
  "freeform",
]);
const VALID_MOODS = Object.freeze([
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
const VALID_PRIORITIES = Object.freeze(["high", "medium", "low"]);
const VALID_CENTERS = Object.freeze([
  "health",
  "relationships",
  "passions",
  "purpose",
  "profession",
]);

const nullableStringSchema = Object.freeze({
  anyOf: Object.freeze([
    Object.freeze({ type: "string" }),
    Object.freeze({ type: "null" }),
  ]),
});
const nullableDateSchema = Object.freeze({
  anyOf: Object.freeze([
    Object.freeze({
      type: "string",
      pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    }),
    Object.freeze({ type: "null" }),
  ]),
});
const stringArraySchema = Object.freeze({
  type: "array",
  items: Object.freeze({ type: "string" }),
});

export const PRODUCTION_EXTRACTION_SCHEMA_V1 = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "throughline-production-extraction-v1",
  type: "object",
  additionalProperties: false,
  required: [...CANONICAL_EXTRACTION_FIELDS],
  properties: {
    type: { type: "string", enum: [...VALID_TYPES] },
    title: { type: "string", minLength: 1, maxLength: 80 },
    summary: { type: "string", minLength: 1 },
    most_important: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 1 },
    },
    todos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [...TODO_FIELDS],
        properties: {
          text: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["open", "completed"] },
          priority: {
            anyOf: [
              { type: "string", enum: [...VALID_PRIORITIES] },
              { type: "null" },
            ],
          },
          due: nullableDateSchema,
          for_date: nullableDateSchema,
          context: nullableStringSchema,
        },
      },
    },
    priorities: stringArraySchema,
    intentions: stringArraySchema,
    accomplishments: stringArraySchema,
    tomorrow_todos: stringArraySchema,
    mood: {
      anyOf: [
        { type: "string", enum: [...VALID_MOODS] },
        { type: "null" },
      ],
    },
    people: stringArraySchema,
    projects: stringArraySchema,
    tags: stringArraySchema,
    centers_of_balance: {
      type: "array",
      items: { type: "string", enum: [...VALID_CENTERS] },
    },
  },
});

export const PRODUCTION_NORMALIZER_SPEC_V1 = deepFreeze({
  normalizer_version: "throughline-production-normalizer-v1",
  ordered_fields: [...CANONICAL_EXTRACTION_FIELDS],
  title_max_characters: 80,
  most_important_max_items: 5,
  todo_status_default: "open",
  invalid_enum_value: null,
  invalid_array_value: [],
  relative_dates: ["today", "tomorrow", "next day", "weekday"],
  derives: [
    "tomorrow_todos",
    "most_important",
    "title",
    "summary",
    "action_items",
  ],
});

export function canonicalJson(value) {
  try {
    return JSON.stringify(canonicalValue(value));
  } catch {
    throw new Error("canonical_json_invalid");
  }
}

export async function sha256Hex(value) {
  if (typeof value !== "string" && !(value instanceof Uint8Array)) {
    throw new Error("sha256_input_invalid");
  }
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function resolveInferenceContract(env = {}) {
  if (env === null || typeof env !== "object" || Array.isArray(env)) {
    throw new Error("inference_contract_env_invalid");
  }
  const provider = {
    name: "groq",
    base_url: trimTrailingSlash(
      resolvedString(env.GROQ_BASE_URL, DEFAULT_GROQ_BASE_URL),
    ),
  };
  const transcription = {
    model: resolvedString(
      env.GROQ_TRANSCRIPTION_MODEL,
      DEFAULT_GROQ_TRANSCRIPTION_MODEL,
    ),
    timeout_ms: resolvedInteger(
      env.GROQ_TRANSCRIPTION_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      1,
    ),
    max_retries: resolvedInteger(
      env.GROQ_TRANSCRIPTION_MAX_RETRIES,
      DEFAULT_MAX_RETRIES,
      0,
    ),
    response_format: "json",
  };
  const extraction = {
    model: resolvedString(env.GROQ_MODEL, DEFAULT_GROQ_MODEL),
    timeout_ms: resolvedInteger(
      env.GROQ_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      1,
    ),
    max_retries: resolvedInteger(
      env.GROQ_MAX_RETRIES,
      DEFAULT_MAX_RETRIES,
      0,
    ),
    temperature: 0,
    response_format: { type: "json_object" },
  };
  const schemaJson = canonicalJson(PRODUCTION_EXTRACTION_SCHEMA_V1);
  const normalizerJson = canonicalJson(PRODUCTION_NORMALIZER_SPEC_V1);
  const keysetJson = canonicalJson(CANONICAL_EXTRACTION_FIELDS);
  const promptSha256 = await sha256Hex(PRODUCTION_EXTRACTION_PROMPT);
  const schemaSha256 = await sha256Hex(schemaJson);
  const normalizerSha256 = await sha256Hex(normalizerJson);
  const keysetSha256 = await sha256Hex(keysetJson);
  const resolved = {
    contract_version: "throughline-inference-contract-v1",
    provider,
    transcription,
    extraction,
    prompt: {
      version: "throughline-production-extraction-prompt-v0",
      snapshot: PRODUCTION_EXTRACTION_PROMPT,
      sha256: promptSha256,
    },
    schema: {
      version: "throughline-production-extraction-schema-v1",
      snapshot: PRODUCTION_EXTRACTION_SCHEMA_V1,
      sha256: schemaSha256,
      keyset_sha256: keysetSha256,
    },
    normalizer: {
      version: "throughline-production-normalizer-v1",
      snapshot: PRODUCTION_NORMALIZER_SPEC_V1,
      sha256: normalizerSha256,
    },
  };
  return deepFreeze({
    ...resolved,
    contract_sha256: await sha256Hex(canonicalJson(resolved)),
  });
}

export function canonicalExtractionFields(contract) {
  if (
    contract?.schema?.snapshot?.$id !==
      PRODUCTION_EXTRACTION_SCHEMA_V1.$id ||
    contract.schema.sha256 === undefined ||
    canonicalJson(contract.schema.snapshot) !==
      canonicalJson(PRODUCTION_EXTRACTION_SCHEMA_V1)
  ) {
    throw new Error("inference_contract_schema_invalid");
  }
  return [...contract.schema.snapshot.required];
}

export function validateCanonicalExtractionSnapshot(value, contract) {
  const fields = canonicalExtractionFields(contract);
  assertExactObjectKeys(value, fields);
  assertCanonicalShape(value);
  const normalized = normalizeExtraction(value, {});
  normalized.todos.forEach((todo, index) => {
    todo.status = value.todos[index].status;
  });
  delete normalized.action_items;
  if (canonicalJson(normalized) !== canonicalJson(value)) {
    throw new Error("canonical_extraction_invalid");
  }
  return structuredClone(value);
}

export function normalizeExtraction(raw, metadata = {}) {
  const actual = {};

  for (const field of CANONICAL_EXTRACTION_FIELDS) {
    if (field === "type") {
      actual.type = VALID_TYPES.includes(raw?.type) ? raw.type : "freeform";
    } else if (field === "title") {
      actual.title = stringOrEmpty(raw?.title).slice(0, 80);
    } else if (field === "summary") {
      actual.summary = stringOrEmpty(raw?.summary);
    } else if (field === "todos") {
      actual.todos = Array.isArray(raw?.todos)
        ? raw.todos
          .map((todo) => normalizeTodo(todo, metadata))
          .filter((todo) => todo.text)
        : [];
    } else if (field === "mood") {
      actual.mood = normalizeEnum(raw?.mood, VALID_MOODS);
    } else if (field === "centers_of_balance") {
      actual.centers_of_balance = normalizeCenters(raw?.centers_of_balance);
    } else {
      actual[field] = normalizeStringArray(raw?.[field]);
    }
  }

  return postprocessExtraction(actual, metadata);
}

function canonicalValue(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error("canonical_json_invalid");
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function resolvedString(value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("inference_contract_env_invalid");
  }
  return value;
}

function resolvedInteger(value, fallback, minimum) {
  if (value === undefined || value === "") return fallback;
  const parsed = typeof value === "string" && /^\d+$/u.test(value)
    ? Number(value)
    : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error("inference_contract_env_invalid");
  }
  return parsed;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/u, "");
}

function assertExactObjectKeys(value, expected) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !exactArray(Object.keys(value).sort(), [...expected].sort())
  ) {
    throw new Error("canonical_extraction_invalid");
  }
}

function assertCanonicalShape(value) {
  if (
    !VALID_TYPES.includes(value.type) ||
    typeof value.title !== "string" ||
    !value.title ||
    value.title.length > 80 ||
    typeof value.summary !== "string" ||
    !value.summary ||
    !isStringArray(value.most_important) ||
    value.most_important.length < 1 ||
    value.most_important.length > 5 ||
    !Array.isArray(value.todos) ||
    !STRING_ARRAY_FIELDS.every((field) => isStringArray(value[field])) ||
    !(
      value.mood === null ||
      (typeof value.mood === "string" && VALID_MOODS.includes(value.mood))
    ) ||
    !Array.isArray(value.centers_of_balance) ||
    value.centers_of_balance.some((center) =>
      typeof center !== "string" || !VALID_CENTERS.includes(center)
    )
  ) throw new Error("canonical_extraction_invalid");

  for (const todo of value.todos) {
    assertExactObjectKeys(todo, TODO_FIELDS);
    if (
      typeof todo.text !== "string" ||
      !todo.text ||
      !["open", "completed"].includes(todo.status) ||
      !(
        todo.priority === null ||
        VALID_PRIORITIES.includes(todo.priority)
      ) ||
      !isNullableDate(todo.due) ||
      !isNullableDate(todo.for_date) ||
      !(todo.context === null || typeof todo.context === "string")
    ) throw new Error("canonical_extraction_invalid");
  }
}

function isStringArray(value) {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0);
}

function isNullableDate(value) {
  return value === null ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value));
}

function exactArray(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

function postprocessExtraction(actual, metadata) {
  deriveTomorrowTodos(actual, metadata);
  deriveMostImportant(actual);
  deriveTitleAndSummary(actual);
  deriveActionItems(actual);
  return actual;
}

function deriveTitleAndSummary(actual) {
  const firstTodo = actual.todos?.[0]?.text;
  const firstImportant = actual.most_important?.[0];
  const firstPriority = actual.priorities?.[0];
  const fallbackTitle = nullableString(firstImportant) ??
    nullableString(firstPriority) ??
    nullableString(firstTodo) ??
    "voice note";

  actual.title = (nullableString(actual.title) ?? fallbackTitle).slice(0, 80);

  if (!nullableString(actual.summary)) {
    const summaryItems = (actual.most_important ?? [])
      .map(nullableString)
      .filter(Boolean)
      .slice(0, 2);
    actual.summary = summaryItems.length
      ? summaryItems.join(". ")
      : actual.title;
  }
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
  return allowed.includes(value) ? value : null;
}

function normalizeDateValue(value, metadata) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower === "today") return metadata?.user_local_date ?? null;
  if (lower === "tomorrow" || lower === "next day") {
    return nextIsoDate(metadata?.user_local_date);
  }

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
  if (
    typeof baseIsoDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(baseIsoDate)
  ) return null;

  const date = new Date(`${baseIsoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  const currentDay = date.getUTCDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilTarget);
  return date.toISOString().slice(0, 10);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());
}

function normalizeCenters(value) {
  return normalizeStringArray(value).filter((item) =>
    VALID_CENTERS.includes(item)
  );
}

function deriveTomorrowTodos(actual, metadata) {
  const tomorrowDate = nextIsoDate(metadata?.user_local_date);
  if (!tomorrowDate) return;

  const tomorrowTodoTexts = new Set(
    actual.tomorrow_todos.map(normalizeForComparison),
  );

  for (const todo of actual.todos) {
    if (todo.for_date !== tomorrowDate) continue;

    const key = normalizeForComparison(todo.text);
    if (!key || tomorrowTodoTexts.has(key)) continue;

    actual.tomorrow_todos.push(todo.text);
    tomorrowTodoTexts.add(key);
  }
}

function deriveMostImportant(actual) {
  const values = [];

  addUniqueImportant(values, actual.most_important ?? []);
  addUniqueImportant(values, actual.priorities ?? []);
  addUniqueImportant(
    values,
    (actual.todos ?? [])
      .filter((todo) => todo.priority === "high")
      .map((todo) => todo.text),
  );
  addUniqueImportant(values, actual.tomorrow_todos ?? []);
  addUniqueImportant(values, actual.intentions ?? []);
  addUniqueImportant(values, actual.accomplishments ?? []);
  addUniqueImportant(values, (actual.todos ?? []).map((todo) => todo.text));

  if (!values.length && actual.summary) {
    addUniqueImportant(values, [actual.summary]);
  }

  actual.most_important = values.slice(0, 5);
}

function deriveActionItems(actual) {
  const items = [];

  for (const todo of actual.todos ?? []) {
    addActionItem(items, todo.text, "todo", todo.status, todo.completed_at);
  }

  actual.action_items = items;
}

function addActionItem(
  items,
  candidate,
  source,
  status = null,
  completedAt = null,
) {
  const text = nullableString(candidate);
  if (!text) return;

  const key = normalizeForComparison(text);
  if (
    !key ||
    items.some((item) => normalizeForComparison(item.text) === key)
  ) return;

  const normalizedStatus = status === "completed" || status === "done"
    ? "completed"
    : "open";
  items.push({
    id: stableActionItemId(text),
    text,
    status: normalizedStatus,
    source,
    completed_at: normalizedStatus === "completed"
      ? nullableString(completedAt)
      : null,
  });
}

function addUniqueImportant(values, candidates) {
  const seen = new Set(values.map(normalizeForComparison));

  for (const candidate of candidates) {
    const text = nullableString(candidate);
    if (!text) continue;

    const key = normalizeForComparison(text);
    if (!key || seen.has(key)) continue;

    values.push(text.slice(0, 180));
    seen.add(key);
  }
}

function stableActionItemId(text) {
  const normalized = normalizeForComparison(text)
    .replace(/[^a-z0-9\s-]/gu, " ")
    .replace(/\s+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return `act_${normalized.slice(0, 80) || "item"}`;
}

function nextIsoDate(isoDate) {
  if (
    typeof isoDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(isoDate)
  ) return null;

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeForComparison(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
