import "@supabase/functions-js/edge-runtime.d.ts";

import { listMemoryTools, runMemoryTool } from "../_shared/memory-tools.ts";

const FUNCTION_NAME = "api";
const DEFAULT_AUDIO_BUCKET = "throughline-audio";
const DEFAULT_USER_ID = "dev-user";
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const DEFAULT_GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;
const MAX_BODY_BYTES = Number(Deno.env.get("THROUGHLINE_MAX_BODY_BYTES") || 60 * 1024 * 1024);
const DEMO_MAX_BODY_BYTES = Number(Deno.env.get("THROUGHLINE_DEMO_MAX_BODY_BYTES") || 8 * 1024 * 1024);
const DEMO_MAX_DURATION_SECONDS = Number(Deno.env.get("THROUGHLINE_DEMO_MAX_DURATION_SECONDS") || 30);

const RECORDING_TYPES = new Set(["morning", "evening", "weekly_review", "freeform"]);
const OUTPUT_FIELDS = [
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

const EXTRACTION_PROMPT = `# Throughline Note Extraction v0

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
- If the transcript says what matters most, priorities is not empty.
- If the transcript says how to approach the work, intentions is not empty.

Return strict JSON only. No markdown. No commentary.`;

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RequestContext = {
  kind: "service" | "user";
  legacyUserId: string;
  authUserId: string | null;
};

Deno.serve((req) => {
  return handleRequest(req).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unknown server error";
    return jsonResponse(status, { error: message });
  });
});

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const pathname = normalizeFunctionPath(url.pathname, FUNCTION_NAME);

  if (req.method === "GET" && pathname === "/health") {
    const context = await requestContext(req);
    return jsonResponse(200, {
      ok: true,
      service: "throughline-supabase-edge-api",
      storage: "supabase",
      auth_required: apiTokens().length > 0,
      authenticated: Boolean(context),
      auth_mode: context?.kind ?? null,
      transcription: Boolean(Deno.env.get("GROQ_API_KEY")) ? "groq" : "not_configured",
    });
  }

  if (req.method === "POST" && pathname === "/demo/recordings") {
    return handlePostDemoRecording(req);
  }

  const context = await requestContext(req);
  if (!context) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  if (req.method === "GET" && pathname === "/agent/tools") {
    return jsonResponse(200, { tools: listMemoryTools() });
  }

  const memoryToolMatch = pathname.match(/^\/agent\/tools\/([^/]+)$/);
  if (req.method === "POST" && memoryToolMatch) {
    const input = await parseJsonRequest(req);
    const output = runMemoryTool(decodeURIComponent(memoryToolMatch[1]), input, {
      recordings: await listFullRecordings(context),
    });
    return jsonResponse(200, { tool: memoryToolMatch[1], output });
  }

  if (req.method === "GET" && pathname === "/agent/tokens") {
    return jsonResponse(200, await listMcpTokens(context));
  }

  if (req.method === "POST" && pathname === "/agent/tokens") {
    return jsonResponse(201, await createMcpToken(context, await parseJsonRequest(req)));
  }

  const agentTokenMatch = pathname.match(/^\/agent\/tokens\/([^/]+)$/);
  if (req.method === "DELETE" && agentTokenMatch) {
    await revokeMcpToken(context, decodeURIComponent(agentTokenMatch[1]));
    return jsonResponse(200, { id: decodeURIComponent(agentTokenMatch[1]), revoked: true });
  }

  if (req.method === "POST" && pathname === "/recordings") {
    return handlePostRecording(req, context);
  }

  const extractionMatch = pathname.match(/^\/recordings\/([^/]+)\/extract$/);
  if (req.method === "POST" && extractionMatch) {
    return handleExtractRecording(req, context, decodeURIComponent(extractionMatch[1]));
  }

  const feedbackForRecordingMatch = pathname.match(/^\/recordings\/([^/]+)\/feedback$/);
  if (req.method === "POST" && feedbackForRecordingMatch) {
    return handlePostFeedback(req, context, decodeURIComponent(feedbackForRecordingMatch[1]));
  }

  if (req.method === "GET" && pathname === "/recordings") {
    const recordings = await listRecordings(context);
    return jsonResponse(200, { recordings, count: recordings.length });
  }

  if (req.method === "GET" && pathname === "/feedback") {
    const feedback = await listFeedback(context);
    return jsonResponse(200, { feedback, count: feedback.length });
  }

  if (req.method === "DELETE" && pathname === "/account") {
    return handleDeleteAccount(context);
  }

  const feedbackMatch = pathname.match(/^\/feedback\/([^/]+)$/);
  if (req.method === "GET" && feedbackMatch) {
    return jsonResponse(200, { feedback: await readFeedback(context, decodeURIComponent(feedbackMatch[1])) });
  }

  const recordingMatch = pathname.match(/^\/recordings\/([^/]+)$/);
  if (req.method === "DELETE" && recordingMatch) {
    const id = decodeURIComponent(recordingMatch[1]);
    await deleteRecording(id, context);
    return jsonResponse(200, { id, deleted: true });
  }

  if (req.method === "GET" && recordingMatch) {
    return jsonResponse(200, { recording: await readRecording(decodeURIComponent(recordingMatch[1]), context) });
  }

  return jsonResponse(404, { error: "Not found" });
}

