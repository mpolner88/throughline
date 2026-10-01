import {
  encodeTaskPage,
  parseTaskPage,
  TaskContractError,
  taskResult,
  validateTaskEdit,
  validateTaskMutation,
  validTaskDate,
} from "./tasks.ts";
const one = "00000000-0000-4000-8000-000000000001",
  two = "00000000-0000-4000-8000-000000000002";
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function rejects(work: () => unknown, code = "invalid_task_request") {
  try {
    work();
  } catch (error) {
    assert(
      error instanceof TaskContractError && error.code === code,
      "Expected typed safe rejection",
    );
    return;
  }
  throw new Error("Expected rejection");
}
Deno.test("task civil dates reject rollover and preserve leap dates", () => {
  assert(validTaskDate("2024-02-29"), "Leap date");
  for (
    const value of [
      "2025-02-29",
      "2026-13-01",
      "tomorrow",
      "2026-2-3",
      "2026-04-31",
    ]
  ) assert(!validTaskDate(value), "Invalid date refused");
});
Deno.test("ordinary edits preserve duplicate words with different identities", () => {
  const request = {
    task_contract_version: 1,
    mutation_id: one,
    expected_task_revision: 2,
    edited_local_date: "2026-09-30",
    edited_timezone: "UTC",
    todos: [{ id: one, text: "Synthetic task" }, {
      id: two,
      text: "Synthetic task",
    }],
  };
  assert(
    validateTaskEdit(request).todos.length === 2,
    "Both occurrences retained",
  );
  rejects(() =>
    validateTaskEdit({
      ...request,
      todos: [request.todos[0], request.todos[0]],
    })
  );
  rejects(() =>
    validateTaskEdit({ ...request, expected_task_revision: undefined })
  );
  rejects(() =>
    validateTaskEdit({ ...request, policy_version: "not-an-evaluation" })
  );
});
Deno.test("absolute mutations require durable UUID versions and explicit move dates", () => {
  const base = {
    mutation_id: one,
    expected_version: 1,
    operation: "set_completion",
    completed: true,
    occurred_at: "2026-09-30T10:00:00Z",
    completion_placement: "later",
  };
  validateTaskMutation(base);
  rejects(() => validateTaskMutation({ ...base, completed: "true" }));
  rejects(() =>
    validateTaskMutation({ ...base, text: "Selector is forbidden" })
  );
  validateTaskMutation({
    mutation_id: one,
    expected_version: 1,
    operation: "set_placement",
    placement: "this_week",
    anchor_date: "2026-09-30",
  });
  rejects(() =>
    validateTaskMutation({
      mutation_id: one,
      expected_version: 1,
      operation: "set_placement",
      placement: "this_week",
      anchor_date: "next week",
    })
  );
});
Deno.test("opaque full snapshot page cursors preserve revision and stable key", () => {
  const response = encodeTaskPage({
    next_cursor: { snapshot_version: 12, after: one },
  });
  const page = parseTaskPage(
    new URL("https://test/tasks?limit=2&cursor=" + response.next_cursor),
  );
  assert(
    page.cursor?.snapshot_version === 12 && page.cursor.after === one &&
      page.limit === 2,
    "Cursor roundtrip",
  );
  rejects(() => parseTaskPage(new URL("https://test/tasks?limit=1000")));
  rejects(() => parseTaskPage(new URL("https://test/tasks?cursor=bad")));
});
Deno.test("task error mapping contains only explicit safe vocabulary", () => {
  rejects(
    () => taskResult({ error_code: "version_conflict" }),
    "version_conflict",
  );
  rejects(() => taskResult({ error_code: "task_deleted" }), "task_deleted");
  assert(
    taskResult({ task: { id: one } }).task.id === one,
    "Success passes through",
  );
});
