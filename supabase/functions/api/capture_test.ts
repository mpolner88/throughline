import { captureDigest, captureUpload } from "./capture.ts";
import { normalizeProductEventContract } from "../_shared/product-event-contract.ts";
import { buildPostHogBatch } from "../_shared/posthog.ts";
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const bytes = new Uint8Array([1, 2, 3, 4]);
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
async function request(overrides: Record<string, string> = {}) {
  return new Request("https://edge.test/recordings", {
    method: "POST",
    headers: {
      "x-throughline-capture-id": id,
      "x-throughline-audio-sha256": await captureDigest(bytes),
      "x-throughline-audio-bytes": "4",
      "x-throughline-captured-at": "2026-09-29T10:00:00Z",
      "x-throughline-user-local-time": "2026-09-29T03:00:00-07:00",
      "x-throughline-timezone": "America/Los_Angeles",
      "content-type": "audio/mp4",
      ...overrides,
    },
    body: bytes,
  });
}
function harness() {
  const reservations = new Map<string, any>();
  const objects = new Map<string, Uint8Array>();
  let processing = 0, uploads = 0, deleted = false, hold = false, fail = "";
  const context = {
    kind: "user" as const,
    authUserId: owner,
    legacyUserId: owner,
  };
  const deps = {
    rpc: async (name: string, p: any) => {
      const key = p.p_owner + ":" + p.p_capture;
      if (hold) return { capture_outcome: "account_deletion_pending" };
      if (deleted) {
        return {
          capture_outcome: "owner_deleted",
          owner_deleted: {
            owner_id: p.p_owner,
            capture_id: p.p_capture,
            deleted_at: "2026-09-29T11:00:00Z",
          },
        };
      }
      if (name.includes("reserve")) {
        if (fail === "reservation") {
          fail = "";
          throw new Error("injected");
        }
        let r = reservations.get(key);
        if (!r) {
          r = {
            digest: p.p_sha256,
            metadata: p.p_metadata,
            recording_id: "rec_" + reservations.size,
            object_token: crypto.randomUUID(),
          };
          reservations.set(key, r);
        }
        if (
          r.digest !== p.p_sha256 ||
          JSON.stringify(r.metadata) !== JSON.stringify(p.p_metadata)
        ) return { capture_outcome: "conflict" };
        if (r.receipt) {
          return { capture_outcome: "accepted", capture_receipt: r.receipt };
        }
        return {
          capture_outcome: "incomplete",
          recording_id: r.recording_id,
          object_token: r.object_token,
        };
      }
      if (fail === "acceptance") {
        fail = "";
        throw new Error("injected");
      }
      const r = reservations.get(key);
      if (r.receipt) {
        return { capture_outcome: "accepted", capture_receipt: r.receipt };
      }
      r.receipt = {
        version: 1,
        owner_id: p.p_owner,
        capture_id: p.p_capture,
        recording_id: r.recording_id,
        accepted_at: "2026-09-29T11:00:00Z",
        audio_sha256: r.digest,
        audio_bytes: 4,
        captured_at: r.metadata.captured_at,
      };
      if (fail === "response") {
        fail = "";
        throw new Error("injected");
      }
      return {
        capture_outcome: "accepted",
        capture_receipt: r.receipt,
        processing_claim: true,
      };
    },
    storage: async (path: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        assert(
          (options.headers as Record<string, string>)["x-upsert"] === "false",
          "Overwrite forbidden",
        );
        if (fail === "storage") {
          fail = "";
          return new Response(null, { status: 503 });
        }
        if (objects.has(path)) return new Response(null, { status: 409 });
        uploads++;
        objects.set(path, new Uint8Array(options.body as ArrayBuffer));
        return new Response(null, { status: 200 });
      }
      const object = objects.get(path);
      return object
        ? new Response(new Uint8Array(object))
        : new Response(null, { status: 404 });
    },
    process: async () => {
      processing++;
    },
    enqueue: (_: Promise<unknown>) => {},
  };
  return {
    deps,
    context,
    reservations,
    objects,
    get processing() {
      return processing;
    },
    get uploads() {
      return uploads;
    },
    set fail(v: string) {
      fail = v;
    },
    set deleted(v: boolean) {
      deleted = v;
    },
    set hold(v: boolean) {
      hold = v;
    },
  };
}
Deno.test("concurrent capture retries preserve one object, one receipt and one processing start", async () => {
  const h = harness();
  const results = await Promise.all(
    Array.from(
      { length: 12 },
      async () => captureUpload(await request(), bytes, h.context, h.deps),
    ),
  );
  assert(
    h.reservations.size === 1 && h.uploads === 1 && h.processing === 1,
    "Expected one durable acceptance",
  );
  assert(results.every((r) => r.status === 202), "All replays accepted");
  assert(
    new Set(results.map((r) => JSON.stringify(r.body.capture_receipt))).size ===
      1,
    "Receipt immutable",
  );
});
for (const boundary of ["reservation", "storage", "acceptance", "response"]) {
  Deno.test(`capture resumes after injected ${boundary} failure without overwrite`, async () => {
    const h = harness();
    h.fail = boundary;
    const first = await captureUpload(
      await request(),
      bytes,
      h.context,
      h.deps,
    );
    assert(first.status === 503, "Expected retryable failure");
    const retry = await captureUpload(
      await request(),
      bytes,
      h.context,
      h.deps,
    );
    assert(
      retry.status === 202 && h.uploads === 1 && h.reservations.size === 1,
      "Replay must converge",
    );
    assert(
      h.processing <= 1,
      "Claim cannot repeat; lost response may leave saved unfinished row",
    );
  });
}
Deno.test("accepted receipt survives audio retention with zero storage accesses", async () => {
  const h = harness();
  const first = await captureUpload(await request(), bytes, h.context, h.deps);
  h.objects.clear();
  const retry = await captureUpload(await request(), bytes, h.context, {
    ...h.deps,
    storage: () => {
      throw new Error("Storage forbidden for accepted replay");
    },
  });
  assert(
    JSON.stringify(first.body.capture_receipt) ===
      JSON.stringify(retry.body.capture_receipt),
    "Same receipt after retention",
  );
  assert(
    h.uploads === 1 && h.processing === 1,
    "No second write or processing",
  );
});
Deno.test("metadata or digest conflict never changes prior acceptance", async () => {
  const h = harness();
  await captureUpload(await request(), bytes, h.context, h.deps);
  const result = await captureUpload(
    await request({ "x-throughline-timezone": "UTC" }),
    bytes,
    h.context,
    h.deps,
  );
  assert(
    result.status === 409 && h.uploads === 1 && h.processing === 1,
    "Conflict must preserve prior capture",
  );
  const wrong = await captureUpload(
    await request({ "x-throughline-audio-sha256": "f".repeat(64) }),
    bytes,
    h.context,
    h.deps,
  );
  assert(wrong.status === 409, "Server must digest exact body");
});
Deno.test("service context and zero audio refuse before reservation", async () => {
  const h = harness();
  assert(
    (await captureUpload(await request(), bytes, {
      ...h.context,
      kind: "service",
    }, h.deps)).status === 403,
    "Service cannot capture",
  );
  assert(
    (await captureUpload(
      await request({ "x-throughline-audio-bytes": "0" }),
      new Uint8Array(),
      h.context,
      h.deps,
    )).status === 400,
    "Empty refused",
  );
  assert(h.reservations.size === 0, "No reservation on refusal");
});
Deno.test("cross-owner capture reuse is isolated and deletion replay cannot resurrect", async () => {
  const h = harness();
  await captureUpload(await request(), bytes, h.context, h.deps);
  const second = await captureUpload(await request(), bytes, {
    ...h.context,
    authUserId: other,
    legacyUserId: other,
  }, h.deps);
  assert(
    (second.body.capture_receipt as any).owner_id === other &&
      h.reservations.size === 2,
    "Separate owner namespace",
  );
  h.deleted = true;
  const replay = await captureUpload(await request(), bytes, h.context, h.deps);
  assert(
    replay.body.capture_outcome === "owner_deleted" && h.uploads === 2,
    "Deleted replay cannot write",
  );
  h.deleted = false;
  h.hold = true;
  assert(
    (await captureUpload(await request(), bytes, h.context, h.deps)).status ===
      503,
    "Deletion hold blocks replay",
  );
});
Deno.test("existing mismatched storage bytes fail closed before acceptance", async () => {
  const h = harness();
  h.fail = "acceptance";
  await captureUpload(await request(), bytes, h.context, h.deps);
  for (const key of h.objects.keys()) {
    h.objects.set(key, new Uint8Array([7, 7, 7, 7]));
  }
  const result = await captureUpload(await request(), bytes, h.context, h.deps);
  assert(
    result.status === 409 && h.processing === 0 && h.uploads === 1,
    "No overwrite or processing of mismatched object",
  );
});
Deno.test("capture analytics drops every private identifier and accepts only bounded categories", async () => {
  const contract = normalizeProductEventContract({
    event_name: "capture_upload_attempt_failed",
    schema_version: 2,
    properties: {
      reason: "offline",
      attempt_bucket: "4_or_more",
      capture_id: id,
      file_token: id,
      audio_sha256: "f".repeat(64),
      owner_id: owner,
      message: "PRIVATE_SYNTHETIC",
    },
  });
  assert(
    JSON.stringify(contract.properties) ===
      '{"reason":"offline","attempt_bucket":"4_or_more"}',
    "Only bounded fields",
  );
  const batch = await buildPostHogBatch([{
    ...contract,
    id: "evt_" + id,
    auth_user_id: owner,
    session_id: other,
    occurred_at: "2026-09-29T00:00:00Z",
    event_name: "capture_upload_attempt_failed",
    platform: "ios",
    app_version: null,
    build_number: null,
    is_internal_user: true,
  }], {
    projectToken: "synthetic",
    ingestHost: "https://analytics.test",
    analyticsIdSecret: "synthetic-hmac-secret",
    environment: "test",
  });
  const serialized = JSON.stringify(batch);
  assert(
    !serialized.includes(id) && !serialized.includes(owner) &&
      !serialized.includes(other),
    "Private identities must not reach PostHog",
  );
});

Deno.test("Storage compatibility HTTP400 missing-object response resumes but generic400 does not", async () => {
  const h = harness();
  const original = h.deps.storage;
  const compatibility = {
    ...h.deps,
    storage: async (path: string, options?: RequestInit) => {
      const response = await original(path, options);
      return response.status === 404
        ? Response.json({
          statusCode: "404",
          error: "not_found",
          message: "Object not found",
        }, { status: 400 })
        : response;
    },
  };
  const accepted = await captureUpload(
    await request(),
    bytes,
    h.context,
    compatibility,
  );
  assert(
    accepted.status === 202 && h.uploads === 1,
    "Exact missing object is safe to write",
  );
  const other = harness();
  const refused = await captureUpload(await request(), bytes, other.context, {
    ...other.deps,
    storage: async () => new Response(null, { status: 400 }),
  });
  assert(
    refused.status === 503 && other.uploads === 0,
    "Unknown400 never authorizes a write",
  );
});
