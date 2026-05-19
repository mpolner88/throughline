#!/usr/bin/env node

import crypto from "node:crypto";
import http from "node:http";
import process from "node:process";
import { URL } from "node:url";
import { extractRecordingNote } from "./extraction-service.mjs";
import { listMemoryTools, runMemoryTool } from "./memory-tools.mjs";
import { createStorage } from "./storage/index.mjs";
import { transcribeRecordingAudio } from "./transcription-service.mjs";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 5180);
const MAX_BODY_BYTES = Number(process.env.THROUGHLINE_STUB_MAX_BODY_BYTES || 60 * 1024 * 1024);
const EXTRACTION_PROMPT_PATH = process.env.THROUGHLINE_EXTRACTION_PROMPT
  || "evals/prompts/extract-note-v0.md";
const EXTRACTOR_COMMAND = process.env.THROUGHLINE_EXTRACTOR_COMMAND || null;
const TRANSCRIBER_PROVIDER = process.env.THROUGHLINE_TRANSCRIBER || null;
const STORAGE = createStorage();
const API_TOKEN = process.env.THROUGHLINE_API_TOKEN || null;

const RECORDING_TYPES = new Set(["morning", "evening", "weekly_review", "freeform"]);

function createId() {
  const timestamp = Date.now().toString(36);
  const suffix = crypto.randomBytes(6).toString("hex");
  return `rec_${timestamp}_${suffix}`;
}

async function ensureStorage() {
  await STORAGE.ensure();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Throughline-Api-Key, X-Throughline-Duration-Seconds, X-Throughline-User-Local-Time, X-Throughline-Timezone, X-Throughline-Recording-Type, X-Throughline-Processing-Mode",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function isAuthorized(req) {
  if (!API_TOKEN) return true;

  const authorization = req.headers.authorization || "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
  const headerToken = req.headers["x-throughline-api-key"] || "";
  return safeTokenEqual(bearerToken, API_TOKEN) || safeTokenEqual(headerToken, API_TOKEN);
}

