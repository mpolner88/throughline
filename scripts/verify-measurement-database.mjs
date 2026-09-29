import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildStartingStateClassificationSql,
  startingStateRelationInventorySql,
} from "./preview-branch-contract.mjs";
import {
  assertMeasurementContractPass,
  measurementContractDefinition,
  parseMeasurementContractRows,
} from "./measurement-structured-contract.mjs";

const REQUIRED_CLI_VERSION = "2.98.2";
const EXPECTED_MIGRATION = "20260817180709_measurement_attribution.sql";
const EXPECTED_MIGRATION_HASH =
  "1b530402ede8f4546ab355ce1af8caf3741b17e848d739151bc8a10666ee0b7d";
const EXPECTED_TEST = "measurement_attribution_test.sql";
const EXPECTED_TEST_HASH =
  "de319fb4c1997a3c8a6a64cfe102f556d4134a82f22648608461b4fc396e1d4d";
const HARDENING_MIGRATION =
  "20260818061933_measurement_privilege_hardening.sql";
const HARDENING_MIGRATION_HASH =
  "2997ea280d6ea825b0561e15adbb54fe4edfbb5e30626840df50cc61d1be3162";
const HARDENING_TEST = "measurement_privilege_hardening_test.sql";
const HARDENING_TEST_HASH =
  "5be986f4815b066d6321127e484da3a574f92ee5c196d777e4fd6286e8bf1e7b";
const BASELINE_TEST = "measurement_attribution_baseline_test.sql";
const BASELINE_TEST_HASH =
  "93a7f6ab1eed1d2974796d39023a05e73b8025d0c3f8224e5f4ddb1d4ba7a7e2";
const BASELINE_TEST_COUNT = 21;
const HARDENING_TEST_COUNT = 7;
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;
const DEFAULT_TERMINATE_GRACE_MS = 250;
const MAX_DATABASE_FAILURE_SCAN_CHARACTERS = 32_768;
const MAX_PGTAP_FAILURE_SCAN_CHARACTERS = 32_768;
const MAX_SAFE_FAILURE_SUMMARY_CHARACTERS = 128;
const MAX_PGTAP_ASSERTION_NUMBER = 30;
const BASELINE_MIGRATIONS = [
  "0001_throughline_memory.sql",
  "20260510025558_enable_rls_for_throughline.sql",
  "20260516173641_user_accounts_and_mcp_tokens.sql",
  "20260806044304_product_feedback_and_events.sql",
];
const EXPECTED_HISTORY = [
  "0001",
  "20260510025558",
  "20260516173641",
  "20260806044304",
];
const EXPECTED_BASELINE_TABLES = [
  "throughline_feedback",
  "throughline_mcp_tokens",
  "throughline_product_events",
  "throughline_product_feedback",
  "throughline_profiles",
  "throughline_recordings",
];
const MIGRATION_PHASES = [
  {
    contractPhase: "measurement_attribution",
    label: "measurement attribution",
    migration: EXPECTED_MIGRATION,
    migrationHash: EXPECTED_MIGRATION_HASH,
    test: EXPECTED_TEST,
    testHash: EXPECTED_TEST_HASH,
    tests: 30,
    version: "20260817180709",
  },
  {
    contractPhase: "privilege_hardening",
    label: "privilege hardening",
    migration: HARDENING_MIGRATION,
    migrationHash: HARDENING_MIGRATION_HASH,
    test: HARDENING_TEST,
    testHash: HARDENING_TEST_HASH,
    tests: HARDENING_TEST_COUNT,
    version: "20260818061933",
  },
];
const PHASE_ORACLES = new Map([
  ["baseline", {
    test: BASELINE_TEST,
    tests: BASELINE_TEST_COUNT,
  }],
  ...MIGRATION_PHASES.map((phase) => [phase.contractPhase, {
    test: phase.test,
    tests: phase.tests,
  }]),
]);
const MEASUREMENT_EQUIVALENCE_FIXTURES = [
  {
    phase: "baseline",
    expectedAssertions: [4],
    mutationSql:
      "alter table public.throughline_product_events add column schema_version smallint",
    restoreSql:
      "alter table public.throughline_product_events drop column schema_version",
  },
  {
    phase: "measurement_attribution",
    expectedAssertions: [8],
    mutationSql: `alter table public.throughline_product_events
      alter column distribution_channel set default 'UNKNOWN'`,
    restoreSql: `alter table public.throughline_product_events
      alter column distribution_channel set default 'unknown'`,
  },
  {
    phase: "measurement_attribution",
    expectedAssertions: [10],
    mutationSql: `alter table public.throughline_product_events
      add constraint throughline_product_events_equivalence_guard
      check (not (schema_version = 2 and distribution_channel = 'app_store'))
      not valid`,
    restoreSql: `alter table public.throughline_product_events
      drop constraint throughline_product_events_equivalence_guard`,
  },
  {
    phase: "measurement_attribution",
    expectedAssertions: [10],
    mutationSql: `create index throughline_product_events_equivalence_expression_idx
      on public.throughline_product_events
      ((1 / (schema_version - schema_version)))`,
    restoreSql:
      "drop index public.throughline_product_events_equivalence_expression_idx",
  },
  {
    phase: "measurement_attribution",
    expectedAssertions: [11],
    mutationSql: `alter table public.throughline_product_events
      drop constraint throughline_product_events_schema_version_check,
      add constraint throughline_product_events_schema_version_check
      check (schema_version in (1, 2, 3))`,
    restoreSql: `alter table public.throughline_product_events
      drop constraint throughline_product_events_schema_version_check,
      add constraint throughline_product_events_schema_version_check
      check (schema_version in (1, 2))`,
  },
  {
    phase: "measurement_attribution",
    expectedAssertions: [12],
    mutationSql: `alter table public.throughline_product_events
      drop constraint throughline_product_events_distribution_channel_check,
      add constraint throughline_product_events_distribution_channel_check
      check (distribution_channel in (
        'debug', 'testflight', 'app_store', 'unknown', 'sandbox'
      ))`,
    restoreSql: `alter table public.throughline_product_events
      drop constraint throughline_product_events_distribution_channel_check,
      add constraint throughline_product_events_distribution_channel_check
      check (distribution_channel in (
        'debug', 'testflight', 'app_store', 'unknown'
      ))`,
  },
  {
    phase: "privilege_hardening",
    expectedAssertions: [2],
    mutationSql:
      "grant delete on table public.throughline_profiles to authenticated",
    restoreSql:
      "revoke delete on table public.throughline_profiles from authenticated",
  },
];
const TEMP_PREFIX = "throughline-measurement-db-";
const TRUSTED_TEMP_ROOTS = new Set(["/private/tmp", "/tmp"]);
const LOCAL_SERVICES_TO_EXCLUDE = [
  "realtime",
  "imgproxy",
  "mailpit",
  "postgres-meta",
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "supavisor",
];
const API_READ_PROBES = [
  { table: "throughline_recordings", column: "id" },
  { table: "throughline_feedback", column: "id" },
  { table: "throughline_product_events", column: "id" },
  { table: "throughline_product_feedback", column: "id" },
];
const ALLOWLIST_READ_PROBE = {
  table: "throughline_internal_users",
  column: "auth_user_id",
};
const STARTING_STATE_RELATION_INVENTORY_SQL =
  startingStateRelationInventorySql();
