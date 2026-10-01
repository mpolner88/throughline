import "@supabase/functions-js/edge-runtime.d.ts";
import {
  encodeTaskPage,
  parseTaskPage,
  TaskContractError,
  taskResult,
  validateTaskEdit,
  validateTaskMutation,
} from "./tasks.ts";
import {
  captureAnswer,
  captureUpload,
  isMissingStorageObject,
  validCaptureUUID,
} from "./capture.ts";

import {
  normalizeExtraction as normalizeContractExtraction,
  resolveInferenceContract,
} from "../../../core/inference-contract.mjs";

import { listMemoryTools, runMemoryTool } from "../_shared/memory-tools.ts";
import {
  type ProcessingCommitV1,
  runRecordingOperation,
} from "../_shared/processing-lineage.ts";
import type { ProviderAttemptOutcome } from "../_shared/inference-provider.ts";
import {
  buildAgentReadinessPreview,
  normalizeEvaluationRequest,
  PRIVATE_EVALUATION_DISCLOSURE_VERSION,
  PRIVATE_EVALUATION_NOTICE_VERSION,
  PRIVATE_EVALUATION_POLICY_VERSION,
  validateAgentReadinessBinding,
} from "../_shared/evaluation-contract.ts";
import { buildUserMutationCommit } from "../_shared/note-revisions.ts";
import {
  purgeCorpusCaseArtifacts,
  removeEvaluationContribution,
  selectRetentionAction,
} from "../_shared/evaluation-retention.ts";
import {
  assertStableCompatibilityAllowed,
  resolveEvaluationFlags,
} from "../_shared/evaluation-flags.ts";
import {
  captureProductEventsInPostHog,
  deleteProductAnalyticsUserFromPostHog,
  hasPostHogCaptureConfig,
  hasPostHogDeletionConfig,
  type PostHogCaptureConfig,
  type PostHogDeletionConfig,
  type ProductEventRow,
} from "../_shared/posthog.ts";
import {
  normalizeProductEventAppVersion,
  normalizeProductEventBuildNumber,
  normalizeProductEventContract,
  PRODUCT_EVENT_NAMES,
  ProductEventContractError,
} from "../_shared/product-event-contract.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const FUNCTION_NAME = "api";
const DEFAULT_AUDIO_BUCKET = "throughline-audio";
const DEFAULT_USER_ID = "dev-user";
const MAX_BODY_BYTES = Number(
  Deno.env.get("THROUGHLINE_MAX_BODY_BYTES") || 60 * 1024 * 1024,
);
const DEMO_MAX_BODY_BYTES = Number(
  Deno.env.get("THROUGHLINE_DEMO_MAX_BODY_BYTES") || 8 * 1024 * 1024,
);
const DEMO_MAX_DURATION_SECONDS = Number(
  Deno.env.get("THROUGHLINE_DEMO_MAX_DURATION_SECONDS") || 30,
);
const PRODUCT_EVENT_MAX_BODY_BYTES = 64 * 1024;
const PRODUCT_FEEDBACK_MAX_BODY_BYTES = 16 * 1024;
const AUDIO_RETENTION_DAYS = positiveNumberEnv(
  "THROUGHLINE_AUDIO_RETENTION_DAYS",
  30,
);
const AUDIO_RETENTION_BATCH_LIMIT = positiveNumberEnv(
  "THROUGHLINE_AUDIO_RETENTION_BATCH_LIMIT",
  500,
);
const AUDIO_RETENTION_CLAIM_TTL_SECONDS = positiveNumberEnv(
  "THROUGHLINE_EVALUATION_RETENTION_CLAIM_TTL_SECONDS",
  300,
);
const EVALUATION_ARTIFACT_STALE_SECONDS = positiveNumberEnv(
  "THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS",
  3600,
);
const EVALUATION_ARTIFACT_RECONCILIATION_LIMIT = positiveNumberEnv(
  "THROUGHLINE_EVALUATION_ARTIFACT_RECONCILIATION_LIMIT",
  100,
);
const EVALUATION_ARTIFACT_CLAIM_TTL_SECONDS = positiveNumberEnv(
  "THROUGHLINE_EVALUATION_ARTIFACT_CLAIM_TTL_SECONDS",
  300,
);
const DEFAULT_POSTHOG_INGEST_HOST = "https://us.i.posthog.com";
const DEFAULT_POSTHOG_API_HOST = "https://us.posthog.com";

const INFERENCE_ENV_NAMES = [
  "GROQ_BASE_URL",
  "GROQ_MODEL",
  "GROQ_TRANSCRIPTION_MODEL",
  "GROQ_TIMEOUT_MS",
  "GROQ_MAX_RETRIES",
  "GROQ_TRANSCRIPTION_TIMEOUT_MS",
  "GROQ_TRANSCRIPTION_MAX_RETRIES",
] as const;

export function resolveCurrentInferenceContract() {
  return resolveInferenceContract(Object.fromEntries(
    INFERENCE_ENV_NAMES.map((name) => [name, Deno.env.get(name)]),
  ));
}

const RECORDING_TYPES = new Set([
  "morning",
  "evening",
  "weekly_review",
  "freeform",
]);
const PRODUCT_FEEDBACK_CATEGORIES = new Set([
  "general",
  "idea",
  "problem",
  "praise",
]);
const VALID_PRIORITIES = new Set(["high", "medium", "low"]);

class HttpError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestContext = {
  kind: "service" | "user";
  legacyUserId: string;
  authUserId: string | null;
};

if (import.meta.main) {
  Deno.serve(handleRequestResponse);
}

export function handleRequestResponse(req: Request) {
  return handleRequest(req).catch((error) => {
    const status =
      error instanceof HttpError || error instanceof TaskContractError
        ? error.status
        : 500;
    const message =
      error instanceof HttpError || error instanceof TaskContractError
        ? error.message
        : "Server request could not be completed";
    console.error(JSON.stringify({
      event: "api_request_failed",
      method: req.method,
      path: safeApiLogPath(new URL(req.url).pathname),
      status,
      error_type:
        error instanceof HttpError || error instanceof TaskContractError
          ? "http_error"
          : "unexpected_error",
    }));
    return jsonResponse(status, {
      error: message,
      ...((error instanceof HttpError || error instanceof TaskContractError) &&
          error.code
        ? { error_code: error.code }
        : {}),
    });
  });
}

function safeApiLogPath(pathname: string) {
  return pathname
    .replace(/\/recordings\/[^/]+/gu, "/recordings/:recording_id")
    .replace(/\/captures\/[^/]+/gu, "/captures/:capture_id")
    .replace(/\/tasks\/[^/]+/gu, "/tasks/:task_id")
    .replace(/\/feedback\/[^/]+/gu, "/feedback/:feedback_id")
    .replace(/\/agent\/tokens\/[^/]+/gu, "/agent/tokens/:token_id");
}

export async function handleRequest(req: Request) {
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
      transcription: Boolean(Deno.env.get("GROQ_API_KEY"))
        ? "groq"
        : "not_configured",
      product_analytics: hasPostHogCaptureConfig(postHogCaptureConfig())
        ? "posthog"
        : "first_party_only",
      analytics_deletion: hasPostHogDeletionConfig(postHogDeletionConfig())
        ? "configured"
        : "not_configured",
    });
  }

  if (req.method === "POST" && pathname === "/demo/recordings") {
    return handlePostDemoRecording(req);
  }

  if (req.method === "POST" && pathname === "/events") {
    return handlePostProductEvents(req, await requestContext(req));
  }

  if (req.method === "GET" && pathname === "/account/deletion-status") {
    const token = req.headers.get("x-throughline-deletion-token");
    if (!validCaptureUUID(token)) {
      return jsonResponse(400, { deletion_outcome: "unknown" });
    }
    try {
      const result = await captureRpc(
        "throughline_account_deletion_status_v1",
        { p_token_sha256: await sha256Hex(token.toLowerCase()) },
      );
      return jsonResponse(200, result);
    } catch {
      return jsonResponse(503, { deletion_outcome: "unknown" });
    }
  }

  const context = await requestContext(req);
  if (!context) {
    return jsonResponse(401, { error: "Unauthorized" });
  }
  await requireEvaluationCompatibilitySafety();

  if (req.method === "GET" && pathname === "/tasks") {
    if (lineageWritesEnabled() || evaluationWritesEnabled()) {
      throw new TaskContractError(
        409,
        "evaluation_task_conflict",
        "Task enrollment is unavailable for this processing mode.",
      );
    }
    return jsonResponse(
      200,
      encodeTaskPage(
        await ordinaryTaskRpc(
          requireAuthUser(context),
          "list",
          null,
          parseTaskPage(url),
        ),
      ),
    );
  }
  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  if (req.method === "PATCH" && taskMatch) {
    if (!validCaptureUUID(taskMatch[1])) {
      throw new TaskContractError(
        400,
        "invalid_task_request",
        "The task change is invalid.",
      );
    }
    const body = validateTaskMutation(await parseJsonRequest(req));
    return jsonResponse(
      200,
      await ordinaryTaskRpc(requireAuthUser(context), "mutation", null, {
        task_id: taskMatch[1],
        body,
      }),
    );
  }

  if (req.method === "POST" && pathname === "/maintenance/audio-retention") {
    requireServiceContext(context);
    return jsonResponse(200, await expireStoredAudio());
  }

  if (
    req.method === "POST" &&
    pathname === "/maintenance/evaluation-artifact-reconciliation"
  ) {
    requireServiceContext(context);
    return jsonResponse(200, await reconcileStaleEvaluationArtifacts());
  }

  if (req.method === "GET" && pathname === "/agent/tools") {
    return jsonResponse(200, { tools: listMemoryTools() });
  }

  const memoryToolMatch = pathname.match(/^\/agent\/tools\/([^/]+)$/);
  if (req.method === "POST" && memoryToolMatch) {
    const input = await parseJsonRequest(req);
    const output = runMemoryTool(
      decodeURIComponent(memoryToolMatch[1]),
      input,
      {
        recordings: await listFullRecordings(context),
      },
    );
    return jsonResponse(200, { tool: memoryToolMatch[1], output });
  }

  if (req.method === "GET" && pathname === "/agent/tokens") {
    return jsonResponse(200, await listMcpTokens(context));
  }

  if (req.method === "POST" && pathname === "/agent/tokens") {
    return jsonResponse(
      201,
      await createMcpToken(context, await parseJsonRequest(req)),
    );
  }

  const agentTokenMatch = pathname.match(/^\/agent\/tokens\/([^/]+)$/);
  if (req.method === "DELETE" && agentTokenMatch) {
    await revokeMcpToken(context, decodeURIComponent(agentTokenMatch[1]));
    return jsonResponse(200, {
      id: decodeURIComponent(agentTokenMatch[1]),
      revoked: true,
    });
  }

  if (req.method === "POST" && pathname === "/recordings") {
    return handlePostRecording(req, context);
  }

  const extractionMatch = pathname.match(/^\/recordings\/([^/]+)\/extract$/);
  if (req.method === "POST" && extractionMatch) {
    return handleExtractRecording(
      req,
      context,
      decodeURIComponent(extractionMatch[1]),
    );
  }

  const feedbackForRecordingMatch = pathname.match(
    /^\/recordings\/([^/]+)\/feedback$/,
  );
  if (req.method === "POST" && feedbackForRecordingMatch) {
    return handlePostFeedback(
      req,
      context,
      decodeURIComponent(feedbackForRecordingMatch[1]),
    );
  }

  const evaluationPreviewMatch = pathname.match(
    /^\/recordings\/([^/]+)\/evaluation-readiness-preview$/,
  );
  if (req.method === "GET" && evaluationPreviewMatch) {
    return handleGetEvaluationReadinessPreview(
      context,
      decodeURIComponent(evaluationPreviewMatch[1]),
      url.searchParams.get("revision_id"),
    );
  }

  const evaluationsMatch = pathname.match(
    /^\/recordings\/([^/]+)\/evaluations$/,
  );
  if (req.method === "POST" && evaluationsMatch) {
    return handlePostEvaluation(
      req,
      context,
      decodeURIComponent(evaluationsMatch[1]),
    );
  }

  const evaluationContributionMatch = pathname.match(
    /^\/recordings\/([^/]+)\/evaluation-contribution$/,
  );
  if (req.method === "DELETE" && evaluationContributionMatch) {
    return handleDeleteEvaluationContribution(
      req,
      context,
      decodeURIComponent(evaluationContributionMatch[1]),
    );
  }

  const actionItemsMatch = pathname.match(
    /^\/recordings\/([^/]+)\/action-items$/,
  );
  if (req.method === "PATCH" && actionItemsMatch) {
    return handlePatchActionItem(
      req,
      context,
      decodeURIComponent(actionItemsMatch[1]),
    );
  }

  const patchRecordingMatch = pathname.match(/^\/recordings\/([^/]+)$/);
  if (req.method === "PATCH" && patchRecordingMatch) {
    return handlePatchRecording(
      req,
      context,
      decodeURIComponent(patchRecordingMatch[1]),
    );
  }

  if (req.method === "GET" && pathname === "/recordings") {
    const recordings = await listRecordings(context);
    return jsonResponse(200, { recordings, count: recordings.length });
  }

  if (req.method === "GET" && pathname === "/feedback") {
    const feedback = await listFeedback(context);
    return jsonResponse(200, { feedback, count: feedback.length });
  }

  if (req.method === "POST" && pathname === "/product-feedback") {
    return handlePostProductFeedback(req, context);
  }

  if (req.method === "GET" && pathname === "/product-feedback") {
    requireServiceContext(context);
    const feedback = await listProductFeedback();
    return jsonResponse(200, { feedback, count: feedback.length });
  }

  if (req.method === "DELETE" && pathname === "/account") {
    return handleDeleteAccount(context, req);
  }

  const captureMatch = pathname.match(/^\/captures\/([^/]+)$/);
  if (req.method === "GET" && captureMatch) {
    const owner = requireAuthUser(context);
    const capture = captureMatch[1].toLowerCase();
    if (!validCaptureUUID(capture)) {
      return jsonResponse(400, { error_code: "capture_invalid_id" });
    }
    const result = captureAnswer(
      await captureRpc("throughline_capture_status_v1", {
        p_owner: owner,
        p_capture: capture,
      }),
    );
    return jsonResponse(result.status, result.body);
  }

  const feedbackMatch = pathname.match(/^\/feedback\/([^/]+)$/);
  if (req.method === "GET" && feedbackMatch) {
    return jsonResponse(200, {
      feedback: await readFeedback(
        context,
        decodeURIComponent(feedbackMatch[1]),
      ),
    });
  }

  const recordingMatch = pathname.match(/^\/recordings\/([^/]+)$/);
  if (req.method === "DELETE" && recordingMatch) {
    const id = decodeURIComponent(recordingMatch[1]);
    await deleteRecording(id, context);
    return jsonResponse(200, { id, deleted: true });
  }

  if (req.method === "GET" && recordingMatch) {
    const id = decodeURIComponent(recordingMatch[1]);
    if (context.authUserId) {
      return jsonResponse(
        200,
        await ordinaryTaskRpc(context.authUserId, "detail", id),
      );
    }
    return jsonResponse(200, {
      recording: await readRecording(id, context),
      current_revision_id: await readCurrentRevisionID(id, context),
    });
  }

  return jsonResponse(404, { error: "Not found" });
}

