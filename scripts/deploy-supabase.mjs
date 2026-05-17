#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

const DEFAULT_PROJECT_REF = "ywsenspsfyrdhgyxgcrv";
const DEFAULT_FUNCTIONS = ["api", "mcp"];
const ENV_FILES = [".env.local", ".env"];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function localEnv() {
  return ENV_FILES.reduce((accumulator, filePath) => ({
    ...accumulator,
    ...parseEnvFile(filePath),
  }), {});
}

function printMissingTokenHelp() {
  console.error("SUPABASE_ACCESS_TOKEN is not set for this deploy process.");
  console.error("");
  console.error("Create an access token at:");
  console.error("  https://supabase.com/dashboard/account/tokens");
  console.error("");
  console.error("Then add it to the ignored local env file:");
  console.error("  SUPABASE_ACCESS_TOKEN=your-token-here");
  console.error("");
  console.error("Use .env.local. It is gitignored and should not be committed.");
}

function deployFunction(functionName, env) {
  const projectRef = env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT_REF;
  const args = [
    "functions",
    "deploy",
    functionName,
    "--no-verify-jwt",
    "--use-api",
    "--project-ref",
    projectRef,
  ];

  console.log(`Deploying Supabase function: ${functionName}`);
  const result = spawnSync("supabase", args, {
    env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function selectedFunctions() {
  const names = process.argv.slice(2);
  return names.length ? names : DEFAULT_FUNCTIONS;
}

function main() {
  const env = {
    ...localEnv(),
    ...process.env,
  };

  if (!env.SUPABASE_ACCESS_TOKEN) {
    printMissingTokenHelp();
    process.exit(1);
  }

  for (const functionName of selectedFunctions()) {
    deployFunction(functionName, env);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
