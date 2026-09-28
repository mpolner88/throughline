#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFile = promisify(execFileCallback);

const AUTHORIZATION_GATE = "THROUGHLINE_LINEAGE_HOSTED_CANARY_AUTHORIZED";
const EXPECTED_ORIGIN = "https://ywsenspsfyrdhgyxgcrv.supabase.co";
const EXPECTED_PROJECT_REF = "ywsenspsfyrdhgyxgcrv";
const LINEAGE_FLAG = "THROUGHLINE_LINEAGE_WRITES_ENABLED";
const BEHAVIOR_CONTROLS = [
  "THROUGHLINE_EVAL_COMPATIBILITY_MODE",
  "THROUGHLINE_EVALUATION_RETENTION_ENABLED",
  "THROUGHLINE_EVALUATION_WRITES_ENABLED",
  LINEAGE_FLAG,
];
const CANONICAL_KEYS = [
  "accomplishments",
  "centers_of_balance",
  "intentions",
  "mood",
  "most_important",
  "people",
  "priorities",
  "projects",
  "summary",
  "tags",
  "title",
  "todos",
  "tomorrow_todos",
  "type",
];
const CHECKS = [
  "flags_off_preflight",
  "zero_active_eligibility",
  "lineage_only_enablement",
  "synthetic_transcript_processing",
  "complete_immutable_lineage",
  "evaluation_absence",
  "recording_cascade_cleanup",
  "flags_off_rollback",
  "privacy",
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_RESPONSE_BYTES = 256_000;
const HTTP_TIMEOUT_MS = 30_000;
const PROCESSING_TIMEOUT_MS = 120_000;

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

export function parseCliArgs(args) {
  if (!Array.isArray(args)) throw new TypeError("CLI arguments must be an array");
  if (args.length !== 1 || args[0] !== "--execute-hosted") {
    if (args.some((argument) => argument !== "--execute-hosted")) {
      throw new Error("Unknown argument");
    }
    throw new Error("Explicit hosted execution flag is required");
  }
  return { executeHosted: true };
}

export function assertExecutionAuthorized({ executeHosted, env }) {
  if (executeHosted !== true) {
    throw new Error("Explicit hosted execution flag is required");
  }
  if (env?.[AUTHORIZATION_GATE] !== "true") {
    throw new Error("Hosted canary authorization environment gate is required");
  }
  return true;
}

export function readHostedCanaryConfig(env) {
  const rawUrl = env?.SUPABASE_URL?.trim();
  const serviceRoleKey = env?.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const apiToken = env?.THROUGHLINE_API_TOKEN?.trim();
  if (!rawUrl || !serviceRoleKey || !apiToken) {
    throw new Error("Hosted canary configuration is incomplete");
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Hosted canary configuration is invalid");
  }
  if (
    url.origin !== EXPECTED_ORIGIN || url.protocol !== "https:" ||
    url.pathname !== "/" || url.search || url.hash || url.username ||
    url.password
  ) {
    throw new Error("Hosted canary configuration is invalid");
  }
  return {
    origin: url.origin,
    projectRef: EXPECTED_PROJECT_REF,
    serviceRoleKey,
    apiToken,
  };
}

export function assertPrivacySafeCanaryOutput(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const unsafe = [
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
    /\brec_[A-Za-z0-9-]+\b/u,
    /\bbearer\s+\S+/iu,
    /https?:\/\/\S+/iu,
    /(?:service[_-]?role[_-]?key|credential|secret|token)\s*[:=]\s*\S+/iu,
    /(?:transcript|note|summary|title)(?:_raw)?\s*[:=]\s*\S+/iu,
  ];
  if (unsafe.some((pattern) => pattern.test(text))) {
    throw new Error("Hosted canary output is not privacy-safe");
  }
  return true;
}

function assertRuntime(runtime) {
  const methods = [
    "inspectBehaviorControls",
    "activeEligibilityCount",
    "enableLineage",
    "awaitHealthy",
    "createSyntheticRecording",
    "inspectLineage",
    "deleteSyntheticRecording",
    "inspectCleanup",
    "disableLineage",
  ];
  if (!runtime || typeof runtime !== "object") {
    throw new TypeError("Hosted lineage canary runtime is required");
  }
  for (const method of methods) {
    if (typeof runtime[method] !== "function") {
      throw new TypeError(`Hosted lineage canary runtime is missing ${method}`);
    }
  }
}

function assertControlsAbsent(value) {
  if (!Array.isArray(value) || value.length !== 0) {
    throw new Error("Evaluation behavior controls are not absent");
  }
}

function assertLineageOnly(value) {
  if (
    !Array.isArray(value) || value.length !== 1 || value[0] !== LINEAGE_FLAG
  ) {
    throw new Error("Lineage-only behavior state is invalid");
  }
}

function assertLineageProof(value) {
  const keys = [
    "recording_count",
    "inference_contract_count",
    "operation_count",
    "succeeded_operation_count",
    "extraction_attempt_count",
    "succeeded_extraction_attempt_count",
    "transcription_attempt_count",
    "original_revision_count",
    "original_revision_key_count",
    "pointer_integrity",
    "evaluation_count",
    "contribution_count",
    "corpus_case_count",
  ];
  if (!exactKeys(value, keys)) {
    throw new Error("Hosted lineage proof is invalid");
  }
  for (const key of keys.filter((key) => key.endsWith("_count"))) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) {
      throw new Error("Hosted lineage proof is invalid");
    }
  }
  if (
    value.recording_count !== 1 || value.inference_contract_count !== 1 ||
    value.operation_count !== 1 || value.succeeded_operation_count !== 1 ||
    value.extraction_attempt_count !== 1 ||
    value.succeeded_extraction_attempt_count !== 1 ||
    value.transcription_attempt_count !== 0 ||
    value.original_revision_count !== 1 ||
    value.original_revision_key_count !== 14 ||
    value.pointer_integrity !== true
  ) {
    throw new Error("Hosted lineage proof is invalid");
  }
  if (
    value.evaluation_count !== 0 || value.contribution_count !== 0 ||
    value.corpus_case_count !== 0
  ) {
    throw new Error("Unexpected evaluation rows were created");
  }
  return value;
}

