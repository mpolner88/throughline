import {
  handleRequestResponse,
  resolveCurrentInferenceContract,
} from "./index.ts";
import { canonicalJson, sha256Hex } from "../../../core/inference-contract.mjs";

const AUTH_USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const EVENT_ID = "evt_00000000-0000-4000-8000-000000000003";
const RECORDING_ID = "rec_owned_recording";
const SECOND_RECORDING_ID = "rec_second_owned_recording";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function setTestEnvironment() {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
  Deno.env.delete("THROUGHLINE_API_TOKEN");
  Deno.env.delete("THROUGHLINE_LINEAGE_WRITES_ENABLED");
  Deno.env.delete("THROUGHLINE_EVALUATION_WRITES_ENABLED");
  Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ENABLED");
  Deno.env.delete("THROUGHLINE_EVAL_COMPATIBILITY_MODE");
  Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL");
  Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN");
  Deno.env.delete("THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS");
  Deno.env.delete("THROUGHLINE_EVALUATION_ARTIFACT_RECONCILIATION_LIMIT");
  Deno.env.delete("THROUGHLINE_EVALUATION_ARTIFACT_CLAIM_TTL_SECONDS");
  Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE");
  Deno.env.delete("GROQ_API_KEY");
}

Deno.test("production API resolves the frozen inference contract defaults", async () => {
  for (
    const name of [
      "GROQ_BASE_URL",
      "GROQ_MODEL",
      "GROQ_TRANSCRIPTION_MODEL",
      "GROQ_TIMEOUT_MS",
      "GROQ_MAX_RETRIES",
      "GROQ_TRANSCRIPTION_TIMEOUT_MS",
      "GROQ_TRANSCRIPTION_MAX_RETRIES",
    ]
  ) Deno.env.delete(name);

  const contract = await resolveCurrentInferenceContract();
  assert(contract.provider.name === "groq", "Expected Groq provider");
  assert(
    contract.provider.base_url === "https://api.groq.com/openai/v1",
    "Expected current Groq base URL",
  );
  assert(
    contract.transcription.model === "whisper-large-v3-turbo",
    "Expected current transcription model",
  );
  assert(
    contract.extraction.model === "openai/gpt-oss-120b",
    "Expected current extraction model",
  );
  assert(
    contract.prompt.sha256 ===
      "c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135",
    "Expected approved production prompt bytes",
  );
  assert(
    /^[0-9a-f]{64}$/.test(contract.contract_sha256),
    "Expected immutable contract identity",
  );
});