async function handlePostRecording(req: Request, context: RequestContext) {
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, `Request body exceeds ${MAX_BODY_BYTES} bytes`);
  }

  const contentType = req.headers.get("content-type") || "";
  const { recording, audioBytes } = contentType.includes("application/json")
    ? await createRecordingFromJson(parseJsonBytes(bytes), context)
    : await createRecordingFromRaw(req, bytes, context);

  await persistRecording(recording);

  if (processingMode(req) === "async") {
    EdgeRuntime.waitUntil(processAndPersistRecording(recording, audioBytes));
    return jsonResponse(202, {
      id: recording.id,
      status: recording.status,
      processing_status: recording.processing_status,
      has_note: Boolean(recording.structured_note),
      recording_url: `/recordings/${recording.id}`,
      recording,
    });
  }

  await processAndPersistRecording(recording, audioBytes);

  return jsonResponse(201, {
    id: recording.id,
    status: recording.status,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording_url: `/recordings/${recording.id}`,
    recording,
  });
}

async function handlePostDemoRecording(req: Request) {
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > DEMO_MAX_BODY_BYTES) {
    throw new HttpError(413, `Demo recording exceeds ${DEMO_MAX_BODY_BYTES} bytes`);
  }

  const durationSeconds = nullableNumber(req.headers.get("x-throughline-duration-seconds"));
  if (durationSeconds !== null && durationSeconds > DEMO_MAX_DURATION_SECONDS) {
    throw new HttpError(400, `Demo recordings are limited to ${DEMO_MAX_DURATION_SECONDS} seconds`);
  }

  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const mimeType = contentType.split(";")[0].trim() || "application/octet-stream";
  const recording: any = {
    id: createDemoRecordingId(),
    user_id: "demo",
    auth_user_id: null,
    created_at: new Date().toISOString(),
    user_local_time: nullableString(req.headers.get("x-throughline-user-local-time")),
    timezone: nullableString(req.headers.get("x-throughline-timezone")),
    duration_seconds: durationSeconds,
    type: normalizeType(req.headers.get("x-throughline-recording-type")) || "freeform",
    transcript_raw: null,
    upload_source: "demo",
    audio: {
      stored: true,
      storage: "memory",
      mime_type: mimeType,
      bytes: bytes.byteLength,
    },
    status: "uploaded",
    processing_status: "uploaded",
  };

  await processRecording(recording, bytes);

  return jsonResponse(201, {
    id: recording.id,
    status: recording.status,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording_url: `/demo/recordings/${recording.id}`,
    recording,
  });
}

async function handleExtractRecording(req: Request, context: RequestContext, id: string) {
  const recording = await readRecording(id, context);
  const body = await parseJsonRequest(req);

  recording.transcript_raw = nullableString(body.transcript_raw) ?? recording.transcript_raw;
  recording.user_local_time = nullableString(body.user_local_time) ?? recording.user_local_time;
  recording.timezone = nullableString(body.timezone) ?? recording.timezone;
  recording.duration_seconds = nullableNumber(body.duration_seconds) ?? recording.duration_seconds;
  recording.type = normalizeType(body.type) ?? recording.type;

  await processRecording(recording, null);
  await persistRecording(recording);

  return jsonResponse(200, {
    id: recording.id,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording,
  });
}

