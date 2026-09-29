#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const REQUEST_KEY = "materializer_receipt_sha256";
const SAFE_CHECKS = [
  "health",
  "auth",
  "request_shape",
  "receipt_scope",
  "idempotency",
  "sibling_survival",
  "privacy",
  "cleanup",
];
const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
const MAX_HTTP_BODY_BYTES = 8_192;
const MAX_COMMAND_OUTPUT_BYTES = 1_048_576;
const POSTGRES_IMAGE = "postgres:17-alpine";
const POSTGREST_IMAGE = "postgrest/postgrest:v14.1";
const PREBUILT_SERVICE_IMAGE = "throughline-private-artifact-delete:canary";
const TEMP_PREFIX = "throughline-artifact-canary-";
const TRUSTED_TEMP_ROOTS = new Set(["/private/tmp", "/tmp"]);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const serviceDirectory = join(
  repositoryRoot,
  "services",
  "private-artifact-delete",
);

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
}

export function parseCliArgs(args) {
  if (!Array.isArray(args)) throw new TypeError("CLI arguments must be an array");
  let contractOnly = false;
  for (const argument of args) {
    if (argument === "--contract-only") {
      contractOnly = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { contractOnly };
}

export function assertDeletionResponse(body, statusCode) {
  if (statusCode === 404 && (body === null || body === undefined)) {
    return { status: "not_found", deleted_count: 0 };
  }
  const valid = statusCode === 200 &&
    exactKeys(body, ["status", "deleted_count"]) &&
    (body.status === "deleted" || body.status === "not_found") &&
    Number.isSafeInteger(body.deleted_count) &&
    body.deleted_count >= 0 &&
    (body.status !== "not_found" || body.deleted_count === 0);
  if (!valid) {
    const safeStatus = Number.isSafeInteger(statusCode) ? statusCode : "invalid";
    throw new Error(`Invalid artifact deletion response status ${safeStatus}`);
  }
  return { status: body.status, deleted_count: body.deleted_count };
}

export function assertPrivacySafeText(value) {
  const text = String(value);
  const unsafe = [
    /materializer_receipt_sha256/iu,
    /\b[0-9a-f]{64}\b/iu,
    /\bbearer\s+\S+/iu,
    /\b(?:token|credential|secret)\s*[:=]\s*\S+/iu,
    /(?:^|[\s"'])(?:private|evals\/private|staging)\/[A-Za-z0-9._/-]+/iu,
    /synthetic private sentinel/iu,
  ];
  if (unsafe.some((pattern) => pattern.test(text))) {
    throw new Error("Artifact canary output is not privacy-safe");
  }
  return true;
}

function assertStatus(response, allowed, label) {
  if (!response || !allowed.includes(response.status)) {
    throw new Error(`${label} returned an unexpected status`);
  }
}

function assertSafeErrorResponse(response, label) {
  assertStatus(response, [400, 401, 403, 405, 422], label);
  assertPrivacySafeText(JSON.stringify(response.body ?? {}));
}

export async function runArtifactDeletionCanary({ runtime }) {
  if (!runtime || typeof runtime.setup !== "function" ||
    typeof runtime.cleanup !== "function") {
    throw new TypeError("Artifact canary requires a runtime with setup and cleanup");
  }

  let context;
  let failure;
  try {
    context = await runtime.setup();
    if (
      !context || typeof context !== "object" ||
      typeof context.request !== "function" ||
      typeof context.inspect !== "function" ||
      !HASH_PATTERN.test(context.targetReceipt ?? "") ||
      !HASH_PATTERN.test(context.siblingReceipt ?? "") ||
      context.targetReceipt === context.siblingReceipt ||
      typeof context.token !== "string" || context.token.length < 16 ||
      !Number.isSafeInteger(context.expectedTargetCount) ||
      context.expectedTargetCount < 1
    ) {
      throw new Error("Artifact canary runtime returned an invalid synthetic setup");
    }

    const health = await context.request({ method: "GET", path: "/health" });
    assertStatus(health, [200], "health check");
    if (!exactKeys(health.body, ["ok"]) || health.body.ok !== true) {
      throw new Error("Artifact service health response is invalid");
    }

    const unauthorized = await context.request({
      method: "POST",
      path: "/delete",
      body: { [REQUEST_KEY]: context.targetReceipt },
    });
    assertSafeErrorResponse(unauthorized, "missing authorization");
    const wrongToken = await context.request({
      method: "POST",
      path: "/delete",
      token: "wrong-synthetic-token",
      body: { [REQUEST_KEY]: context.targetReceipt },
    });
    assertSafeErrorResponse(wrongToken, "wrong authorization");

    for (const body of [
      {},
      { [REQUEST_KEY]: "not-a-receipt" },
      { [REQUEST_KEY]: context.targetReceipt, extra: true },
    ]) {
      const response = await context.request({
        method: "POST",
        path: "/delete",
        token: context.token,
        body,
      });
      assertSafeErrorResponse(response, "invalid deletion request");
    }

    const first = await context.request({
      method: "POST",
      path: "/delete",
      token: context.token,
      body: { [REQUEST_KEY]: context.targetReceipt },
    });
    const firstReceipt = assertDeletionResponse(first.body, first.status);
    if (firstReceipt.status !== "deleted") {
      throw new Error("Artifact deletion returned a safe not-found receipt");
    }
    if (firstReceipt.deleted_count !== context.expectedTargetCount) {
      throw new Error("Artifact deletion returned an unexpected aggregate count");
    }
    const afterFirst = await context.inspect();
    if (
      !exactKeys(afterFirst, ["siblingCount", "targetCount"]) ||
      afterFirst.targetCount !== 0 ||
      !Number.isSafeInteger(afterFirst.siblingCount) ||
      afterFirst.siblingCount < 1
    ) {
      throw new Error("Artifact deletion scope or sibling survival failed");
    }

    const second = await context.request({
      method: "POST",
      path: "/delete",
      token: context.token,
      body: { [REQUEST_KEY]: context.targetReceipt },
    });
    const secondReceipt = assertDeletionResponse(second.body, second.status);
    if (secondReceipt.status !== "not_found" || secondReceipt.deleted_count !== 0) {
      throw new Error("Artifact deletion is not idempotent");
    }
    const afterSecond = await context.inspect();
    if (afterSecond.targetCount !== 0 ||
      afterSecond.siblingCount !== afterFirst.siblingCount) {
      throw new Error("Repeated deletion changed a sibling receipt scope");
    }

    const logs = typeof context.logs === "function" ? await context.logs() : [];
    assertPrivacySafeText(JSON.stringify({
      health: health.body,
      unauthorized: unauthorized.body,
      wrongToken: wrongToken.body,
      first: first.body,
      second: second.body,
      logs,
    }));
  } catch (error) {
    failure = error;
  }

  try {
    await runtime.cleanup();
  } catch (cleanupError) {
    failure ??= new Error("Artifact canary cleanup failed", {
      cause: cleanupError,
    });
  }
  if (failure) throw failure;

  return {
    mode: runtime.mode ?? "unknown",
    status: "pass",
    checks: [...SAFE_CHECKS],
  };
}

function fakeResponse(status, body) {
  return { status, body: structuredClone(body) };
}

export function createContractOnlyRuntime({ corruptFirstDeletion = false } = {}) {
  const targetReceipt = "a".repeat(64);
  const siblingReceipt = "b".repeat(64);
  const token = "synthetic-contract-token";
  const artifacts = new Map([
    [targetReceipt, 2],
    [siblingReceipt, 1],
  ]);
  const safeLogs = [];
  let corrupted = false;
  const state = { active: false, cleanupCalls: 0 };

  return {
    mode: "contract-only",
    state,
    async setup() {
      state.active = true;
      return {
        targetReceipt,
        siblingReceipt,
        token,
        expectedTargetCount: 2,
        async request({ method, path, token: suppliedToken, body }) {
          if (!state.active) throw new Error("fake runtime is not active");
          if (method === "GET" && path === "/health") {
            safeLogs.push("health ok");
            return fakeResponse(200, { ok: true });
          }
          if (method !== "POST" || path !== "/delete") {
            return fakeResponse(405, { code: "method_not_allowed" });
          }
          if (suppliedToken !== token) {
            safeLogs.push("delete rejected auth");
            return fakeResponse(401, { code: "unauthorized" });
          }
          if (!exactKeys(body, [REQUEST_KEY]) ||
            !HASH_PATTERN.test(body?.[REQUEST_KEY] ?? "")) {
            safeLogs.push("delete rejected shape");
            return fakeResponse(422, { code: "invalid_request" });
          }
          const count = artifacts.get(body[REQUEST_KEY]) ?? 0;
          artifacts.delete(body[REQUEST_KEY]);
          safeLogs.push(count > 0 ? "delete completed" : "delete absent");
          if (corruptFirstDeletion && count > 0 && !corrupted) {
            corrupted = true;
            return fakeResponse(200, {
              status: "deleted",
              deleted_count: count,
              receipt: "redacted",
            });
          }
          return fakeResponse(200, count > 0
            ? { status: "deleted", deleted_count: count }
            : { status: "not_found", deleted_count: 0 });
        },
        async inspect() {
          return {
            targetCount: artifacts.get(targetReceipt) ?? 0,
            siblingCount: artifacts.get(siblingReceipt) ?? 0,
          };
        },
        async logs() {
          return [...safeLogs];
        },
      };
    },
    async cleanup() {
      state.cleanupCalls += 1;
      state.active = false;
      artifacts.clear();
    },
  };
}

function runCommand(command, args, {
  cwd,
  env = process.env,
  input,
  label = command,
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
} = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(value);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      settle(rejectPromise, new Error(`${label} timed out`));
    }, timeoutMs);
    const collect = (chunks) => (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        settle(rejectPromise, new Error(`${label} output exceeded its bound`));
        return;
      }
      chunks.push(chunk);
    };
    if (input !== undefined) child.stdin.end(input);
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", (error) => settle(rejectPromise, error));
    child.on("close", (code) => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) settle(resolvePromise, result);
      else settle(rejectPromise, new Error(`${label} exited ${code}`));
    });
  });
}