function requestWithEvents(
  events: unknown[],
  authorization = "Bearer user-token-test",
) {
  return new Request("https://edge.test/functions/v1/api/events", {
    method: "POST",
    headers: authorization
      ? {
        Authorization: authorization,
        "Content-Type": "application/json",
      }
      : {
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
  recording?: "owned" | "missing" | "failure" | "partial";
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
      if (options.recording === "failure") {
        return Promise.resolve(new Response("unavailable", { status: 503 }));
      }
      return Promise.resolve(Response.json(
        options.recording === "missing"
          ? []
          : options.recording === "partial"
          ? [{ id: RECORDING_ID }]
          : [{ id: RECORDING_ID }, { id: SECOND_RECORDING_ID }],
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
        app_version: AUTH_USER_ID,
        build_number: AUTH_USER_ID,
        properties: {
          is_internal_user: false,
          schema_version: 1,
          distribution_channel: "app_store",
          recording_id: "rec_forged_property",
          raw_content: "private note body must not persist",
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
      rows[0].app_version === null,
      "Invalid app version must not persist",
    );
    assert(
      rows[0].build_number === null,
      "Invalid build number must not persist",
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

Deno.test("recording lookup failures remain retryable and do not partially insert a batch", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "miss", recording: "failure" });
  try {
    const response = await handleRequestResponse(
      requestWithEvents([schemaV2Event()]),
    );
    assert(
      response.status === 503,
      "Recording lookup failure must be retryable",
    );
    assert(
      !mock.requests.some((request) =>
        request.url.includes("/throughline_product_events?")
      ),
      "Failed attribution batch must not insert any events",
    );
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
    assert(
      row.is_internal_user === false,
      "Confirmed allowlist miss must be false",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("anonymous and service legacy events remain internal-attribution unknown without allowlist calls", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ recording: "owned" });
  try {
    const legacyEvent = {
      id: EVENT_ID,
      session_id: SESSION_ID,
      occurred_at: new Date().toISOString(),
      event_name: "app_opened",
    };
    const anonymous = await handleRequestResponse(
      requestWithEvents([legacyEvent], ""),
    );
    Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
    const service = await handleRequestResponse(
      requestWithEvents(
        [{ ...legacyEvent, id: "evt_00000000-0000-4000-8000-000000000005" }],
        "Bearer service-token-test",
      ),
    );
    assert(
      anonymous.status === 202 && service.status === 202,
      "Legacy events must be accepted",
    );
    assert(
      !mock.requests.some((request) =>
        request.url.includes("/throughline_internal_users?")
      ),
      "Anonymous and service events must not query the allowlist",
    );
    const inserts = mock.requests.filter((request) =>
      request.url.includes("/throughline_product_events?")
    );
    assert(
      inserts.every((request) =>
        (request.body as Array<Record<string, unknown>>).every((row) =>
          row.is_internal_user === null
        )
      ),
      "Anonymous and service events must remain unknown",
    );
  } finally {
    Deno.env.delete("THROUGHLINE_API_TOKEN");
    mock.restore();
  }
});

Deno.test("a 50-event batch validates distinct recording references once and persists atomically", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "hit", recording: "owned" });
  try {
    const events = Array.from({ length: 50 }, (_, index) =>
      schemaV2Event({
        id: `evt_00000000-0000-4000-8000-${
          String(index + 10).padStart(12, "0")
        }`,
        recording_id: index % 2 === 0 ? RECORDING_ID : SECOND_RECORDING_ID,
      }));
    const response = await handleRequestResponse(requestWithEvents(events));
    assert(response.status === 202, "Expected accepted batch response");
    assert(
      mock.requests.filter((request) =>
        request.url.includes("/throughline_internal_users?")
      ).length === 1,
      "Allowlist lookup must occur once per authenticated batch",
    );
    assert(
      mock.requests.filter((request) =>
        request.url.includes("/throughline_recordings?")
      ).length === 1,
      "Distinct recording references must use one ownership lookup",
    );
    const insertRequest = mock.requests.find((request) =>
      request.url.includes("/throughline_product_events?")
    );
    assert(
      (insertRequest?.body as Array<unknown>).length === 50,
      "Validated batch must persist together",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("an unowned recording in a batch rejects every event before persistence", async () => {
  setTestEnvironment();
  const mock = installFetchMock({ allowlist: "hit", recording: "partial" });
  try {
    const response = await handleRequestResponse(requestWithEvents([
      schemaV2Event({ recording_id: RECORDING_ID }),
      schemaV2Event({
        id: "evt_00000000-0000-4000-8000-000000000006",
        recording_id: SECOND_RECORDING_ID,
      }),
    ]));
    assert(
      response.status === 403,
      "Unowned batch reference must reject the batch",
    );
    assert(
      !mock.requests.some((request) =>
        request.url.includes("/throughline_product_events?")
      ),
      "Unowned batch must not partially insert events",
    );
  } finally {
    mock.restore();
  }
});

Deno.test("owner recording detail exposes the current immutable revision", async () => {
  setTestEnvironment();
  const revisionID = "00000000-0000-4000-8000-000000000401";
  const originalFetch = globalThis.fetch;
  globalThis.fetch =
    (async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.endsWith("/auth/v1/user")) {
        return Response.json({ id: AUTH_USER_ID });
      }
      if (target.endsWith("/rpc/throughline_tasks_v1")) {
        const request = JSON.parse(String(init?.body));
        assert(
          request.p_owner === AUTH_USER_ID && request.p_operation === "detail",
          "Owner-scoped consistent detail",
        );
        return Response.json({
          recording: {
            id: RECORDING_ID,
            auth_user_id: AUTH_USER_ID,
            created_at: "2026-08-23T00:00:00.000Z",
            processing_status: "processed",
          },
          current_revision_id: revisionID,
        });
      }
      throw new Error("Unexpected request: " + target);
    }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID,
        { headers: { Authorization: "Bearer user-token-test" } },
      ),
    );
    assert(response.status === 200, "Expected owner recording detail");
    const body = await response.json();
    assert(body.recording.id === RECORDING_ID, "Expected recording payload");
    assert(
      body.current_revision_id === revisionID,
      "Expected exact current immutable revision",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("flagged processing commits immutable lineage before exposing the note", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_LINEAGE_WRITES_ENABLED", "true");
  Deno.env.set("GROQ_API_KEY", "provider-test-key");
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  const extraction = {
    type: "freeform",
    title: "Lineage test",
    summary: "Persist the immutable processing path.",
    most_important: ["Persist lineage"],
    todos: [],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "focused",
    people: [],
    projects: ["Throughline"],
    tags: ["lineage"],
    centers_of_balance: ["profession"],
  };
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    let body: unknown = null;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    requests.push({ url: target, body });
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (target.endsWith("/rpc/throughline_tasks_v1")) {
      const taskRequest = body as Record<string, any>;
      assert(
        taskRequest.p_owner === AUTH_USER_ID,
        "Persistence is owner-scoped",
      );
      assert(
        ["insert", "processing"].includes(taskRequest.p_operation),
        "Expected initial insert or existing-only processing",
      );
      return Response.json({ recording: taskRequest.p_payload.recording });
    }
    if (target.endsWith("/chat/completions")) {
      return Response.json({
        choices: [{ message: { content: JSON.stringify(extraction) } }],
        usage: { total_tokens: 12 },
      });
    }
    if (target.endsWith("/rest/v1/rpc/throughline_commit_processing_v1")) {
      return Response.json({ idempotent: false });
    }
    throw new Error(`Unexpected request: ${target}`);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer user-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcript_raw: "Test the immutable lineage write.",
            type: "freeform",
          }),
        },
      ),
    );
    assert(
      requests.filter((request) =>
            (request.body as any)?.p_operation === "insert"
          ).length === 1 &&
        requests.filter((request) =>
            (request.body as any)?.p_operation === "processing"
          ).length === 1 &&
        !requests.some((request) => request.url.includes("?on_conflict=id")),
      "Only initial creation inserts; completion uses existing-only atomic processing",
    );
    assert(response.status === 201, "Expected compatible processed response");
    const responseBody = await response.json();
    assert(responseBody.processing_status === "processed", "Expected note");
    const rpc = requests.find((request) =>
      request.url.endsWith(
        "/rest/v1/rpc/throughline_commit_processing_v1",
      )
    );
    const commit = (rpc?.body as Record<string, any>)?.payload;
    assert(commit?.operation?.status === "succeeded", "Expected operation");
    assert(
      commit?.attempts?.length === 1 &&
        commit.attempts[0].stage === "extraction",
      "Expected one extraction attempt for an existing transcript",
    );
    assert(
      Object.keys(commit.original_revision.canonical_output).length === 14,
      "Expected complete immutable original revision",
    );
    assert(
      !JSON.stringify(commit).includes("PRIVATE_PROVIDER_BODY"),
      "Private provider body entered the RPC payload",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_LINEAGE_WRITES_ENABLED");
    Deno.env.delete("GROQ_API_KEY");
  }
});