async function handlePostFeedback(req: Request, context: RequestContext, recordingId: string) {
  const recording = await readRecording(recordingId, context);
  const body = await parseJsonRequest(req);
  const feedback = {
    id: createFeedbackId(),
    recording_id: recording.id,
    user_id: recording.user_id,
    auth_user_id: recording.auth_user_id ?? context.authUserId,
    created_at: new Date().toISOString(),
    source: "alpha_feedback",
    status: body.expected ? "eval_candidate" : "needs_review",
    answers: {
      agent_ready: nullableBoolean(body.agent_ready),
      should_remember: nullableBoolean(body.should_remember),
      missing: nullableString(body.missing),
      invented: nullableString(body.invented),
      correction: nullableString(body.correction),
    },
    expected: body.expected && typeof body.expected === "object" ? body.expected : null,
    recording_snapshot: {
      id: recording.id,
      user_local_time: recording.user_local_time,
      timezone: recording.timezone,
      type: recording.type,
      transcript_raw: recording.transcript_raw,
      structured_note: recording.structured_note ?? null,
    },
  };

  await persistFeedback(feedback);

  return jsonResponse(201, {
    id: feedback.id,
    recording_id: recording.id,
    status: feedback.status,
    feedback_url: `/feedback/${feedback.id}`,
  });
}

async function handleDeleteAccount(context: RequestContext) {
  const authUserId = requireAuthUser(context);
  const recordings = await listFullRecordings(context);

  for (const recording of recordings) {
    await deleteRecording(recording.id, context);
  }

  await deleteRows("throughline_feedback", `auth_user_id=eq.${encodeURIComponent(authUserId)}`);
  await deleteRows("throughline_mcp_tokens", `user_id=eq.${encodeURIComponent(authUserId)}`);
  await deleteRows("throughline_profiles", `id=eq.${encodeURIComponent(authUserId)}`);
  await deleteAuthUser(authUserId);

  return jsonResponse(200, {
    deleted: true,
    recordings_deleted: recordings.length,
  });
}

async function createRecordingFromJson(body: Record<string, unknown>, context: RequestContext) {
  const id = createRecordingId();
  const audioBytes = typeof body.audio_base64 === "string" ? decodeBase64(body.audio_base64) : null;
  const audioMimeType = nullableString(body.audio_mime_type) || "application/octet-stream";
  const audio = await storeAudio({ id, bytes: audioBytes, mimeType: audioMimeType, ownerId: context.legacyUserId });

  return {
    recording: {
      id,
      user_id: context.legacyUserId,
      auth_user_id: context.authUserId,
      created_at: new Date().toISOString(),
      user_local_time: nullableString(body.user_local_time),
      timezone: nullableString(body.timezone),
      duration_seconds: nullableNumber(body.duration_seconds),
      type: normalizeType(body.type),
      transcript_raw: nullableString(body.transcript_raw),
      upload_source: "json",
      audio,
      status: "uploaded",
      processing_status: "uploaded",
    },
    audioBytes,
  };
}

async function createRecordingFromRaw(req: Request, bodyBytes: Uint8Array, context: RequestContext) {
  const id = createRecordingId();
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const mimeType = contentType.split(";")[0].trim() || "application/octet-stream";
  const audio = await storeAudio({ id, bytes: bodyBytes, mimeType, ownerId: context.legacyUserId });

  return {
    recording: {
      id,
      user_id: context.legacyUserId,
      auth_user_id: context.authUserId,
      created_at: new Date().toISOString(),
      user_local_time: nullableString(req.headers.get("x-throughline-user-local-time")),
      timezone: nullableString(req.headers.get("x-throughline-timezone")),
      duration_seconds: nullableNumber(req.headers.get("x-throughline-duration-seconds")),
      type: normalizeType(req.headers.get("x-throughline-recording-type")),
      transcript_raw: null,
      upload_source: "raw",
      audio,
      status: "uploaded",
      processing_status: "uploaded",
    },
    audioBytes: bodyBytes,
  };
}

async function processRecording(recording: any, audioBytes: Uint8Array | null) {
  if (!recording.transcript_raw) {
    const transcription = await transcribeRecordingAudio(recording, audioBytes);

    recording.transcription = {
      status: transcription.status,
      provider: transcription.provider,
      processed_at: new Date().toISOString(),
      error: transcription.error,
    };

    if (transcription.transcript) {
      recording.transcript_raw = transcription.transcript;
    } else {
      recording.processing_status = transcription.status;
      return recording;
    }
  }

  const result = await extractRecordingNote(recording);
  recording.processing_status = result.status;
  recording.extraction = {
    status: result.status,
    provider: result.provider,
    prompt_path: "supabase/functions/api/index.ts:EXTRACTION_PROMPT",
    processed_at: new Date().toISOString(),
    metadata: result.metadata ?? null,
    error: result.error,
  };

  if (result.note) {
    recording.structured_note = result.note;
    recording.type = recording.type || result.note.type;
  }

  return recording;
}