async function handlePostProductEvents(
  req: Request,
  context: RequestContext | null,
) {
  const body = await parseJsonRequest(req, PRODUCT_EVENT_MAX_BODY_BYTES);
  const candidates: unknown[] = Array.isArray(body.events)
    ? body.events
    : [body];
  if (!candidates.length || candidates.length > 50) {
    throw new HttpError(400, "Submit between 1 and 50 product events");
  }

  const normalizedEvents = candidates.map((candidate) => {
    if (
      !candidate || typeof candidate !== "object" || Array.isArray(candidate)
    ) {
      throw new HttpError(400, "Each product event must be an object");
    }

    const event = candidate as Record<string, unknown>;
    const id = normalizedIdentifier(event.id, "evt_", 128);
    const eventName = nullableString(event.event_name);
    const sessionId = normalizedUuid(event.session_id);
    const occurredAt = normalizedClientTimestamp(event.occurred_at);

    if (
      !id || !eventName ||
      !PRODUCT_EVENT_NAMES.includes(
        eventName as typeof PRODUCT_EVENT_NAMES[number],
      )
    ) {
      throw new HttpError(400, "Unknown or invalid product event");
    }

    if (!sessionId || !occurredAt) {
      throw new HttpError(
        400,
        "Product events require valid session and timestamp values",
      );
    }

    let contract;
    try {
      contract = normalizeProductEventContract(event);
    } catch (error) {
      if (error instanceof ProductEventContractError) {
        throw new HttpError(400, error.message);
      }
      throw error;
    }

    if (contract.recording_id) {
      if (!context?.authUserId) {
        throw new HttpError(
          403,
          "A signed-in user is required for a recording reference",
        );
      }
    }

    return {
      id,
      auth_user_id: context?.authUserId ?? null,
      session_id: sessionId,
      occurred_at: occurredAt,
      event_name: eventName,
      platform: "ios",
      app_version: normalizeProductEventAppVersion(event.app_version),
      build_number: normalizeProductEventBuildNumber(event.build_number),
      schema_version: contract.schema_version,
      distribution_channel: contract.distribution_channel,
      recording_id: contract.recording_id,
      properties: contract.properties,
    };
  });

  const isInternalUser = context?.authUserId
    ? await lookupInternalUser(context.authUserId)
    : null;
  const recordingIds = [
    ...new Set(
      normalizedEvents.flatMap((event) =>
        event.recording_id ? [event.recording_id] : []
      ),
    ),
  ];
  if (recordingIds.length) {
    if (!context?.authUserId) {
      throw new HttpError(
        403,
        "A signed-in user is required for a recording reference",
      );
    }
    await requireOwnedProductEventRecordings(recordingIds, context.authUserId);
  }
  const rows: ProductEventRow[] = normalizedEvents.map((event) => ({
    ...event,
    is_internal_user: isInternalUser,
  }));

  await insertManyIgnoringDuplicates("throughline_product_events", rows);
  EdgeRuntime.waitUntil(forwardProductEventsToPostHog(rows));
  return jsonResponse(202, { accepted: rows.length });
}

async function lookupInternalUser(authUserId: string) {
  try {
    const rows = await restRequest(
      `/throughline_internal_users?select=auth_user_id&auth_user_id=eq.${
        encodeURIComponent(authUserId)
      }&limit=1`,
    );
    if (!Array.isArray(rows)) {
      throw new Error("Unexpected allowlist lookup response");
    }
    return rows.length > 0;
  } catch {
    throw new HttpError(
      503,
      "Internal attribution lookup is temporarily unavailable",
    );
  }
}

async function requireOwnedProductEventRecordings(
  recordingIds: string[],
  authUserId: string,
) {
  let rows: unknown;
  try {
    const ids = recordingIds.map(encodeURIComponent).join(",");
    rows = await restRequest(
      `/throughline_recordings?select=id&id=in.(${ids})&auth_user_id=eq.${
        encodeURIComponent(authUserId)
      }`,
    );
  } catch {
    throw new HttpError(
      503,
      "Recording attribution lookup is temporarily unavailable",
    );
  }

  if (!Array.isArray(rows)) {
    throw new HttpError(
      503,
      "Recording attribution lookup is temporarily unavailable",
    );
  }
  const ownedIds = new Set(rows.map((row) => row?.id));
  if (recordingIds.some((recordingId) => !ownedIds.has(recordingId))) {
    throw new HttpError(
      403,
      "Recording reference is not owned by the authenticated account",
    );
  }
}

async function forwardProductEventsToPostHog(rows: ProductEventRow[]) {
  try {
    const result = await captureProductEventsInPostHog(
      rows,
      postHogCaptureConfig(),
    );
    if (result.configured) {
      console.log(`Forwarded ${result.sent} product event(s) to PostHog`);
    }
  } catch (error) {
    console.error(
      "PostHog product-event forwarding failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function handlePostProductFeedback(
  req: Request,
  context: RequestContext,
) {
  const authUserId = requireAuthUser(context);
  const body = await parseJsonRequest(req, PRODUCT_FEEDBACK_MAX_BODY_BYTES);
  const category = nullableString(body.category);
  const message = nullableString(body.message);

  if (!category || !PRODUCT_FEEDBACK_CATEGORIES.has(category)) {
    throw new HttpError(400, "Choose a valid feedback category");
  }

  if (!message || message.length > 4000) {
    throw new HttpError(400, "Feedback must be between 1 and 4000 characters");
  }

  const row = await insert("throughline_product_feedback", {
    id: createProductFeedbackId(),
    auth_user_id: authUserId,
    source: "ios",
    category,
    message,
    contact_allowed: nullableBoolean(body.contact_allowed) ?? false,
    status: "new",
    app_version: limitedString(body.app_version, 40),
    build_number: limitedString(body.build_number, 40),
    context: normalizedEventProperties(body.context),
  });

  return jsonResponse(201, {
    id: row?.id,
    status: row?.status ?? "new",
  });
}

async function handlePostRecording(req: Request, context: RequestContext) {
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, `Request body exceeds ${MAX_BODY_BYTES} bytes`);
  }

  if (req.headers.has("x-throughline-capture-id")) {
    const result = await captureUpload(req, bytes, context, {
      rpc: captureRpc,
      storage: captureStorageRequest,
      process: processAndPersistRecording,
      enqueue: (promise) => EdgeRuntime.waitUntil(promise),
    });
    return jsonResponse(result.status, result.body);
  }

  const contentType = req.headers.get("content-type") || "";
  const { recording, audioBytes } = contentType.includes("application/json")
    ? await createRecordingFromJson(parseJsonBytes(bytes), context)
    : await createRecordingFromRaw(req, bytes, context);

  await persistRecording(recording, false);

  if (processingMode(req) === "async") {
    EdgeRuntime.waitUntil(processAndPersistRecording(recording, audioBytes));
    return jsonResponse(202, {
      id: recording.id,
      status: recording.status,
      processing_status: recording.processing_status,
      has_note: hasStructuredNote(recording),
      recording_url: `/recordings/${recording.id}`,
      recording,
    });
  }

  await processAndPersistRecording(recording, audioBytes);

  return jsonResponse(201, {
    id: recording.id,
    status: recording.status,
    processing_status: recording.processing_status,
    has_note: hasStructuredNote(recording),
    recording_url: `/recordings/${recording.id}`,
    recording,
  });
}

async function handlePostDemoRecording(req: Request) {
  const startedAt = performance.now();
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength > DEMO_MAX_BODY_BYTES) {
    throw new HttpError(
      413,
      `Demo recording exceeds ${DEMO_MAX_BODY_BYTES} bytes`,
    );
  }

  const durationSeconds = nullableNumber(
    req.headers.get("x-throughline-duration-seconds"),
  );
  if (durationSeconds !== null && durationSeconds > DEMO_MAX_DURATION_SECONDS) {
    throw new HttpError(
      400,
      `Demo recordings are limited to ${DEMO_MAX_DURATION_SECONDS} seconds`,
    );
  }

  const contentType = req.headers.get("content-type") ||
    "application/octet-stream";
  const mimeType = contentType.split(";")[0].trim() ||
    "application/octet-stream";
  const recording: any = {
    id: createDemoRecordingId(),
    user_id: "demo",
    auth_user_id: null,
    created_at: new Date().toISOString(),
    user_local_time: nullableString(
      req.headers.get("x-throughline-user-local-time"),
    ),
    timezone: nullableString(req.headers.get("x-throughline-timezone")),
    duration_seconds: durationSeconds,
    type: normalizeType(req.headers.get("x-throughline-recording-type")) ||
      "freeform",
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

  logRecordingHealth("processing_started", recording, bytes);
  await processRecording(recording, bytes);
  logRecordingHealth("processing_finished", recording, bytes, startedAt);

  return jsonResponse(201, {
    id: recording.id,
    status: recording.status,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording_url: `/demo/recordings/${recording.id}`,
    recording,
  });
}