Deno.test("service context cannot submit a human evaluation", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
  Deno.env.set("THROUGHLINE_EVALUATION_WRITES_ENABLED", "true");
  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID +
          "/evaluations",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer service-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      ),
    );
    assert(
      response.status === 403,
      "Service tokens cannot impersonate the evaluator",
    );
    const body = await response.json();
    assert(
      body.error_code === "human_evaluation_requires_owner",
      "Expected a stable owner-only error code",
    );
  } finally {
    Deno.env.delete("THROUGHLINE_API_TOKEN");
    Deno.env.delete("THROUGHLINE_EVALUATION_WRITES_ENABLED");
  }
});

Deno.test("owner grade derives immutable revision and operation lineage server-side", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_EVALUATION_WRITES_ENABLED", "true");
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ url: target, body });
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (target.includes("/throughline_recordings?select=id%2Cauth_user_id")) {
      return Response.json([{
        id: RECORDING_ID,
        auth_user_id: AUTH_USER_ID,
        current_note_revision_id: "00000000-0000-4000-8000-000000000502",
      }]);
    }
    if (target.includes("/throughline_note_revisions?select=")) {
      return Response.json([{
        revision_id: "00000000-0000-4000-8000-000000000502",
        recording_id: RECORDING_ID,
        processing_operation_id: "00000000-0000-4000-8000-000000000503",
        canonical_snapshot: {},
        canonical_output_sha256: "5".repeat(64),
        production_schema_sha256: "2".repeat(64),
        production_normalizer_sha256: "3".repeat(64),
        canonical_keyset_sha256: "4".repeat(64),
      }]);
    }
    if (target.endsWith("/rest/v1/rpc/throughline_commit_evaluation_v1")) {
      return Response.json({
        evaluation_id: "00000000-0000-4000-8000-000000000504",
        evaluated_revision_id: "00000000-0000-4000-8000-000000000502",
        eligible: true,
        eligibility_source: "explicit_grade",
      });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID +
          "/evaluations",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer user-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            evaluation_id: "00000000-0000-4000-8000-000000000504",
            evaluated_revision_id: "00000000-0000-4000-8000-000000000502",
            idempotency_key: "00000000-0000-4000-8000-000000000505",
            score: 4,
            issue_codes: ["weak_summary"],
            notice_version: "private_evaluation_notice_v1",
            disclosure_version: "private_evaluation_disclosure_v1",
            policy_version: "private_evaluation_policy_v1",
            agent_ready: false,
          }),
        },
      ),
    );
    assert(response.status === 201, "Expected owner evaluation creation");
    const rpc = requests.find((request) =>
      request.url.endsWith("/rest/v1/rpc/throughline_commit_evaluation_v1")
    );
    const payload = (rpc?.body as Record<string, any>)?.payload;
    assert(
      payload.auth_user_id === AUTH_USER_ID,
      "Owner must be server-derived",
    );
    assert(
      payload.processing_operation_id ===
        "00000000-0000-4000-8000-000000000503",
      "Operation must be derived through the immutable revision",
    );
    assert(
      payload.contribution.eligibility_source === undefined,
      "Caller cannot supply eligibility claims",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_EVALUATION_WRITES_ENABLED");
  }
});

