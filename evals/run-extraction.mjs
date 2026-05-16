#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  buildExtractionInput,
  normalizeExtraction,
  runCommandExtractor,
} from "../core/extraction-pipeline.mjs";

const DEFAULT_FIXTURE_DIR = "evals/fixtures/labeled";
const DEFAULT_PROMPT_PATH = "evals/prompts/extract-note-v0.md";
const DEFAULT_OUT_DIR = "evals/runs/latest";

function parseArgs(argv) {
  const args = {
    fixtures: DEFAULT_FIXTURE_DIR,
    prompt: DEFAULT_PROMPT_PATH,
    out: DEFAULT_OUT_DIR,
    provider: "golden",
    command: null,
    keepExisting: false,
    skipExisting: false,
    delayMs: 0,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixtures") {
      args.fixtures = argv[++index];
    } else if (arg === "--prompt") {
      args.prompt = argv[++index];
    } else if (arg === "--out") {
      args.out = argv[++index];
    } else if (arg === "--provider") {
      args.provider = argv[++index];
    } else if (arg === "--command") {
      args.command = argv[++index];
    } else if (arg === "--keep-existing") {
      args.keepExisting = true;
    } else if (arg === "--skip-existing") {
      args.skipExisting = true;
    } else if (arg === "--delay-ms") {
      args.delayMs = Number(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["golden", "command"].includes(args.provider)) {
    throw new Error("--provider must be golden or command");
  }

  if (args.provider === "command" && !args.command) {
    throw new Error("--provider command requires --command");
  }

  if (!Number.isFinite(args.delayMs) || args.delayMs < 0) {
    throw new Error("--delay-ms must be a non-negative number");
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node evals/run-extraction.mjs
  node evals/run-extraction.mjs --provider command --command ./extractor-adapter

Options:
  --fixtures <dir>       Labeled fixture directory. Defaults to ${DEFAULT_FIXTURE_DIR}
  --prompt <file>        Prompt contract path. Defaults to ${DEFAULT_PROMPT_PATH}
  --out <dir>            Prediction output directory. Defaults to ${DEFAULT_OUT_DIR}
  --provider <provider>  golden or command. Defaults to golden.
  --command <path>       Executable adapter for command provider.
  --keep-existing        Do not clear existing JSON files in the output directory.
  --skip-existing        Skip fixtures with existing prediction files in the output directory.
  --delay-ms <number>    Delay between fixtures, useful for provider rate limits.

Command provider contract:
  The command is called once per fixture.
  It receives JSON on stdin:
    { "id", "metadata", "transcript", "prompt" }
  It must print strict JSON extraction output to stdout.
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listJsonFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(directory, file));
}

function ensureCleanOutputDirectory(directory, keepExisting) {
  fs.mkdirSync(directory, { recursive: true });
  if (keepExisting) return;

  for (const file of fs.readdirSync(directory)) {
    if (file.endsWith(".json")) {
      fs.unlinkSync(path.join(directory, file));
    }
  }
}

function writePrediction(outDir, fixture, actual, provider) {
  const payload = {
    id: fixture.id,
    provider,
    actual,
  };
  fs.writeFileSync(
    path.join(outDir, `${fixture.id}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
}

function writeManifest(outDir, details) {
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(details, null, 2)}\n`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const prompt = readText(args.prompt);
  const fixtureFiles = listJsonFiles(args.fixtures);

  if (fixtureFiles.length === 0) {
    throw new Error(`No JSON fixtures found in ${args.fixtures}`);
  }

  ensureCleanOutputDirectory(args.out, args.keepExisting);

  const startedAt = new Date().toISOString();
  const results = [];

  for (let index = 0; index < fixtureFiles.length; index += 1) {
    const fixturePath = fixtureFiles[index];
    const fixture = readJson(fixturePath);
    const predictionPath = path.join(args.out, `${fixture.id}.json`);

    if (args.skipExisting && fs.existsSync(predictionPath)) {
      results.push({ id: fixture.id, output: `${fixture.id}.json`, skipped: true });
      continue;
    }

    const input = buildExtractionInput({
      id: fixture.id,
      metadata: fixture.metadata ?? {},
      transcript: fixture.transcript,
      prompt,
    });

    const raw = args.provider === "golden"
      ? fixture.expected
      : runCommandExtractor(args.command, input);

    const actual = normalizeExtraction(raw, fixture.metadata ?? {});
    writePrediction(args.out, fixture, actual, args.provider);
    results.push({ id: fixture.id, output: `${fixture.id}.json` });

    if (args.delayMs > 0 && index < fixtureFiles.length - 1) {
      await sleep(args.delayMs);
    }
  }

  writeManifest(args.out, {
    provider: args.provider,
    command: args.provider === "command" ? args.command : null,
    prompt: args.prompt,
    fixtures: args.fixtures,
    fixture_count: fixtureFiles.length,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    results,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider: args.provider,
        fixtures: fixtureFiles.length,
        out: args.out,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