const STARTING_STATE_COLUMNS = [
  "history",
  "tables",
  "measurement_column_count",
  "measurement_constraint_count",
  "measurement_index_exists",
  "allowlist_exists",
  "auth_user_count",
  "storage_object_count",
  "bucket_count",
  "throughline_bucket_count",
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

const stripAnsi = (value) =>
  value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");

function pendingMigrationFilenames(output) {
  return [...stripAnsi(String(output)).matchAll(
    /^\s*[•*]\s+([0-9][A-Za-z0-9_-]*\.sql)\s*$/gmu,
  )].map((match) => match[1]);
}

export function assertExactPendingMigrations(output, expectedFilenames) {
  if (
    !Array.isArray(expectedFilenames) ||
    expectedFilenames.length === 0 ||
    expectedFilenames.some((filename) =>
      typeof filename !== "string" ||
      !/^[0-9][A-Za-z0-9_-]*\.sql$/u.test(filename)
    ) ||
    new Set(expectedFilenames).size !== expectedFilenames.length
  ) {
    throw new TypeError("Expected migrations must be unique frozen SQL filenames");
  }
  const filenames = pendingMigrationFilenames(output);
  if (
    filenames.length !== expectedFilenames.length ||
    filenames.some((filename, index) => filename !== expectedFilenames[index])
  ) {
    throw new Error("Expected exact pending migration sequence in frozen order");
  }
  return filenames;
}

export function assertExactPendingMigration(output, expectedFilename) {
  let filenames;
  try {
    filenames = assertExactPendingMigrations(output, [expectedFilename]);
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new Error("Expected exactly one pending migration with the frozen filename");
  }
  return filenames[0];
}

function assertSingleExactPgTapPass(output, expectedTests) {
  const clean = stripAnsi(String(output));
  const summaries = [...clean.matchAll(/^Files=(\d+),\s+Tests=(\d+),.*$/gmu)];
  const results = [...clean.matchAll(/^Result:\s+(PASS|FAIL)\s*$/gmu)];
  if (
    summaries.length !== 1 ||
    results.length !== 1 ||
    Number(summaries[0][1]) !== 1 ||
    Number(summaries[0][2]) !== expectedTests ||
    results[0][1] !== "PASS"
  ) {
    throw new Error(
      `Expected exact pgTAP Files=1, Tests=${expectedTests}, Result: PASS`,
    );
  }
  return { files: 1, tests: expectedTests, result: "PASS" };
}

export function assertExactPgTapPass(output) {
  return assertSingleExactPgTapPass(output, 30);
}

export function assertExactBaselinePgTapPass(output) {
  return assertSingleExactPgTapPass(output, BASELINE_TEST_COUNT);
}

export function assertExactHardeningPgTapPass(output) {
  return assertSingleExactPgTapPass(output, HARDENING_TEST_COUNT);
}

export function measurementMigrationPhases() {
  return MIGRATION_PHASES.map(({ migration, test, tests }) => ({
    migration,
    test,
    tests,
  }));
}

export function measurementEquivalenceFixtures() {
  return MEASUREMENT_EQUIVALENCE_FIXTURES.map((fixture) => ({
    ...fixture,
    expectedAssertions: [...fixture.expectedAssertions],
  }));
}

export function parseSafePgTapFailureAssertions(error) {
  if (!(error instanceof Error)) {
    throw new Error("pgTAP equivalence fixture returned an invalid safe failure");
  }
  const match = error.message.match(
    / failed with exit code \d+ \(failed assertions: ([1-9]\d*(?:,[1-9]\d*)*)\)$/u,
  );
  const assertions = match?.[1].split(",").map(Number) ?? [];
  const valid = assertions.length > 0 && assertions.every((value, index) =>
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_PGTAP_ASSERTION_NUMBER &&
    (index === 0 || assertions[index - 1] < value)
  );
  if (!valid) {
    throw new Error("pgTAP equivalence fixture returned an invalid safe failure");
  }
  return assertions;
}

export function assertEquivalentMeasurementFailures({
  phase,
  pgTapError,
  structuredRows,
  expectedAssertions,
}) {
  const pgTapFailures = parseSafePgTapFailureAssertions(pgTapError);
  const structuredFailures = parseMeasurementContractRows(
    phase,
    structuredRows,
  ).failedAssertions;
  const expected = Array.isArray(expectedAssertions)
    ? expectedAssertions
    : [];
  const exact = (left, right) =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);
  if (
    !exact(pgTapFailures, expected) ||
    !exact(structuredFailures, expected)
  ) {
    throw new Error("Measurement oracle equivalence mismatch");
  }
  return { phase, failedAssertions: [...expected] };
}