async function processAndPersistRecording(recording: any, audioBytes: Uint8Array | null) {
  try {
    await processRecording(recording, audioBytes);
  } catch (error) {
    recording.processing_status = "processing_failed";
    recording.processing_error = {
      message: error instanceof Error ? error.message : "Unknown processing error",
      processed_at: new Date().toISOString(),
    };
  }

  await persistRecording(recording);
  return recording;
}

async function transcribeRecordingAudio(recording: any, audioBytes: Uint8Array | null) {
  if (recording.transcript_raw) {
    return {
      status: "transcribed",
      transcript: recording.transcript_raw,
      provider: "existing",
      error: null,
    };
  }

  if (!recording.audio?.stored || !audioBytes || audioBytes.byteLength === 0) {
    return {
      status: "needs_transcript",
      transcript: null,
      provider: null,
      error: null,
    };
  }

  if (!Deno.env.get("GROQ_API_KEY")) {
    return {
      status: "needs_transcript",
      transcript: null,
      provider: null,
      error: null,
    };
  }

  try {
    const transcript = await transcribeWithGroq(recording, audioBytes);
    return {
      status: "transcribed",
      transcript,
      provider: "groq",
      error: null,
    };
  } catch (error) {
    return {
      status: "transcription_failed",
      transcript: null,
      provider: "groq",
      error: error instanceof Error ? error.message : "Unknown transcription error",
    };
  }
}

async function transcribeWithGroq(recording: any, audioBytes: Uint8Array) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for Groq transcription");
  }

  const baseUrl = trimTrailingSlash(Deno.env.get("GROQ_BASE_URL") || DEFAULT_GROQ_BASE_URL);
  const model = Deno.env.get("GROQ_TRANSCRIPTION_MODEL") || DEFAULT_GROQ_TRANSCRIPTION_MODEL;
  const timeoutMs = Number(Deno.env.get("GROQ_TRANSCRIPTION_TIMEOUT_MS") || DEFAULT_TIMEOUT_MS);
  const maxRetries = Number(Deno.env.get("GROQ_TRANSCRIPTION_MAX_RETRIES") || DEFAULT_MAX_RETRIES);
  const fileName = `${recording.id}.${extensionForMime(recording.audio?.mime_type)}`;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const form = new FormData();
    form.append("model", model);
    form.append("response_format", "json");
    form.append(
      "file",
      new Blob([audioBytes], { type: recording.audio?.mime_type || "application/octet-stream" }),
      fileName,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        await sleep(retryDelayMs("", attempt));
        continue;
      }
      throw error;
    }
    clearTimeout(timeout);

    const responseText = await response.text();
    if (response.status === 429 && attempt < maxRetries) {
      await sleep(retryDelayMs(responseText, attempt));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Groq transcription failed (${response.status}): ${responseText}`);
    }

    const payload = JSON.parse(responseText);
    if (typeof payload.text !== "string" || !payload.text.trim()) {
      throw new Error("Groq transcription response did not include text");
    }

    return payload.text.trim();
  }

  throw new Error("Groq transcription failed after retries");
}

async function extractRecordingNote(recording: any) {
  const transcript = recording.transcript_raw;
  if (!transcript) {
    return {
      status: "needs_transcript",
      note: null,
      error: null,
      provider: null,
    };
  }

  if (!Deno.env.get("GROQ_API_KEY")) {
    return {
      status: "needs_extractor",
      note: null,
      error: null,
      provider: null,
    };
  }

  try {
    const metadata = metadataForRecording(recording);
    const raw = await requestGroqExtraction({
      id: recording.id,
      metadata,
      transcript,
      prompt: EXTRACTION_PROMPT,
    });

    return {
      status: "processed",
      note: normalizeExtraction(raw, metadata),
      error: null,
      provider: "groq",
      metadata,
    };
  } catch (error) {
    return {
      status: "extraction_failed",
      note: null,
      error: error instanceof Error ? error.message : "Unknown extraction error",
      provider: "groq",
    };
  }
}

async function requestGroqExtraction(input: Record<string, unknown>) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for Groq extraction");
  }

  const baseUrl = trimTrailingSlash(Deno.env.get("GROQ_BASE_URL") || DEFAULT_GROQ_BASE_URL);
  const model = Deno.env.get("GROQ_MODEL") || DEFAULT_GROQ_MODEL;
  const timeoutMs = Number(Deno.env.get("GROQ_TIMEOUT_MS") || DEFAULT_TIMEOUT_MS);
  const maxRetries = Number(Deno.env.get("GROQ_MAX_RETRIES") || DEFAULT_MAX_RETRIES);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: buildExtractionMessages(input, attempt),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        await sleep(retryDelayMs("", attempt));
        continue;
      }
      throw error;
    }
    clearTimeout(timeout);

    const responseText = await response.text();
    if (response.status === 429 && attempt < maxRetries) {
      await sleep(retryDelayMs(responseText, attempt));
      continue;
    }

    if (isJsonValidationFailure(response.status, responseText) && attempt < maxRetries) {
      await sleep(500);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Groq extraction failed (${response.status}): ${responseText}`);
    }

    const payload = JSON.parse(responseText);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Groq extraction response did not include message content");
    }

    try {
      return extractJsonFromText(content);
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(500);
        continue;
      }
      throw error;
    }
  }

  throw new Error("Groq extraction failed after retries");
}