async function handleExtractRecording(
  req: Request,
  context: RequestContext,
  id: string,
) {
  const recording = await readRecording(id, context);
  if (recording.capture_id) {
    throw new HttpError(
      409,
      "This saved capture has already claimed processing",
      "capture_processing_already_claimed",
    );
  }
  if (context.authUserId) {
    await ordinaryTaskRpc(context.authUserId, "assert_reextract", id);
  }
  const body = await parseJsonRequest(req);

  recording.transcript_raw = nullableString(body.transcript_raw) ??
    recording.transcript_raw;
  recording.user_local_time = nullableString(body.user_local_time) ??
    recording.user_local_time;
  recording.timezone = nullableString(body.timezone) ?? recording.timezone;
  recording.duration_seconds = nullableNumber(body.duration_seconds) ??
    recording.duration_seconds;
  recording.type = normalizeType(body.type) ?? recording.type;

  await processAndPersistRecording(recording, null);

  return jsonResponse(200, {
    id: recording.id,
    processing_status: recording.processing_status,
    has_note: Boolean(recording.structured_note),
    recording,
  });
}

async function handlePostFeedback(
  req: Request,
  context: RequestContext,
  recordingId: string,
) {
  const recording = await readRecording(recordingId, context);
  const body = await parseJsonRequest(req);
  const qualityScore = normalizeQualityScore(body.quality_score);
  const issueTypes = normalizeStringArray(body.issue_types).slice(0, 8);
  const correction = nullableString(body.correction);
  const missing = nullableString(body.missing);
  const invented = nullableString(body.invented);
  const feedback = {
    id: createFeedbackId(),
    recording_id: recording.id,
    user_id: recording.user_id,
    auth_user_id: recording.auth_user_id ?? context.authUserId,
    created_at: new Date().toISOString(),
    source: nullableString(body.source) || "alpha_feedback",
    status: feedbackStatus(body.expected, qualityScore, issueTypes, correction),
    answers: {
      quality_score: qualityScore,
      issue_types: issueTypes,
      rubric_version: nullableString(body.rubric_version) ||
        "extraction_quality_v1",
      agent_ready: nullableBoolean(body.agent_ready),
      should_remember: nullableBoolean(body.should_remember),
      missing,
      invented,
      correction,
    },
    expected: body.expected && typeof body.expected === "object"
      ? body.expected
      : null,
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
    quality_score: qualityScore,
    feedback_url: `/feedback/${feedback.id}`,
  });
}

async function handleGetEvaluationReadinessPreview(
  context: RequestContext,
  recordingId: string,
  revisionId: string | null,
) {
  requireEvaluationOwner(context);
  requireEvaluationRuntime();
  const normalizedRevisionId = normalizedUuid(revisionId);
  if (!normalizedRevisionId) {
    throw new HttpError(
      422,
      "A valid revision_id is required",
      "evaluated_revision_id_invalid",
    );
  }
  const lineage = await readCurrentEvaluationLineage(recordingId, context);
  if (lineage.revision.revision_id !== normalizedRevisionId) {
    throw new HttpError(409, "The note changed", "revision_conflict");
  }
  try {
    const preview = await buildAgentReadinessPreview(
      lineage.revision,
      await resolveCurrentInferenceContract(),
    );
    return jsonResponse(200, { preview });
  } catch (error) {
    throw evaluationContractHttpError(error);
  }
}

async function handlePostEvaluation(
  req: Request,
  context: RequestContext,
  recordingId: string,
) {
  const authUserId = requireEvaluationOwner(context);
  requireEvaluationRuntime();
  let evaluation;
  try {
    evaluation = normalizeEvaluationRequest(await parseJsonRequest(req));
  } catch (error) {
    throw evaluationContractHttpError(error);
  }

  const lineage = await readCurrentEvaluationLineage(recordingId, context);
  if (evaluation.evaluated_revision_id !== lineage.revision.revision_id) {
    throw new HttpError(409, "The note changed", "revision_conflict");
  }
  if (evaluation.agent_ready) {
    try {
      await validateAgentReadinessBinding(
        evaluation,
        lineage.revision,
        await resolveCurrentInferenceContract(),
      );
    } catch (error) {
      throw evaluationContractHttpError(error);
    }
  }

  const createdAt = new Date().toISOString();
  const payload = {
    ...evaluation,
    recording_id: recordingId,
    auth_user_id: authUserId,
    processing_operation_id: lineage.revision.processing_operation_id,
    evaluator_kind: "recording_user",
    created_at: createdAt,
    contribution: {
      contribution_id: crypto.randomUUID(),
      idempotency_key: evaluation.idempotency_key,
    },
  };
  try {
    const result = await restRequest(
      "/rpc/throughline_commit_evaluation_v1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      },
    );
    return jsonResponse(201, result);
  } catch (error) {
    throw evaluationRpcHttpError(error);
  }
}

async function handleDeleteEvaluationContribution(
  req: Request,
  context: RequestContext,
  recordingId: string,
) {
  const authUserId = requireEvaluationOwner(context);
  requireEvaluationRetentionRuntime();
  const body = await parseJsonRequest(req);
  const idempotencyKey = normalizedUuid(body?.idempotency_key);
  if (!idempotencyKey) {
    throw new HttpError(
      422,
      "A valid idempotency_key is required",
      "evaluation_withdrawal_idempotency_key_invalid",
    );
  }

  const recordingSelect = encodeURIComponent("id,auth_user_id,audio");
  const recordingRows = await restRequest([
    "/throughline_recordings?select=" + recordingSelect,
    "&id=eq." + encodeURIComponent(recordingId),
    "&auth_user_id=eq." + encodeURIComponent(authUserId),
    "&limit=1",
  ].join(""));
  if (!Array.isArray(recordingRows) || !recordingRows.length) {
    throw new HttpError(404, "Recording not found");
  }

  const contributionSelect = encodeURIComponent(
    "contribution_id,event_kind,supersedes_contribution_id",
  );
  const contributions = await restRequest([
    "/throughline_evaluation_contributions?select=" + contributionSelect,
    "&recording_id=eq." + encodeURIComponent(recordingId),
    "&auth_user_id=eq." + encodeURIComponent(authUserId),
    "&order=created_at.desc,contribution_id.desc",
    "&limit=1",
  ].join(""));
  const latest = Array.isArray(contributions) ? contributions[0] : null;
  if (!latest || latest.event_kind === "withdrawn") {
    return jsonResponse(200, {
      withdrawn: true,
      audio_deleted: true,
      private_artifacts_deleted: 0,
      invalidated_case_count: 0,
      idempotent: true,
    });
  }

  const contributionId = normalizedUuid(latest.contribution_id);
  const audio = recordingRows[0]?.audio;
  if (
    !contributionId ||
    audio?.storage !== "supabase" ||
    typeof audio?.object_path !== "string" ||
    !audio.object_path
  ) {
    throw new HttpError(
      503,
      "Evaluation withdrawal is retryable",
      "evaluation_withdrawal_retryable",
    );
  }

  const caseSelect = encodeURIComponent("materializer_receipt_sha256");
  const cases = await restRequest([
    "/throughline_evaluation_corpus_cases?select=" + caseSelect,
    "&contribution_id=eq." + encodeURIComponent(contributionId),
    "&limit=1",
  ].join(""));
  const receipt = Array.isArray(cases)
    ? cases[0]?.materializer_receipt_sha256
    : null;
  const artifactScope = typeof receipt === "string"
    ? { materializer_receipt_sha256: receipt }
    : null;

  try {
    const result = await removeEvaluationContribution({
      recording_id: recordingId,
      contribution_id: contributionId,
      auth_user_id: authUserId,
      idempotency_key: idempotencyKey,
      audio: {
        bucket: typeof audio.bucket === "string" && audio.bucket
          ? audio.bucket
          : audioBucket(),
        object_path: audio.object_path,
      },
      artifact_scope: artifactScope,
    }, {
      async deleteAudio(input) {
        await deleteStoredAudioObject({
          bucket: input.audio.bucket,
          object_path: input.audio.object_path,
        });
        return { status: "deleted" };
      },
      deletePrivateRaw: deleteRegisteredPrivateArtifacts,
      async removeAndInvalidate(payload) {
        return await restRequest(
          "/rpc/throughline_remove_contribution_v1",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: {
                ...payload,
                withdrawn_at: new Date().toISOString(),
              },
            }),
          },
        );
      },
    });
    return jsonResponse(200, { ...result, idempotent: false });
  } catch {
    throw new HttpError(
      503,
      "Evaluation withdrawal is retryable",
      "evaluation_withdrawal_retryable",
    );
  }
}

async function deleteRegisteredPrivateArtifacts(scope: {
  materializer_receipt_sha256: string;
}) {
  const endpoint = privateArtifactDeleteEndpoint();
  const token = Deno.env.get("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN")
    ?.trim();
  if (!endpoint || !token) throw new Error("artifact_deletion_not_configured");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scope),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) {
    return { status: "not_found" as const, deleted_count: 0 };
  }
  if (!response.ok) throw new Error("artifact_deletion_failed");
  const proof = normalizeArtifactDeletionProof(await response.json());
  if (!proof) throw new Error("artifact_deletion_proof_invalid");
  return proof;
}

function privateArtifactDeleteEndpoint() {
  const baseUrl = supabaseUrl();
  if (!baseUrl) return "";
  const expected = new URL("/functions/v1/private-artifact-delete", baseUrl);
  const configured = Deno.env.get("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL")
    ?.trim();
  if (!configured) return expected.href;
  try {
    const candidate = new URL(configured);
    if (
      candidate.origin !== expected.origin ||
      candidate.pathname !== expected.pathname ||
      candidate.search || candidate.hash || candidate.username ||
      candidate.password
    ) return "";
    return candidate.href;
  } catch {
    return "";
  }
}

function normalizeArtifactDeletionProof(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const proof = value as Record<string, unknown>;
  if (
    Object.keys(proof).sort().join(",") !== "deleted_count,status" ||
    !Number.isInteger(proof.deleted_count) ||
    Number(proof.deleted_count) < 0
  ) return null;
  if (proof.status === "not_found" && proof.deleted_count === 0) {
    return { status: "not_found" as const, deleted_count: 0 };
  }
  if (proof.status === "deleted" && Number(proof.deleted_count) > 0) {
    return {
      status: "deleted" as const,
      deleted_count: Number(proof.deleted_count),
    };
  }
  return null;
}