function assertCleanupProof(value) {
  const keys = [
    "marker_count",
    "recording_count",
    "operation_count",
    "attempt_count",
    "revision_count",
    "evaluation_count",
    "contribution_count",
    "quarantine_count",
    "corpus_case_count",
  ];
  if (
    !exactKeys(value, keys) ||
    keys.some((key) => value[key] !== 0)
  ) {
    throw new Error("Hosted canary cleanup proof is invalid");
  }
  return value;
}

export async function runLineageCanary({ runtime }) {
  assertRuntime(runtime);
  assertControlsAbsent(await runtime.inspectBehaviorControls());
  const activeEligibility = await runtime.activeEligibilityCount();
  if (!Number.isSafeInteger(activeEligibility) || activeEligibility !== 0) {
    throw new Error("Active eligibility is not zero");
  }

  let rollbackRequired = false;
  let creationAttempted = false;
  let recordingRef = null;
  let primaryError = null;
  let cleanupError = null;
  let rollbackError = null;
  try {
    rollbackRequired = true;
    await runtime.enableLineage();
    assertLineageOnly(await runtime.inspectBehaviorControls());
    if (await runtime.awaitHealthy() !== true) {
      throw new Error("Hosted API health check failed");
    }
    creationAttempted = true;
    recordingRef = await runtime.createSyntheticRecording();
    if (typeof recordingRef !== "string" || !recordingRef) {
      throw new Error("Synthetic recording creation failed");
    }
    assertLineageProof(await runtime.inspectLineage(recordingRef));
  } catch (error) {
    primaryError = error;
  } finally {
    if (creationAttempted) {
      try {
        const recoveredRefs = await runtime.deleteSyntheticRecording(recordingRef);
        if (
          !Array.isArray(recoveredRefs) ||
          recoveredRefs.some((value) => typeof value !== "string" || !value)
        ) {
          throw new Error("Hosted canary recovery proof is invalid");
        }
        assertCleanupProof(await runtime.inspectCleanup(recoveredRefs));
      } catch (error) {
        cleanupError = error;
      }
    }
    if (rollbackRequired) {
      try {
        await runtime.disableLineage();
        assertControlsAbsent(await runtime.inspectBehaviorControls());
        if (await runtime.awaitHealthy() !== true) {
          throw new Error("Hosted API health check failed after rollback");
        }
      } catch (error) {
        rollbackError = error;
      }
    }
  }

  if (rollbackError) {
    throw new Error("Hosted lineage canary rollback failed", {
      cause: rollbackError,
    });
  }
  if (cleanupError) throw cleanupError;
  if (primaryError) throw primaryError;

  const result = {
    mode: "hosted-lineage-write-canary",
    status: "pass",
    checks: [...CHECKS],
  };
  assertPrivacySafeCanaryOutput(result);
  return result;
}