Deno.test("explicit current edit commits only its material correction mask", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_EVALUATION_WRITES_ENABLED", "true");
  const contract = await resolveCurrentInferenceContract();
  const canonical = {
    type: "freeform",
    title: "Original",
    summary: "Original summary",
    most_important: ["Original point"],
    todos: [],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "neutral",
    people: [],
    projects: [],
    tags: [],
    centers_of_balance: [],
  };
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ url: target, body });
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (target.includes("/throughline_recordings?select=recording")) {
      return Response.json([{
        recording: {
          id: RECORDING_ID,
          auth_user_id: AUTH_USER_ID,
          transcript_raw: "Original transcript",
          structured_note: canonical,
        },
      }]);
    }
    if (target.includes("/throughline_recordings?select=id%2Cauth_user_id")) {
      return Response.json([{
        id: RECORDING_ID,
        auth_user_id: AUTH_USER_ID,
        current_note_revision_id: "00000000-0000-4000-8000-000000000602",
      }]);
    }
    if (target.includes("/throughline_note_revisions?select=")) {
      return Response.json([{
        revision_id: "00000000-0000-4000-8000-000000000602",
        recording_id: RECORDING_ID,
        processing_operation_id: "00000000-0000-4000-8000-000000000603",
        canonical_snapshot: canonical,
        canonical_output_sha256: await sha256Hex(canonicalJson(canonical)),
        production_schema_sha256: contract.schema.sha256,
        production_normalizer_sha256: contract.normalizer.sha256,
        canonical_keyset_sha256: contract.schema.keyset_sha256,
      }]);
    }
    if (target.endsWith("/rest/v1/rpc/throughline_commit_user_mutation_v1")) {
      return Response.json({
        current_revision_id: "00000000-0000-4000-8000-000000000604",
        eligible: true,
      });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID,
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer user-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expected_current_revision_id:
              "00000000-0000-4000-8000-000000000602",
            idempotency_key: "00000000-0000-4000-8000-000000000605",
            notice_version: "private_evaluation_notice_v1",
            disclosure_version: "private_evaluation_disclosure_v1",
            policy_version: "private_evaluation_policy_v1",
            title: "Corrected",
            should_remember: true,
          }),
        },
      ),
    );
    assert(response.status === 200, "Expected current correction response");
    const rpc = requests.find((request) =>
      request.url.endsWith("/rest/v1/rpc/throughline_commit_user_mutation_v1")
    );
    const payload = (rpc?.body as Record<string, any>)?.payload;
    assert(
      JSON.stringify(payload.revision.editable_correction_mask) ===
        JSON.stringify(["title"]),
      "Only title should be labeled as corrected",
    );
    assert(
      payload.contribution.eligibility_source === "content_correction",
      "Material current correction should create eligibility",
    );
    assert(
      !JSON.stringify(payload).includes("should_remember"),
      "Legacy retention input must not enter immutable lineage",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_EVALUATION_WRITES_ENABLED");
  }
});

Deno.test("flagged action toggle appends immutable non-eligible action state", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_EVALUATION_WRITES_ENABLED", "true");
  const contract = await resolveCurrentInferenceContract();
  const canonical = {
    type: "freeform",
    title: "Action state",
    summary: "Preserve workflow history.",
    most_important: ["Keep action state immutable", "Ship action state"],
    todos: [{
      text: "Ship action state",
      status: "open",
      priority: null,
      due: null,
      for_date: null,
      context: null,
    }],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "neutral",
    people: [],
    projects: [],
    tags: [],
    centers_of_balance: [],
  };
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ url: target, body });
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (target.includes("/throughline_recordings?select=recording")) {
      return Response.json([{
        recording: {
          id: RECORDING_ID,
          auth_user_id: AUTH_USER_ID,
          transcript_raw: "Action transcript",
          structured_note: canonical,
        },
      }]);
    }
    if (target.includes("/throughline_recordings?select=id%2Cauth_user_id")) {
      return Response.json([{
        id: RECORDING_ID,
        auth_user_id: AUTH_USER_ID,
        current_note_revision_id: "00000000-0000-4000-8000-000000000702",
      }]);
    }
    if (target.includes("/throughline_note_revisions?select=")) {
      return Response.json([{
        revision_id: "00000000-0000-4000-8000-000000000702",
        recording_id: RECORDING_ID,
        processing_operation_id: "00000000-0000-4000-8000-000000000703",
        canonical_snapshot: canonical,
        canonical_output_sha256: await sha256Hex(canonicalJson(canonical)),
        production_schema_sha256: contract.schema.sha256,
        production_normalizer_sha256: contract.normalizer.sha256,
        canonical_keyset_sha256: contract.schema.keyset_sha256,
      }]);
    }
    if (target.endsWith("/rest/v1/rpc/throughline_commit_user_mutation_v1")) {
      return Response.json({
        current_revision_id: "00000000-0000-4000-8000-000000000704",
        eligible: false,
      });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID +
          "/action-items",
        {
          method: "PATCH",
          headers: {
            Authorization: "Bearer user-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: "Ship action state", completed: true }),
        },
      ),
    );
    assert(
      response.status === 200,
      "Expected action-state response: " + await response.clone().text(),
    );
    const rpc = requests.find((request) =>
      request.url.endsWith("/rest/v1/rpc/throughline_commit_user_mutation_v1")
    );
    const payload = (rpc?.body as Record<string, any>)?.payload;
    assert(
      payload.revision.revision_kind === "action_state",
      "Toggle must append an action-state revision",
    );
    assert(
      payload.revision.canonical_snapshot.todos[0].status === "completed",
      "Action-state revision must preserve the completed todo",
    );
    assert(
      payload.revision.editable_correction_mask.length === 0,
      "Workflow state must not masquerade as a content correction",
    );
    assert(payload.eligibility_source === null, "Action state is not eligible");
    assert(
      payload.contribution === null,
      "Action state creates no contribution",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_EVALUATION_WRITES_ENABLED");
  }
});

