import { isAllowedStartingStateManagementQuery } from "./preview-branch-contract.mjs";

const API_ORIGIN = "https://api.supabase.com";
const MAX_QUERY_BYTES = 4_096;
const MAX_RESPONSE_BYTES = 65_536;
const QUERY_TIMEOUT_MS = 15_000;
const PROJECT_REF_PATTERN = /^[a-z]{20}$/u;
const ACCESS_TOKEN_PATTERN = /^sbp_(?:oauth_)?[a-f0-9]{40}$/u;
const ALLOWED_STAGES = new Set([
  "classification_inventory",
  "classification_snapshot",
]);

function managementQueryFailure(stage, safeReason, retryable = false) {
  const error = new Error(`Management query ${stage} failed: ${safeReason}`);
  error.stage = stage;
  error.safeReason = safeReason;
  error.retryable = retryable;
  return error;
}

function requireInputs({
  accessToken,
  childBranch,
  parentRef,
  expectedBranchName,
  sql,
  stage,
}) {
  if (!ALLOWED_STAGES.has(stage)) {
    throw managementQueryFailure("invalid_stage", "target_validation");
  }
  if (
    childBranch === null ||
    typeof childBranch !== "object" ||
    typeof expectedBranchName !== "string" ||
    expectedBranchName.length === 0 ||
    childBranch.name !== expectedBranchName ||
    childBranch.is_default !== false ||
    childBranch.with_data !== false ||
    !Object.hasOwn(childBranch, "parent_project_ref") ||
    childBranch.parent_project_ref !== parentRef ||
    !PROJECT_REF_PATTERN.test(childBranch.project_ref) ||
    !PROJECT_REF_PATTERN.test(parentRef) ||
    childBranch.project_ref === parentRef ||
    !ACCESS_TOKEN_PATTERN.test(accessToken)
  ) {
    throw managementQueryFailure(stage, "target_validation");
  }
  if (
    typeof sql !== "string" ||
    new TextEncoder().encode(sql).byteLength > MAX_QUERY_BYTES ||
    !isAllowedStartingStateManagementQuery(stage, sql)
  ) {
    throw managementQueryFailure(stage, "invalid_request");
  }
  return childBranch.project_ref;
}

async function cancelBody(body) {
  try {
    await body?.cancel();
  } catch {
    // Cancellation is best-effort; never replace the fixed safe failure class.
  }
}

async function boundedResponseBytes(response, stage) {
  const declaredHeader = response.headers.get("content-length");
  if (
    declaredHeader !== null &&
    (!/^\d+$/u.test(declaredHeader) || Number(declaredHeader) > MAX_RESPONSE_BYTES)
  ) {
    await cancelBody(response.body);
    throw managementQueryFailure(stage, "invalid_response");
  }
  if (response.body === null || typeof response.body?.getReader !== "function") {
    throw managementQueryFailure(stage, "invalid_response");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        throw managementQueryFailure(stage, "invalid_response");
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw managementQueryFailure(stage, "invalid_response");
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error?.safeReason === "invalid_response") throw error;
    throw managementQueryFailure(stage, "invalid_response");
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function statusFailure(stage, status) {
  if (status === 401 || status === 403) {
    return managementQueryFailure(stage, "authentication");
  }
  if (status === 404) {
    return managementQueryFailure(stage, "target_unavailable");
  }
  if (status === 429 || status >= 500) {
    return managementQueryFailure(stage, "provider_unavailable", true);
  }
  return managementQueryFailure(stage, "unexpected_status");
}

export async function runChildManagementQuery({
  accessToken,
  childBranch,
  parentRef,
  expectedBranchName,
  sql,
  stage,
  fetchImpl = fetch,
}) {
  const childRef = requireInputs({
    accessToken,
    childBranch,
    parentRef,
    expectedBranchName,
    sql,
    stage,
  });
  let response;
  try {
    response = await fetchImpl(
      `${API_ORIGIN}/v1/projects/${childRef}/database/query/read-only`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      },
    );
  } catch {
    throw managementQueryFailure(stage, "connection_or_timeout", true);
  }
  if (response.status !== 201) {
    await cancelBody(response.body);
    throw statusFailure(stage, response.status);
  }
  const bytes = await boundedResponseBytes(response, stage);
  let rows;
  try {
    rows = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw managementQueryFailure(stage, "invalid_response");
  }
  if (
    !Array.isArray(rows) ||
    rows.length !== 1 ||
    rows.some((row) =>
      row === null || typeof row !== "object" || Array.isArray(row)
    )
  ) {
    throw managementQueryFailure(stage, "invalid_response");
  }
  return rows;
}