function buildExtractionMessages(input: Record<string, unknown>, attempt: number) {
  const retryGuard = attempt > 0
    ? [
      "",
      "Retry guard:",
      "- Return syntactically valid JSON only.",
      "- Do not include markdown, comments, or trailing text.",
      "- tomorrow_todos must be an array of strings, never todo objects.",
      "- Use double quotes for every JSON string and close every string.",
    ].join("\n")
    : "";

  return [
    {
      role: "system",
      content: `${input.prompt}${retryGuard}`,
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          id: input.id,
          metadata: input.metadata ?? {},
          transcript: input.transcript,
        },
        null,
        2,
      ),
    },
  ];
}

async function storeAudio(
  { id, bytes, mimeType, ownerId }: { id: string; bytes: Uint8Array | null; mimeType: string; ownerId: string },
) {
  if (!bytes || bytes.byteLength === 0) return null;

  const extension = extensionForMime(mimeType);
  const objectPath = `${storagePathSegment(ownerId)}/${id}.${extension}`;
  await storageRequest(`/object/${audioBucket()}/${objectPath}`, {
    method: "POST",
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: bytes,
  });

  return {
    stored: true,
    storage: "supabase",
    bucket: audioBucket(),
    object_path: objectPath,
    mime_type: mimeType,
    bytes: bytes.byteLength,
  };
}

async function persistRecording(recording: any) {
  await upsert("throughline_recordings", {
    id: recording.id,
    user_id: recording.user_id || userId(),
    auth_user_id: recording.auth_user_id ?? null,
    created_at: recording.created_at,
    user_local_time: recording.user_local_time,
    timezone: recording.timezone,
    duration_seconds: recording.duration_seconds,
    type: recording.type,
    status: recording.status,
    processing_status: recording.processing_status,
    transcript_raw: recording.transcript_raw,
    structured_note: recording.structured_note ?? null,
    audio: recording.audio ?? null,
    recording,
  });
}

async function persistFeedback(feedback: any) {
  await upsert("throughline_feedback", {
    id: feedback.id,
    recording_id: feedback.recording_id,
    user_id: feedback.user_id || userId(),
    auth_user_id: feedback.auth_user_id ?? null,
    created_at: feedback.created_at,
    status: feedback.status,
    answers: feedback.answers,
    expected: feedback.expected,
    recording_snapshot: feedback.recording_snapshot,
    feedback,
  });
}

async function readRecording(id: string, context?: RequestContext) {
  const rows = await restRequest(
    [
      "/throughline_recordings?select=recording",
      `&id=eq.${encodeURIComponent(id)}`,
      recordingScopeQuery(context),
      "&limit=1",
    ].join(""),
  );
  if (!Array.isArray(rows) || !rows.length) {
    throw new HttpError(404, "Recording not found");
  }

  return rows[0].recording;
}

async function deleteRecording(id: string, context: RequestContext) {
  const recording = await readRecording(id, context);

  if (recording.audio?.storage === "supabase" && recording.audio?.object_path) {
    try {
      await storageRequest(
        `/object/${audioBucket()}/${recording.audio.object_path}`,
        { method: "DELETE" },
      );
    } catch (error) {
      if (!String(error instanceof Error ? error.message : error).includes("(404)")) {
        throw error;
      }
    }
  }

  await restRequest(
    [
      "/throughline_recordings",
      `?id=eq.${encodeURIComponent(id)}`,
      recordingScopeQuery(context),
    ].join(""),
    { method: "DELETE" },
  );
}