export function serviceRoleRestProbes(includeAllowlist) {
  if (typeof includeAllowlist !== "boolean") {
    throw new TypeError("REST probes require Boolean allowlist selection");
  }
  const probes = includeAllowlist
    ? [...API_READ_PROBES, ALLOWLIST_READ_PROBE]
    : API_READ_PROBES;
  return probes.map(({ table, column }) => ({ table, column }));
}

export function summarizePgTapFailure(output) {
  const clean = stripAnsi(String(output));
  const directNumbers = [...clean.matchAll(
    /^\s*(?:not ok|#\s*Failed test)\s+(\d+)\b/gmu,
  )].map((match) => Number(match[1]));
  const summaryNumbers = [...clean.matchAll(
    /^\s*Failed tests?:\s+([0-9][0-9\s,]*)\s*$/gmu,
  )].flatMap((match) => match[1].split(/[\s,]+/u).map(Number));
  const assertionNumbers = [...directNumbers, ...summaryNumbers]
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  const unique = [...new Set(assertionNumbers)].sort((left, right) => left - right);
  return unique.length > 0
    ? `failed assertions: ${unique.join(",")}`
    : "failed assertions unavailable";
}

function isKnownPgTapInvocationFailure(output) {
  return /\b(?:unknown command|unknown flag|unknown shorthand flag|flag provided but not defined|flag needs an argument|failed to parse connection string|invalid dsn)\b/u.test(
    output,
  ) || /(?:^|\n)\s*usage:\s*(?:\r?\n\s*)?supabase\s+(?:db\s+test|test\s+db)\b/imu.test(
    output,
  );
}

function isTapShapedOutput(output) {
  return /^\s*(?:TAP version \d+|(?:ok|not ok)\b|1\.\.\d+\b|#\s*Failed test\b|Failed tests?:\b|Files=\d+,\s*Tests=\d+\b|Result:\s*(?:PASS|FAIL)\b)/mu.test(
    output,
  );
}

function isSafePgTapAssertionSummary(summary) {
  if (
    typeof summary !== "string" ||
    summary.length > MAX_SAFE_FAILURE_SUMMARY_CHARACTERS ||
    !/^failed assertions: [1-9]\d*(?:,[1-9]\d*)*$/u.test(summary)
  ) {
    return false;
  }
  return summary
    .slice("failed assertions: ".length)
    .split(",")
    .every((value) => Number(value) <= MAX_PGTAP_ASSERTION_NUMBER);
}

export function summarizeDatabaseCommandFailure(output) {
  const clean = stripAnsi(String(output))
    .slice(0, MAX_DATABASE_FAILURE_SCAN_CHARACTERS)
    .toLowerCase();
  if (
    /(?:password authentication failed|authentication failed|invalid password|no pg_hba\.conf entry|\b28p01\b|\b28000\b)/u.test(
      clean,
    )
  ) {
    return "database failure category: authentication";
  }
  if (
    /(?:permission denied|insufficient privilege|must be (?:owner|superuser)|syntax error|undefined (?:table|column|function|schema)|does not exist|\b42501\b|\b42p01\b|\b42703\b|\b42883\b|catalog)/u.test(
      clean,
    )
  ) {
    return "database failure category: sql_or_permission_or_catalog";
  }
  if (
    /(?:could not connect|failed to connect to postgres|failed to connect to [`']?host|connection (?:refused|reset|terminated|timed out)|server closed the connection|network is unreachable|no route to host|econnrefused|econnreset|etimedout|timed out|\btimeout\b|deadline exceeded|could not translate host name|temporary failure in name resolution|getaddrinfo|tenant or user not found|unexpected eof|driver:\s*bad connection|\b08[0-9a-z]{3}\b)/u.test(
      clean,
    )
  ) {
    return "database failure category: connection_or_timeout";
  }
  return "database failure category: unknown";
}

export function summarizePgTapCommandFailure(output) {
  const completeClean = stripAnsi(String(output));
  const sourceFitsPgTapScan =
    completeClean.length <= MAX_PGTAP_FAILURE_SCAN_CHARACTERS;
  const clean = completeClean.slice(0, MAX_PGTAP_FAILURE_SCAN_CHARACTERS);
  if (sourceFitsPgTapScan) {
    const assertionSummary = summarizePgTapFailure(clean);
    if (isSafePgTapAssertionSummary(assertionSummary)) {
      return assertionSummary;
    }
  }

  const databaseSummary = summarizeDatabaseCommandFailure(clean);
  if (databaseSummary !== "database failure category: unknown") {
    return databaseSummary;
  }

  if (isKnownPgTapInvocationFailure(clean)) {
    return "pgTAP failure category: invocation";
  }
  if (isTapShapedOutput(clean)) {
    return "pgTAP failure category: malformed_or_no_summary";
  }
  return "pgTAP failure category: unknown";
}

function isAllowedFailureSummary(candidate) {
  return typeof candidate === "string" &&
    candidate.length <= MAX_SAFE_FAILURE_SUMMARY_CHARACTERS &&
    /^(?:failed assertions: [1-9]\d*(?:,[1-9]\d*)*|failed assertions unavailable|database failure category: (?:connection_or_timeout|sql_or_permission_or_catalog|authentication|unknown)|pgTAP failure category: (?:invocation|malformed_or_no_summary|unknown))$/u
      .test(candidate);
}

export function assertFrozenHash(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} SHA-256 mismatch`);
  }
  return actual;
}

export function resolveMeasurementTemporaryRoot(platform = process.platform) {
  if (platform === "darwin") return "/private/tmp";
  if (platform === "linux") return "/tmp";
  throw new Error(`Unsupported measurement database platform: ${platform}`);
}

export function buildCleanupPlan({ workdir, projectId, temporaryRoot }) {
  const resolvedWorkdir = resolve(workdir);
  const resolvedTemporaryRoot = resolve(temporaryRoot);
  const uniqueProjectPattern = new RegExp(`^${TEMP_PREFIX}[a-z0-9]{6,}$`, "i");
  const valid = TRUSTED_TEMP_ROOTS.has(resolvedTemporaryRoot) &&
    uniqueProjectPattern.test(projectId) &&
    resolvedWorkdir === join(resolvedTemporaryRoot, projectId) &&
    basename(resolvedWorkdir) === projectId;
  if (!valid) {
    throw new Error("Cleanup requires a validated unique temporary project");
  }
  return {
    stopArgs: [
      "--workdir",
      resolvedWorkdir,
      "--agent=no",
      "stop",
      "--project-id",
      projectId,
      "--no-backup",
    ],
    removeDirectory: resolvedWorkdir,
  };
}

export async function runBoundedCommand(
  command,
  args,
  label,
  {
    timeoutMs = 300_000,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    terminateGraceMs = DEFAULT_TERMINATE_GRACE_MS,
    summarizeFailure = null,
  } = {},
) {
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes <= 0 ||
    !Number.isSafeInteger(terminateGraceMs) ||
    terminateGraceMs <= 0 ||
    (summarizeFailure !== null && typeof summarizeFailure !== "function")
  ) {
    throw new TypeError("Command bounds must be positive safe integers");
  }

  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failure = null;
    let settled = false;
    let terminateTimer = null;

    const settle = (action, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (terminateTimer !== null) clearTimeout(terminateTimer);
      action(value);
    };

    const terminate = (reason) => {
      if (failure !== null) return;
      failure = reason;
      child.kill("SIGTERM");
      terminateTimer = setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, terminateGraceMs);
    };

    const timeout = setTimeout(() => {
      terminate(new Error(`${label} exceeded its bounded timeout`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (failure !== null) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) {
        terminate(new Error(`${label} stdout exceeded bounded output`));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (failure !== null) return;
      stderrBytes += chunk.length;
      if (stderrBytes > maxOutputBytes) {
        terminate(new Error(`${label} stderr exceeded bounded output`));
        return;
      }
      stderrChunks.push(chunk);
    });
    child.on("error", (error) => {
      settle(
        rejectPromise,
        new Error(`${label} could not start: ${error.code ?? "unknown"}`),
      );
    });
    child.on("close", (code) => {
      if (failure !== null) {
        settle(rejectPromise, failure);
      } else if (code !== 0) {
        let safeSummary = "";
        if (summarizeFailure !== null) {
          try {
            const candidate = summarizeFailure(
              `${Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8")}\n${
                Buffer.concat(stderrChunks, stderrBytes).toString("utf8")
              }`,
            );
            safeSummary = isAllowedFailureSummary(candidate)
              ? ` (${candidate})`
              : " (failure summary unavailable)";
          } catch {
            safeSummary = " (failure summary unavailable)";
          }
        }
        settle(
          rejectPromise,
          new Error(`${label} failed with exit code ${code}${safeSummary}`),
        );
      } else {
        settle(resolvePromise, {
          stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"),
          stderr: Buffer.concat(stderrChunks, stderrBytes).toString("utf8"),
        });
      }
    });
  });
}