async function handlePatchActionItem(
  req: Request,
  context: RequestContext,
  recordingId: string,
) {
  const recording = await readRecording(recordingId, context);
  const body = await parseJsonRequest(req);
  const text = nullableString(body.text);
  const completed = nullableBoolean(body.completed);

  if (!text) {
    throw new HttpError(400, "Action item text is required");
  }

  if (completed === null) {
    throw new HttpError(400, "Action item completed must be a boolean");
  }

  if (!recording.structured_note) {
    throw new HttpError(400, "Recording does not have an extracted note yet");
  }

  const beforeTaskChange = structuredClone(recording);
  updateActionItemCompletion(recording.structured_note, text, completed);
  if (evaluationWritesEnabled()) {
    const authUserId = requireEvaluationOwner(context);
    const lineage = await readCurrentEvaluationLineage(recordingId, context);
    let commit;
    try {
      commit = await buildUserMutationCommit({
        recording_id: recordingId,
        auth_user_id: authUserId,
        idempotency_key: crypto.randomUUID(),
        revision_id: crypto.randomUUID(),
        current_revision: lineage.revision,
        changes: {
          todos: updatedCanonicalTodoState(
            lineage.revision.canonical_snapshot.todos,
            text,
            completed,
          ),
        },
        transcript_before: String(recording.transcript_raw ?? ""),
        transcript_after: String(recording.transcript_raw ?? ""),
        mutation_kind: "action_state",
        notice_version: PRIVATE_EVALUATION_NOTICE_VERSION,
        disclosure_version: PRIVATE_EVALUATION_DISCLOSURE_VERSION,
        policy_version: PRIVATE_EVALUATION_POLICY_VERSION,
        created_at: new Date().toISOString(),
      });
      if (commit.revision) {
        await buildAgentReadinessPreview(
          {
            revision_id: commit.revision.revision_id,
            canonical_snapshot: commit.revision.canonical_snapshot,
            canonical_output_sha256: commit.revision.canonical_output_sha256,
            production_schema_sha256: commit.revision.production_schema_sha256,
            production_normalizer_sha256:
              commit.revision.production_normalizer_sha256,
            canonical_keyset_sha256: commit.revision.canonical_keyset_sha256,
          },
          await resolveCurrentInferenceContract(),
        );
      }
    } catch (error) {
      throw evaluationContractHttpError(error);
    }
    if (commit.material_change) {
      let result;
      try {
        result = await restRequest(
          "/rpc/throughline_commit_user_mutation_v1",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: commit }),
          },
        );
      } catch (error) {
        throw evaluationRpcHttpError(error);
      }
      recording.structured_note = structuredNoteForCanonicalSnapshot(
        commit.revision!.canonical_snapshot,
      );
      return jsonResponse(200, {
        recording,
        current_revision_id: result?.current_revision_id ??
          commit.revision!.revision_id,
        material_change: true,
        eligible: false,
      });
    }
  }
  if (context.authUserId) {
    return jsonResponse(
      200,
      await ordinaryTaskRpc(context.authUserId, "legacy", recordingId, {
        before: beforeTaskChange,
        after: recording,
        body,
        kind: "completion",
      }),
    );
  }
  await persistRecording(recording);
  return jsonResponse(200, { recording });
}

async function handlePatchRecording(
  req: Request,
  context: RequestContext,
  recordingId: string,
) {
  const body = await parseJsonRequest(req);
  if (body.task_contract_version === 1) {
    return jsonResponse(
      200,
      await ordinaryTaskRpc(
        requireAuthUser(context),
        "edit",
        recordingId,
        validateTaskEdit(body),
      ),
    );
  }
  const recording = await readRecording(recordingId, context);

  if (isCurrentEvaluationMutation(body)) {
    const authUserId = requireEvaluationOwner(context);
    requireEvaluationRuntime();
    const lineage = await readCurrentEvaluationLineage(recordingId, context);
    if (
      normalizedUuid(body.expected_current_revision_id) !==
        lineage.revision.revision_id
    ) {
      throw new HttpError(409, "The note changed", "revision_conflict");
    }
    assertCurrentMutationFields(body);
    let commit;
    try {
      commit = await buildUserMutationCommit({
        recording_id: recordingId,
        auth_user_id: authUserId,
        idempotency_key: String(body.idempotency_key ?? ""),
        revision_id: crypto.randomUUID(),
        contribution_id: crypto.randomUUID(),
        current_revision: lineage.revision,
        changes: body,
        transcript_before: String(recording.transcript_raw ?? ""),
        transcript_after: Object.hasOwn(body, "transcript") ||
            Object.hasOwn(body, "transcript_raw")
          ? String(body.transcript ?? body.transcript_raw ?? "")
          : String(recording.transcript_raw ?? ""),
        notice_version: String(body.notice_version ?? ""),
        disclosure_version: String(body.disclosure_version ?? ""),
        policy_version: String(body.policy_version ?? ""),
        created_at: new Date().toISOString(),
      });
      if (commit.revision) {
        await buildAgentReadinessPreview(
          {
            revision_id: commit.revision.revision_id,
            canonical_snapshot: commit.revision.canonical_snapshot,
            canonical_output_sha256: commit.revision.canonical_output_sha256,
            production_schema_sha256: commit.revision.production_schema_sha256,
            production_normalizer_sha256:
              commit.revision.production_normalizer_sha256,
            canonical_keyset_sha256: commit.revision.canonical_keyset_sha256,
          },
          await resolveCurrentInferenceContract(),
        );
      }
    } catch (error) {
      throw evaluationContractHttpError(error);
    }
    if (!commit.material_change) {
      return jsonResponse(200, {
        recording,
        current_revision_id: lineage.revision.revision_id,
        material_change: false,
        eligible: false,
      });
    }
    let result;
    try {
      result = await restRequest(
        "/rpc/throughline_commit_user_mutation_v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: commit }),
        },
      );
    } catch (error) {
      throw evaluationRpcHttpError(error);
    }
    recording.transcript_raw = commit.transcript_after;
    recording.structured_note = structuredNoteForCanonicalSnapshot(
      commit.revision!.canonical_snapshot,
    );
    return jsonResponse(200, {
      recording,
      current_revision_id: result?.current_revision_id ??
        commit.revision!.revision_id,
      material_change: true,
      eligible: result?.eligible ?? true,
    });
  }

  const beforeTaskChange = structuredClone(recording);
  applyRecordingEdits(recording, body);
  if (context.authUserId) {
    return jsonResponse(
      200,
      await ordinaryTaskRpc(context.authUserId, "legacy", recordingId, {
        before: beforeTaskChange,
        after: recording,
        body,
        kind: "edit",
      }),
    );
  }
  await persistRecording(recording);
  return jsonResponse(200, { recording });
}

