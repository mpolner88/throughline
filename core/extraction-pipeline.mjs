import { spawnSync } from "node:child_process";
import { extractJsonFromText } from "./extraction-contract.mjs";

// The extraction contract (prompt input shape, normaliser, derived fields) lives
// in core/extraction-contract.mjs so it can be copied into the Supabase Edge
// Function unchanged. This module adds the one piece that needs Node: running
// an external extractor command.
export * from "./extraction-contract.mjs";

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
      `Extractor command failed with exit ${result.status}: ${result.stderr || result.stdout}`,
    );
  }

  return extractJsonFromText(result.stdout);
}