const runCommand = runBoundedCommand;

async function sha256File(path) {
  const bytes = await readFile(path);
  return createHash("sha256").update(bytes).digest("hex");
}

async function createIsolatedProject() {
  const suffix = randomBytes(8).toString("hex");
  const projectId = `${TEMP_PREFIX}${suffix}`;
  const temporaryRoot = resolveMeasurementTemporaryRoot();
  const workdir = join(temporaryRoot, projectId);
  const supabaseDirectory = join(workdir, "supabase");
  const migrationsDirectory = join(supabaseDirectory, "migrations");
  const testsDirectory = join(supabaseDirectory, "tests");
  const project = {
    projectId,
    temporaryRoot,
    workdir,
    migrationsDirectory,
    testsDirectory,
  };

  try {
    await mkdir(migrationsDirectory, { recursive: true, mode: 0o700 });
    await mkdir(testsDirectory, { recursive: true, mode: 0o700 });

    const sourceConfig = await readFile(
      join(repositoryRoot, "supabase", "config.toml"),
      "utf8",
    );
    if (!/^project_id = "Throughline"$/mu.test(sourceConfig)) {
      throw new Error("Source config has an unexpected project identifier");
    }
    const isolatedConfig = sourceConfig.replace(
      /^project_id = "Throughline"$/mu,
      `project_id = "${projectId}"`,
    );
    await writeFile(join(supabaseDirectory, "config.toml"), isolatedConfig, {
      mode: 0o600,
    });
    await writeFile(
      join(supabaseDirectory, "seed.sql"),
      "-- Intentionally empty: this gate is data-less.\n",
      { mode: 0o600 },
    );

    for (const filename of [BASELINE_TEST, EXPECTED_TEST, HARDENING_TEST]) {
      await copyFile(
        join(repositoryRoot, "supabase", "tests", filename),
        join(testsDirectory, filename),
      );
    }
    return project;
  } catch (error) {
    const plan = buildCleanupPlan(project);
    await rm(plan.removeDirectory, { recursive: true, force: true });
    throw error;
  }
}

