import { spawnSync } from "node:child_process";
import { normalizeExtraction as normalizeSharedExtraction } from "./inference-contract.mjs";

export const OUTPUT_FIELDS = [
  "type",
  "title",
  "summary",
  "most_important",
  "todos",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "mood",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
];

export function buildExtractionInput(
  { id, metadata = {}, transcript, prompt },
) {
  return {
    id,
    metadata,
    transcript,
    prompt,
  };
}

export function normalizeExtraction(raw, metadata = {}) {
  return normalizeSharedExtraction(raw, metadata);
}

export function extractJsonFromText(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Extractor returned empty output");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Extractor did not return parseable JSON");
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

export function runCommandExtractor(command, input) {
  const result = spawnSync(command, {
    input: JSON.stringify(input),
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024 * 5,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Extractor command failed with exit ${result.status}: ${
        result.stderr || result.stdout
      }`,
    );
  }

  return extractJsonFromText(result.stdout);
}

export function userLocalDateFromTime(userLocalTime) {
  if (typeof userLocalTime !== "string") return null;

  const match = userLocalTime.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
