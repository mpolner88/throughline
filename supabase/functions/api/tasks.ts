// Owner-private ordinary task contracts, independent of Private Evaluation.
export type TaskTab = "today" | "this_week" | "later";
export type TaskOccurrence = {
  id: string;
  recording_id: string;
  version: number;
  source_order: number;
  text: string;
  status: "open" | "completed";
  completed_at: string | null;
  due: string | null;
  for_date: string | null;
  created_at: string;
  origin_local_date: string | null;
  source_created_at: string;
  source_local_date: string | null;
  source_timezone: string | null;
  source_title: string;
  is_earlier: boolean;
  placement_override: TaskTab | null;
  placement_anchor_date: string | null;
  completed_placement: TaskTab | null;
};
export class TaskContractError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tabs = new Set(["today", "this_week", "later"]);
function invalid(): never {
  throw new TaskContractError(
    400,
    "invalid_task_request",
    "The task change is invalid.",
  );
}
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, any>;
}
function keys(body: Record<string, any>, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key))) invalid();
}
function identifier(value: unknown) {
  if (typeof value !== "string" || !uuid.test(value)) invalid();
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) invalid();
}
export function validTaskDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}
export function validateTaskMutation(value: unknown) {
  const body = object(value);
  identifier(body.mutation_id);
  version(body.expected_version);
  if (body.operation === "set_completion") {
    keys(body, [
      "mutation_id",
      "expected_version",
      "operation",
      "completed",
      "occurred_at",
      "completion_placement",
    ]);
    if (
      typeof body.completed !== "boolean" ||
      typeof body.occurred_at !== "string" ||
      !/^\d{4}-\d\d-\d\dT/.test(body.occurred_at) ||
      !Number.isFinite(Date.parse(body.occurred_at)) ||
      (body.completed && !tabs.has(body.completion_placement)) ||
      (body.completion_placement !== undefined &&
        !tabs.has(body.completion_placement))
    ) invalid();
  } else if (body.operation === "set_placement") {
    keys(body, [
      "mutation_id",
      "expected_version",
      "operation",
      "placement",
      "anchor_date",
    ]);
    if (!tabs.has(body.placement) || !validTaskDate(body.anchor_date)) {
      invalid();
    }
  } else invalid();
  return body;
}
export function validateTaskEdit(value: unknown) {
  const body = object(value);
  keys(body, [
    "task_contract_version",
    "mutation_id",
    "expected_task_revision",
    "title",
    "summary",
    "transcript",
    "most_important",
    "todos",
    "edited_local_date",
    "edited_timezone",
  ]);
  if (body.task_contract_version !== 1) invalid();
  identifier(body.mutation_id);
  version(body.expected_task_revision);
  if (
    !validTaskDate(body.edited_local_date) ||
    typeof body.edited_timezone !== "string"
  ) invalid();
  try {
    new Intl.DateTimeFormat("en", { timeZone: body.edited_timezone });
  } catch {
    invalid();
  }
  for (const key of ["title", "summary", "transcript"]) {
    if (body[key] !== undefined && typeof body[key] !== "string") invalid();
  }
  if (
    body.title !== undefined &&
    (!body.title.trim() || body.title.trim().length > 80)
  ) invalid();
  if (
    body.most_important !== undefined &&
    (!Array.isArray(body.most_important) ||
      body.most_important.some((item: unknown) => typeof item !== "string"))
  ) invalid();
  if (body.todos !== undefined) {
    if (!Array.isArray(body.todos)) invalid();
    const seen = new Set();
    for (const value of body.todos) {
      const row = object(value);
      keys(row, ["id", "client_item_id", "text"]);
      if ((row.id === undefined) === (row.client_item_id === undefined)) {
        invalid();
      }
      const id = row.id ?? row.client_item_id;
      identifier(id);
      if (
        seen.has(id.toLowerCase()) || typeof row.text !== "string" ||
        !row.text.trim()
      ) invalid();
      seen.add(id.toLowerCase());
    }
  }
  return body;
}
export function parseTaskPage(url: URL) {
  const limit = url.searchParams.get("limit") ?? "200";
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 200) {
    invalid();
  }
  let cursor: { snapshot_version: number; after: string } | null = null;
  const encoded = url.searchParams.get("cursor");
  if (encoded) {
    try {
      const decoded = object(
        JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))),
      );
      keys(decoded, ["snapshot_version", "after"]);
      version(decoded.snapshot_version);
      identifier(decoded.after);
      cursor = {
        snapshot_version: decoded.snapshot_version,
        after: decoded.after,
      };
    } catch {
      invalid();
    }
  }
  return { limit: Number(limit), cursor };
}
export function encodeTaskPage(result: any) {
  if (result.next_cursor && typeof result.next_cursor === "object") {
    result.next_cursor = btoa(JSON.stringify(result.next_cursor)).replace(
      /\+/g,
      "-",
    ).replace(/\//g, "_").replace(/=+$/g, "");
  }
  return result;
}
export function taskResult(result: any) {
  if (!result?.error_code) return result;
  const errors: Record<string, [number, string]> = {
    version_conflict: [409, "The note changed. Refresh and try again."],
    snapshot_changed: [409, "Your task list changed. Refresh it again."],
    idempotency_conflict: [409, "This change could not be retried safely."],
    update_required: [409, "Update Throughline to change these tasks safely."],
    task_deleted: [410, "This task was removed."],
    not_found: [404, "The note or task is no longer available."],
    account_deletion_pending: [423, "Account deletion is in progress."],
    evaluation_task_conflict: [
      409,
      "This note cannot be changed by this task operation.",
    ],
    invalid_task_request: [400, "The task change is invalid."],
  };
  const entry = errors[result.error_code];
  if (!entry) throw new Error("Task transaction failed");
  throw new TaskContractError(entry[0], result.error_code, entry[1]);
}