function combineCommandOutput(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function parseJsonWithoutEcho(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} did not return valid JSON`);
  }
}

function extractRows(value, label) {
  const rows = Array.isArray(value)
    ? value
    : value !== null && typeof value === "object" && Array.isArray(value.result)
    ? value.result
    : null;
  if (rows === null) {
    throw new Error(`${label} did not return a JSON row array`);
  }
  return rows;
}

function hasExactOwnKeys(value, expectedKeys) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join("\n") ===
      [...expectedKeys].sort().join("\n");
}

function requireStartingStateRelationInventory(rows) {
  const fields = [
    "migration_history_exists",
    "auth_users_exists",
    "storage_objects_exists",
    "storage_buckets_exists",
  ];
  if (
    rows.length !== 1 ||
    !hasExactOwnKeys(rows[0], fields) ||
    fields.some((field) => typeof rows[0][field] !== "boolean")
  ) {
    throw new Error("Starting-state relation inventory returned an invalid shape");
  }
  return {
    migrationHistory: rows[0].migration_history_exists,
    authUsers: rows[0].auth_users_exists,
    storageObjects: rows[0].storage_objects_exists,
    storageBuckets: rows[0].storage_buckets_exists,
  };
}

export function assertFullReplayStartingState(rows) {
  const valid = Array.isArray(rows) &&
    rows.length === 1 &&
    hasExactOwnKeys(rows[0], STARTING_STATE_COLUMNS) &&
    Array.isArray(rows[0].history) &&
    rows[0].history.length === 0 &&
    Array.isArray(rows[0].tables) &&
    rows[0].tables.length === 0 &&
    rows[0].measurement_column_count === 0 &&
    rows[0].measurement_constraint_count === 0 &&
    rows[0].measurement_index_exists === false &&
    rows[0].allowlist_exists === false &&
    rows[0].auth_user_count === 0 &&
    rows[0].storage_object_count === 0 &&
    rows[0].bucket_count === 0 &&
    rows[0].throughline_bucket_count === 0;
  if (!valid) {
    throw new Error("Expected exact full-replay data-less starting state");
  }
  return "full-replay";
}

const exactArray = (actual, expected) =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((value, index) => value === expected[index]);

export function assertDeltaOnlyStartingState(rows) {
  const valid = Array.isArray(rows) &&
    rows.length === 1 &&
    hasExactOwnKeys(rows[0], STARTING_STATE_COLUMNS) &&
    exactArray(rows[0].history, EXPECTED_HISTORY) &&
    exactArray(rows[0].tables, EXPECTED_BASELINE_TABLES) &&
    rows[0].measurement_column_count === 0 &&
    rows[0].measurement_constraint_count === 0 &&
    rows[0].measurement_index_exists === false &&
    rows[0].allowlist_exists === false &&
    rows[0].auth_user_count === 0 &&
    rows[0].storage_object_count === 0 &&
    rows[0].bucket_count === 1 &&
    rows[0].throughline_bucket_count === 1;
  if (!valid) {
    throw new Error("Expected exact delta-only data-less starting state");
  }
  return "delta-only";
}

async function runDatabaseProbe(workdir, label, sql) {
  const probeDirectory = join(workdir, "database-probes");
  await mkdir(probeDirectory, { recursive: true, mode: 0o700 });
  const sqlFile = join(probeDirectory, `${label}.sql`);
  await writeFile(sqlFile, `${sql.trim()}\n`, { mode: 0o600 });
  await chmod(sqlFile, 0o600);
  const result = await runCommand(
    "supabase",
    [
      "--workdir",
      workdir,
      "--agent=no",
      "db",
      "query",
      "--local",
      "--output",
      "json",
      "--file",
      sqlFile,
    ],
    `database probe ${label}`,
    { summarizeFailure: summarizeDatabaseCommandFailure },
  );
  return extractRows(parseJsonWithoutEcho(result.stdout, label), label);
}

function requirePhaseOracle(phase) {
  const oracle = PHASE_ORACLES.get(phase);
  if (oracle === undefined) {
    throw new Error("Unknown measurement oracle phase");
  }
  return oracle;
}

async function runPgTapOracle(project, phase, label) {
  const oracle = requirePhaseOracle(phase);
  return await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "test",
      join(project.testsDirectory, oracle.test),
      "--local",
    ],
    label,
    { summarizeFailure: summarizePgTapCommandFailure },
  );
}

async function runStructuredContractRows(workdir, phase, label) {
  const definition = measurementContractDefinition(phase);
  return await runDatabaseProbe(workdir, label, definition.sql);
}

async function runPhaseOraclePass(project, phase, label) {
  const oracle = requirePhaseOracle(phase);
  const pgTapResult = await runPgTapOracle(
    project,
    phase,
    `${label} pgTAP`,
  );
  assertSingleExactPgTapPass(combineCommandOutput(pgTapResult), oracle.tests);
  const structuredRows = await runStructuredContractRows(
    project.workdir,
    phase,
    `${label}-structured`,
  );
  assertMeasurementContractPass(phase, structuredRows);
}

async function runDatabaseFixtureSql(workdir, label, sql) {
  if (
    typeof label !== "string" ||
    !/^[a-z0-9-]+$/u.test(label) ||
    typeof sql !== "string" ||
    sql.trim().length === 0 ||
    sql.includes(";")
  ) {
    throw new Error("Measurement equivalence fixture is not one bounded statement");
  }
  const fixtureDirectory = join(workdir, "equivalence-fixtures");
  await mkdir(fixtureDirectory, { recursive: true, mode: 0o700 });
  const sqlFile = join(fixtureDirectory, `${label}.sql`);
  await writeFile(sqlFile, `${sql.trim()};\n`, { mode: 0o600 });
  await chmod(sqlFile, 0o600);
  await runCommand(
    "supabase",
    [
      "--workdir",
      workdir,
      "--agent=no",
      "db",
      "query",
      "--local",
      "--file",
      sqlFile,
    ],
    `measurement equivalence fixture ${label}`,
    { summarizeFailure: summarizeDatabaseCommandFailure },
  );
}

async function runEquivalenceFixturesForPhase(project, phase) {
  const fixtures = measurementEquivalenceFixtures()
    .filter((fixture) => fixture.phase === phase);
  for (const [index, fixture] of fixtures.entries()) {
    const safePhase = phase.replaceAll("_", "-");
    const fixtureLabel = `${safePhase}-${index + 1}`;
    let mutationApplied = false;
    let fixtureFailure = null;
    let restoreFailure = null;
    try {
      await runDatabaseFixtureSql(
        project.workdir,
        `${fixtureLabel}-mutate`,
        fixture.mutationSql,
      );
      mutationApplied = true;
      let pgTapError = null;
      try {
        await runPgTapOracle(
          project,
          phase,
          `${fixtureLabel} expected-failure pgTAP`,
        );
      } catch (error) {
        pgTapError = error;
      }
      if (pgTapError === null) {
        throw new Error("Measurement pgTAP equivalence fixture unexpectedly passed");
      }
      const structuredRows = await runStructuredContractRows(
        project.workdir,
        phase,
        `${fixtureLabel}-expected-failure-structured`,
      );
      assertEquivalentMeasurementFailures({
        phase,
        pgTapError,
        structuredRows,
        expectedAssertions: fixture.expectedAssertions,
      });
    } catch (error) {
      fixtureFailure = error;
    } finally {
      if (mutationApplied) {
        try {
          await runDatabaseFixtureSql(
            project.workdir,
            `${fixtureLabel}-restore`,
            fixture.restoreSql,
          );
          await runPhaseOraclePass(
            project,
            phase,
            `${fixtureLabel} restored`,
          );
        } catch {
          restoreFailure = new Error(
            "Measurement equivalence fixture restore verification failed",
          );
        }
      }
    }
    if (restoreFailure !== null) throw restoreFailure;
    if (fixtureFailure !== null) throw fixtureFailure;
  }
}

async function requireFullReplayDatabase(workdir) {
  const inventoryRows = await runDatabaseProbe(
    workdir,
    "starting-relation-inventory",
    STARTING_STATE_RELATION_INVENTORY_SQL,
  );
  const inventory = requireStartingStateRelationInventory(inventoryRows);
  const rows = await runDatabaseProbe(
    workdir,
    "starting-state",
    buildStartingStateClassificationSql(inventory),
  );
  assertFullReplayStartingState(rows);
}

async function requireDeltaOnlyClassificationDatabase(workdir) {
  const inventoryRows = await runDatabaseProbe(
    workdir,
    "baseline-relation-inventory",
    STARTING_STATE_RELATION_INVENTORY_SQL,
  );
  const inventory = requireStartingStateRelationInventory(inventoryRows);
  const rows = await runDatabaseProbe(
    workdir,
    "baseline-starting-state",
    buildStartingStateClassificationSql(inventory),
  );
  assertDeltaOnlyStartingState(rows);
}

function requireSingleTrueRow(rows, expectedFields, label) {
  if (rows.length !== 1 || rows[0] === null || typeof rows[0] !== "object") {
    throw new Error(`${label} did not return one aggregate row`);
  }
  for (const field of expectedFields) {
    if (rows[0][field] !== true) {
      throw new Error(`${label} failed ${field}`);
    }
  }
}

async function requireBaselineDatabase(workdir) {
  const rows = await runDatabaseProbe(
    workdir,
    "baseline",
    `
      select
        (select array_agg(version order by version)
          from supabase_migrations.schema_migrations) =
          array['${EXPECTED_HISTORY.join("','")}']::text[] as history_ok,
        (select array_agg(tablename order by tablename)
          from pg_tables
          where schemaname = 'public'
            and tablename like 'throughline_%') =
          array[
            'throughline_feedback',
            'throughline_mcp_tokens',
            'throughline_product_events',
            'throughline_product_feedback',
            'throughline_profiles',
            'throughline_recordings'
          ]::name[] as tables_ok,
        not exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'throughline_product_events'
            and column_name in (
              'schema_version', 'distribution_channel',
              'is_internal_user', 'recording_id'
            )
        ) as measurement_columns_absent,
        to_regclass('public.throughline_internal_users') is null
          as allowlist_absent,
        (select count(*) = 0 from public.throughline_recordings)
          and (select count(*) = 0 from public.throughline_feedback)
          and (select count(*) = 0 from public.throughline_profiles)
          and (select count(*) = 0 from public.throughline_mcp_tokens)
          and (select count(*) = 0 from public.throughline_product_events)
          and (select count(*) = 0 from public.throughline_product_feedback)
          as throughline_rows_empty,
        (select count(*) = 0 from auth.users) as auth_rows_empty,
        (select count(*) = 0 from storage.objects) as storage_rows_empty,
        (select count(*) = 1 from storage.buckets
          where id = 'throughline-audio' and public = false)
          and (select count(*) = 1 from storage.buckets)
          as bucket_ok;
    `,
  );
  requireSingleTrueRow(
    rows,
    [
      "history_ok",
      "tables_ok",
      "measurement_columns_absent",
      "allowlist_absent",
      "throughline_rows_empty",
      "auth_rows_empty",
      "storage_rows_empty",
      "bucket_ok",
    ],
    "baseline database contract",
  );
}

async function requirePostMigrationDatabase(workdir, expectedHistory, label) {
  const rows = await runDatabaseProbe(
    workdir,
    label,
    `
      select
        (select array_agg(version order by version)
          from supabase_migrations.schema_migrations) =
          array['${expectedHistory.join("','")}']::text[]
          as history_ok,
        to_regclass('public.throughline_internal_users') is not null
          as allowlist_exists,
        (select count(*) = 4 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'throughline_product_events'
            and column_name in (
              'schema_version', 'distribution_channel',
              'is_internal_user', 'recording_id'
            )) as measurement_columns_exist,
        to_regclass('public.throughline_product_events_recording_id_idx')
          is not null as measurement_index_exists,
        (select count(*) = 0 from public.throughline_recordings)
          and (select count(*) = 0 from public.throughline_feedback)
          and (select count(*) = 0 from public.throughline_profiles)
          and (select count(*) = 0 from public.throughline_mcp_tokens)
          and (select count(*) = 0 from public.throughline_product_events)
          and (select count(*) = 0 from public.throughline_product_feedback)
          and (select count(*) = 0 from public.throughline_internal_users)
          as throughline_rows_empty,
        (select count(*) = 0 from auth.users) as auth_rows_empty,
        (select count(*) = 0 from storage.objects) as storage_rows_empty,
        (select count(*) = 1 from storage.buckets
          where id = 'throughline-audio' and public = false)
          and (select count(*) = 1 from storage.buckets)
          as bucket_ok;
    `,
  );
  requireSingleTrueRow(
    rows,
    [
      "history_ok",
      "allowlist_exists",
      "measurement_columns_exist",
      "measurement_index_exists",
      "throughline_rows_empty",
      "auth_rows_empty",
      "storage_rows_empty",
      "bucket_ok",
    ],
    `${label} database contract`,
  );
}

async function applyBaselineMigrations(project) {
  for (const filename of BASELINE_MIGRATIONS) {
    await copyFile(
      join(repositoryRoot, "supabase", "migrations", filename),
      join(project.migrationsDirectory, filename),
    );
  }
  const dryRunResult = await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "push",
      "--local",
      "--dry-run",
    ],
    "baseline-only local migration dry-run",
  );
  assertExactPendingMigrations(
    combineCommandOutput(dryRunResult),
    BASELINE_MIGRATIONS,
  );
  await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "push",
      "--local",
      "--yes",
    ],
    "explicit baseline migration apply",
  );
}

async function applyMigrationPhase(project, phase, ordinal) {
  await copyFile(
    join(repositoryRoot, "supabase", "migrations", phase.migration),
    join(project.migrationsDirectory, phase.migration),
  );
  const dryRunResult = await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "push",
      "--local",
      "--dry-run",
    ],
    `${ordinal}-only local migration dry-run`,
  );
  assertExactPendingMigration(
    combineCommandOutput(dryRunResult),
    phase.migration,
  );
  await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "push",
      "--local",
      "--yes",
    ],
    `explicit ${phase.label} migration apply`,
  );

  await runPhaseOraclePass(project, phase.contractPhase, phase.label);
  await runEquivalenceFixturesForPhase(project, phase.contractPhase);
}

function localRuntimeFromStatus(status) {
  if (status === null || typeof status !== "object") {
    throw new Error("Local status did not return an object");
  }
  const apiUrl = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  if (
    typeof apiUrl !== "string" ||
    !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/u.test(apiUrl) ||
    typeof serviceRoleKey !== "string" ||
    serviceRoleKey.length === 0
  ) {
    throw new Error("Local status omitted bounded local runtime values");
  }
  return { apiUrl, serviceRoleKey };
}

async function requireStatus(response, expectedStatus, label) {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} returned status ${response.status}`);
  }
}