async function handleDeleteAccount(context: RequestContext, req: Request) {
  const authUserId = requireAuthUser(context);
  const token = req.headers.get("x-throughline-deletion-token") ||
    crypto.randomUUID();
  if (!validCaptureUUID(token)) {
    return jsonResponse(400, { deleted: false, deletion_outcome: "refused" });
  }
  const captureConfig = postHogCaptureConfig();
  const deletionConfig = postHogDeletionConfig();
  // This is the only refusal path: no cleanup or hold has been started by this
  // request. If an earlier deletion already started, retain its pending state.
  if (
    hasPostHogCaptureConfig(captureConfig) &&
    !hasPostHogDeletionConfig(deletionConfig)
  ) {
    const holds = await restRequest(
      `/throughline_account_deletion_holds?owner_id=eq.${
        encodeURIComponent(authUserId)
      }&select=owner_id&limit=1`,
    );
    return jsonResponse(503, {
      deleted: false,
      deletion_outcome: Array.isArray(holds) && holds.length
        ? "uncertain"
        : "refused",
    });
  }
  let recordingsDeleted = 0;
  try {
    const begin = await captureRpc("throughline_begin_account_deletion_v1", {
      p_owner: authUserId,
      p_token_sha256: await sha256Hex(token.toLowerCase()),
    });
    if (begin.deletion_outcome !== "pending") {
      return jsonResponse(409, {
        deleted: false,
        deletion_outcome: "uncertain",
      });
    }
    if (hasPostHogCaptureConfig(captureConfig)) {
      await deleteProductAnalyticsUserFromPostHog(authUserId, deletionConfig);
    }
    // The hold prevents any new acceptance. Drain every page; one page alone
    // would miss owners with more than 1,000 saved notes.
    for (;;) {
      const recordings = await listFullRecordings(context);
      if (!recordings.length) break;
      for (const recording of recordings) {
        await deleteRecording(recording.id, context, "account_deleted");
        recordingsDeleted++;
      }
    }
    // Incomplete reservations can already have an object but no recording row.
    // Storage's insertion trigger shares the owner lock with the hold, so a
    // delayed upload cannot create another object after this cleanup.
    for (;;) {
      const pending = await restRequest(
        `/throughline_capture_reservations?owner_id=eq.${
          encodeURIComponent(authUserId)
        }&select=capture_id,object_token&limit=1000`,
      );
      if (!Array.isArray(pending) || !pending.length) break;
      for (const capture of pending) {
        await deleteStoredAudioObject({
          storage: "supabase",
          bucket: "throughline-audio",
          object_path: `captures/${capture.object_token}`,
        });
        await deleteRows(
          "throughline_capture_reservations",
          `owner_id=eq.${encodeURIComponent(authUserId)}&capture_id=eq.${
            encodeURIComponent(capture.capture_id)
          }`,
        );
      }
    }
    // A public legacy upload can have committed an object before its row, then
    // crashed. The same storage guard now quiesces its owner UUID namespace.
    for (;;) {
      const objects = await storageRequest(`/object/list/${audioBucket()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: `${authUserId}/`,
          limit: 1000,
          offset: 0,
        }),
      });
      if (!Array.isArray(objects)) throw new Error("Invalid storage listing");
      if (!objects.length) break;
      for (const object of objects) {
        if (
          !object.id || typeof object.name !== "string" ||
          object.name.includes("/")
        ) throw new Error("Unexpected owner audio object");
        await deleteStoredAudioObject({
          storage: "supabase",
          bucket: audioBucket(),
          object_path: `${authUserId}/${object.name}`,
        });
      }
    }
    for (
      const table of [
        "throughline_feedback",
        "throughline_product_feedback",
        "throughline_product_events",
      ]
    ) {
      await deleteRows(
        table,
        `auth_user_id=eq.${encodeURIComponent(authUserId)}`,
      );
    }
    await deleteRows(
      "throughline_mcp_tokens",
      `user_id=eq.${encodeURIComponent(authUserId)}`,
    );
    await deleteRows(
      "throughline_profiles",
      `id=eq.${encodeURIComponent(authUserId)}`,
    );
    // The auth-user DELETE transaction also marks all hashed receipt tokens
    // deleted, strips owner links, and cascades holds/reservations/tombstones.
    await deleteAuthUser(authUserId);
    return jsonResponse(200, {
      deleted: true,
      deletion_outcome: "deleted",
      recordings_deleted: recordingsDeleted,
    });
  } catch {
    return jsonResponse(503, {
      deleted: false,
      deletion_outcome: "uncertain",
      error_code: "account_deletion_unconfirmed",
    });
  }
}

async function createRecordingFromJson(
  body: Record<string, unknown>,
  context: RequestContext,
) {
  const id = createRecordingId();
  const audioBytes = typeof body.audio_base64 === "string"
    ? decodeBase64(body.audio_base64)
    : null;
  const audioMimeType = nullableString(body.audio_mime_type) ||
    "application/octet-stream";
  const audio = await storeAudio({
    id,
    bytes: audioBytes,
    mimeType: audioMimeType,
    ownerId: context.legacyUserId,
  });

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

async function createRecordingFromRaw(
  req: Request,
  bodyBytes: Uint8Array,
  context: RequestContext,
) {
  const id = createRecordingId();
  const contentType = req.headers.get("content-type") ||
    "application/octet-stream";
  const mimeType = contentType.split(";")[0].trim() ||
    "application/octet-stream";
  const audio = await storeAudio({
    id,
    bytes: bodyBytes,
    mimeType,
    ownerId: context.legacyUserId,
  });

  return {
    recording: {
      id,
      user_id: context.legacyUserId,
      auth_user_id: context.authUserId,
      created_at: new Date().toISOString(),
      user_local_time: nullableString(
        req.headers.get("x-throughline-user-local-time"),
      ),
      timezone: nullableString(req.headers.get("x-throughline-timezone")),
      duration_seconds: nullableNumber(
        req.headers.get("x-throughline-duration-seconds"),
      ),
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
    prompt_path: "core/inference-contract.mjs:PRODUCTION_EXTRACTION_PROMPT",
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

async function processAndPersistRecording(
  recording: any,
  audioBytes: Uint8Array | null,
) {
  const startedAt = performance.now();
  logRecordingHealth("processing_started", recording, audioBytes);
  try {
    if (lineageWritesEnabled() && Deno.env.get("GROQ_API_KEY")) {
      const commit = await processRecordingWithLineage(recording, audioBytes);
      await commitProcessingLineage(commit);
      applyProcessingCommit(recording, commit);
    } else {
      await processRecording(recording, audioBytes);
    }
  } catch (error) {
    recording.processing_status = "processing_failed";
    recording.processing_error = {
      message: safeProcessingError(error),
      processed_at: new Date().toISOString(),
    };
  }

  await persistRecording(recording, true);
  logRecordingHealth("processing_finished", recording, audioBytes, startedAt);
  return recording;
}

async function processRecordingWithLineage(
  recording: any,
  audioBytes: Uint8Array | null,
) {
  const contract = await resolveCurrentInferenceContract();
  return runRecordingOperation({
    recording_id: recording.id,
    audio_bytes: audioBytes,
    mime_type: recording.audio?.mime_type ?? null,
    existing_transcript: recording.transcript_raw ?? null,
    metadata: metadataForRecording(recording),
  }, {
    contract,
    transcribeAttempt: (attemptNumber) =>
      requestGroqTranscriptionAttempt(
        recording,
        audioBytes,
        contract,
        attemptNumber,
      ),
    extractAttempt: (attemptNumber, transcript) =>
      requestGroqExtractionAttempt(
        {
          id: recording.id,
          metadata: metadataForRecording(recording),
          transcript,
          prompt: contract.prompt.snapshot,
        },
        contract,
        attemptNumber,
      ),
    sleep: async (attemptNumber) => {
      await sleep(retryDelayMs("", attemptNumber - 1));
    },
  });
}

async function commitProcessingLineage(commit: ProcessingCommitV1) {
  await restRequest("/rpc/throughline_commit_processing_v1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: commit }),
  });
}

function applyProcessingCommit(recording: any, commit: ProcessingCommitV1) {
  const transcriptionAttempts = commit.attempts.filter((attempt) =>
    attempt.stage === "transcription"
  );
  const extractionAttempts = commit.attempts.filter((attempt) =>
    attempt.stage === "extraction"
  );
  const transcript = [...transcriptionAttempts].reverse().find((attempt) =>
    attempt.status === "succeeded"
  )?.private_output_snapshot?.value;

  if (typeof transcript === "string" && transcript.trim()) {
    recording.transcript_raw = transcript.trim();
  }
  recording.transcription = transcriptionAttempts.length
    ? {
      status: transcriptionAttempts.at(-1)?.status === "succeeded"
        ? "transcribed"
        : "transcription_failed",
      provider: "groq",
      processed_at: commit.operation.finished_at,
      error: transcriptionAttempts.at(-1)?.safe_failure_code ?? null,
    }
    : recording.transcription;

  if (commit.original_revision) {
    recording.structured_note = commit.original_revision.canonical_output;
    recording.type = recording.type || recording.structured_note.type;
    recording.processing_status = "processed";
  } else if (extractionAttempts.length) {
    recording.processing_status = "extraction_failed";
  } else {
    recording.processing_status = "transcription_failed";
  }
  recording.extraction = extractionAttempts.length
    ? {
      status: commit.original_revision ? "processed" : "extraction_failed",
      provider: "groq",
      prompt_path: "core/inference-contract.mjs:PRODUCTION_EXTRACTION_PROMPT",
      processed_at: commit.operation.finished_at,
      metadata: metadataForRecording(recording),
      error: extractionAttempts.at(-1)?.safe_failure_code ?? null,
    }
    : recording.extraction;
  recording.processing_lineage = {
    operation_id: commit.operation.operation_id,
    contract_sha256: commit.contract.contract_sha256,
  };
}

function safeProcessingError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return [
      "configuration_missing",
      "input_missing",
      "timeout",
      "rate_limited",
      "provider_http",
      "provider_response_invalid",
      "storage_failed",
      "unknown",
    ].includes(message)
    ? message
    : "unknown";
}

function lineageWritesEnabled() {
  return currentEvaluationFlags().lineageWrites;
}

function evaluationWritesEnabled() {
  return currentEvaluationFlags().evaluationWrites;
}

function evaluationRetentionEnabled() {
  return currentEvaluationFlags().retentionEnforcement;
}

function currentEvaluationFlags() {
  try {
    return resolveEvaluationFlags({
      THROUGHLINE_EVAL_COMPATIBILITY_MODE: Deno.env.get(
        "THROUGHLINE_EVAL_COMPATIBILITY_MODE",
      ),
      THROUGHLINE_LINEAGE_WRITES_ENABLED: Deno.env.get(
        "THROUGHLINE_LINEAGE_WRITES_ENABLED",
      ),
      THROUGHLINE_EVALUATION_WRITES_ENABLED: Deno.env.get(
        "THROUGHLINE_EVALUATION_WRITES_ENABLED",
      ),
      THROUGHLINE_EVALUATION_RETENTION_ENABLED: Deno.env.get(
        "THROUGHLINE_EVALUATION_RETENTION_ENABLED",
      ),
    });
  } catch {
    throw new HttpError(
      503,
      "Evaluation compatibility configuration is invalid",
      "evaluation_compatibility_mode_invalid",
    );
  }
}

async function requireEvaluationCompatibilitySafety() {
  const flags = currentEvaluationFlags();
  if (!flags.requiresStableEligibilityCheck) return;

  let result: unknown;
  try {
    result = await restRequest(
      "/rpc/throughline_active_evaluation_eligibility_count_v1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
  } catch {
    throw new HttpError(
      503,
      "Evaluation compatibility could not be verified",
      "evaluation_compatibility_check_failed",
    );
  }

  const rawCount = Array.isArray(result)
    ? result[0]
    : result && typeof result === "object" && "active_count" in result
    ? (result as { active_count: unknown }).active_count
    : result;
  const activeCount = typeof rawCount === "number"
    ? rawCount
    : typeof rawCount === "string" && /^\d+$/u.test(rawCount)
    ? Number(rawCount)
    : Number.NaN;
  try {
    assertStableCompatibilityAllowed(flags, activeCount);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "retention_aware_rollback_required") {
      throw new HttpError(
        503,
        "Retention-aware compatibility is required",
        code,
      );
    }
    throw new HttpError(
      503,
      "Evaluation compatibility could not be verified",
      "evaluation_compatibility_check_failed",
    );
  }
}

function requireEvaluationRetentionRuntime() {
  if (!evaluationRetentionEnabled()) {
    throw new HttpError(
      503,
      "Evaluation retention is not enabled",
      "evaluation_retention_disabled",
    );
  }
}

function requireEvaluationRuntime() {
  if (!evaluationWritesEnabled()) {
    throw new HttpError(
      503,
      "Private evaluation is not enabled",
      "evaluation_runtime_disabled",
    );
  }
}

function requireEvaluationOwner(context: RequestContext) {
  if (context.kind !== "user" || !context.authUserId) {
    throw new HttpError(
      403,
      "A recording owner is required",
      "human_evaluation_requires_owner",
    );
  }
  return context.authUserId;
}

function evaluationContractHttpError(error: unknown) {
  const code = error instanceof Error
    ? error.message
    : "evaluation_request_invalid";
  if (code === "agent_readiness_preview_stale") {
    return new HttpError(409, "The readiness preview changed", code);
  }
  if (code === "agent_readiness_preview_required") {
    return new HttpError(422, "Inspect the current note preview first", code);
  }
  if (code === "agent_readiness_revision_contract_invalid") {
    return new HttpError(409, "The current note contract changed", code);
  }
  const safeCode = /^[a-z0-9_]{1,80}$/u.test(code)
    ? code
    : "evaluation_request_invalid";
  return new HttpError(422, "The evaluation request is invalid", safeCode);
}

function evaluationRpcHttpError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("revision_conflict")) {
    return new HttpError(409, "The note changed", "revision_conflict");
  }
  if (message.includes("agent_readiness_preview_stale")) {
    return new HttpError(
      409,
      "The readiness preview changed",
      "agent_readiness_preview_stale",
    );
  }
  return new HttpError(
    503,
    "The evaluation could not be saved",
    "evaluation_commit_retryable",
  );
}

async function requestGroqTranscriptionAttempt(
  recording: any,
  audioBytes: Uint8Array | null,
  contract: Awaited<ReturnType<typeof resolveCurrentInferenceContract>>,
  _attemptNumber: number,
): Promise<ProviderAttemptOutcome<string>> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      failure_code: "configuration_missing",
      retryable: false,
    };
  }
  if (!audioBytes?.byteLength) {
    return { ok: false, failure_code: "input_missing", retryable: false };
  }

  const form = new FormData();
  form.append("model", contract.transcription.model);
  form.append("response_format", contract.transcription.response_format);
  form.append(
    "file",
    new Blob([arrayBufferFromBytes(audioBytes)], {
      type: recording.audio?.mime_type || "application/octet-stream",
    }),
    `${recording.id}.${extensionForMime(recording.audio?.mime_type)}`,
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    contract.transcription.timeout_ms,
  );
  let response: Response;
  try {
    response = await fetch(
      `${contract.provider.base_url}/audio/transcriptions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      },
    );
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      failure_code: error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : "unknown",
      retryable: true,
    };
  }
  clearTimeout(timeout);

  const privateResponseText = await response.text();
  if (response.status === 429) {
    return { ok: false, failure_code: "rate_limited", retryable: true };
  }
  if (!response.ok) {
    return { ok: false, failure_code: "provider_http", retryable: false };
  }
  try {
    const payload = JSON.parse(privateResponseText);
    if (typeof payload.text !== "string" || !payload.text.trim()) {
      return {
        ok: false,
        failure_code: "provider_response_invalid",
        retryable: false,
      };
    }
    return {
      ok: true,
      value: payload.text.trim(),
      usage: payload.usage && typeof payload.usage === "object"
        ? payload.usage
        : null,
    };
  } catch {
    return {
      ok: false,
      failure_code: "provider_response_invalid",
      retryable: false,
    };
  }
}

async function requestGroqExtractionAttempt(
  input: Record<string, unknown>,
  contract: Awaited<ReturnType<typeof resolveCurrentInferenceContract>>,
  attemptNumber: number,
): Promise<ProviderAttemptOutcome<Record<string, unknown>>> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      failure_code: "configuration_missing",
      retryable: false,
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    contract.extraction.timeout_ms,
  );
  let response: Response;
  try {
    response = await fetch(`${contract.provider.base_url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: contract.extraction.model,
        temperature: contract.extraction.temperature,
        response_format: contract.extraction.response_format,
        messages: buildExtractionMessages(input, attemptNumber - 1),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      failure_code: error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : "unknown",
      retryable: true,
    };
  }
  clearTimeout(timeout);

  const privateResponseText = await response.text();
  if (response.status === 429) {
    return { ok: false, failure_code: "rate_limited", retryable: true };
  }
  if (isJsonValidationFailure(response.status, privateResponseText)) {
    return {
      ok: false,
      failure_code: "provider_response_invalid",
      retryable: true,
    };
  }
  if (!response.ok) {
    return { ok: false, failure_code: "provider_http", retryable: false };
  }
  try {
    const payload = JSON.parse(privateResponseText);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return {
        ok: false,
        failure_code: "provider_response_invalid",
        retryable: false,
      };
    }
    return {
      ok: true,
      value: extractJsonFromText(content),
      usage: payload.usage && typeof payload.usage === "object"
        ? payload.usage
        : null,
    };
  } catch {
    return {
      ok: false,
      failure_code: "provider_response_invalid",
      retryable: true,
    };
  }
}

async function transcribeRecordingAudio(
  recording: any,
  audioBytes: Uint8Array | null,
) {
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
      error: error instanceof Error
        ? error.message
        : "Unknown transcription error",
    };
  }
}

async function transcribeWithGroq(recording: any, audioBytes: Uint8Array) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for Groq transcription");
  }

  const contract = await resolveCurrentInferenceContract();
  const baseUrl = contract.provider.base_url;
  const model = contract.transcription.model;
  const timeoutMs = contract.transcription.timeout_ms;
  const maxRetries = contract.transcription.max_retries;
  const fileName = `${recording.id}.${
    extensionForMime(recording.audio?.mime_type)
  }`;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const form = new FormData();
    form.append("model", model);
    form.append("response_format", contract.transcription.response_format);
    form.append(
      "file",
      new Blob([arrayBufferFromBytes(audioBytes)], {
        type: recording.audio?.mime_type || "application/octet-stream",
      }),
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
      throw new Error(`Groq transcription failed (${response.status})`);
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
    const contract = await resolveCurrentInferenceContract();
    const raw = await requestGroqExtraction({
      id: recording.id,
      metadata,
      transcript,
      prompt: contract.prompt.snapshot,
    }, contract);

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
      error: error instanceof Error
        ? error.message
        : "Unknown extraction error",
      provider: "groq",
    };
  }
}

async function requestGroqExtraction(
  input: Record<string, unknown>,
  contract: Awaited<ReturnType<typeof resolveCurrentInferenceContract>>,
) {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for Groq extraction");
  }

  const baseUrl = contract.provider.base_url;
  const model = contract.extraction.model;
  const timeoutMs = contract.extraction.timeout_ms;
  const maxRetries = contract.extraction.max_retries;

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
          temperature: contract.extraction.temperature,
          response_format: contract.extraction.response_format,
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

    if (
      isJsonValidationFailure(response.status, responseText) &&
      attempt < maxRetries
    ) {
      await sleep(500);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Groq extraction failed (${response.status})`);
    }

    const payload = JSON.parse(responseText);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error(
        "Groq extraction response did not include message content",
      );
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