async function readBoundedJsonResponse(response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_HTTP_BODY_BYTES) {
    throw new Error("Artifact service response exceeded its bound");
  }
  if (buffer.length === 0) return null;
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("Artifact service returned malformed JSON");
  }
}

export async function requestArtifactService(baseUrl, input, {
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
} = {}) {
  const headers = { Accept: "application/json" };
  if (input.token !== undefined) headers.Authorization = `Bearer ${input.token}`;
  if (input.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(new URL(input.path, baseUrl), {
    method: input.method,
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    status: response.status,
    body: await readBoundedJsonResponse(response),
  };
}

function safeTemporaryRoot(platform = process.platform) {
  if (platform === "darwin") return "/private/tmp";
  if (platform === "linux") return "/tmp";
  throw new Error("Artifact canary requires a supported Docker host");
}

function assertDisposablePaths({ temporaryRoot, workdir, prefix }) {
  const root = resolve(temporaryRoot);
  const directory = resolve(workdir);
  if (
    !TRUSTED_TEMP_ROOTS.has(root) ||
    dirname(directory) !== root ||
    !directory.startsWith(join(root, prefix))
  ) {
    throw new Error("Artifact canary cleanup target is not disposable");
  }
  return true;
}

async function runDockerCleanup(args) {
  try {
    await runCommand("docker", args, { timeoutMs: 30_000 });
  } catch {
    // Cleanup is best-effort per target and is verified by final temp removal.
  }
}

async function waitFor(label, probe, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`${label} did not become ready`, { cause: lastError });
}

export function publishedPort(output, containerPort) {
  const match = String(output).trim().match(
    /(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)$/u,
  );
  const port = Number(match?.[1]);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Docker did not publish container port ${containerPort}`);
  }
  return port;
}


export function createContainerPostgrestRuntime({
  postgresImage = POSTGRES_IMAGE,
  postgrestImage = POSTGREST_IMAGE,
  prebuiltServiceImage = PREBUILT_SERVICE_IMAGE,
} = {}) {
  const suffix = `${process.pid}-${randomBytes(6).toString("hex")}`;
  const prefix = `${TEMP_PREFIX}${suffix}`;
  const names = canaryResourceNames(prefix);
  const temporaryRoot = safeTemporaryRoot();
  let workdir;
  let targetReceipt;
  let siblingReceipt;
  let imageBuilt = false;
  let selectedServiceImage = prebuiltServiceImage;

  return {
    mode: "container-postgrest",
    async setup() {
      await runCommand("docker", ["version", "--format", "{{.Server.Version}}"], { label: "docker prerequisite" });
      workdir = await mkdtemp(join(temporaryRoot, TEMP_PREFIX));
      assertDisposablePaths({ temporaryRoot, workdir, prefix: TEMP_PREFIX });
      targetReceipt = "a".repeat(64);
      siblingReceipt = "b".repeat(64);

      await runCommand("docker", ["network", "create", names.network], { label: "docker network create" });
      await runCommand("docker", [
        "run", "-d", "--rm",
        "--name", names.postgres,
        "--network", names.network,
        "-e", "POSTGRES_DB=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_PASSWORD=synthetic-canary-password",
        postgresImage,
      ], { timeoutMs: 120_000, label: "postgres container start" });
      await waitFor("PostgreSQL", async () => {
        try {
          await runCommand("docker", [
            "exec", names.postgres,
            "pg_isready", "-U", "postgres", "-d", "postgres",
          ], { timeoutMs: 5_000 });
          return true;
        } catch {
          return false;
        }
      });

      const sql = `
        create role authenticator noinherit login
          password 'synthetic-canary-postgrest-password';
        create role artifact_reader nologin;
        grant artifact_reader to authenticator;
        create schema canary;
        grant usage on schema canary to artifact_reader;
        create table canary.synthetic_artifact_registry (
          materializer_receipt_sha256 text primary key
            check (materializer_receipt_sha256 ~ '^[0-9a-f]{64}$'),
          artifact_count integer not null check (artifact_count > 0)
        );
        revoke all on canary.synthetic_artifact_registry from public;
        insert into canary.synthetic_artifact_registry values
          ('${targetReceipt}', 1),
          ('${siblingReceipt}', 1);
        create view canary.synthetic_artifact_receipts
          with (security_barrier = true)
          as select materializer_receipt_sha256, artifact_count
          from canary.synthetic_artifact_registry;
        revoke all on canary.synthetic_artifact_receipts from public;
        grant select on canary.synthetic_artifact_receipts to artifact_reader;
      `;
      await runCommand("docker", [
        "exec", "-i", names.postgres,
        "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
      ], { input: sql, label: "postgres synthetic schema seed" });

      await runCommand("docker", [
        "run", "-d", "--rm",
        "--name", names.postgrest,
        "--network", names.network,
        "-p", "127.0.0.1::3000",
        "-e", `PGRST_DB_URI=postgres://authenticator:synthetic-canary-postgrest-password@${names.postgres}:5432/postgres`,
        "-e", "PGRST_DB_SCHEMAS=canary",
        "-e", "PGRST_DB_ANON_ROLE=artifact_reader",
        postgrestImage,
      ], { timeoutMs: 120_000, label: "postgrest container start" });
      const postgrestPortResult = await runCommand("docker", [
        "port", names.postgrest, "3000/tcp",
      ], { label: "postgrest port discovery" });
      const postgrestPort = publishedPort(postgrestPortResult.stdout, 3000);
      const postgrestUrl = `http://127.0.0.1:${postgrestPort}/`;
      const rows = await waitFor("PostgREST", async () => {
        const response = await fetch(new URL(
          "synthetic_artifact_receipts?select=materializer_receipt_sha256,artifact_count&order=materializer_receipt_sha256.asc",
          postgrestUrl,
        ), { signal: AbortSignal.timeout(DEFAULT_HTTP_TIMEOUT_MS) });
        if (!response.ok) return false;
        const value = await readBoundedJsonResponse(response);
        return Array.isArray(value) ? value : false;
      });
      if (
        rows.length !== 2 ||
        rows.some((row) => !exactKeys(row, [REQUEST_KEY, "artifact_count"])) ||
        rows.some((row) => !HASH_PATTERN.test(row[REQUEST_KEY] ?? "")) ||
        rows.some((row) => row.artifact_count !== 1)
      ) {
        throw new Error("PostgREST synthetic receipt inventory is invalid");
      }
      targetReceipt = rows[0][REQUEST_KEY];
      siblingReceipt = rows[1][REQUEST_KEY];

      try {
        await runCommand("docker", ["image", "inspect", prebuiltServiceImage], { label: "service image inspect" });
      } catch {
        await runCommand("docker", [
          "build", "--quiet", "-t", names.serviceImage, serviceDirectory,
        ], { timeoutMs: 180_000, label: "service image build" });
        imageBuilt = true;
        selectedServiceImage = names.serviceImage;
      }
      await runCommand("docker", ["volume", "create", names.volume], {
        label: "artifact volume create",
      });
      const seedScript = `
        const fs = require("node:fs");
        const path = require("node:path");
        const root = "/private/evaluation";
        fs.chmodSync(root, 0o777);
        const target = path.join(root, process.env.TARGET_RECEIPT);
        const sibling = path.join(root, process.env.SIBLING_RECEIPT);
        fs.mkdirSync(path.join(target, "nested"), { recursive: true, mode: 0o777 });
        fs.mkdirSync(sibling, { mode: 0o777 });
        fs.chmodSync(target, 0o777);
        fs.chmodSync(path.join(target, "nested"), 0o777);
        fs.chmodSync(sibling, 0o777);
        fs.writeFileSync(path.join(target, "synthetic.bin"), "synthetic-canary-a");
        fs.writeFileSync(path.join(target, "nested", "synthetic.bin"), "synthetic-canary-b");
        fs.writeFileSync(path.join(sibling, "synthetic.bin"), "synthetic-canary-c");
      `;
      await runCommand("docker", [
        "run", "--rm", "--user", "0:0",
        "--entrypoint", "node",
        "-e", `TARGET_RECEIPT=${targetReceipt}`,
        "-e", `SIBLING_RECEIPT=${siblingReceipt}`,
        "-v", `${names.volume}:/private/evaluation:rw`,
        selectedServiceImage,
        "-e", seedScript,
      ], { label: "artifact volume seed" });
      await runCommand("docker", [
        "run", "-d", "--rm",
        "--name", names.service,
        "--network", names.network,
        "-p", "127.0.0.1::8080",
        "-e", "THROUGHLINE_PRIVATE_ARTIFACT_ROOT=/private/evaluation",
        "-e", "THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN=synthetic-canary-token",
        "-e", "MAX_REQUEST_BYTES=4096",
        "-v", `${names.volume}:/private/evaluation:rw`,
        selectedServiceImage,
      ], { timeoutMs: 60_000, label: "service container start" });
      const servicePortResult = await runCommand("docker", [
        "port", names.service, "8080/tcp",
      ], { label: "service port discovery" });
      const servicePort = publishedPort(servicePortResult.stdout, 8080);
      const serviceUrl = `http://127.0.0.1:${servicePort}/`;
      await waitFor("artifact service", async () => {
        try {
          const response = await requestArtifactService(serviceUrl, {
            method: "GET",
            path: "/health",
          });
          return response.status === 200 && response.body?.ok === true;
        } catch {
          return false;
        }
      });

      const inspectVolume = async () => {
        const inspectScript = `
          const fs = require("node:fs");
          const path = require("node:path");
          const root = "/private/evaluation";
          const exists = (receipt) => fs.existsSync(path.join(root, receipt)) ? 1 : 0;
          process.stdout.write(JSON.stringify({
            targetCount: exists(process.env.TARGET_RECEIPT),
            siblingCount: exists(process.env.SIBLING_RECEIPT),
          }));
        `;
        const result = await runCommand("docker", [
          "run", "--rm", "--entrypoint", "node",
          "-e", `TARGET_RECEIPT=${targetReceipt}`,
          "-e", `SIBLING_RECEIPT=${siblingReceipt}`,
          "-v", `${names.volume}:/private/evaluation:ro`,
          selectedServiceImage,
          "-e", inspectScript,
        ], { label: "artifact volume inspect" });
        const value = JSON.parse(result.stdout);
        if (!exactKeys(value, ["targetCount", "siblingCount"])) {
          throw new Error("Artifact volume inspection is invalid");
        }
        return value;
      };
      const seeded = await inspectVolume();
      if (seeded.targetCount !== 1 || seeded.siblingCount !== 1) {
        throw new Error("Synthetic artifact roots were not seeded exactly");
      }
      return {
        targetReceipt,
        siblingReceipt,
        token: "synthetic-canary-token",
        expectedTargetCount: 1,
        request: (input) => requestArtifactService(serviceUrl, input),
        async inspect() {
          return await inspectVolume();
        },
        async logs() {
          const result = await runCommand("docker", ["logs", names.service], { label: "service log read" });
          return [result.stdout, result.stderr].filter(Boolean);
        },
      };
    },
    async cleanup() {
      await runDockerCleanup(["rm", "-f", names.service]);
      await runDockerCleanup(["rm", "-f", names.postgrest]);
      await runDockerCleanup(["rm", "-f", names.postgres]);
      await runDockerCleanup(["network", "rm", names.network]);
      await runDockerCleanup(["volume", "rm", names.volume]);
      if (imageBuilt) {
        await runDockerCleanup(["image", "rm", names.serviceImage]);
      }
      if (workdir) {
        assertDisposablePaths({ temporaryRoot, workdir, prefix: TEMP_PREFIX });
        await rm(workdir, { recursive: true, force: true });
      }
    },
  };
}

export function canaryResourceNames(prefix) {
  if (typeof prefix !== "string" || !prefix) {
    throw new Error("Artifact canary resource prefix is invalid");
  }
  return {
    network: `${prefix}-network`,
    postgres: `${prefix}-postgres`,
    postgrest: `${prefix}-postgrest`,
    service: `${prefix}-service`,
    serviceImage: `${prefix}:local`,
    volume: `${prefix}-volume`,
  };
}

async function main() {
  const { contractOnly } = parseCliArgs(process.argv.slice(2));
  const runtime = contractOnly
    ? createContractOnlyRuntime()
    : createContainerPostgrestRuntime();
  const result = await runArtifactDeletionCanary({ runtime });
  const output = JSON.stringify(result);
  assertPrivacySafeText(output);
  process.stdout.write(`${output}\n`);
}

const isMain = process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    const safe = error?.code === "ENOENT"
      ? "artifact canary prerequisite unavailable"
      : String(error?.message ?? "artifact canary failed")
        .replace(/\b[0-9a-f]{64}\b/giu, "[redacted]")
        .replace(/\bbearer\s+\S+/giu, "Bearer [redacted]");
    process.stderr.write(`${safe}\n`);
    process.exitCode = 1;
  });
}