Deno.test("owner withdrawal deletes source audio and registered private artifacts before invalidation", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_EVALUATION_RETENTION_ENABLED", "true");
  Deno.env.set(
    "THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL",
    "https://supabase.test/functions/v1/private-artifact-delete",
  );
  Deno.env.set("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN", "artifact-token");
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ url: target, body });
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (
      target.includes(
        "/throughline_recordings?select=id%2Cauth_user_id%2Caudio",
      )
    ) {
      return Response.json([{
        id: RECORDING_ID,
        auth_user_id: AUTH_USER_ID,
        audio: {
          stored: true,
          storage: "supabase",
          bucket: "throughline-audio",
          object_path: "private/owned.m4a",
        },
      }]);
    }
    if (target.includes("/throughline_evaluation_contributions?select=")) {
      return Response.json([{
        contribution_id: "00000000-0000-4000-8000-000000000801",
        event_kind: "created",
      }]);
    }
    if (target.includes("/throughline_evaluation_corpus_cases?select=")) {
      return Response.json([{
        materializer_receipt_sha256: "a".repeat(64),
      }]);
    }
    if (target.includes("/storage/v1/object/")) {
      calls.push("storage.delete_audio");
      return new Response(null, { status: 200 });
    }
    if (
      target === "https://supabase.test/functions/v1/private-artifact-delete"
    ) {
      calls.push("artifacts.delete_private_raw");
      return Response.json({ status: "deleted", deleted_count: 2 });
    }
    if (target.endsWith("/rest/v1/rpc/throughline_remove_contribution_v1")) {
      calls.push("rpc.remove_contribution_and_invalidate");
      return Response.json({ invalidated_case_count: 1 });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID +
          "/evaluation-contribution",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer user-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idempotency_key: "00000000-0000-4000-8000-000000000803",
          }),
        },
      ),
    );
    assert(
      response.status === 200,
      "Expected owner withdrawal: " + await response.clone().text(),
    );
    assert(
      JSON.stringify(calls) === JSON.stringify([
        "storage.delete_audio",
        "artifacts.delete_private_raw",
        "rpc.remove_contribution_and_invalidate",
      ]),
      "Expected privacy deletion before atomic invalidation",
    );
    const body = await response.json();
    assert(body.withdrawn === true, "Expected aggregate withdrawal receipt");
    assert(
      body.private_artifacts_deleted === 2 &&
        body.invalidated_case_count === 1,
      "Expected aggregate cleanup counts",
    );
    assert(
      !JSON.stringify(body).includes(RECORDING_ID) &&
        !JSON.stringify(body).includes("private/owned.m4a") &&
        !JSON.stringify(body).includes("a".repeat(64)),
      "Withdrawal response exposed private identifiers or receipts",
    );
    const rpc = requests.find((request) =>
      request.url.endsWith("/rest/v1/rpc/throughline_remove_contribution_v1")
    );
    const payload = (rpc?.body as Record<string, any>)?.payload;
    assert(
      payload.auth_user_id === AUTH_USER_ID,
      "Owner must be server-derived",
    );
    assert(
      payload.source_audio_deleted === true,
      "Audio cleanup must be sealed",
    );
    assert(
      payload.raw_artifacts_deleted === true,
      "Artifact cleanup must be sealed",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ENABLED");
    Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL");
    Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN");
  }
});

Deno.test("artifact deletion failure leaves contribution state retryable", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_EVALUATION_RETENTION_ENABLED", "true");
  Deno.env.set(
    "THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL",
    "https://supabase.test/functions/v1/private-artifact-delete",
  );
  Deno.env.set("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN", "artifact-token");
  const originalFetch = globalThis.fetch;
  let rpcCalled = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (
      target.includes(
        "/throughline_recordings?select=id%2Cauth_user_id%2Caudio",
      )
    ) {
      return Response.json([{
        id: RECORDING_ID,
        auth_user_id: AUTH_USER_ID,
        audio: {
          stored: true,
          storage: "supabase",
          bucket: "throughline-audio",
          object_path: "private/owned.m4a",
        },
      }]);
    }
    if (target.includes("/throughline_evaluation_contributions?select=")) {
      return Response.json([{
        contribution_id: "00000000-0000-4000-8000-000000000811",
        event_kind: "created",
      }]);
    }
    if (target.includes("/throughline_evaluation_corpus_cases?select=")) {
      return Response.json([{
        materializer_receipt_sha256: "b".repeat(64),
      }]);
    }
    if (target.includes("/storage/v1/object/")) {
      return new Response(null, { status: 200 });
    }
    if (
      target === "https://supabase.test/functions/v1/private-artifact-delete"
    ) {
      return new Response("unavailable", { status: 503 });
    }
    if (target.endsWith("/rest/v1/rpc/throughline_remove_contribution_v1")) {
      rpcCalled = true;
      return Response.json({ invalidated_case_count: 1 });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID +
          "/evaluation-contribution",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer user-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idempotency_key: "00000000-0000-4000-8000-000000000813",
          }),
        },
      ),
    );
    assert(response.status === 503, "Expected retryable withdrawal failure");
    assert(
      rpcCalled === false,
      "Failed artifact cleanup must not remove eligibility",
    );
    const body = await response.json();
    assert(
      body.error_code === "evaluation_withdrawal_retryable",
      "Expected a safe stable retry code",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ENABLED");
    Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL");
    Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN");
  }
});