function buildExtractionMessages(
  input: Record<string, unknown>,
  attempt: number,
) {
  const retryGuard = attempt > 0
    ? [
      "",
      "Retry guard:",
      "- Return syntactically valid JSON only.",
      "- Do not include markdown, comments, or trailing text.",
      "- most_important must be an array of strings.",
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
  { id, bytes, mimeType, ownerId }: {
    id: string;
    bytes: Uint8Array | null;
    mimeType: string;
    ownerId: string;
  },
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
    body: arrayBufferFromBytes(bytes),
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

async function persistRecording(recording: any, existingOnly = true) {
  if (recording.auth_user_id) {
    const result = await ordinaryTaskRpc(
      recording.auth_user_id,
      existingOnly ? "processing" : "insert",
      recording.id,
      { recording },
    );
    if (result.recording) Object.assign(recording, result.recording);
    return;
  }
  const payload = {
    id: recording.id,
    user_id: recording.user_id || userId(),
    auth_user_id: recording.auth_user_id ?? null,
    capture_id: recording.capture_id ?? null,
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
  };
  if (existingOnly) {
    // Processing completion must never resurrect a concurrently deleted row.
    await restRequest(
      `/throughline_recordings?id=eq.${encodeURIComponent(recording.id)}${
        recording.auth_user_id
          ? `&auth_user_id=eq.${encodeURIComponent(recording.auth_user_id)}`
          : ""
      }`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  } else await upsert("throughline_recordings", payload);
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

async function readCurrentRevisionID(id: string, context?: RequestContext) {
  const rows = await restRequest(
    [
      "/throughline_recordings?select=current_note_revision_id",
      `&id=eq.${encodeURIComponent(id)}`,
      recordingScopeQuery(context),
      "&limit=1",
    ].join(""),
  );
  if (!Array.isArray(rows) || !rows.length) {
    throw new HttpError(404, "Recording not found");
  }
  return normalizedUuid(rows[0].current_note_revision_id);
}

async function readCurrentEvaluationLineage(
  recordingId: string,
  context: RequestContext,
) {
  const recordingSelect = encodeURIComponent(
    "id,auth_user_id,current_note_revision_id",
  );
  const recordingRows = await restRequest(
    [
      "/throughline_recordings?select=" + recordingSelect,
      "&id=eq." + encodeURIComponent(recordingId),
      recordingScopeQuery(context),
      "&limit=1",
    ].join(""),
  );
  if (!Array.isArray(recordingRows) || !recordingRows.length) {
    throw new HttpError(404, "Recording not found", "recording_not_found");
  }
  const recordingRow = recordingRows[0];
  const revisionId = normalizedUuid(recordingRow.current_note_revision_id);
  if (!revisionId) {
    throw new HttpError(
      409,
      "The recording has no current immutable note revision",
      "evaluation_lineage_unavailable",
    );
  }

  const revisionSelect = encodeURIComponent([
    "revision_id",
    "recording_id",
    "processing_operation_id",
    "canonical_snapshot",
    "canonical_output_sha256",
    "production_schema_sha256",
    "production_normalizer_sha256",
    "canonical_keyset_sha256",
  ].join(","));
  const revisionRows = await restRequest(
    [
      "/throughline_note_revisions?select=" + revisionSelect,
      "&revision_id=eq." + encodeURIComponent(revisionId),
      "&recording_id=eq." + encodeURIComponent(recordingId),
      "&limit=1",
    ].join(""),
  );
  if (!Array.isArray(revisionRows) || !revisionRows.length) {
    throw new HttpError(
      409,
      "The current immutable note revision is unavailable",
      "evaluation_lineage_unavailable",
    );
  }
  return { recording: recordingRow, revision: revisionRows[0] };
}

async function deleteRecording(
  id: string,
  context: RequestContext,
  reason: "note_deleted" | "account_deleted" = "note_deleted",
) {
  const recording = await readRecording(id, context);

  if (recording.audio?.storage === "supabase" && recording.audio?.object_path) {
    await deleteStoredAudioObject(recording.audio);
  }

  if (evaluationRetentionEnabled()) {
    const authUserId = normalizedUuid(recording.auth_user_id) ??
      normalizedUuid(context.authUserId);
    if (!authUserId) {
      throw new HttpError(
        503,
        "Privacy deletion is retryable",
        "evaluation_withdrawal_retryable",
      );
    }
    await purgeEvaluationArtifactsForRecording(id, authUserId, reason);
  }

  if (recording.auth_user_id && reason !== "account_deleted") {
    await ordinaryTaskRpc(recording.auth_user_id, "delete", id);
  } else {
    await restRequest(
      [
        "/throughline_recordings",
        `?id=eq.${encodeURIComponent(id)}`,
        recordingScopeQuery(context),
      ].join(""),
      { method: "DELETE" },
    );
  }
}

async function purgeEvaluationArtifactsForRecording(
  recordingId: string,
  authUserId: string,
  reason: "note_deleted" | "account_deleted" | "eligibility_ended",
) {
  try {
    const caseSelect = encodeURIComponent("materializer_receipt_sha256");
    const cases = await restRequest([
      "/throughline_evaluation_corpus_cases?select=" + caseSelect,
      "&recording_id=eq." + encodeURIComponent(recordingId),
      "&auth_user_id=eq." + encodeURIComponent(authUserId),
      "&limit=1001",
    ].join(""));
    if (Array.isArray(cases) && cases.length > 1000) {
      throw new Error("artifact_deletion_batch_limit_exceeded");
    }
    const receipts = new Set<string>();
    for (const corpusCase of Array.isArray(cases) ? cases : []) {
      if (typeof corpusCase?.materializer_receipt_sha256 === "string") {
        receipts.add(corpusCase.materializer_receipt_sha256);
      }
    }
    if (!receipts.size) return 0;

    let deletedCount = 0;
    for (const receipt of [...receipts].sort()) {
      const deletion = await purgeCorpusCaseArtifacts(
        { materializer_receipt_sha256: receipt },
        { deletePrivateRaw: deleteRegisteredPrivateArtifacts },
      );
      deletedCount += deletion.deleted_count;
    }

    await restRequest(
      "/rpc/throughline_invalidate_evaluation_corpus_v1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            recording_id: recordingId,
            auth_user_id: authUserId,
            reason_code: reason,
            raw_artifacts_deleted: true,
            raw_artifacts_deleted_count: deletedCount,
            invalidated_at: new Date().toISOString(),
          },
        }),
      },
    );
    return deletedCount;
  } catch {
    throw new HttpError(
      503,
      "Privacy deletion is retryable",
      "evaluation_withdrawal_retryable",
    );
  }
}

async function expireStoredAudio() {
  if (evaluationRetentionEnabled()) {
    return await expireStoredAudioRetentionAware();
  }
  const retentionDays = Math.max(1, AUDIO_RETENTION_DAYS);
  const batchLimit = Math.max(1, Math.min(1000, AUDIO_RETENTION_BATCH_LIMIT));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    .toISOString();
  const rows = await restRequest(
    [
      "/throughline_recordings",
      "?select=id,auth_user_id,created_at,audio,recording",
      `&created_at=lt.${encodeURIComponent(cutoff)}`,
      "&order=created_at.asc",
      `&limit=${batchLimit}`,
    ].join(""),
  );

  let expired = 0;
  let skipped = 0;
  let retryableErrors = 0;
  const expiredAt = new Date().toISOString();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.audio?.storage !== "supabase" || !row.audio.object_path) {
      skipped += 1;
      continue;
    }

    try {
      await deleteStoredAudioObject(row.audio);
      await markRecordingAudioExpired(row, expiredAt, retentionDays);
      expired += 1;
    } catch {
      retryableErrors += 1;
    }
  }

  return {
    retention_days: retentionDays,
    cutoff,
    scanned: Array.isArray(rows) ? rows.length : 0,
    expired,
    skipped,
    errors: retryableErrors ? { storage_delete_failed: retryableErrors } : {},
  };
}

async function reconcileStaleEvaluationArtifacts() {
  const staleAfterSeconds = Math.max(
    300,
    Math.min(30 * 24 * 60 * 60, Math.floor(EVALUATION_ARTIFACT_STALE_SECONDS)),
  );
  const batchLimit = Math.max(
    1,
    Math.min(1000, Math.floor(EVALUATION_ARTIFACT_RECONCILIATION_LIMIT)),
  );
  const claimTtlSeconds = Math.max(
    30,
    Math.min(3600, Math.floor(EVALUATION_ARTIFACT_CLAIM_TTL_SECONDS)),
  );
  const cutoff = new Date(Date.now() - staleAfterSeconds * 1000).toISOString();
  const rows = await restRequest(
    "/rpc/throughline_claim_stale_evaluation_artifact_receipts_v1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stale_before: cutoff,
        max_rows: batchLimit,
        claim_ttl_seconds: claimTtlSeconds,
      }),
    },
  );

  const claims = Array.isArray(rows) ? rows : [];
  let deleted = 0;
  let notFound = 0;
  let acknowledged = 0;
  let retryableErrors = 0;
  let invalidClaims = 0;
  let releaseErrors = 0;

  for (const row of claims) {
    const claim = normalizeEvaluationArtifactCleanupClaim(row);
    if (!claim) {
      invalidClaims += 1;
      continue;
    }

    try {
      const proof = await deleteRegisteredPrivateArtifacts({
        materializer_receipt_sha256: claim.materializer_receipt_sha256,
      });
      await restRequest(
        "/rpc/throughline_acknowledge_evaluation_artifact_deletion_v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: {
              materializer_receipt_sha256: claim.materializer_receipt_sha256,
              cleanup_claim_token: claim.cleanup_claim_token,
              deletion_status: proof.status,
              deleted_count: proof.deleted_count,
            },
          }),
        },
      );
      acknowledged += 1;
      if (proof.status === "deleted") deleted += 1;
      else notFound += 1;
    } catch {
      retryableErrors += 1;
      try {
        await releaseEvaluationArtifactCleanupClaim(claim);
      } catch {
        releaseErrors += 1;
      }
    }
  }

  return {
    stale_after_seconds: staleAfterSeconds,
    cutoff,
    scanned: claims.length,
    deleted,
    not_found: notFound,
    acknowledged,
    errors: {
      ...(retryableErrors
        ? { artifact_deletion_retryable: retryableErrors }
        : {}),
      ...(invalidClaims ? { invalid_cleanup_claim: invalidClaims } : {}),
      ...(releaseErrors ? { cleanup_claim_release_failed: releaseErrors } : {}),
    },
  };
}

function normalizeEvaluationArtifactCleanupClaim(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const claim = value as Record<string, unknown>;
  if (
    Object.keys(claim).sort().join(",") !==
      "cleanup_claim_expires_at,cleanup_claim_token,materializer_receipt_sha256" ||
    typeof claim.materializer_receipt_sha256 !== "string" ||
    !/^[0-9a-f]{64}$/u.test(claim.materializer_receipt_sha256)
  ) return null;
  const cleanupClaimToken = normalizedUuid(claim.cleanup_claim_token);
  const expiresAt = typeof claim.cleanup_claim_expires_at === "string"
    ? Date.parse(claim.cleanup_claim_expires_at)
    : Number.NaN;
  if (!cleanupClaimToken || !Number.isFinite(expiresAt)) return null;
  return {
    materializer_receipt_sha256: claim.materializer_receipt_sha256,
    cleanup_claim_token: cleanupClaimToken,
  };
}