export function assertEmptyHeadResponse(response, label) {
  if (response.status !== 200) {
    throw new Error(`${label} returned status ${response.status}`);
  }
  if (response.body !== null) {
    throw new Error(`${label} HEAD response unexpectedly included a body`);
  }
  const contentRange = response.headers.get("content-range");
  const match = contentRange?.match(/^(?:\*|\d+-\d+)\/(\d+)$/u) ?? null;
  if (match === null || Number(match[1]) !== 0) {
    throw new Error(`${label} did not report exact total count zero`);
  }
  return 0;
}

async function fetchLocal(url, options = {}) {
  return await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10_000),
  });
}

async function requireLocalServiceProbes(workdir, includeAllowlist) {
  const statusResult = await runCommand(
    "supabase",
    ["--workdir", workdir, "--agent=no", "status", "--output", "json"],
    "local service status",
  );
  const runtime = localRuntimeFromStatus(
    parseJsonWithoutEcho(statusResult.stdout, "local service status"),
  );
  const headers = {
    apikey: runtime.serviceRoleKey,
    Authorization: `Bearer ${runtime.serviceRoleKey}`,
  };
  const countHeaders = { ...headers, Prefer: "count=exact" };

  await requireStatus(
    await fetchLocal(`${runtime.apiUrl}/auth/v1/health`),
    200,
    "Auth health probe",
  );
  await requireStatus(
    await fetchLocal(`${runtime.apiUrl}/storage/v1/bucket`, { headers }),
    200,
    "Storage bucket-list probe",
  );
  for (const { table, column } of serviceRoleRestProbes(includeAllowlist)) {
    assertEmptyHeadResponse(
      await fetchLocal(
        `${runtime.apiUrl}/rest/v1/${table}?select=${column}&limit=1`,
        { method: "HEAD", headers: countHeaders },
      ),
      `service-role REST probe for ${table}`,
    );
  }
}