Deno.test("note deletion purges every registered evaluation artifact before database cascade", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_EVALUATION_RETENTION_ENABLED", "true");
  Deno.env.set(
    "THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL",
    "https://supabase.test/functions/v1/private-artifact-delete",
  );
  Deno.env.set("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN", "artifact-token");
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) {
      return Response.json({ id: AUTH_USER_ID });
    }
    if (target.includes("/throughline_recordings?select=recording")) {
      return Response.json([{
        recording: {
          id: RECORDING_ID,
          auth_user_id: AUTH_USER_ID,
          audio: {
            stored: true,
            storage: "supabase",
            bucket: "throughline-audio",
            object_path: "private/delete-note.m4a",
          },
        },
      }]);
    }
    if (target.includes("/storage/v1/object/")) {
      calls.push("storage.delete_audio");
      return new Response(null, { status: 200 });
    }
    if (target.includes("/throughline_evaluation_corpus_cases?select=")) {
      return Response.json([
        { materializer_receipt_sha256: "c".repeat(64) },
        { materializer_receipt_sha256: "c".repeat(64) },
      ]);
    }
    if (
      target === "https://supabase.test/functions/v1/private-artifact-delete"
    ) {
      calls.push("artifacts.delete_private_raw");
      return Response.json({ status: "deleted", deleted_count: 3 });
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_invalidate_evaluation_corpus_v1",
      )
    ) {
      calls.push("rpc.invalidate_corpus");
      const body = typeof init?.body === "string"
        ? JSON.parse(init.body)
        : null;
      assert(
        body?.payload?.reason_code === "note_deleted",
        "Expected a content-free note deletion reason",
      );
      return Response.json({ invalidated_case_count: 2 });
    }
    if (target.endsWith("/rpc/throughline_tasks_v1")) {
      const request = JSON.parse(String(init?.body));
      assert(
        request.p_operation === "delete" && request.p_owner === AUTH_USER_ID &&
          request.p_recording_id === RECORDING_ID,
        "Exact owner-locked deletion after privacy cleanup",
      );
      calls.push("database.delete_recording");
      return Response.json({ deleted: true });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/" + RECORDING_ID,
        {
          method: "DELETE",
          headers: { Authorization: "Bearer user-token-test" },
        },
      ),
    );
    assert(
      response.status === 200,
      "Expected note deletion: " + await response.clone().text(),
    );
    assert(
      JSON.stringify(calls) === JSON.stringify([
        "storage.delete_audio",
        "artifacts.delete_private_raw",
        "rpc.invalidate_corpus",
        "database.delete_recording",
      ]),
      "Expected all private cleanup before note cascade",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ENABLED");
    Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL");
    Deno.env.delete("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN");
  }
});

Deno.test("maintenance uses server-derived retention reasons and never expires protected audio", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
  Deno.env.set("THROUGHLINE_EVALUATION_RETENTION_ENABLED", "true");
  Deno.env.set(
    "THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE",
    "2026-08-22T00:00:00.000Z",
  );
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    if (target.endsWith("/rest/v1/rpc/throughline_retention_candidates_v1")) {
      calls.push("rpc.retention_candidates");
      return Response.json([
        {
          recording_id: "rec-protected-private",
          candidate_reason: "active_current_contribution",
        },
        {
          recording_id: "rec-expired-private",
          candidate_reason: "historical_or_no_active_contribution",
        },
      ]);
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_claim_retention_candidates_v1",
      )
    ) {
      calls.push("rpc.claim_retention_candidates");
      return Response.json([{
        recording_id: "rec-expired-private",
        candidate_reason: "historical_or_no_active_contribution",
        claim_token: "00000000-0000-4000-8000-000000000777",
        claim_expires_at: "2026-08-22T00:05:00.000Z",
      }]);
    }
    if (
      target.includes("/throughline_recordings?select=") &&
      target.includes("rec-expired-private")
    ) {
      calls.push("database.read_standard_candidate");
      return Response.json([{
        id: "rec-expired-private",
        auth_user_id: AUTH_USER_ID,
        created_at: "2026-07-01T00:00:00.000Z",
        audio: {
          stored: true,
          storage: "supabase",
          bucket: "throughline-audio",
          object_path: "private/expired.m4a",
        },
        recording: {},
      }]);
    }
    if (target.includes("/storage/v1/object/")) {
      calls.push("storage.delete_standard_audio");
      return new Response(null, { status: 200 });
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_finalize_retention_claim_v1",
      )
    ) {
      calls.push("rpc.finalize_retention_claim");
      const body = typeof init?.body === "string"
        ? JSON.parse(init.body)
        : null;
      assert(
        body?.payload?.claim_token ===
          "00000000-0000-4000-8000-000000000777",
        "Expected exact claim token",
      );
      assert(
        body?.payload?.source_audio_deleted === true &&
          body?.payload?.raw_artifacts_deleted === false,
        "Expected deletion evidence without private artifacts",
      );
      return Response.json({
        finalized: true,
        candidate_reason: "historical_or_no_active_contribution",
        idempotent: false,
      });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/maintenance/audio-retention",
        {
          method: "POST",
          headers: { Authorization: "Bearer service-token-test" },
        },
      ),
    );
    assert(
      response.status === 200,
      "Expected retention maintenance: " + await response.clone().text(),
    );
    assert(
      JSON.stringify(calls) === JSON.stringify([
        "rpc.retention_candidates",
        "rpc.claim_retention_candidates",
        "database.read_standard_candidate",
        "storage.delete_standard_audio",
        "rpc.finalize_retention_claim",
      ]),
      "Protected audio must not enter the deletion path",
    );
    const body = await response.json();
    assert(
      body.protected_evaluation === 1 && body.expired_standard === 1,
      "Expected aggregate counts by server-derived reason",
    );
    assert(
      !JSON.stringify(body).includes("rec-protected-private") &&
        !JSON.stringify(body).includes("rec-expired-private") &&
        !JSON.stringify(body).includes("private/expired.m4a"),
      "Retention response exposed identifiers or object paths",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_API_TOKEN");
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ENABLED");
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE");
  }
});