async function releaseEvaluationArtifactCleanupClaim(claim: {
  materializer_receipt_sha256: string;
  cleanup_claim_token: string;
}) {
  await restRequest(
    "/rpc/throughline_release_evaluation_artifact_cleanup_claim_v1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: claim }),
    },
  );
}

async function expireStoredAudioRetentionAware() {
  const retentionDays = Math.max(1, AUDIO_RETENTION_DAYS);
  const batchLimit = Math.max(1, Math.min(1000, AUDIO_RETENTION_BATCH_LIMIT));
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const eligibilityCutoff = evaluationRetentionEligibleSince();
  const selectedCandidates = await restRequest(
    "/rpc/throughline_retention_candidates_v1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordinary_cutoff: cutoff,
        eligibility_cutoff: eligibilityCutoff,
        max_rows: batchLimit,
      }),
    },
  );
  const claims = await restRequest(
    "/rpc/throughline_claim_retention_candidates_v1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordinary_cutoff: cutoff,
        eligibility_cutoff: eligibilityCutoff,
        max_rows: batchLimit,
        claim_ttl_seconds: Math.max(
          30,
          Math.min(3600, AUDIO_RETENTION_CLAIM_TTL_SECONDS),
        ),
      }),
    },
  );

  const protectedEvaluation =
    (Array.isArray(selectedCandidates) ? selectedCandidates : []).filter((
      candidate,
    ) => candidate?.candidate_reason === "active_current_contribution").length;
  let expiredStandard = 0;
  let expiredEligibilityEnded = 0;
  let skipped = 0;
  let retryableErrors = 0;
  let claimReleaseErrors = 0;

  for (const candidate of Array.isArray(claims) ? claims : []) {
    const action = selectRetentionAction({
      candidate_reason: candidate?.candidate_reason,
      disclosure_current: false,
      audio_available: true,
    });
    const recordingId = String(candidate?.recording_id ?? "");
    const claimToken = normalizedUuid(candidate?.claim_token);
    if (
      !recordingId || !claimToken ||
      (action !== "delete_standard" &&
        action !== "delete_eligibility_ended")
    ) {
      retryableErrors += 1;
      continue;
    }

    try {
      const select = encodeURIComponent(
        "id,auth_user_id,created_at,audio,recording",
      );
      const rows = await restRequest([
        "/throughline_recordings?select=" + select,
        "&id=eq." + encodeURIComponent(recordingId),
        "&limit=1",
      ].join(""));
      const row = Array.isArray(rows) ? rows[0] : null;
      if (
        !row || row.audio?.storage !== "supabase" ||
        typeof row.audio?.object_path !== "string" || !row.audio.object_path
      ) {
        await releaseRetentionClaim(recordingId, claimToken);
        skipped += 1;
        continue;
      }

      await deleteStoredAudioObject(row.audio);
      let rawArtifactsDeleted = false;
      let rawArtifactsDeletedCount = 0;
      if (action === "delete_eligibility_ended") {
        const authUserId = normalizedUuid(row.auth_user_id);
        if (!authUserId) throw new Error("retention_owner_missing");
        rawArtifactsDeletedCount = await purgeEvaluationArtifactsForRecording(
          row.id,
          authUserId,
          "eligibility_ended",
        );
        rawArtifactsDeleted = true;
      }
      await restRequest(
        "/rpc/throughline_finalize_retention_claim_v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: {
              recording_id: recordingId,
              claim_token: claimToken,
              source_audio_deleted: true,
              raw_artifacts_deleted: rawArtifactsDeleted,
              raw_artifacts_deleted_count: rawArtifactsDeletedCount,
            },
          }),
        },
      );
      if (action === "delete_eligibility_ended") {
        expiredEligibilityEnded += 1;
      } else {
        expiredStandard += 1;
      }
    } catch {
      try {
        await releaseRetentionClaim(recordingId, claimToken);
      } catch {
        claimReleaseErrors += 1;
      }
      retryableErrors += 1;
    }
  }

  return {
    retention_days: retentionDays,
    cutoff,
    scanned: Array.isArray(claims) ? claims.length : 0,
    protected_evaluation: protectedEvaluation,
    expired_standard: expiredStandard,
    expired_eligibility_ended: expiredEligibilityEnded,
    skipped,
    errors: {
      ...(retryableErrors
        ? { evaluation_withdrawal_retryable: retryableErrors }
        : {}),
      ...(claimReleaseErrors
        ? { claim_release_failed: claimReleaseErrors }
        : {}),
    },
  };
}

async function releaseRetentionClaim(recordingId: string, claimToken: string) {
  await restRequest(
    "/rpc/throughline_release_retention_claim_v1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          recording_id: recordingId,
          claim_token: claimToken,
        },
      }),
    },
  );
}

function evaluationRetentionEligibleSince() {
  const value = Deno.env.get(
    "THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE",
  )?.trim();
  const timestamp = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) {
    throw new HttpError(
      503,
      "Evaluation retention configuration is invalid",
      "evaluation_retention_configuration_invalid",
    );
  }
  return new Date(timestamp).toISOString();
}

async function deleteStoredAudioObject(audio: any) {
  const response = await captureStorageRequest(
    `/object/${
      encodeURIComponent(audio.bucket || audioBucket())
    }/${audio.object_path}`,
    { method: "DELETE" },
  );
  if (response.ok || await isMissingStorageObject(response)) return;
  throw new HttpError(
    503,
    "Audio cleanup is retryable",
    "audio_deletion_retryable",
  );
}

async function markRecordingAudioExpired(
  row: any,
  expiredAt: string,
  retentionDays: number,
) {
  const previousAudio = row.audio ?? {};
  const expiredAudio = {
    stored: false,
    storage: "expired",
    bucket: previousAudio.bucket ?? audioBucket(),
    mime_type: previousAudio.mime_type ?? null,
    bytes: previousAudio.bytes ?? null,
    expired_at: expiredAt,
    retention_days: retentionDays,
  };
  const recording = row.recording && typeof row.recording === "object"
    ? row.recording
    : {};
  recording.audio = expiredAudio;
  recording.audio_retention = {
    status: "expired",
    expired_at: expiredAt,
    retention_days: retentionDays,
  };

  const retentionOwner = row.auth_user_id ?? recording.auth_user_id;
  if (retentionOwner) {
    await ordinaryTaskRpc(retentionOwner, "audio", row.id, {
      audio: expiredAudio,
      audio_retention: recording.audio_retention,
    });
    return;
  }
  await restRequest(
    `/throughline_recordings?id=eq.${encodeURIComponent(row.id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio: expiredAudio, recording }),
    },
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
      "?select=id,capture_id,created_at,user_local_time,duration_seconds,type,processing_status,transcript_raw,structured_note,audio",
      recordingScopeQuery(context),
      "&order=created_at.desc",
      "&limit=1000",
    ].join(""),
  );

  if (!Array.isArray(rows)) return [];
  return rows.map((recording) => ({
    id: recording.id,
    capture_id: recording.capture_id ?? null,
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
  return Array.isArray(rows)
    ? rows.map((row) => feedbackSummary(row.feedback))
    : [];
}

async function listProductFeedback() {
  const rows = await restRequest(
    [
      "/throughline_product_feedback",
      "?select=id,auth_user_id,created_at,source,category,message,contact_allowed,status,app_version,build_number,context",
      "&order=created_at.desc",
      "&limit=1000",
    ].join(""),
  );
  return Array.isArray(rows) ? rows : [];
}

async function listMcpTokens(context: RequestContext) {
  const authUserId = requireAuthUser(context);
  const rows = await restRequest(
    [
      "/throughline_mcp_tokens",
      "?select=id,name,created_at,last_used_at,revoked_at",
      `&user_id=eq.${encodeURIComponent(authUserId)}`,
      "&revoked_at=is.null",
      "&order=created_at.desc",
      "&limit=100",
    ].join(""),
  );

  return {
    tokens: Array.isArray(rows) ? rows : [],
    count: Array.isArray(rows) ? rows.length : 0,
  };
}

async function createMcpToken(
  context: RequestContext,
  body: Record<string, unknown>,
) {
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

async function insertManyIgnoringDuplicates(
  table: string,
  payloads: Record<string, unknown>[],
) {
  await restRequest(`/${table}?on_conflict=id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(payloads),
  });
}

async function captureRpc(name: string, body: Record<string, unknown>) {
  return await restRequest(`/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function captureStorageRequest(path: string, options: RequestInit = {}) {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return await fetch(`${supabaseUrl()}/storage/v1${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...options.headers,
    },
  });
}

async function ordinaryTaskRpc(
  owner: string,
  operation: string,
  recordingID: string | null = null,
  payload: unknown = {},
) {
  return taskResult(
    await restRequest("/rpc/throughline_tasks_v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        p_owner: owner,
        p_operation: operation,
        p_recording_id: recordingID,
        p_payload: payload,
      }),
    }),
  );
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
    throw new Error(
      `Supabase request failed (${response.status}): ${responseText}`,
    );
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
    quality_score: feedback.answers?.quality_score ?? null,
    issue_types: feedback.answers?.issue_types ?? [],
    agent_ready: feedback.answers?.agent_ready ?? null,
    should_remember: feedback.answers?.should_remember ?? null,
  };
}

function feedbackStatus(
  expected: unknown,
  qualityScore: number | null,
  issueTypes: string[],
  correction: string | null,
) {
  if (expected && typeof expected === "object") return "eval_candidate";
  if (qualityScore !== null && qualityScore <= 3) return "needs_review";
  if (issueTypes.length || correction) return "needs_review";
  if (qualityScore !== null) return "graded";
  return "needs_review";
}

function normalizeExtraction(raw: any, metadata: Record<string, unknown> = {}) {
  return normalizeContractExtraction(raw, metadata);
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
    user_local_date: userLocalDateFromTime(recording.user_local_time) ||
      new Date(recording.created_at).toISOString().slice(0, 10),
    scenario: recording.type || "freeform",
    recording_context: recording.upload_source || "unknown",
  };
}

function logRecordingHealth(
  phase: "processing_started" | "processing_finished",
  recording: any,
  audioBytes: Uint8Array | null,
  startedAt?: number,
) {
  const note = recording.structured_note;
  console.log(JSON.stringify({
    event: `recording_${phase}`,
    recording_kind: recording.upload_source === "demo" ? "demo" : "signed_in",
    processing_status: recording.processing_status,
    duration_bucket: durationBucket(recording.duration_seconds),
    audio_size_bucket: byteSizeBucket(audioBytes?.byteLength ?? 0),
    has_transcript: Boolean(recording.transcript_raw),
    has_structured_note: Boolean(note),
    structured_item_count: note
      ? (note.most_important?.length ?? 0) + (note.todos?.length ?? 0)
      : 0,
    latency_ms: startedAt === undefined
      ? null
      : Math.round(performance.now() - startedAt),
  }));
}

function durationBucket(value: unknown) {
  const seconds = nullableNumber(value);
  if (seconds === null) return "unknown";
  if (seconds < 5) return "under_5_seconds";
  if (seconds < 15) return "5_to_14_seconds";
  if (seconds < 60) return "15_to_59_seconds";
  return "60_seconds_or_more";
}

function byteSizeBucket(bytes: number) {
  if (bytes <= 0) return "none";
  if (bytes < 64 * 1024) return "under_64_kb";
  if (bytes < 512 * 1024) return "64_to_511_kb";
  if (bytes < 2 * 1024 * 1024) return "512_kb_to_1_9_mb";
  return "2_mb_or_more";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((
    item,
  ) => item.trim());
}

function deriveActionItems(actual: any) {
  const items: any[] = [];

  for (const todo of actual.todos ?? []) {
    addActionItem(items, todo.text, "todo", todo.status, todo.completed_at);
  }

  actual.action_items = items;
}

