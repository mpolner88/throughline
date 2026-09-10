#!/usr/bin/env node

// Pull correction feedback out of Supabase into the local eval workspace.
//
// Reads throughline_feedback rows with the given status through PostgREST
// using the service role key and writes each row's feedback JSON to
// <out>/<id>.json. Idempotent by id: a file whose content already matches is
// left alone. Only counts are printed; row contents never reach stdout.
//
//   node scripts/export-feedback.mjs [--status eval_candidate] [--out backend/data/feedback]
//
// Then run `npm run eval:import-feedback` to turn the rows into fixtures.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ENV_FILES = [".env.local", ".env"];
const DEFAULT_STATUS = "eval_candidate";
const DEFAULT_OUT_DIR = "backend/data/feedback";
const PAGE_SIZE = 500;

function parseArgs(argv) {
  const args = { status: DEFAULT_STATUS, out: DEFAULT_OUT_DIR };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--status") {
      args.status = argv[++index];
    } else if (arg === "--out") {
      args.out = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.status) throw new Error("--status needs a value");
  if (!args.out) throw new Error("--out needs a value");

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/export-feedback.mjs

Options:
  --status <status>  Feedback status to export. Defaults to ${DEFAULT_STATUS}
  --out <dir>        Output directory. Defaults to ${DEFAULT_OUT_DIR}

Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment,
.env.local, or .env.
`);
}

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

function resolveEnv() {
  const fileEnv = localEnv();
  const supabaseUrl = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY || "";

  const missing = [];
  if (!supabaseUrl.trim()) missing.push("SUPABASE_URL");
  if (!serviceRoleKey.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length) {
    console.error(`Missing ${missing.join(" and ")}.`);
    console.error("Set them in the environment or in the gitignored .env.local file.");
    process.exit(1);
  }

  return {
    supabaseUrl: supabaseUrl.trim().replace(/\/+$/, ""),
    serviceRoleKey: serviceRoleKey.trim(),
  };
}

async function fetchPage({ supabaseUrl, serviceRoleKey }, status, offset) {
  const url = new URL(`${supabaseUrl}/rest/v1/throughline_feedback`);
  url.searchParams.set("select", "feedback");
  url.searchParams.set("status", `eq.${status}`);
  url.searchParams.set("order", "created_at.asc");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Range: `${offset}-${offset + PAGE_SIZE - 1}`,
      "Range-Unit": "items",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase returned ${response.status} for rows ${offset}-${offset + PAGE_SIZE - 1}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Supabase returned a non-array page");
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = resolveEnv();

  fs.mkdirSync(args.out, { recursive: true });

  let fetched = 0;
  let written = 0;
  let unchanged = 0;
  let skipped = 0;
  let offset = 0;

  while (true) {
    const rows = await fetchPage(env, args.status, offset);
    fetched += rows.length;

    for (const row of rows) {
      const feedback = row?.feedback;
      const id = typeof feedback?.id === "string" ? feedback.id.trim() : "";

      if (!id || !/^[A-Za-z0-9_.-]+$/.test(id)) {
        skipped += 1;
        continue;
      }

      const filePath = path.join(args.out, `${id}.json`);
      const content = `${JSON.stringify(feedback, null, 2)}\n`;

      if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) {
        unchanged += 1;
        continue;
      }

      fs.writeFileSync(filePath, content);
      written += 1;
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`fetched ${fetched}, written ${written}, unchanged ${unchanged}${skipped ? `, skipped ${skipped}` : ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