Deno.test("maintenance releases an exact claim after retryable Storage failure", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
  Deno.env.set("THROUGHLINE_EVALUATION_RETENTION_ENABLED", "true");
  Deno.env.set(
    "THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE",
    "2026-08-22T00:00:00.000Z",
  );
  const claimToken = "00000000-0000-4000-8000-000000000778";
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    if (target.endsWith("/rest/v1/rpc/throughline_retention_candidates_v1")) {
      return Response.json([]);
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_claim_retention_candidates_v1",
      )
    ) {
      calls.push("claim");
      return Response.json([{
        recording_id: "rec-retryable-private",
        candidate_reason: "historical_or_no_active_contribution",
        claim_token: claimToken,
        claim_expires_at: "2026-08-22T00:05:00.000Z",
      }]);
    }
    if (target.includes("/throughline_recordings?select=")) {
      return Response.json([{
        id: "rec-retryable-private",
        auth_user_id: AUTH_USER_ID,
        audio: {
          stored: true,
          storage: "supabase",
          bucket: "throughline-audio",
          object_path: "synthetic-object",
        },
        recording: {},
      }]);
    }
    if (target.includes("/storage/v1/object/")) {
      calls.push("storage_failure");
      return new Response(null, { status: 503 });
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_release_retention_claim_v1",
      )
    ) {
      const body = typeof init?.body === "string"
        ? JSON.parse(init.body)
        : null;
      assert(
        body?.payload?.claim_token === claimToken,
        "Expected exact release token",
      );
      calls.push("release");
      return Response.json({ released: true, idempotent: false });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/maintenance/audio-retention",
        {
          method: "POST",
          headers: { Authorization: "Bearer service-token-test" },
        },
      ),
    );
    const body = await response.json();
    assert(
      response.status === 200,
      "maintenance must return aggregate retry state",
    );
    assert(
      JSON.stringify(calls) === JSON.stringify([
        "claim",
        "storage_failure",
        "release",
      ]),
      "Expected claim release after Storage failure",
    );
    assert(
      body.errors?.evaluation_withdrawal_retryable === 1 &&
        body.expired_standard === 0,
      "Expected aggregate retry without finalization",
    );
    assert(
      !JSON.stringify(body).includes("rec-retryable-private") &&
        !JSON.stringify(body).includes(claimToken),
      "Maintenance response exposed claim details",
    );
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("THROUGHLINE_API_TOKEN");
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ENABLED");
    Deno.env.delete("THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE");
  }
});

