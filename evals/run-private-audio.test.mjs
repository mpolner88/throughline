import assert from "node:assert/strict";
import test from "node:test";

import { sealPredictionBundle } from "./run-private-audio.mjs";

test("prediction bundles are immutable, complete, and content-addressed", async () => {
  const sealed = await sealPredictionBundle({
    bundle_version: "throughline-private-predictions-v1",
    manifest_sha256: "1".repeat(64),
    contract_sha256: "2".repeat(64),
    adapter: { id: "synthetic-adapter", sha256: "3".repeat(64) },
    started_at: "2026-08-22T00:00:00.000Z",
    finished_at: "2026-08-22T00:00:01.000Z",
    predictions: [{ case_id: "synthetic-001", output: { type: "freeform" } }],
  });
  assert.match(sealed.seal_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(Object.isFrozen(sealed), true);
  assert.equal(Object.isFrozen(sealed.predictions), true);
});