async function readFeedback(context: RequestContext, id: string) {
  const rows = await restRequest(
    [
      "/throughline_feedback?select=feedback",
      `&id=eq.${encodeURIComponent(id)}`,
      feedbackScopeQuery(context),
      "&limit=1",
    ].join(""),
  );
  if (!Array.isArray(rows) || !rows.length) {
    throw new HttpError(404, "Feedback not found");
  }

  return rows[0].feedback;
}

async function listFullRecordings(context?: RequestContext) {
  const rows = await restRequest(
    [
      "/throughline_recordings?select=recording",
      recordingScopeQuery(context),
      "&order=created_at.desc",
      "&limit=1000",
    ].join(""),
  );
  return Array.isArray(rows) ? rows.map((row) => row.recording) : [];
}

async function listRecordings(context?: RequestContext) {
  const rows = await restRequest(
    [
      "/throughline_recordings",
      "?select=id,created_at,user_local_time,duration_seconds,type,processing_status,transcript_raw,structured_note,audio",
      recordingScopeQuery(context),
      "&order=created_at.desc",
      "&limit=1000",
    ].join(""),
  );

  if (!Array.isArray(rows)) return [];
  return rows.map((recording) => ({
    id: recording.id,
    created_at: recording.created_at,
    user_local_time: recording.user_local_time,
    duration_seconds: recording.duration_seconds,
    type: recording.type,
    processing_status: recording.processing_status,
    has_audio: Boolean(recording.audio?.stored),
    has_transcript: Boolean(recording.transcript_raw),
    has_note: Boolean(recording.structured_note),
  }));
}

async function listFeedback(context: RequestContext) {
  const rows = await restRequest(
    [
      "/throughline_feedback?select=feedback",
      feedbackScopeQuery(context),
      "&order=created_at.desc",
      "&limit=1000",
    ].join(""),
  );
  return Array.isArray(rows) ? rows.map((row) => feedbackSummary(row.feedback)) : [];
}

async function listMcpTokens(context: RequestContext) {
  const authUserId = requireAuthUser(context);
  const rows = await restRequest(
    [
      "/throughline_mcp_tokens",
      "?select=id,name,created_at,last_used_at,revoked_at",
      `&user_id=eq.${encodeURIComponent(authUserId)}`,
      "&order=created_at.desc",
      "&limit=100",
    ].join(""),
  );

  return { tokens: Array.isArray(rows) ? rows : [], count: Array.isArray(rows) ? rows.length : 0 };
}

async function createMcpToken(context: RequestContext, body: Record<string, unknown>) {
  const authUserId = requireAuthUser(context);
  const token = `tlmcp_${randomHex(32)}`;
  const tokenHash = await sha256Hex(token);
  const name = nullableString(body.name) || "agent token";

  const row = await insert("throughline_mcp_tokens", {
    user_id: authUserId,
    name,
    token_hash: tokenHash,
  });

  return {
    id: row?.id ?? null,
    name,
    token,
    created_at: row?.created_at ?? null,
  };
}

async function revokeMcpToken(context: RequestContext, id: string) {
  const authUserId = requireAuthUser(context);
  await restRequest(
    [
      "/throughline_mcp_tokens",
      `?id=eq.${encodeURIComponent(id)}`,
      `&user_id=eq.${encodeURIComponent(authUserId)}`,
    ].join(""),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
    },
  );
}

async function deleteRows(table: string, query: string) {
  await restRequest(`/${table}?${query}`, { method: "DELETE" });
}

async function deleteAuthUser(authUserId: string) {
  await authAdminRequest(`/admin/users/${encodeURIComponent(authUserId)}`, {
    method: "DELETE",
  });
}

async function upsert(table: string, payload: Record<string, unknown>) {
  const rows = await restRequest(`/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([payload]),
  });

  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function insert(table: string, payload: Record<string, unknown>) {
  const rows = await restRequest(`/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([payload]),
  });

  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function restRequest(pathname: string, options: RequestInit = {}) {
  return supabaseRequest(`/rest/v1${pathname}`, options);
}

async function storageRequest(pathname: string, options: RequestInit = {}) {
  return supabaseRequest(`/storage/v1${pathname}`, options);
}

async function authAdminRequest(pathname: string, options: RequestInit = {}) {
  return supabaseRequest(`/auth/v1${pathname}`, options);
}

