// Private capture protocol. No identifiers or payloads are logged by this module.
export type CaptureContext = {
  kind: "user" | "service";
  authUserId: string | null;
  legacyUserId: string;
};
type Dependencies = {
  rpc: (name: string, body: Record<string, unknown>) => Promise<any>;
  storage: (path: string, options?: RequestInit) => Promise<Response>;
  process: (recording: any, bytes: Uint8Array) => Promise<unknown>;
  enqueue: (promise: Promise<unknown>) => void;
};
export function validCaptureUUID(value: string | null): value is string {
  return !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}
export async function captureDigest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  return Array.from(
    new Uint8Array(hash),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function answer(status: number, body: Record<string, unknown>) {
  return { status, body };
}
export async function captureUpload(
  req: Request,
  bytes: Uint8Array,
  context: CaptureContext,
  deps: Dependencies,
) {
  if (context.kind !== "user" || !context.authUserId) {
    return answer(403, { error_code: "capture_user_required" });
  }
  const capture = req.headers.get("x-throughline-capture-id")?.toLowerCase() ??
    null;
  const sha = req.headers.get("x-throughline-audio-sha256");
  const byteCount = req.headers.get("x-throughline-audio-bytes");
  const capturedAt = req.headers.get("x-throughline-captured-at");
  const mime = (req.headers.get("content-type") || "application/octet-stream")
    .split(";")[0].trim();
  const local = req.headers.get("x-throughline-user-local-time");
  const timezone = req.headers.get("x-throughline-timezone");
  const durationHeader = req.headers.get("x-throughline-duration-seconds");
  const duration = durationHeader === null ? null : Number(durationHeader);
  const type = req.headers.get("x-throughline-recording-type") || "freeform";
  if (
    !validCaptureUUID(capture) || !sha || !/^[0-9a-f]{64}$/.test(sha) ||
    !byteCount || !/^[1-9][0-9]*$/.test(byteCount) ||
    Number(byteCount) !== bytes.byteLength ||
    bytes.byteLength === 0 || !capturedAt ||
    !Number.isFinite(Date.parse(capturedAt)) ||
    !local || local.length > 100 || !timezone || timezone.length > 100 ||
    (duration !== null && (!Number.isFinite(duration) || duration < 0)) ||
    !["morning", "evening", "weekly_review", "freeform"].includes(type) ||
    mime.includes("json") || mime.length > 100
  ) return answer(400, { error_code: "capture_invalid_payload" });
  if (await captureDigest(bytes) !== sha) {
    return answer(409, {
      capture_outcome: "conflict",
      error_code: "capture_payload_conflict",
    });
  }
  const metadata = {
    captured_at: new Date(capturedAt).toISOString(),
    user_local_time: local,
    timezone,
    duration_seconds: duration,
    type,
    mime_type: mime,
  };
  let reservation;
  try {
    reservation = await deps.rpc("throughline_reserve_capture_v1", {
      p_owner: context.authUserId,
      p_capture: capture,
      p_sha256: sha,
      p_bytes: bytes.byteLength,
      p_metadata: metadata,
    });
    if (reservation.capture_outcome !== "incomplete") {
      return captureAnswer(reservation);
    }
    const objectPath = `captures/${reservation.object_token}`;
    const objectURL = `/object/throughline-audio/${objectPath}`;
    // Read first so resuming after the storage commit never writes again.
    let stored = await deps.storage(objectURL);
    if (await isMissingStorageObject(stored)) {
      const upload = await deps.storage(objectURL, {
        method: "POST",
        headers: { "Content-Type": mime, "x-upsert": "false" },
        body: new Uint8Array(bytes).buffer,
      });
      if (!upload.ok) {
        // Another identical request may have won. Only verified bytes permit
        // acceptance; neither a duplicate error nor metadata is sufficient.
        stored = await deps.storage(objectURL);
      } else stored = await deps.storage(objectURL);
    }
    if (!stored.ok) {
      return answer(503, {
        capture_outcome: "incomplete",
        error_code: "capture_storage_retryable",
      });
    }
    const existing = new Uint8Array(await stored.arrayBuffer());
    if (
      existing.byteLength !== bytes.byteLength ||
      await captureDigest(existing) !== sha
    ) {
      return answer(409, {
        capture_outcome: "conflict",
        error_code: "capture_payload_conflict",
      });
    }
    const recording = {
      id: reservation.recording_id,
      user_id: context.legacyUserId,
      auth_user_id: context.authUserId,
      capture_id: capture,
      created_at: metadata.captured_at,
      user_local_time: local,
      timezone,
      duration_seconds: duration,
      type,
      transcript_raw: null,
      upload_source: "raw",
      status: "uploaded",
      processing_status: "uploaded",
      audio: {
        stored: true,
        storage: "supabase",
        bucket: "throughline-audio",
        object_path: objectPath,
        mime_type: mime,
        bytes: bytes.byteLength,
      },
    };
    const accepted = await deps.rpc("throughline_accept_capture_v1", {
      p_owner: context.authUserId,
      p_capture: capture,
      p_recording: recording,
    });
    if (accepted.processing_claim === true) {
      deps.enqueue(deps.process(recording, bytes).catch(() => undefined));
    }
    return captureAnswer(
      accepted,
      accepted.processing_claim === true ? recording : undefined,
    );
  } catch {
    // Transport failures say nothing definitive about the transaction outcome.
    return answer(503, {
      capture_outcome: "unconfirmed",
      error_code: "capture_retryable",
    });
  }
}
export async function isMissingStorageObject(response: Response) {
  if (response.status === 404) return true;
  // Storage's compatibility handler can transport a precise 404 as HTTP400.
  // Never treat generic 400/auth/network errors as object absence.
  if (response.status !== 400) return false;
  try {
    const body = await response.clone().json();
    return body?.code === "NoSuchKey" ||
      (String(body?.statusCode) === "404" && body?.error === "not_found");
  } catch {
    return false;
  }
}

export function captureAnswer(result: any, recording?: any) {
  const outcome = result?.capture_outcome;
  const status = outcome === "conflict"
    ? 409
    : outcome === "account_deletion_pending"
    ? 503
    : outcome === "accepted"
    ? 202
    : 200;
  if (outcome === "accepted") {
    const id = result.capture_receipt.recording_id;
    return answer(status, {
      capture_outcome: outcome,
      capture_receipt: result.capture_receipt,
      id,
      status: "uploaded",
      processing_status: "uploaded",
      has_note: false,
      recording_url: `/recordings/${id}`,
      ...(recording ? { recording } : {}),
    });
  }
  return answer(status, {
    capture_outcome: outcome,
    ...(result?.owner_deleted ? { owner_deleted: result.owner_deleted } : {}),
  });
}
