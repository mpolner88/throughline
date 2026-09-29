import { handleRequestResponse } from "./index.ts";
const owner = "00000000-0000-4000-8000-000000000081";
const token = "00000000-0000-4000-8000-000000000082";
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function setup() {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-role");
  Deno.env.set("SUPABASE_ANON_KEY", "synthetic-anon");
  for (
    const key of [
      "THROUGHLINE_API_TOKEN",
      "THROUGHLINE_EVAL_COMPATIBILITY_MODE",
      "THROUGHLINE_EVALUATION_RETENTION_ENABLED",
      "POSTHOG_PROJECT_TOKEN",
      "POSTHOG_API_KEY",
      "POSTHOG_PROJECT_API_KEY",
      "POSTHOG_ANALYTICS_ID_SECRET",
    ]
  ) Deno.env.delete(key);
}
function req(path: string, method = "GET", auth = true) {
  return new Request("https://edge.test/functions/v1/api" + path, {
    method,
    headers: {
      ...(auth ? { Authorization: "Bearer synthetic-user" } : {}),
      "x-throughline-deletion-token": token,
    },
  });
}
Deno.test("deletion resolution works after authentication is gone and hashes capability", async () => {
  setup();
  const original = fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url, init) => {
    calls.push(String(url));
    assert(
      String(url).endsWith("/rpc/throughline_account_deletion_status_v1"),
      "Resolution needs no user lookup",
    );
    const body = JSON.parse(String(init?.body));
    assert(
      /^[0-9a-f]{64}$/.test(body.p_token_sha256) &&
        !String(init?.body).includes(token),
      "Store only hashed capability",
    );
    return Response.json({ deletion_outcome: "deleted", deleted: true });
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(
      req("/account/deletion-status", "GET", false),
    );
    assert(
      response.status === 200 && (await response.json()).deleted === true,
      "Lost success can be confirmed",
    );
    assert(calls.length === 1, "Read-only resolution only");
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("unknown deletion capability never asserts survival or deletion", async () => {
  setup();
  const original = fetch;
  globalThis.fetch = (async () =>
    Response.json({
      deletion_outcome: "unknown",
      deleted: false,
    })) as typeof fetch;
  try {
    const response = await handleRequestResponse(
      req("/account/deletion-status", "GET", false),
    );
    const body = await response.json();
    assert(
      body.deletion_outcome === "unknown" && !body.deleted,
      "Hold must remain",
    );
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("account deletion establishes hold before touching remote records or incomplete objects", async () => {
  setup();
  const original = fetch;
  const calls: string[] = [];
  let pending = true;
  let orphan = true;
  globalThis.fetch = (async (url, init) => {
    const target = String(url);
    calls.push(target);
    if (target.endsWith("/auth/v1/user")) return Response.json({ id: owner });
    if (target.endsWith("/rpc/throughline_begin_account_deletion_v1")) {
      return Response.json({ deletion_outcome: "pending" });
    }
    assert(
      calls.some((c) =>
        c.endsWith("/rpc/throughline_begin_account_deletion_v1")
      ),
      "Hold must be first mutation",
    );
    if (target.includes("/throughline_recordings?")) return Response.json([]);
    if (
      target.includes("/throughline_capture_reservations?") &&
      init?.method !== "DELETE"
    ) {
      return Response.json(
        pending ? [{ capture_id: token, object_token: token }] : [],
      );
    }
    if (target.includes("/storage/v1/object/list/")) {
      const body = JSON.parse(String(init?.body));
      assert(
        body.prefix === owner + "/",
        "List only the deleting owner prefix",
      );
      return Response.json(
        orphan ? [{ id: token, name: "rec_synthetic_orphan.m4a" }] : [],
      );
    }
    if (target.endsWith("/rec_synthetic_orphan.m4a")) {
      orphan = false;
      return new Response(null, { status: 204 });
    }
    if (target.includes("/storage/v1/")) {
      return Response.json({ statusCode: "404", error: "not_found" }, {
        status: 400,
      });
    }
    if (
      target.includes("/throughline_capture_reservations?") &&
      init?.method === "DELETE"
    ) {
      pending = false;
      return new Response(null, { status: 204 });
    }
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    throw new Error("Unexpected synthetic request");
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(req("/account", "DELETE"));
    const body = await response.json();
    assert(
      response.status === 200 && body.deletion_outcome === "deleted",
      "Confirmed cleanup",
    );
    assert(!orphan, "Pre-hold legacy orphan without a row must be cleaned");
    assert(
      calls.at(-1)?.includes("/auth/v1/admin/users/"),
      "Auth deletion and receipt completion last",
    );
    assert(
      calls.some((c) => c.includes("/storage/v1/")),
      "Incomplete upload object cleaned",
    );
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("partial cleanup or lost deletion response returns uncertain and never refused", async () => {
  setup();
  const original = fetch;
  globalThis.fetch = (async (url) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return Response.json({ id: owner });
    if (target.endsWith("/rpc/throughline_begin_account_deletion_v1")) {
      return Response.json({ deletion_outcome: "pending" });
    }
    return new Response(null, { status: 503 });
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(req("/account", "DELETE"));
    assert(
      response.status === 503 &&
        (await response.json()).deletion_outcome === "uncertain",
      "Partial failure keeps hold",
    );
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("owner reconciliation returns current absence without a terminal no-save claim", async () => {
  setup();
  const original = fetch;
  globalThis.fetch = (async (url, init) => {
    if (String(url).endsWith("/auth/v1/user")) {
      return Response.json({ id: owner });
    }
    const body = JSON.parse(String(init?.body));
    assert(
      body.p_owner === owner && body.p_capture === token,
      "Owner derived from authenticated session",
    );
    return Response.json({ capture_outcome: "nothing_held" });
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(req("/captures/" + token));
    const body = await response.json();
    assert(
      body.capture_outcome === "nothing_held" && !body.authoritative,
      "Absence does not rule out in-flight acceptance",
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("legacy raw upload remains compatible without capture headers", async () => {
  setup();
  Deno.env.delete("GROQ_API_KEY");
  Deno.env.delete("THROUGHLINE_LINEAGE_WRITES_ENABLED");
  const original = fetch;
  let initialRows = 0;
  let finalPatches = 0;
  globalThis.fetch = (async (url, init) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) return Response.json({ id: owner });
    assert(
      !target.includes("/rpc/throughline_"),
      "Legacy needs no capture reservation",
    );
    if (target.includes("/storage/v1/object/")) {
      return Response.json({ stored: true });
    }
    if (target.includes("/throughline_recordings?on_conflict=id")) {
      initialRows++;
      return Response.json(JSON.parse(String(init?.body)));
    }
    if (
      target.includes("/throughline_recordings?id=eq.") &&
      init?.method === "PATCH"
    ) {
      finalPatches++;
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected legacy synthetic request");
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(
      new Request("https://edge.test/functions/v1/api/recordings", {
        method: "POST",
        headers: {
          Authorization: "Bearer synthetic-user",
          "Content-Type": "audio/mp4",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
    );
    const body = await response.json();
    assert(
      response.status === 201 && !!body.recording && !body.capture_receipt,
      "Old raw response preserved",
    );
    assert(
      initialRows === 1 && finalPatches === 1,
      "Create once and finish without upsert resurrection",
    );
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("capture extraction endpoint cannot bypass the one-time processing claim", async () => {
  setup();
  const original = fetch;
  let calls = 0;
  globalThis.fetch = (async (url) => {
    calls++;
    if (String(url).endsWith("/auth/v1/user")) {
      return Response.json({ id: owner });
    }
    return Response.json([{
      recording: {
        id: "rec_synthetic",
        capture_id: token,
        auth_user_id: owner,
      },
    }]);
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/rec_synthetic/extract",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer synthetic-user",
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      ),
    );
    assert(
      response.status === 409 &&
        (await response.json()).error_code ===
          "capture_processing_already_claimed" &&
        calls === 2,
      "No provider request or write on capture reprocessing",
    );
  } finally {
    globalThis.fetch = original;
  }
});
