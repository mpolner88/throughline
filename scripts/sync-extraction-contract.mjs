#!/usr/bin/env node

// Copies the extraction contract into the Supabase Edge Function tree so
// production runs the same prompt and normaliser the eval suite scores.
//
//   node scripts/sync-extraction-contract.mjs          write the generated files
//   node scripts/sync-extraction-contract.mjs --check  exit 1 if any generated file is stale

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = "scripts/sync-extraction-contract.mjs";
const CONTRACT_SOURCE = "core/extraction-contract.mjs";
const PROMPT_SOURCE = "evals/prompts/extract-note-v0.md";
const CONTRACT_TARGET = "supabase/functions/_shared/extraction-contract.mjs";
const PROMPT_TARGET = "supabase/functions/_shared/extraction-prompt.ts";

function header(source) {
  return [
    "// GENERATED FILE. Do not edit by hand.",
    `// Source: ${source}`,
    `// Regenerate with: node ${SCRIPT_PATH} (or npm run contract:sync)`,
    `// Verify with: node ${SCRIPT_PATH} --check (or npm run contract:check)`,
    "",
    "",
  ].join("\n");
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function generatedFiles() {
  const contract = readSource(CONTRACT_SOURCE);
  const prompt = readSource(PROMPT_SOURCE);

  return [
    {
      target: CONTRACT_TARGET,
      content: header(CONTRACT_SOURCE) + contract,
    },
    {
      target: PROMPT_TARGET,
      content: header(PROMPT_SOURCE)
        + `export const EXTRACTION_PROMPT_PATH = ${JSON.stringify(PROMPT_SOURCE)};\n`
        + `export const EXTRACTION_PROMPT = ${JSON.stringify(prompt)};\n`,
    },
  ];
}

function currentContent(relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : null;
}

function check(files) {
  const stale = files.filter((file) => currentContent(file.target) !== file.content);

  if (!stale.length) {
    console.log("Extraction contract is current.");
    return 0;
  }

  console.error("Extraction contract is stale. Generated files do not match their sources:");
  for (const file of stale) {
    console.error(`  ${file.target}`);
  }
  console.error(`Run: node ${SCRIPT_PATH}`);
  return 1;
}

function write(files) {
  for (const file of files) {
    const absolutePath = path.join(REPO_ROOT, file.target);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, file.content);
    console.log(`Wrote ${file.target}`);
  }
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const unknown = args.filter((arg) => arg !== "--check");

  if (unknown.length) {
    console.error(`Unknown argument: ${unknown[0]}`);
    console.error(`Usage: node ${SCRIPT_PATH} [--check]`);
    return 2;
  }

  const files = generatedFiles();
  return checkOnly ? check(files) : write(files);
}

process.exit(main());