async function runGate(project) {
  const versionResult = await runCommand(
    "supabase",
    ["--version"],
    "Supabase CLI version check",
  );
  if (versionResult.stdout.trim() !== REQUIRED_CLI_VERSION) {
    throw new Error(`Supabase CLI must be exactly ${REQUIRED_CLI_VERSION}`);
  }

  const startResult = await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "start",
      "--exclude",
      LOCAL_SERVICES_TO_EXCLUDE.join(","),
    ],
    "bounded local Supabase start",
  );
  void startResult;

  await requireFullReplayDatabase(project.workdir);
  await applyBaselineMigrations(project);

  await runPhaseOraclePass(project, "baseline", "baseline");
  await runEquivalenceFixturesForPhase(project, "baseline");
  await requireBaselineDatabase(project.workdir);
  await requireDeltaOnlyClassificationDatabase(project.workdir);

  const [measurementPhase, hardeningPhase] = MIGRATION_PHASES;
  await applyMigrationPhase(project, measurementPhase, "fifth");
  await requirePostMigrationDatabase(
    project.workdir,
    [...EXPECTED_HISTORY, measurementPhase.version],
    "post-measurement",
  );

  await applyMigrationPhase(project, hardeningPhase, "sixth");
  await requirePostMigrationDatabase(
    project.workdir,
    [...EXPECTED_HISTORY, measurementPhase.version, hardeningPhase.version],
    "post-hardening",
  );
  await requireLocalServiceProbes(project.workdir, true);

  await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "lint",
      "--local",
      "--schema",
      "public",
      "--level",
      "warning",
      "--fail-on",
      "warning",
    ],
    "public-schema lint",
  );
  for (const advisorType of ["security", "performance"]) {
    await runCommand(
      "supabase",
      [
        "--workdir",
        project.workdir,
        "--agent=no",
        "db",
        "advisors",
        "--local",
        "--type",
        advisorType,
        "--level",
        "warn",
        "--fail-on",
        "warn",
      ],
      `${advisorType} advisors`,
    );
  }
}

