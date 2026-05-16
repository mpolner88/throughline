#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { userLocalDateFromTime } from "../core/extraction-pipeline.mjs";

const DEFAULT_FEEDBACK_DIR = "backend/data/feedback";
const DEFAULT_OUT_DIR = "evals/tmp/feedback-fixtures";

function parseArgs(argv) {
  const args = {
    feedback: DEFAULT_FEEDBACK_DIR,
    out: DEFAULT_OUT_DIR,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--feedback") {
      args.feedback = argv[++index];
    } else if (arg === "--out") {
      args.out = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node evals/import-feedback-fixtures.mjs

Options:
  --feedback <dir>  Feedback directory. Defaults to ${DEFAULT_FEEDBACK_DIR}
  --out <dir>       Output fixture directory. Defaults to ${DEFAULT_OUT_DIR}
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(directory, file));
}

function fixtureFromFeedback(feedback) {
  const snapshot = feedback.recording_snapshot ?? {};
  const transcript = snapshot.transcript_raw;
  const expected = feedback.expected;

  if (!transcript || !expected || typeof expected !== "object") return null;

  return {
    id: `feedback-${feedback.id}`,
    title: `Feedback fixture ${feedback.id}`,
    metadata: {
      user_local_date: userLocalDateFromTime(snapshot.user_local_time),
      scenario: snapshot.type || expected.type || "freeform",
      source: "alpha_feedback",
      feedback_id: feedback.id,
      recording_id: feedback.recording_id,
    },
    transcript,
    expected,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const feedbackFiles = listJsonFiles(args.feedback);
  fs.mkdirSync(args.out, { recursive: true });

  let imported = 0;
  let skipped = 0;
  const outputs = [];

  for (const file of feedbackFiles) {
    const feedback = readJson(file);
    const fixture = fixtureFromFeedback(feedback);
    if (!fixture) {
      skipped += 1;
      continue;
    }

    const outPath = path.join(args.out, `${fixture.id}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
    imported += 1;
    outputs.push(outPath);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        feedback: feedbackFiles.length,
        imported,
        skipped,
        out: args.out,
        outputs,
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
