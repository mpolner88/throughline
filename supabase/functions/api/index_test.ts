import { handleRequestResponse } from "./index.ts";

const AUTH_USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const EVENT_ID = "evt_00000000-0000-4000-8000-000000000003";
const RECORDING_ID = "rec_owned_recording";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function setTestEnvironment() {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
}

function requestWithEvents(events: unknown[]) {
  return new Request("https://edge.test/functions/v1/api/events", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-token-test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ events }),
  });
}

function schemaV2Event(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    session_id: SESSION_ID,
    occurred_at: new Date().toISOString(),
    event_name: "recording_processed",
    schema_version: 2,
    distribution_channel: "testflight",
    recording_id: RECORDING_ID,
    ...overrides,
  };
}

function installFetchMock(options: {
  allowlist?: "hit" | "miss" | "failure";
  recording?: "owned" | "missing";
}) {
  const requests: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url: target, body });

    if (target.endsWith("/auth/v1/user")) {
      return Promise.resolve(Response.json({ id: AUTH_USER_ID }));
    }
    if (target.includes("/throughline_internal_users?")) {
      if (options.allowlist === "failure") {
        return Promise.resolve(new Response("unavailable", { status: 503 }));
      }
      return Promise.resolve(Response.json(
        options.allowlist === "miss" ? [] : [{ auth_user_id: AUTH_USER_ID }],
      ));
    }
    if (target.includes("/throughline_recordings?")) {
      return Promise.resolve(Response.json(
        options.recording === "missing" ? [] : [{ id: RECORDING_ID }],
      ));
    }
    if (target.includes("/throughline_product_events?")) {
      return Promise.resolve(new Response(null, { status: 201 }));
    }
    throw new Error(`Unexpected request: ${target}`);
  }) as typeof fetch;

  return {
    requests,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

(globalThis as Record<string, unknown>).EdgeRuntime = {
  waitUntil(promise: Promise<unknown>) {
    void promise;
  },
};

Deno.test("event ingestion derives trusted attribution once and discards forged fields", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "hit", recording: "owned" });
  try {
    const response = await handleRequestResponse(requestWithEvents([
      schemaV2Event({
        is_internal_user: false,
        properties: {
          is_internal_user: false,
          schema_version: 1,
          distribution_channel: "app_store",
          recording_id: "rec_forged_property",
          surface: "home",
        },
      }),
      schemaV2Event({ id: "evt_00000000-0000-4000-8000-000000000004" }),
    ]));

    assert(response.status === 202, "Expected accepted response");
    const allowlistRequests = mock.requests.filter((request) =>
      request.url.includes("/throughline_internal_users?")
    );
    assert(allowlistRequests.length === 1, "Allowlist lookup must occur once");

    const insertRequest = mock.requests.find((request) =>
      request.url.includes("/throughline_product_events?")
    );
    const rows = insertRequest?.body as Array<Record<string, unknown>>;
    assert(rows?.length === 2, "Expected two persisted rows");
    assert(rows[0].schema_version === 2, "Expected normalized schema version");
    assert(
      rows[0].distribution_channel === "testflight",
      "Expected normalized distribution channel",
    );
    assert(
      rows[0].is_internal_user === true,
      "Expected server allowlist result",
    );
    assert(
      rows[0].recording_id === RECORDING_ID,
      "Expected validated reference",
    );
    assert(
      !JSON.stringify(rows[0].properties).includes("forged"),
      "Reserved property survived",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("schema-v2 recording references require authenticated ownership", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "miss", recording: "missing" });
  try {
    const response = await handleRequestResponse(
      requestWithEvents([schemaV2Event()]),
    );
    assert(response.status === 403, "Unowned reference must be rejected");
  } finally {
    mock.restore();
  }
});

Deno.test("allowlist failures remain retryable and do not classify traffic as external", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "failure", recording: "owned" });
  try {
    const response = await handleRequestResponse(
      requestWithEvents([schemaV2Event()]),
    );
    assert(response.status === 503, "Allowlist failure must be retryable");
  } finally {
    mock.restore();
  }
});

Deno.test("legacy schema-v1 events remain compatible without a recording reference", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "miss", recording: "owned" });
  try {
    const response = await handleRequestResponse(requestWithEvents([{
      id: EVENT_ID,
      session_id: SESSION_ID,
      occurred_at: new Date().toISOString(),
      event_name: "recording_processed",
      distribution_channel: "app_store",
      recording_id: RECORDING_ID,
    }]));
    assert(response.status === 202, "Legacy event must remain accepted");
    const insertRequest = mock.requests.find((request) =>
      request.url.includes("/throughline_product_events?")
    );
    const row = (insertRequest?.body as Array<Record<string, unknown>>)[0];
    assert(row.schema_version === 1, "Legacy schema must remain v1");
    assert(
      row.distribution_channel === "unknown",
      "Legacy channel must be unknown",
    );
    assert(row.recording_id === null, "Legacy reference must be dropped");
  } finally {
    mock.restore();
  }
});