async function cleanupProject(project) {
  const plan = buildCleanupPlan(project);
  const stat = await lstat(plan.removeDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Cleanup target is not the validated temporary directory");
  }
  let stopFailure = null;
  try {
    await runCommand("supabase", plan.stopArgs, "unique local Supabase stop");
  } catch (error) {
    stopFailure = error;
  }
  await rm(plan.removeDirectory, { recursive: true, force: false });
  if (stopFailure !== null) {
    throw stopFailure;
  }
}

export async function main() {
  assertFrozenHash(
    await sha256File(join(repositoryRoot, "supabase", "tests", BASELINE_TEST)),
    BASELINE_TEST_HASH,
    "baseline pgTAP",
  );
  for (const phase of MIGRATION_PHASES) {
    assertFrozenHash(
      await sha256File(
        join(repositoryRoot, "supabase", "migrations", phase.migration),
      ),
      phase.migrationHash,
      `${phase.label} migration`,
    );
    assertFrozenHash(
      await sha256File(join(repositoryRoot, "supabase", "tests", phase.test)),
      phase.testHash,
      `${phase.label} pgTAP`,
    );
  }

  let project = null;
  let gateFailure = null;
  try {
    project = await createIsolatedProject();
    await runGate(project);
  } catch (error) {
    gateFailure = error;
  } finally {
    if (project !== null) {
      try {
        await cleanupProject(project);
      } catch (error) {
        gateFailure ??= error;
      }
    }
  }
  if (gateFailure !== null) {
    throw gateFailure;
  }
  console.log("Measurement database gate passed.");
}

const isEntryPoint = process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isEntryPoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Database gate failed");
    process.exitCode = 1;
  });
}