function addActionItem(
  items: any[],
  candidate: unknown,
  source: string,
  status: unknown = null,
  completedAt: unknown = null,
) {
  const text = nullableString(candidate);
  if (!text) return;

  const key = normalizeForComparison(text);
  if (!key || items.some((item) => normalizeForComparison(item.text) === key)) {
    return;
  }

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

function updateActionItemCompletion(
  note: any,
  text: string,
  completed: boolean,
) {
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

function updatedCanonicalTodoState(
  value: unknown,
  text: string,
  completed: boolean,
) {
  const todos = Array.isArray(value) ? structuredClone(value) : [];
  const key = normalizeForComparison(text);
  for (const todo of todos) {
    if (!todo || typeof todo !== "object") continue;
    if (normalizeForComparison(String(todo.text ?? "")) !== key) continue;
    todo.status = completed ? "completed" : "open";
  }
  return todos;
}

function applyRecordingEdits(recording: any, body: any) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Recording edit body must be an object");
  }

  recording.structured_note = recording.structured_note ||
    emptyStructuredNote(recording);
  const note = recording.structured_note;

  if (
    Object.hasOwn(body, "transcript") || Object.hasOwn(body, "transcript_raw")
  ) {
    recording.transcript_raw = editString(
      body.transcript ?? body.transcript_raw,
      "Transcript",
    );
  }

  if (Object.hasOwn(body, "title")) {
    const title = editString(body.title, "Title").slice(0, 80);
    if (!title) throw new HttpError(400, "Title cannot be empty");
    note.title = title;
  }

  if (Object.hasOwn(body, "summary")) {
    note.summary = editString(body.summary, "Summary");
  }

  if (Object.hasOwn(body, "type")) {
    const type = normalizeType(body.type);
    if (!type) throw new HttpError(400, "Recording type is invalid");
    recording.type = type;
    note.type = type;
  }

  const shouldRefreshActionItems = Object.hasOwn(body, "most_important") ||
    Object.hasOwn(body, "todos");

  if (Object.hasOwn(body, "most_important")) {
    note.most_important = normalizeEditedStrings(
      body.most_important,
      "Most important",
    ).slice(0, 5);
  }

  if (Object.hasOwn(body, "todos")) {
    note.todos = normalizeEditedTodos(body.todos, note.todos ?? []);
  }

  if (Object.hasOwn(body, "tomorrow_todos")) {
    note.tomorrow_todos = normalizeEditedStrings(
      body.tomorrow_todos,
      "Tomorrow todos",
    );
  } else if (Object.hasOwn(body, "todos")) {
    note.tomorrow_todos = [];
  }

  if (shouldRefreshActionItems) {
    refreshActionItems(note);
  }

  const editedAt = new Date().toISOString();
  note.edited_at = editedAt;
  recording.edited_at = editedAt;
  recording.processing_status = recording.structured_note
    ? "processed"
    : recording.processing_status;
}

function isCurrentEvaluationMutation(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return [
    "expected_current_revision_id",
    "idempotency_key",
    "notice_version",
    "disclosure_version",
    "policy_version",
  ].every((key) => Object.hasOwn(value, key));
}

function assertCurrentMutationFields(body: Record<string, unknown>) {
  if (!normalizedUuid(body.idempotency_key)) {
    throw new HttpError(
      422,
      "A valid idempotency_key is required",
      "user_mutation_idempotency_key_invalid",
    );
  }
  for (
    const forbidden of [
      "type",
      "priorities",
      "intentions",
      "accomplishments",
      "tomorrow_todos",
      "mood",
      "people",
      "projects",
      "tags",
      "centers_of_balance",
    ]
  ) {
    if (Object.hasOwn(body, forbidden)) {
      throw new HttpError(
        422,
        "Only fields shown in the current edit form can be corrected",
        "user_mutation_field_not_editable",
      );
    }
  }
}

function structuredNoteForCanonicalSnapshot(
  canonicalSnapshot: Record<string, unknown>,
) {
  const note = structuredClone(canonicalSnapshot) as any;
  note.action_items = [];
  refreshActionItems(note);
  note.edited_at = new Date().toISOString();
  return note;
}

function emptyStructuredNote(recording: any) {
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

function editString(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${label} must be a string`);
  }

  return value.trim();
}

function normalizeEditedStrings(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${label} must be an array`);
  }

  const values: string[] = [];
  const seen = new Set<string>();
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

function normalizeEditedTodos(value: unknown, previousTodos: any[]) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Todos must be an array");
  }

  const previousByText = new Map(
    (previousTodos ?? []).map((
      todo: any,
    ) => [normalizeForComparison(todo.text), todo]),
  );
  const todos: any[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    const text = typeof item === "string"
      ? item.trim()
      : nullableString(item?.text);
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
      context: nullableString(item?.context ?? previous?.context) ||
        "manual_edit",
      completed_at: status === "completed"
        ? nullableString(item?.completed_at ?? previous?.completed_at)
        : null,
    });
    seen.add(key);
  }

  return todos;
}

function refreshActionItems(note: any) {
  const previousByText = new Map<string, any>(
    (note.action_items ?? []).map(
      (item: any): [string, any] => [normalizeForComparison(item.text), item],
    ),
  );
  const items: any[] = [];

  for (const todo of note.todos ?? []) {
    addEditedActionItem(
      items,
      todo.text,
      "todo",
      todo.status,
      todo.completed_at,
      previousByText,
    );
  }

  for (const text of note.most_important ?? []) {
    addEditedActionItem(
      items,
      text,
      "most_important",
      null,
      null,
      previousByText,
    );
  }

  note.action_items = items;
}

function addEditedActionItem(
  items: any[],
  candidate: unknown,
  source: string,
  status: unknown = null,
  completedAt: unknown = null,
  previousByText = new Map<string, any>(),
) {
  const text = nullableString(candidate);
  if (!text) return;

  const key = normalizeForComparison(text);
  if (!key || items.some((item) => normalizeForComparison(item.text) === key)) {
    return;
  }

  const previous = previousByText.get(key);
  const normalizedStatus = normalizeCompletionStatus(
    status ?? previous?.status,
  );
  items.push({
    id: previous?.id || stableActionItemId(text),
    text,
    status: normalizedStatus,
    source,
    completed_at: normalizedStatus === "completed"
      ? nullableString(completedAt ?? previous?.completed_at)
      : null,
  });
}

function normalizeCompletionStatus(value: unknown) {
  return value === "completed" || value === "done" ? "completed" : "open";
}

function normalizeTodoPriority(value: unknown) {
  return typeof value === "string" && VALID_PRIORITIES.has(value)
    ? value
    : null;
}

function stableActionItemId(text: string) {
  const normalized = normalizeForComparison(text)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `act_${normalized.slice(0, 80) || randomHex(4)}`;
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
  if (!expectedTokens.length) return false;

  const headerToken = req.headers.get("x-throughline-api-key") || "";
  return [bearerToken(req), headerToken].some((candidate) =>
    expectedTokens.some((expected) => safeTokenEqual(candidate, expected))
  );
}

function requireServiceContext(context: RequestContext) {
  if (context.kind !== "service") {
    throw new HttpError(403, "A service token is required");
  }
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
  return context?.authUserId
    ? `&auth_user_id=eq.${encodeURIComponent(context.authUserId)}`
    : "";
}

function feedbackScopeQuery(context?: RequestContext) {
  return context?.authUserId
    ? `&auth_user_id=eq.${encodeURIComponent(context.authUserId)}`
    : "";
}

function processingMode(req: Request) {
  const value = req.headers.get("x-throughline-processing-mode")?.toLowerCase()
    .trim();
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

async function parseJsonRequest(req: Request, maxBytes?: number) {
  const text = await req.text();
  if (maxBytes && new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, `Request body exceeds ${maxBytes} bytes`);
  }
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

function createProductFeedbackId() {
  return `pfb_${Date.now().toString(36)}_${randomHex(6)}`;
}

function hasStructuredNote(recording: object) {
  return "structured_note" in recording && Boolean(recording.structured_note);
}

function arrayBufferFromBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function normalizedIdentifier(
  value: unknown,
  prefix: string,
  maxLength: number,
) {
  const candidate = limitedString(value, maxLength);
  if (!candidate || !candidate.startsWith(prefix)) return null;
  return /^[a-z0-9_-]+$/i.test(candidate) ? candidate : null;
}

function normalizedUuid(value: unknown) {
  const candidate = nullableString(value)?.toLowerCase() ?? null;
  if (!candidate) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      .test(candidate)
    ? candidate
    : null;
}

function normalizedClientTimestamp(value: unknown) {
  const candidate = nullableString(value);
  if (!candidate) return null;

  const milliseconds = Date.parse(candidate);
  if (!Number.isFinite(milliseconds)) return null;

  const now = Date.now();
  const earliest = now - 90 * 24 * 60 * 60 * 1000;
  const latest = now + 10 * 60 * 1000;
  if (milliseconds < earliest || milliseconds > latest) return null;
  return new Date(milliseconds).toISOString();
}

function limitedString(value: unknown, maxLength: number) {
  const candidate = nullableString(value);
  return candidate ? candidate.slice(0, maxLength) : null;
}

function normalizedEventProperties(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const output: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, 24)) {
    const key = rawKey.trim().slice(0, 64);
    if (!/^[a-z][a-z0-9_]*$/i.test(key)) continue;

    if (typeof rawValue === "string") {
      output[key] = rawValue.slice(0, 256);
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      output[key] = rawValue;
    } else if (typeof rawValue === "boolean") {
      output[key] = rawValue;
    }
  }
  return output;
}

function randomHex(byteCount: number) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
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
  if (pathname.startsWith(`${functionPrefix}/`)) {
    return pathname.slice(functionPrefix.length) || "/";
  }
  if (pathname.startsWith(`${localPrefix}/`)) {
    return pathname.slice(localPrefix.length) || "/";
  }
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
      "X-Throughline-Capture-Id",
      "X-Throughline-Audio-Sha256",
      "X-Throughline-Audio-Bytes",
      "X-Throughline-Captured-At",
      "X-Throughline-Deletion-Token",
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

function normalizeQualityScore(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number)) return null;
  return Math.min(5, Math.max(1, number));
}

function normalizeType(value: unknown) {
  return typeof value === "string" && RECORDING_TYPES.has(value) ? value : null;
}

function userLocalDateFromTime(userLocalTime: unknown) {
  if (typeof userLocalTime !== "string") return null;

  const match = userLocalTime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
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
  if (
    cleanMime.includes("mp4") || cleanMime.includes("m4a") ||
    cleanMime.includes("aac")
  ) return "m4a";
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
  return Deno.env.get("THROUGHLINE_AUDIO_BUCKET") ||
    Deno.env.get("SUPABASE_AUDIO_BUCKET") || DEFAULT_AUDIO_BUCKET;
}

function postHogCaptureConfig(): PostHogCaptureConfig {
  return {
    projectToken: Deno.env.get("POSTHOG_PROJECT_TOKEN") || "",
    ingestHost: Deno.env.get("POSTHOG_INGEST_HOST") ||
      DEFAULT_POSTHOG_INGEST_HOST,
    analyticsIdSecret: Deno.env.get("THROUGHLINE_ANALYTICS_ID_SECRET") || "",
    environment: Deno.env.get("THROUGHLINE_ENVIRONMENT") || "production",
  };
}

function postHogDeletionConfig(): PostHogDeletionConfig {
  return {
    personalApiKey: Deno.env.get("POSTHOG_PERSONAL_API_KEY") || "",
    apiHost: Deno.env.get("POSTHOG_API_HOST") || DEFAULT_POSTHOG_API_HOST,
    projectId: Deno.env.get("POSTHOG_PROJECT_ID") || "",
    analyticsIdSecret: Deno.env.get("THROUGHLINE_ANALYTICS_ID_SECRET") || "",
  };
}

function positiveNumberEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name) || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function supabaseClientApiKey() {
  return Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
}

function supabaseUrl() {
  return trimTrailingSlash(Deno.env.get("SUPABASE_URL") || "");
}

function trimTrailingSlash(value: string) {
  return String(value ?? "").replace(/\/+$/, "");
}
