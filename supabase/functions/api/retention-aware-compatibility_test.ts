import { handleRequestResponse } from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function setCompatibilityEnvironment(mode: "stable" | "retention_aware") {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  Deno.env.set("THROUGHLINE_API_TOKEN", "service-token-test");
  Deno.env.set("THROUGHLINE_EVAL_COMPATIBILITY_MODE", mode);
  Deno.env.set("THROUGHLINE_LINEAGE_WRITES_ENABLED", "true");
  Deno.env.set("THROUGHLINE_EVALUATION_WRITES_ENABLED", "true");
  Deno.env.set("THROUGHLINE_EVALUATION_RETENTION_ENABLED", "false");
}

function clearCompatibilityEnvironment() {
  for (
    const name of [
      "THROUGHLINE_API_TOKEN",
      "THROUGHLINE_EVAL_COMPATIBILITY_MODE",
      "THROUGHLINE_LINEAGE_WRITES_ENABLED",
      "THROUGHLINE_EVALUATION_WRITES_ENABLED",
      "THROUGHLINE_EVALUATION_RETENTION_ENABLED",
      "THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE",
    ]
  ) Deno.env.delete(name);
}

Deno.test("explicit stable rollback refuses requests when eligibility is active", async () => {
  setCompatibilityEnvironment("stable");
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const target = String(input);
    requests.push(target);
    if (
      target.endsWith(
        "/rest/v1/rpc/throughline_active_evaluation_eligibility_count_v1",
      )
    ) {
      return Promise.resolve(new Response(JSON.stringify(1), { status: 200 }));
    }
    throw new Error("stable rollback must stop before serving data");
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings",
        { headers: { Authorization: "Bearer service-token-test" } },
      ),
    );
    const body = await response.json();
    assert(response.status === 503, "stable rollback must fail closed");
    assert(
      body.error_code === "retention_aware_rollback_required",
      "expected safe rollback code",
    );
    assert(requests.length === 1, "only aggregate eligibility may be queried");
  } finally {
    globalThis.fetch = originalFetch;
    clearCompatibilityEnvironment();
  }
});

Deno.test("retention-aware compatibility keeps current evaluation writes disabled", async () => {
  setCompatibilityEnvironment("retention_aware");
  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/recording/evaluations",
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
    const body = await response.json();
    assert(
      response.status === 403,
      "service context must remain barred as human evaluator",
    );
    assert(
      body.error_code === "human_evaluation_requires_owner",
      "owner boundary must survive rollback",
    );
  } finally {
    clearCompatibilityEnvironment();
  }
});

Deno.test("retention-aware compatibility accepts legacy feedback without eligibility", async () => {
  setCompatibilityEnvironment("retention_aware");
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: unknown }> = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    const target = String(input);
    requests.push({
      url: target,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    if (target.includes("/rest/v1/throughline_recordings?select=recording")) {
      return Promise.resolve(
        new Response(
          JSON.stringify([{
            recording: {
              id: "legacy-recording",
              user_id: "dev-user",
              auth_user_id: null,
              created_at: "2026-08-22T00:00:00.000Z",
              transcript_raw: null,
              type: "freeform",
              status: "processed",
              processing_status: "processed",
              structured_note: null,
            },
          }]),
          { status: 200 },
        ),
      );
    }
    if (target.includes("/rest/v1/throughline_feedback")) {
      return Promise.resolve(new Response(null, { status: 201 }));
    }
    throw new Error("unexpected compatibility request");
  }) as typeof fetch;
  try {
    const response = await handleRequestResponse(
      new Request(
        "https://edge.test/functions/v1/api/recordings/legacy-recording/feedback",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer service-token-test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quality_score: 4, should_remember: true }),
        },
      ),
    );
    assert(response.status === 201, "legacy feedback must remain accepted");
    assert(
      !requests.some(({ url }) =>
        url.includes("throughline_commit_evaluation_v1") ||
        url.includes("throughline_commit_user_mutation_v1")
      ),
      "legacy feedback must never create current evaluation eligibility",
    );
  } finally {
    globalThis.fetch = originalFetch;
    clearCompatibilityEnvironment();
  }
});
