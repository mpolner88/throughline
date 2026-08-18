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

const REQUIRED_CLI_VERSION = "2.98.2";
const EXPECTED_MIGRATION = "20260817180709_measurement_attribution.sql";
const EXPECTED_MIGRATION_HASH =
  "1b530402ede8f4546ab355ce1af8caf3741b17e848d739151bc8a10666ee0b7d";
const EXPECTED_TEST = "measurement_attribution_test.sql";
const EXPECTED_TEST_HASH =
  "de319fb4c1997a3c8a6a64cfe102f556d4134a82f22648608461b4fc396e1d4d";
const BASELINE_TEST = "measurement_attribution_baseline_test.sql";
const BASELINE_TEST_COUNT = 23;
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;
const DEFAULT_TERMINATE_GRACE_MS = 250;
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
const API_READ_TABLES = [
  "throughline_recordings",
  "throughline_feedback",
  "throughline_product_events",
  "throughline_product_feedback",
];

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

const stripAnsi = (value) =>
  value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "");

export function assertExactPendingMigration(output, expectedFilename) {
  const filenames = [...stripAnsi(String(output)).matchAll(
    /^\s*[•*]\s+([0-9][A-Za-z0-9_-]*\.sql)\s*$/gmu,
  )].map((match) => match[1]);
  if (filenames.length !== 1 || filenames[0] !== expectedFilename) {
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
            safeSummary = /^(?:failed assertions: [1-9]\d*(?:,[1-9]\d*)*|failed assertions unavailable)$/u
                .test(candidate)
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

    for (const filename of BASELINE_MIGRATIONS) {
      await copyFile(
        join(repositoryRoot, "supabase", "migrations", filename),
        join(migrationsDirectory, filename),
      );
    }
    for (const filename of [BASELINE_TEST, EXPECTED_TEST]) {
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
  );
  return extractRows(parseJsonWithoutEcho(result.stdout, label), label);
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

async function requirePostMigrationDatabase(workdir) {
  const rows = await runDatabaseProbe(
    workdir,
    "post-migration",
    `
      select
        (select array_agg(version order by version)
          from supabase_migrations.schema_migrations) =
          array['${[...EXPECTED_HISTORY, "20260817180709"].join("','")}']::text[]
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
    "post-migration database contract",
  );
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
  const tables = includeAllowlist
    ? [...API_READ_TABLES, "throughline_internal_users"]
    : API_READ_TABLES;
  for (const table of tables) {
    assertEmptyHeadResponse(
      await fetchLocal(
        `${runtime.apiUrl}/rest/v1/${table}?select=id&limit=1`,
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

  const baselineTestResult = await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "test",
      join(project.testsDirectory, BASELINE_TEST),
      "--local",
    ],
    "baseline pgTAP",
    { summarizeFailure: summarizePgTapFailure },
  );
  assertExactBaselinePgTapPass(combineCommandOutput(baselineTestResult));
  await requireBaselineDatabase(project.workdir);
  await requireLocalServiceProbes(project.workdir, false);

  await copyFile(
    join(repositoryRoot, "supabase", "migrations", EXPECTED_MIGRATION),
    join(project.migrationsDirectory, EXPECTED_MIGRATION),
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
    "fifth-only local migration dry-run",
  );
  assertExactPendingMigration(
    combineCommandOutput(dryRunResult),
    EXPECTED_MIGRATION,
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
    "explicit local migration apply",
  );

  const candidateTestResult = await runCommand(
    "supabase",
    [
      "--workdir",
      project.workdir,
      "--agent=no",
      "db",
      "test",
      join(project.testsDirectory, EXPECTED_TEST),
      "--local",
    ],
    "candidate pgTAP",
    { summarizeFailure: summarizePgTapFailure },
  );
  assertExactPgTapPass(combineCommandOutput(candidateTestResult));
  await requirePostMigrationDatabase(project.workdir);
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
  const migrationPath = join(
    repositoryRoot,
    "supabase",
    "migrations",
    EXPECTED_MIGRATION,
  );
  const testPath = join(repositoryRoot, "supabase", "tests", EXPECTED_TEST);
  assertFrozenHash(
    await sha256File(migrationPath),
    EXPECTED_MIGRATION_HASH,
    "candidate migration",
  );
  assertFrozenHash(
    await sha256File(testPath),
    EXPECTED_TEST_HASH,
    "candidate pgTAP",
  );

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
