import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKER = path.resolve(
  HERE,
  "../workers/private-adapter-worker.ts",
);
const ADVERSARIAL_ADAPTER = path.resolve(
  HERE,
  "../fixtures/adversarial/read-reference-adapter.mjs",
);

export async function verifyAdapterIsolation(policy = {}) {
  try {
    const result = await runAdversarialIsolationProbe(policy);
    if (
      result.exitCode === 0 || result.stdout !== "" ||
      !/PermissionDenied|Requires read access/u.test(result.stderr)
    ) throw new Error("probe_did_not_fail_closed");
    return Object.freeze({ verified: true, deno_bin: result.denoBin });
  } catch (error) {
    const wrapped = new Error("adapter_isolation_unavailable");
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function runAdversarialIsolationProbe(policy = {}) {
  const denoBin = policy.denoBin ?? discoverDenoBin();
  const root = await fsp.mkdtemp(
    path.join(os.tmpdir(), "throughline-isolation-probe-"),
  );
  await fsp.chmod(root, 0o700);
  const sentinelPath = path.join(root, "reference-sentinel.json");
  const audioPath = path.join(root, "probe.wav");
  const staging = path.join(root, "staging");
  await fsp.mkdir(staging, { mode: 0o700 });
  await fsp.writeFile(sentinelPath, "forbidden reference");
  await fsp.writeFile(audioPath, "generated probe audio");
  try {
    const result = await invokeInStaging({
      denoBin,
      staging,
      adapterPath: ADVERSARIAL_ADAPTER,
      workerPath: DEFAULT_WORKER,
      audioPath,
      input: { sentinel_path: sentinelPath },
      approvedProviderHosts: [],
      approvedProviderEnvNames: [],
      providerEnv: {},
    });
    return { ...result, denoBin };
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

export async function runIsolatedAdapter({ policy, input, providerEnv = {} }) {
  if (
    (policy.approvedProviderHosts ?? []).length ||
    (policy.approvedProviderEnvNames ?? []).length ||
    Object.keys(providerEnv).length
  ) throw new Error("provider_data_use_not_authorized");
  await verifyAdapterIsolation(policy);
  const denoBin = policy.denoBin ?? discoverDenoBin();
  const staging = await fsp.mkdtemp(
    path.join(os.tmpdir(), "throughline-private-adapter-"),
  );
  await fsp.chmod(staging, 0o700);
  try {
    const result = await invokeInStaging({
      denoBin,
      staging,
      adapterPath: policy.adapterPath,
      workerPath: policy.workerPath ?? DEFAULT_WORKER,
      audioPath: input.audio_path,
      input,
      approvedProviderHosts: policy.approvedProviderHosts ?? [],
      approvedProviderEnvNames: policy.approvedProviderEnvNames ?? [],
      providerEnv,
    });
    if (result.exitCode !== 0) {
      const error = new Error(
        /PermissionDenied|Requires (read|write|run|ffi|env|net) access/u.test(
            result.stderr,
          )
          ? "adapter_policy_violation"
          : "adapter_execution_failed",
      );
      error.stderr = result.stderr;
      throw error;
    }
    return JSON.parse(result.stdout);
  } finally {
    await fsp.rm(staging, { recursive: true, force: true });
  }
}

async function invokeInStaging(options) {
  for (
    const required of [
      options.adapterPath,
      options.workerPath,
      options.audioPath,
    ]
  ) {
    if (typeof required !== "string" || !fs.existsSync(required)) {
      throw new Error("adapter_staging_input_missing");
    }
  }
  const stagedAdapter = path.join(options.staging, "adapter.mjs");
  const stagedWorker = path.join(options.staging, "worker.ts");
  const stagedAudio = path.join(
    options.staging,
    `audio${path.extname(options.audioPath) || ".bin"}`,
  );
  await Promise.all([
    fsp.copyFile(options.adapterPath, stagedAdapter),
    fsp.copyFile(options.workerPath, stagedWorker),
    fsp.copyFile(options.audioPath, stagedAudio),
  ]);

  const allowedEnv = uniqueSafeTokens(
    options.approvedProviderEnvNames,
    "provider_env_invalid",
  );
  const hosts = uniqueSafeTokens(
    options.approvedProviderHosts,
    "provider_host_invalid",
  );
  const args = [
    "run",
    "--no-prompt",
    "--quiet",
    `--allow-read=${[stagedAudio, stagedAdapter, stagedWorker].join(",")}`,
  ];
  if (hosts.length) args.push(`--allow-net=${hosts.join(",")}`);
  if (allowedEnv.length) args.push(`--allow-env=${allowedEnv.join(",")}`);
  args.push(stagedWorker, stagedAdapter);

  const stagedInput = { ...options.input, audio_path: stagedAudio };
  const childEnv = Object.fromEntries(
    allowedEnv.filter((name) => Object.hasOwn(options.providerEnv, name))
      .map((name) => [name, String(options.providerEnv[name])]),
  );
  return await spawnCaptured(options.denoBin, args, {
    cwd: options.staging,
    env: childEnv,
    input: JSON.stringify(stagedInput),
  });
}

function discoverDenoBin() {
  const result = spawnSync("npx", [
    "--no-install",
    "deno",
    "eval",
    "console.log(Deno.execPath())",
  ], {
    encoding: "utf8",
    shell: false,
  });
  const candidate = result.status === 0 ? result.stdout.trim() : "";
  if (!candidate || !path.isAbsolute(candidate) || !fs.existsSync(candidate)) {
    throw new Error("deno_not_found");
  }
  return candidate;
}

function spawnCaptured(command, args, { cwd, env, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on(
      "close",
      (code) =>
        resolve({
          exitCode: code ?? -1,
          stdout: code === 0 ? stdout.trim() : "",
          stderr,
        }),
    );
    child.stdin.end(input);
  });
}

function uniqueSafeTokens(values, code) {
  if (!Array.isArray(values)) throw new Error(code);
  const tokens = [...new Set(values)];
  if (
    tokens.some((value) =>
      typeof value !== "string" || !/^[A-Za-z0-9_.:\-[\]]+$/u.test(value)
    )
  ) {
    throw new Error(code);
  }
  return tokens;
}