Deno.test("artifact receipt maintenance deletes stale pending roots before acknowledging them", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
  Deno.env.set(
    "THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL",
    "https://supabase.test/functions/v1/private-artifact-delete",
  );
  Deno.env.set("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN", "artifact-token");
  const deletedReceipt = "a".repeat(64);
  const absentReceipt = "b".repeat(64);
  const deletedClaim = "00000000-0000-4000-8000-000000000881";
  const absentClaim = "00000000-0000-4000-8000-000000000882";
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const startedAt = Date.now();

  globalThis.fetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const target = String(url);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_claim_stale_evaluation_artifact_receipts_v1",
      )
    ) {
      calls.push("rpc.select_stale");
      assert(
        body?.max_rows === 100 && body?.claim_ttl_seconds === 300,
        "Expected bounded stale selection and claim lease",
      );
      const staleBefore = Date.parse(body?.stale_before ?? "");
      assert(
        Number.isFinite(staleBefore) &&
          staleBefore <= startedAt - 3_599_000 &&
          staleBefore >= startedAt - 3_610_000,
        "Expected a server-derived one-hour exclusive cutoff",
      );
      return Response.json([
        {
          materializer_receipt_sha256: deletedReceipt,
          cleanup_claim_token: deletedClaim,
          cleanup_claim_expires_at: "2026-08-23T00:05:00.000Z",
        },
        {
          materializer_receipt_sha256: absentReceipt,
          cleanup_claim_token: absentClaim,
          cleanup_claim_expires_at: "2026-08-23T00:05:00.000Z",
        },
      ]);
    }
    if (
      target === "https://supabase.test/functions/v1/private-artifact-delete"
    ) {
      assert(
        Object.keys(body ?? {}).length === 1 &&
          typeof body?.materializer_receipt_sha256 === "string",
        "Deletion service must receive only the receipt",
      );
      calls.push(`delete.${body.materializer_receipt_sha256[0]}`);
      return body.materializer_receipt_sha256 === deletedReceipt
        ? Response.json({ status: "deleted", deleted_count: 1 })
        : Response.json({ status: "not_found", deleted_count: 0 });
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_acknowledge_evaluation_artifact_deletion_v1",
      )
    ) {
      assert(
        Object.keys(body ?? {}).length === 1 &&
          Object.keys(body.payload ?? {}).sort().join(",") ===
            "cleanup_claim_token,deleted_count,deletion_status,materializer_receipt_sha256",
        "Acknowledgment must bind the exact external deletion proof",
      );
      const expectedClaim = body.payload.materializer_receipt_sha256 ===
          deletedReceipt
        ? deletedClaim
        : absentClaim;
      assert(
        body.payload.cleanup_claim_token === expectedClaim,
        "Acknowledgment must bind the exact cleanup claim",
      );
      calls.push(`rpc.ack.${body.payload.materializer_receipt_sha256[0]}`);
      return Response.json({ state: "deleted", idempotent: false });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/maintenance/evaluation-artifact-reconciliation",
        {
          method: "POST",
          headers: { Authorization: "Bearer service-token-test" },
        },
      ),
    );
    const body = await response.json();
    assert(response.status === 200, "Expected artifact reconciliation success");
    assert(
      JSON.stringify(calls) === JSON.stringify([
        "rpc.select_stale",
        "delete.a",
        "rpc.ack.a",
        "delete.b",
        "rpc.ack.b",
      ]),
      "Deletion must precede each exact receipt acknowledgment",
    );
    assert(
      body.scanned === 2 && body.deleted === 1 && body.not_found === 1 &&
        body.acknowledged === 2 && Object.keys(body.errors).length === 0,
      "Expected aggregate reconciliation counts",
    );
    assert(
      !JSON.stringify(body).includes(deletedReceipt) &&
        !JSON.stringify(body).includes(absentReceipt),
      "Reconciliation response exposed private receipt identities",
    );
  } finally {
    globalThis.fetch = originalFetch;
    setTestEnvironment();
  }
});

Deno.test("artifact receipt maintenance keeps failed deletion retryable and service-only", async () => {
  setTestEnvironment();
  Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
  Deno.env.set(
    "THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL",
    "https://supabase.test/functions/v1/private-artifact-delete",
  );
  Deno.env.set("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN", "artifact-token");
  const receipt = "c".repeat(64);
  const claimToken = "00000000-0000-4000-8000-000000000883";
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (
    url: string | URL | Request,
  ) => {
    const target = String(url);
    if (target.endsWith("/auth/v1/user")) {
      calls.push("auth.user");
      return Response.json({ id: AUTH_USER_ID });
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_claim_stale_evaluation_artifact_receipts_v1",
      )
    ) {
      calls.push("rpc.select_stale");
      return Response.json([{
        materializer_receipt_sha256: receipt,
        cleanup_claim_token: claimToken,
        cleanup_claim_expires_at: "2026-08-23T00:05:00.000Z",
      }]);
    }
    if (
      target === "https://supabase.test/functions/v1/private-artifact-delete"
    ) {
      calls.push("delete.failed");
      return Response.json({ status: "deleted", deleted_count: 0 });
    }
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_release_evaluation_artifact_cleanup_claim_v1",
      )
    ) {
      calls.push("rpc.release");
      return Response.json({ state: "pending", idempotent: false });
    }
    throw new Error("Unexpected request: " + target);
  }) as typeof fetch;

  try {
    const userResponse = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/maintenance/evaluation-artifact-reconciliation",
        {
          method: "POST",
          headers: { Authorization: "Bearer user-token-test" },
        },
      ),
    );
    assert(
      userResponse.status === 403,
      "Maintenance must require service auth",
    );

    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/maintenance/evaluation-artifact-reconciliation",
        {
          method: "POST",
          headers: { Authorization: "Bearer service-token-test" },
        },
      ),
    );
    const body = await response.json();
    assert(response.status === 200, "Expected aggregate retryable result");
    assert(
      JSON.stringify(calls) === JSON.stringify([
        "auth.user",
        "rpc.select_stale",
        "delete.failed",
        "rpc.release",
      ]),
      "Failed deletion must not be acknowledged",
    );
    assert(
      body.scanned === 1 && body.acknowledged === 0 &&
        body.errors?.artifact_deletion_retryable === 1,
      "Expected one retryable deletion without acknowledgment",
    );
    assert(
      !JSON.stringify(body).includes(receipt),
      "Retry response exposed a receipt identity",
    );
  } finally {
    globalThis.fetch = originalFetch;
    setTestEnvironment();
  }
});