function safeTokenEqual(candidate, expected) {
  if (!candidate || !expected) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

async function readBody(req) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function parseJsonBody(buffer) {
  if (buffer.length === 0) return {};
  return JSON.parse(buffer.toString("utf8"));
}

function nullableString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeType(value) {
  return RECORDING_TYPES.has(value) ? value : null;
}

function processingMode(req) {
  const value = String(req.headers["x-throughline-processing-mode"] || "").toLowerCase().trim();
  return value === "async" ? "async" : "sync";
}

async function storeAudio({ id, bytes, mimeType }) {
  return STORAGE.storeAudio({ id, bytes, mimeType });
}

async function persistRecording(recording) {
  await STORAGE.persistRecording(recording);
}

async function persistFeedback(feedback) {
  await STORAGE.persistFeedback(feedback);
}

async function readRecording(id) {
  return STORAGE.readRecording(id);
}

async function deleteRecording(id) {
  return STORAGE.deleteRecording(id);
}

async function readFeedback(id) {
  return STORAGE.readFeedback(id);
}

async function listRecordings() {
  return STORAGE.listRecordings();
}

async function listFeedback() {
  return STORAGE.listFeedback();
}

async function createRecordingFromJson(body) {
  const id = createId();
  const audioBytes = body.audio_base64 ? Buffer.from(body.audio_base64, "base64") : null;
  const audioMimeType = nullableString(body.audio_mime_type) || "application/octet-stream";
  const audio = await storeAudio({ id, bytes: audioBytes, mimeType: audioMimeType });

  return {
    id,
    user_id: "dev-user",
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
  };
}

async function createRecordingFromRaw(req, bodyBuffer) {
  const id = createId();
  const contentType = req.headers["content-type"] || "application/octet-stream";
  const audio = await storeAudio({ id, bytes: bodyBuffer, mimeType: contentType });

  return {
    id,
    user_id: "dev-user",
    created_at: new Date().toISOString(),
    user_local_time: nullableString(req.headers["x-throughline-user-local-time"]),
    timezone: nullableString(req.headers["x-throughline-timezone"]),
    duration_seconds: nullableNumber(req.headers["x-throughline-duration-seconds"]),
    type: normalizeType(req.headers["x-throughline-recording-type"]),
    transcript_raw: null,
    upload_source: "raw",
    audio,
    status: "uploaded",
    processing_status: "uploaded",
  };
}

async function processRecording(recording) {
  if (!recording.transcript_raw) {
    const transcription = await transcribeRecordingAudio(recording, {
      provider: TRANSCRIBER_PROVIDER,
    });

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

  const result = await extractRecordingNote(recording, {
    command: EXTRACTOR_COMMAND,
    promptPath: EXTRACTION_PROMPT_PATH,
  });

  recording.processing_status = result.status;
  recording.extraction = {
    status: result.status,
    provider: EXTRACTOR_COMMAND ? "command" : null,
    prompt_path: EXTRACTION_PROMPT_PATH,
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

async function processAndPersistRecording(recording) {
  try {
    await processRecording(recording);
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

async function handlePostRecording(req, res) {
  const bodyBuffer = await readBody(req);
  const contentType = req.headers["content-type"] || "";

  const recording = contentType.includes("application/json")
    ? await createRecordingFromJson(parseJsonBody(bodyBuffer))
    : await createRecordingFromRaw(req, bodyBuffer);

  await persistRecording(recording);

  if (processingMode(req) === "async") {
    void processAndPersistRecording(recording);
    sendJson(res, 202, {
      id: recording.id,
      status: recording.status,
      processing_status: recording.processing_status,
      has_note: Boolean(recording.structured_note),
      recording_url: `/recordings/${recording.id}`,
      recording,
    });
    return;
  }

  await processAndPersistRecording(recording);

  sendJson(res, 201, {
    id: recording.id,
    status: recording.status,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording_url: `/recordings/${recording.id}`,
    recording,
  });
}

async function handleExtractRecording(req, res, id) {
  let recording;
  try {
    recording = await readRecording(id);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendError(res, 404, "Recording not found");
      return;
    }
    throw error;
  }

  const body = parseJsonBody(await readBody(req));
  recording.transcript_raw = nullableString(body.transcript_raw) ?? recording.transcript_raw;
  recording.user_local_time = nullableString(body.user_local_time) ?? recording.user_local_time;
  recording.timezone = nullableString(body.timezone) ?? recording.timezone;
  recording.duration_seconds = nullableNumber(body.duration_seconds) ?? recording.duration_seconds;
  recording.type = normalizeType(body.type) ?? recording.type;

  await processRecording(recording);
  await persistRecording(recording);

  sendJson(res, 200, {
    id: recording.id,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording,
  });
}

async function handlePostFeedback(req, res, recordingId) {
  let recording;
  try {
    recording = await readRecording(recordingId);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendError(res, 404, "Recording not found");
      return;
    }
    throw error;
  }

  const body = parseJsonBody(await readBody(req));
  const feedback = {
    id: createFeedbackId(),
    recording_id: recording.id,
    user_id: recording.user_id,
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

  sendJson(res, 201, {
    id: feedback.id,
    recording_id: recording.id,
    status: feedback.status,
    feedback_url: `/feedback/${feedback.id}`,
  });
}

async function handlePatchRecording(req, res, recordingId) {
  let recording;
  try {
    recording = await readRecording(recordingId);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendError(res, 404, "Recording not found");
      return;
    }
    throw error;
  }

  try {
    applyRecordingEdits(recording, parseJsonBody(await readBody(req)));
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Invalid recording edit");
    return;
  }

  await persistRecording(recording);
  sendJson(res, 200, { recording });
}

async function handleMemoryTool(req, res, toolName) {
  const input = parseJsonBody(await readBody(req));
  try {
    const output = await runMemoryTool(toolName, input, {
      recordings: await STORAGE.listFullRecordings(),
    });
    sendJson(res, 200, { tool: toolName, output });
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Memory tool failed");
  }
}

function createFeedbackId() {
  const timestamp = Date.now().toString(36);
  const suffix = crypto.randomBytes(6).toString("hex");
  return `fb_${timestamp}_${suffix}`;
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function applyRecordingEdits(recording, body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Recording edit body must be an object");
  }

  recording.structured_note = recording.structured_note || emptyStructuredNote(recording);
  const note = recording.structured_note;

  if (Object.hasOwn(body, "transcript") || Object.hasOwn(body, "transcript_raw")) {
    recording.transcript_raw = editString(body.transcript ?? body.transcript_raw, "Transcript");
  }

  if (Object.hasOwn(body, "title")) {
    const title = editString(body.title, "Title").slice(0, 80);
    if (!title) throw new Error("Title cannot be empty");
    note.title = title;
  }

  if (Object.hasOwn(body, "summary")) {
    note.summary = editString(body.summary, "Summary");
  }

  if (Object.hasOwn(body, "type")) {
    const type = normalizeType(body.type);
    if (!type) throw new Error("Recording type is invalid");
    recording.type = type;
    note.type = type;
  }

  const shouldRefreshActionItems = Object.hasOwn(body, "most_important") || Object.hasOwn(body, "todos");

  if (Object.hasOwn(body, "most_important")) {
    note.most_important = normalizeEditedStrings(body.most_important, "Most important").slice(0, 5);
  }

  if (Object.hasOwn(body, "todos")) {
    note.todos = normalizeEditedTodos(body.todos, note.todos ?? []);
  }

  if (Object.hasOwn(body, "tomorrow_todos")) {
    note.tomorrow_todos = normalizeEditedStrings(body.tomorrow_todos, "Tomorrow todos");
  } else if (Object.hasOwn(body, "todos")) {
    note.tomorrow_todos = [];
  }

  if (shouldRefreshActionItems) {
    refreshActionItems(note);
  }

  const editedAt = new Date().toISOString();
  note.edited_at = editedAt;
  recording.edited_at = editedAt;
  recording.processing_status = recording.structured_note ? "processed" : recording.processing_status;
}

function emptyStructuredNote(recording) {
  return {
    type: recording.type || "freeform",
    title: "voice note",
    summary: "",
    most_important: [],
    action_items: [],
    todos: [],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: null,
    people: [],
    projects: [],
    tags: [],
    centers_of_balance: [],
  };
}

function editString(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value.trim();
}

function normalizeEditedStrings(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  const values = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    const key = normalizeForComparison(text);
    if (!text || !key || seen.has(key)) continue;
    values.push(text.slice(0, 180));
    seen.add(key);
  }
  return values;
}

function normalizeEditedTodos(value, previousTodos) {
  if (!Array.isArray(value)) {
    throw new Error("Todos must be an array");
  }

  const previousByText = new Map((previousTodos ?? []).map((todo) => [normalizeForComparison(todo.text), todo]));
  const todos = [];
  const seen = new Set();

  for (const item of value) {
    const text = typeof item === "string" ? item.trim() : nullableString(item?.text);
    const key = normalizeForComparison(text);
    if (!text || !key || seen.has(key)) continue;

    const previous = previousByText.get(key);
    const status = normalizeCompletionStatus(item?.status ?? previous?.status);
    todos.push({
      text,
      status,
      priority: normalizeTodoPriority(item?.priority ?? previous?.priority),
      due: nullableString(item?.due ?? previous?.due),
      for_date: nullableString(item?.for_date ?? previous?.for_date),
      context: nullableString(item?.context ?? previous?.context) || "manual_edit",
      completed_at: status === "completed" ? nullableString(item?.completed_at ?? previous?.completed_at) : null,
    });
    seen.add(key);
  }

  return todos;
}

function refreshActionItems(note) {
  const previousByText = new Map((note.action_items ?? []).map((item) => [normalizeForComparison(item.text), item]));
  const items = [];

  for (const todo of note.todos ?? []) {
    addActionItem(items, todo.text, "todo", todo.status, todo.completed_at, previousByText);
  }

  for (const text of note.most_important ?? []) {
    addActionItem(items, text, "most_important", null, null, previousByText);
  }

  note.action_items = items;
}

function addActionItem(items, candidate, source, status = null, completedAt = null, previousByText = new Map()) {
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
  });
}

function normalizeCompletionStatus(value) {
  return value === "completed" || value === "done" ? "completed" : "open";
}

function normalizeTodoPriority(value) {
  return ["high", "medium", "low"].includes(value) ? value : null;
}

function normalizeForComparison(text) {
  return String(text ?? "").trim().toLowerCase();
}

function stableActionItemId(text) {
  const normalized = normalizeForComparison(text)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `act_${normalized.slice(0, 80) || crypto.randomBytes(4).toString("hex")}`;
}

async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "throughline-backend-stub",
      storage: STORAGE.name,
      auth_required: Boolean(API_TOKEN),
      authenticated: isAuthorized(req),
    });
    return;
  }

  if (!isAuthorized(req)) {
    sendError(res, 401, "Unauthorized");
    return;
  }

  if (req.method === "GET" && pathname === "/agent/tools") {
    sendJson(res, 200, { tools: listMemoryTools() });
    return;
  }

  const memoryToolMatch = pathname.match(/^\/agent\/tools\/([^/]+)$/);
  if (req.method === "POST" && memoryToolMatch) {
    await handleMemoryTool(req, res, memoryToolMatch[1]);
    return;
  }

  if (req.method === "POST" && pathname === "/recordings") {
    await handlePostRecording(req, res);
    return;
  }

  const extractionMatch = pathname.match(/^\/recordings\/([^/]+)\/extract$/);
  if (req.method === "POST" && extractionMatch) {
    await handleExtractRecording(req, res, extractionMatch[1]);
    return;
  }

  const feedbackForRecordingMatch = pathname.match(/^\/recordings\/([^/]+)\/feedback$/);
  if (req.method === "POST" && feedbackForRecordingMatch) {
    await handlePostFeedback(req, res, feedbackForRecordingMatch[1]);
    return;
  }

  const patchRecordingMatch = pathname.match(/^\/recordings\/([^/]+)$/);
  if (req.method === "PATCH" && patchRecordingMatch) {
    await handlePatchRecording(req, res, patchRecordingMatch[1]);
    return;
  }

  if (req.method === "GET" && pathname === "/recordings") {
    const recordings = await listRecordings();
    sendJson(res, 200, { recordings, count: recordings.length });
    return;
  }

  if (req.method === "GET" && pathname === "/feedback") {
    const feedback = await listFeedback();
    sendJson(res, 200, { feedback, count: feedback.length });
    return;
  }

  const feedbackMatch = pathname.match(/^\/feedback\/([^/]+)$/);
  if (req.method === "GET" && feedbackMatch) {
    try {
      sendJson(res, 200, { feedback: await readFeedback(feedbackMatch[1]) });
    } catch (error) {
      if (error?.code === "ENOENT") {
        sendError(res, 404, "Feedback not found");
        return;
      }
      throw error;
    }
    return;
  }

  const recordingMatch = pathname.match(/^\/recordings\/([^/]+)$/);
  if (req.method === "DELETE" && recordingMatch) {
    try {
      await deleteRecording(recordingMatch[1]);
      sendJson(res, 200, { id: recordingMatch[1], deleted: true });
    } catch (error) {
      if (error?.code === "ENOENT") {
        sendError(res, 404, "Recording not found");
        return;
      }
      throw error;
    }
    return;
  }

  if (req.method === "GET" && recordingMatch) {
    try {
      sendJson(res, 200, { recording: await readRecording(recordingMatch[1]) });
    } catch (error) {
      if (error?.code === "ENOENT") {
        sendError(res, 404, "Recording not found");
        return;
      }
      throw error;
    }
    return;
  }

  sendError(res, 404, "Not found");
}

await ensureStorage();

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    sendError(res, 500, error instanceof Error ? error.message : "Unknown server error");
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Throughline backend stub listening at http://${HOST}:${PORT}`);
});