async function supabaseRequest(pathname: string, options: RequestInit = {}) {
  const url = supabaseUrl();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${responseText}`);
  }

  if (!responseText.trim()) return null;
  return JSON.parse(responseText);
}

function feedbackSummary(feedback: any) {
  return {
    id: feedback.id,
    recording_id: feedback.recording_id,
    created_at: feedback.created_at,
    status: feedback.status,
    agent_ready: feedback.answers?.agent_ready ?? null,
    should_remember: feedback.answers?.should_remember ?? null,
  };
}

function normalizeExtraction(raw: any, metadata: Record<string, unknown> = {}) {
  const actual: any = {};

  for (const field of OUTPUT_FIELDS) {
    if (field === "type") {
      actual.type = VALID_TYPES.has(raw?.type) ? raw.type : "freeform";
    } else if (field === "title") {
      actual.title = stringOrEmpty(raw?.title).slice(0, 80);
    } else if (field === "summary") {
      actual.summary = stringOrEmpty(raw?.summary);
    } else if (field === "todos") {
      actual.todos = Array.isArray(raw?.todos)
        ? raw.todos.map((todo: any) => normalizeTodo(todo, metadata)).filter((todo: any) => todo.text)
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

function extractJsonFromText(text: string) {
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

function metadataForRecording(recording: any) {
  return {
    user_local_date: userLocalDateFromTime(recording.user_local_time)
      || new Date(recording.created_at).toISOString().slice(0, 10),
    scenario: recording.type || "freeform",
    recording_context: recording.upload_source || "unknown",
  };
}

function postprocessExtraction(actual: any, metadata: Record<string, unknown>) {
  deriveTomorrowTodos(actual, metadata);
  return actual;
}

function normalizeTodo(todo: any, metadata: Record<string, unknown> = {}) {
  return {
    text: stringOrEmpty(todo?.text),
    status: "open",
    priority: normalizeEnum(todo?.priority, VALID_PRIORITIES),
    due: normalizeDateValue(todo?.due, metadata),
    for_date: normalizeDateValue(todo?.for_date, metadata),
    context: nullableString(todo?.context),
  };
}

function normalizeDateValue(value: unknown, metadata: Record<string, unknown>) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower === "today") return typeof metadata.user_local_date === "string" ? metadata.user_local_date : null;
  if (lower === "tomorrow" || lower === "next day") return nextIsoDate(metadata.user_local_date);

  return nextWeekdayIsoDate(metadata.user_local_date, lower);
}

function nextWeekdayIsoDate(baseIsoDate: unknown, weekdayName: string) {
  const weekdayIndexes: Record<string, number> = {
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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function normalizeCenters(value: unknown) {
  return normalizeStringArray(value).filter((item) => VALID_CENTERS.has(item));
}

function deriveTomorrowTodos(actual: any, metadata: Record<string, unknown>) {
  const tomorrowDate = nextIsoDate(metadata.user_local_date);
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

async function requestContext(req: Request): Promise<RequestContext | null> {
  if (hasServiceApiToken(req)) {
    return {
      kind: "service",
      legacyUserId: userId(),
      authUserId: null,
    };
  }

  const token = bearerToken(req);
  if (!token) return null;

  const user = await authUserForToken(token);
  if (!user?.id) return null;

  return {
    kind: "user",
    legacyUserId: user.id,
    authUserId: user.id,
  };
}

function hasServiceApiToken(req: Request) {
  const expectedTokens = apiTokens();
  if (!expectedTokens.length) return true;

  const headerToken = req.headers.get("x-throughline-api-key") || "";
  return [bearerToken(req), headerToken].some((candidate) =>
    expectedTokens.some((expected) => safeTokenEqual(candidate, expected))
  );
}

function bearerToken(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
}

async function authUserForToken(token: string) {
  const apikey = supabaseClientApiKey();
  if (!apikey) return null;

  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;

  const payload = await response.json();
  return typeof payload?.id === "string" ? payload : null;
}

function requireAuthUser(context: RequestContext) {
  if (!context.authUserId) {
    throw new HttpError(403, "A signed-in user is required");
  }

  return context.authUserId;
}

function recordingScopeQuery(context?: RequestContext) {
  return context?.authUserId ? `&auth_user_id=eq.${encodeURIComponent(context.authUserId)}` : "";
}

function feedbackScopeQuery(context?: RequestContext) {
  return context?.authUserId ? `&auth_user_id=eq.${encodeURIComponent(context.authUserId)}` : "";
}

function processingMode(req: Request) {
  const value = req.headers.get("x-throughline-processing-mode")?.toLowerCase().trim();
  return value === "async" ? "async" : "sync";
}

function safeTokenEqual(candidate: string, expected: string) {
  if (!candidate || !expected) return false;

  const encoder = new TextEncoder();
  const left = encoder.encode(candidate);
  const right = encoder.encode(expected);
  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return diff === 0;
}

async function parseJsonRequest(req: Request) {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function parseJsonBytes(bytes: Uint8Array) {
  if (bytes.byteLength === 0) return {};
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

function createRecordingId() {
  return `rec_${Date.now().toString(36)}_${randomHex(6)}`;
}

function createDemoRecordingId() {
  return `demo_${Date.now().toString(36)}_${randomHex(6)}`;
}

function createFeedbackId() {
  return `fb_${Date.now().toString(36)}_${randomHex(6)}`;
}

function randomHex(byteCount: number) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeFunctionPath(pathname: string, functionName: string) {
  const functionPrefix = `/${functionName}`;
  const localPrefix = `/functions/v1/${functionName}`;

  if (pathname === functionPrefix || pathname === localPrefix) return "/";
  if (pathname.startsWith(`${functionPrefix}/`)) return pathname.slice(functionPrefix.length) || "/";
  if (pathname.startsWith(`${localPrefix}/`)) return pathname.slice(localPrefix.length) || "/";
  return pathname || "/";
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": [
      "Authorization",
      "Content-Type",
      "X-Throughline-Api-Key",
      "X-Throughline-Duration-Seconds",
      "X-Throughline-User-Local-Time",
      "X-Throughline-Timezone",
      "X-Throughline-Recording-Type",
      "X-Throughline-Processing-Mode",
      "apikey",
    ].join(", "),
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeType(value: unknown) {
  return typeof value === "string" && RECORDING_TYPES.has(value) ? value : null;
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeEnum(value: unknown, allowed: Set<string>) {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

function userLocalDateFromTime(userLocalTime: unknown) {
  if (typeof userLocalTime !== "string") return null;

  const match = userLocalTime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function nextIsoDate(isoDate: unknown) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeForComparison(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extensionForMime(mimeType: unknown) {
  const cleanMime = String(mimeType ?? "").split(";")[0].trim().toLowerCase();
  if (cleanMime.includes("webm")) return "webm";
  if (cleanMime.includes("wav")) return "wav";
  if (cleanMime.includes("mpeg") || cleanMime.includes("mp3")) return "mp3";
  if (cleanMime.includes("mp4") || cleanMime.includes("m4a") || cleanMime.includes("aac")) return "m4a";
  return "bin";
}

function isJsonValidationFailure(status: number, responseText: string) {
  if (status !== 400) return false;

  try {
    const payload = JSON.parse(responseText);
    return payload?.error?.code === "json_validate_failed";
  } catch {
    return /json_validate_failed/i.test(responseText);
  }
}

function retryDelayMs(responseText: string, attempt: number) {
  const match = responseText.match(/try again in ([0-9.]+)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000) + 1000;
  }

  return Math.min(15_000, 2000 * 2 ** attempt);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function apiTokens() {
  const tokens = [
    Deno.env.get("THROUGHLINE_API_TOKEN") || "",
    ...splitTokenList(Deno.env.get("THROUGHLINE_API_TOKENS") || ""),
  ].map((token) => token.trim()).filter(Boolean);

  return [...new Set(tokens)];
}

function splitTokenList(value: string) {
  return value.split(/[,\n]/).map((token) => token.trim()).filter(Boolean);
}

function userId() {
  return Deno.env.get("THROUGHLINE_USER_ID") || DEFAULT_USER_ID;
}

function storagePathSegment(value: string) {
  return String(value || userId()).replace(/[^A-Za-z0-9._-]/g, "_");
}

function audioBucket() {
  return Deno.env.get("THROUGHLINE_AUDIO_BUCKET") || Deno.env.get("SUPABASE_AUDIO_BUCKET") || DEFAULT_AUDIO_BUCKET;
}

function supabaseClientApiKey() {
  return Deno.env.get("SUPABASE_ANON_KEY")
    || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
}

function supabaseUrl() {
  return trimTrailingSlash(Deno.env.get("SUPABASE_URL") || "");
}

function trimTrailingSlash(value: string) {
  return String(value ?? "").replace(/\/+$/, "");
}