async function boundedJson(response) {
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
    throw new Error("Hosted response exceeded the safety bound");
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error("Hosted response was not valid JSON");
  }
}

function serviceHeaders(config, json = true) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function hostedFetch(fetchImpl, url, init, timeoutMs = HTTP_TIMEOUT_MS) {
  return fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function cliSecrets(config, args) {
  const { stdout } = await execFile(
    "supabase",
    ["secrets", ...args, "--project-ref", config.projectRef, "--output", "json"],
    { timeout: 60_000, maxBuffer: MAX_RESPONSE_BYTES },
  );
  return stdout;
}

function parseSecretNames(stdout) {
  let value;
  try {
    value = JSON.parse(stdout);
  } catch {
    throw new Error("Hosted behavior control inspection failed");
  }
  const rows = Array.isArray(value) ? value : value?.secrets;
  if (!Array.isArray(rows)) {
    throw new Error("Hosted behavior control inspection failed");
  }
  const names = rows.map((row) => typeof row === "string" ? row : row?.name);
  if (names.some((name) => typeof name !== "string" || !name)) {
    throw new Error("Hosted behavior control inspection failed");
  }
  return [...new Set(names.filter((name) => BEHAVIOR_CONTROLS.includes(name)))].sort();
}

function encodeSelect(fields) {
  return encodeURIComponent(fields.join(","));
}

function createHostedRuntime({ env, fetchImpl = fetch }) {
  const config = readHostedCanaryConfig(env);
  const syntheticTranscript =
    `Synthetic lineage canary ${randomUUID()}. Capture one test action for tomorrow.`;
  const fetchRows = async (path) => {
    const response = await hostedFetch(
      fetchImpl,
      `${config.origin}/rest/v1/${path}`,
      { headers: serviceHeaders(config, false) },
    );
    const body = await boundedJson(response);
    if (!response.ok || !Array.isArray(body)) {
      throw new Error("Hosted lineage inspection failed");
    }
    return body;
  };
  return {
    async inspectBehaviorControls() {
      return parseSecretNames(await cliSecrets(config, ["list"]));
    },
    async activeEligibilityCount() {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/rest/v1/rpc/throughline_active_evaluation_eligibility_count_v1`,
        {
          method: "POST",
          headers: serviceHeaders(config),
          body: "{}",
        },
      );
      const body = await boundedJson(response);
      const raw = Array.isArray(body) ? body[0] : body;
      const count = typeof raw === "number"
        ? raw
        : typeof raw === "string" && /^\d+$/u.test(raw)
        ? Number(raw)
        : Number.NaN;
      if (!response.ok || !Number.isSafeInteger(count)) {
        throw new Error("Hosted eligibility inspection failed");
      }
      return count;
    },
    async enableLineage() {
      await cliSecrets(config, ["set", `${LINEAGE_FLAG}=true`]);
    },
    async disableLineage() {
      await cliSecrets(config, ["unset", LINEAGE_FLAG, "--yes"]);
    },
    async awaitHealthy() {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          const response = await hostedFetch(
            fetchImpl,
            `${config.origin}/functions/v1/api/health`,
            { headers: { Authorization: `Bearer ${config.apiToken}` } },
          );
          const body = await boundedJson(response);
          if (
            response.ok && body?.ok === true && body?.authenticated === true &&
            body?.auth_mode === "service"
          ) return true;
        } catch {
          // A secret update can briefly restart the hosted function.
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      return false;
    },
    async createSyntheticRecording() {
      const response = await hostedFetch(
        fetchImpl,
        `${config.origin}/functions/v1/api/recordings`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcript_raw: syntheticTranscript,
            type: "freeform",
            duration_seconds: 1,
            timezone: "UTC",
          }),
        },
        PROCESSING_TIMEOUT_MS,
      );
      const body = await boundedJson(response);
      if (
        !response.ok || response.status !== 201 ||
        typeof body?.id !== "string" || !body.id ||
        body?.processing_status !== "processed" || body?.has_note !== true
      ) {
        throw new Error("Synthetic recording creation failed");
      }
      return body.id;
    },
    async inspectLineage(recordingRef) {
      const recordingFilter = encodeURIComponent(recordingRef);
      const [recordings, operations, attempts, revisions, evaluations, contributions, cases] =
        await Promise.all([
          fetchRows(
            `throughline_recordings?select=${encodeSelect([
              "id",
              "current_processing_operation_id",
              "current_transcription_attempt_id",
              "current_extraction_attempt_id",
              "current_note_revision_id",
            ])}&id=eq.${recordingFilter}`,
          ),
          fetchRows(
            `throughline_processing_operations?select=${encodeSelect([
              "operation_id",
              "recording_id",
              "inference_contract_id",
              "status",
            ])}&recording_id=eq.${recordingFilter}`,
          ),
          fetchRows(
            `throughline_inference_attempts?select=${encodeSelect([
              "attempt_id",
              "operation_id",
              "recording_id",
              "stage",
              "status",
              "input_sha256",
              "output_sha256",
            ])}&recording_id=eq.${recordingFilter}`,
          ),
          fetchRows(
            `throughline_note_revisions?select=${encodeSelect([
              "revision_id",
              "recording_id",
              "processing_operation_id",
              "revision_kind",
              "canonical_snapshot",
              "canonical_output_sha256",
            ])}&recording_id=eq.${recordingFilter}`,
          ),
          fetchRows(
            `throughline_evaluations?select=evaluation_id&recording_id=eq.${recordingFilter}`,
          ),
          fetchRows(
            `throughline_evaluation_contributions?select=contribution_id&recording_id=eq.${recordingFilter}`,
          ),
          fetchRows(
            `throughline_evaluation_corpus_cases?select=case_id&recording_id=eq.${recordingFilter}`,
          ),
        ]);
      const contractIds = [...new Set(operations.map((row) => row.inference_contract_id))];
      const contracts = contractIds.length === 1 && UUID_PATTERN.test(contractIds[0] ?? "")
        ? await fetchRows(
          `throughline_inference_contracts?select=id&id=eq.${encodeURIComponent(contractIds[0])}`,
        )
        : [];
      const operation = operations[0];
      const extractionAttempts = attempts.filter((row) => row.stage === "extraction");
      const transcriptionAttempts = attempts.filter((row) => row.stage === "transcription");
      const revision = revisions[0];
      const canonicalKeys = revision?.canonical_snapshot &&
          typeof revision.canonical_snapshot === "object" &&
          !Array.isArray(revision.canonical_snapshot)
        ? Object.keys(revision.canonical_snapshot).sort()
        : [];
      const pointerIntegrity = recordings.length === 1 && operations.length === 1 &&
        attempts.length === 1 && revisions.length === 1 &&
        recordings[0].current_processing_operation_id === operation?.operation_id &&
        recordings[0].current_transcription_attempt_id === null &&
        recordings[0].current_extraction_attempt_id === extractionAttempts[0]?.attempt_id &&
        recordings[0].current_note_revision_id === revision?.revision_id &&
        operation?.recording_id === recordingRef &&
        extractionAttempts[0]?.recording_id === recordingRef &&
        extractionAttempts[0]?.operation_id === operation?.operation_id &&
        revision?.recording_id === recordingRef &&
        revision?.processing_operation_id === operation?.operation_id &&
        revision?.revision_kind === "original_model" &&
        SHA256_PATTERN.test(extractionAttempts[0]?.input_sha256 ?? "") &&
        SHA256_PATTERN.test(extractionAttempts[0]?.output_sha256 ?? "") &&
        SHA256_PATTERN.test(revision?.canonical_output_sha256 ?? "") &&
        canonicalKeys.length === CANONICAL_KEYS.length &&
        canonicalKeys.every((key, index) => key === CANONICAL_KEYS[index]);
      return {
        recording_count: recordings.length,
        inference_contract_count: contracts.length,
        operation_count: operations.length,
        succeeded_operation_count: operations.filter((row) => row.status === "succeeded").length,
        extraction_attempt_count: extractionAttempts.length,
        succeeded_extraction_attempt_count: extractionAttempts.filter((row) => row.status === "succeeded").length,
        transcription_attempt_count: transcriptionAttempts.length,
        original_revision_count: revisions.filter((row) => row.revision_kind === "original_model").length,
        original_revision_key_count: canonicalKeys.length,
        pointer_integrity: pointerIntegrity,
        evaluation_count: evaluations.length,
        contribution_count: contributions.length,
        corpus_case_count: cases.length,
      };
    },
    async deleteSyntheticRecording(recordingRef) {
      const markerRows = await fetchRows(
        `throughline_recordings?select=id&transcript_raw=eq.${encodeURIComponent(syntheticTranscript)}`,
      );
      const refs = new Set(
        [recordingRef, ...markerRows.map((row) => row?.id)].filter((value) =>
          typeof value === "string" && value
        ),
      );
      for (const ref of refs) {
        const response = await hostedFetch(
          fetchImpl,
          `${config.origin}/functions/v1/api/recordings/${encodeURIComponent(ref)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${config.apiToken}` },
          },
        );
        const body = await boundedJson(response);
        if (!response.ok || body?.deleted !== true) {
          throw new Error("Hosted canary recording deletion failed");
        }
      }
      return [...refs];
    },
    async inspectCleanup(recordingRefs) {
      const markerRows = await fetchRows(
        `throughline_recordings?select=id&transcript_raw=eq.${encodeURIComponent(syntheticTranscript)}`,
      );
      const empty = {
        recordings: [], operations: [], attempts: [], revisions: [],
        evaluations: [], contributions: [], cases: [],
      };
      const linked = await recordingRefs.reduce(async (pending, recordingRef) => {
        const aggregate = await pending;
        const recordingFilter = encodeURIComponent(recordingRef);
        const [recordings, operations, attempts, revisions, evaluations, contributions, cases] =
          await Promise.all([
            fetchRows(`throughline_recordings?select=id&id=eq.${recordingFilter}`),
            fetchRows(`throughline_processing_operations?select=operation_id&recording_id=eq.${recordingFilter}`),
            fetchRows(`throughline_inference_attempts?select=attempt_id&recording_id=eq.${recordingFilter}`),
            fetchRows(`throughline_note_revisions?select=revision_id&recording_id=eq.${recordingFilter}`),
            fetchRows(`throughline_evaluations?select=evaluation_id&recording_id=eq.${recordingFilter}`),
            fetchRows(`throughline_evaluation_contributions?select=contribution_id&recording_id=eq.${recordingFilter}`),
            fetchRows(`throughline_evaluation_corpus_cases?select=case_id&recording_id=eq.${recordingFilter}`),
          ]);
        aggregate.recordings.push(...recordings);
        aggregate.operations.push(...operations);
        aggregate.attempts.push(...attempts);
        aggregate.revisions.push(...revisions);
        aggregate.evaluations.push(...evaluations);
        aggregate.contributions.push(...contributions);
        aggregate.cases.push(...cases);
        return aggregate;
      }, Promise.resolve(empty));
      return {
        marker_count: markerRows.length,
        recording_count: linked.recordings.length,
        operation_count: linked.operations.length,
        attempt_count: linked.attempts.length,
        revision_count: linked.revisions.length,
        evaluation_count: linked.evaluations.length,
        contribution_count: linked.contributions.length,
        quarantine_count: linked.evaluations.length === 0 ? 0 : Number.NaN,
        corpus_case_count: linked.cases.length,
      };
    },
  };
}

function safeErrorCode(error) {
  const message = String(error?.message ?? "");
  if (/authorization|execution flag/iu.test(message)) return "authorization_required";
  if (/configuration/iu.test(message)) return "configuration_invalid";
  if (/eligibility/iu.test(message)) return "eligibility_not_zero";
  if (/rollback/iu.test(message)) return "rollback_failed";
  if (/cleanup|deletion/iu.test(message)) return "cleanup_failed";
  if (/lineage|behavior control|evaluation rows/iu.test(message)) return "lineage_proof_failed";
  return "hosted_canary_failed";
}

async function main() {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    assertExecutionAuthorized({ executeHosted: args.executeHosted, env: process.env });
    const result = await runLineageCanary({
      runtime: createHostedRuntime({ env: process.env }),
    });
    assertPrivacySafeCanaryOutput(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: "fail", error: safeErrorCode(error) }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
