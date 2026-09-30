import { handleRequestResponse } from "./index.ts";
const owner = "00000000-0000-4000-8000-000000000011";
const task = "00000000-0000-4000-8000-000000000012";
const mutation = "00000000-0000-4000-8000-000000000013";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function setup() {
  Deno.env.set("SUPABASE_URL", "https://supabase.test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service");
  Deno.env.set("SUPABASE_ANON_KEY", "synthetic-anon");
  for (
    const key of [
      "THROUGHLINE_API_TOKEN",
      "THROUGHLINE_LINEAGE_WRITES_ENABLED",
      "THROUGHLINE_EVALUATION_WRITES_ENABLED",
      "THROUGHLINE_EVALUATION_RETENTION_ENABLED",
      "THROUGHLINE_EVAL_COMPATIBILITY_MODE",
      "GROQ_API_KEY",
    ]
  ) Deno.env.delete(key);
}
function request(path: string, method = "GET", body?: unknown, auth = true) {
  return new Request("https://edge.test/functions/v1/api" + path, {
    method,
    headers: {
      ...(auth ? { Authorization: "Bearer synthetic-user" } : {}),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function harness(
  work: (calls: any[]) => Promise<void>,
  reply: any,
  recording?: any,
) {
  setup();
  const original = globalThis.fetch;
  const calls: any[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: owner });
    if (url.endsWith("/rpc/throughline_tasks_v1")) {
      const body = JSON.parse(String(init?.body));
      calls.push(body);
      return Response.json(reply);
    }
    if (recording && url.includes("/throughline_recordings?select=recording")) {
      return Response.json([{ recording }]);
    }
    throw new Error("Unexpected mocked route");
  }) as typeof fetch;
  try {
    await work(calls);
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("task list authenticates owner and returns opaque snapshot continuation", async () => {
  await harness(async (calls) => {
    const response = await handleRequestResponse(request("/tasks?limit=2"));
    const body = await response.json();
    assert(
      response.status === 200 && typeof body.next_cursor === "string",
      "Opaque next page",
    );
    assert(
      calls.length === 1 && calls[0].p_owner === owner &&
        calls[0].p_operation === "list" && calls[0].p_payload.limit === 2,
      "Owner-derived RPC",
    );
  }, {
    contract_version: 1,
    snapshot_version: 3,
    tasks: [],
    cutover_at: "2026-09-30T00:00:00Z",
    next_cursor: { snapshot_version: 3, after: task },
  });
});
Deno.test("ordinary task mutation preserves UUID absolute body without text selector", async () => {
  const change = {
    mutation_id: mutation,
    expected_version: 2,
    operation: "set_completion",
    completed: true,
    occurred_at: "2026-09-30T00:00:00Z",
    completion_placement: "today",
  };
  await harness(async (calls) => {
    const response = await handleRequestResponse(
      request("/tasks/" + task, "PATCH", change),
    );
    assert(response.status === 200, "Mutation response");
    assert(
      calls[0].p_payload.task_id === task &&
        JSON.stringify(calls[0].p_payload.body) === JSON.stringify(change),
      "Replay payload retained exactly",
    );
  }, {
    mutation_id: mutation,
    snapshot_version: 4,
    task: { id: task, version: 3 },
  });
});
Deno.test("ordinary note edit bypasses evaluation and preserves duplicate task rows", async () => {
  const edit = {
    task_contract_version: 1,
    mutation_id: mutation,
    expected_task_revision: 7,
    edited_local_date: "2026-09-30",
    edited_timezone: "UTC",
    todos: [{ id: task, text: "Synthetic task" }, {
      client_item_id: owner,
      text: "Synthetic task",
    }],
  };
  await harness(async (calls) => {
    const response = await handleRequestResponse(
      request("/recordings/rec_fixture", "PATCH", edit),
    );
    const body = await response.json();
    assert(
      response.status === 200 && body.task_revision === 8,
      "Ordinary edit contract",
    );
    assert(
      calls.length === 1 && calls[0].p_operation === "edit" &&
        calls[0].p_payload.todos.length === 2,
      "No legacy dedup or evaluation route",
    );
    assert(!("policy_version" in calls[0].p_payload), "No evaluation envelope");
  }, {
    recording: { id: "rec_fixture" },
    task_contract_version: 1,
    task_revision: 8,
    snapshot_version: 9,
    tasks: [],
  });
});
Deno.test("detail retains recording shape and carries ordinary metadata as siblings", async () => {
  const reply = {
    recording: { id: "rec_fixture", structured_note: { todos: [] } },
    current_revision_id: null,
    task_contract_version: 1,
    task_revision: 8,
    snapshot_version: 9,
    tasks: [],
  };
  await harness(async (calls) => {
    const response = await handleRequestResponse(
      request("/recordings/rec_fixture"),
    );
    const body = await response.json();
    assert(
      JSON.stringify(body) === JSON.stringify(reply),
      "Sibling envelope retained",
    );
    assert(
      calls[0].p_operation === "detail",
      "Single consistent transaction read",
    );
  }, reply);
});
Deno.test("conflicts are safe typed failures and invalid requests never reach task RPC", async () => {
  await harness(async (calls) => {
    const response = await handleRequestResponse(
      request("/tasks/" + task, "PATCH", {
        mutation_id: mutation,
        expected_version: 1,
        operation: "set_placement",
        placement: "later",
        anchor_date: "2026-09-30",
      }),
    );
    assert(
      response.status === 409 &&
        (await response.json()).error_code === "version_conflict",
      "Typed conflict",
    );
    const bad = await handleRequestResponse(
      request("/tasks/" + task, "PATCH", {
        text: "Wrong selector",
        completed: true,
      }),
    );
    assert(
      bad.status === 400 && calls.length === 1,
      "Malformed rejected before RPC",
    );
  }, { error_code: "version_conflict" });
});
Deno.test("legacy completion is gated atomically with its original server snapshot", async () => {
  const recording = {
    id: "rec_fixture",
    auth_user_id: owner,
    type: "freeform",
    structured_note: {
      todos: [{ text: "Synthetic task", status: "open" }],
      action_items: [],
    },
  };
  await harness(
    async (calls) => {
      const response = await handleRequestResponse(
        request("/recordings/rec_fixture/action-items", "PATCH", {
          text: "Synthetic task",
          completed: true,
        }),
      );
      assert(response.status === 409, "Unsafe selector refused");
      assert(
        calls[0].p_operation === "legacy" &&
          calls[0].p_payload.kind === "completion",
        "Transaction chooses enrollment branch",
      );
      assert(
        calls[0].p_payload.before.structured_note.todos[0].status === "open",
        "Original server state included",
      );
    },
    { error_code: "update_required" },
    recording,
  );
});
Deno.test("unauthenticated tasks cannot bootstrap another account", async () => {
  await harness(async (calls) => {
    const response = await handleRequestResponse(
      request("/tasks", "GET", undefined, false),
    );
    assert(
      response.status === 401 && calls.length === 0,
      "No enrollment without owner",
    );
  }, {});
});
