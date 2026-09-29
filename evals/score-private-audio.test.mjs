import assert from "node:assert/strict";
import test from "node:test";

import { scorePrivateRun } from "./score-private-audio.mjs";

function baseRun(label, output = {}) {
  return {
    manifest: {
      purpose: "real_private_quality",
      cases: [{ id: "case-1", split: "sealed_holdout", active: true, label }],
    },
    sealedPredictions: {
      seal_sha256: "a".repeat(64),
      predictions: [{ case_id: "case-1", output }],
    },
    split: "sealed_holdout",
    minAcceptedFullOutputCases: 20,
  };
}

test("labels open only after a sealed bundle and active-membership revalidation", async () => {
  const calls = [];
  const report = await scorePrivateRun({
    ...baseRun({ kind: "diagnostic_grade" }),
    revalidateEligibility: async () => (calls.push("revalidate"), {
      valid: true,
      prediction_seal_sha256: "a".repeat(64),
      active_case_ids: ["case-1"],
    }),
    openPermittedLabels:
      async () => (calls.push("labels"),
        new Map([["case-1", { kind: "diagnostic_grade", grade: 4 }]])),
  });
  assert.deepEqual(calls, ["revalidate", "labels"]);
  assert.equal(report.winner, null);
});

test("a grade-only case has no challenger reference or winner denominator", async () => {
  const report = await scorePrivateRun({
    ...baseRun({ kind: "diagnostic_grade" }),
    revalidateEligibility: async () => ({
      valid: true,
      prediction_seal_sha256: "a".repeat(64),
      active_case_ids: ["case-1"],
    }),
    openPermittedLabels: async () =>
      new Map([["case-1", { kind: "diagnostic_grade", grade: 5 }]]),
  });
  assert.equal(report.accepted_full_output.denominator_cases, 0);
  assert.equal(report.winner, null);
});

test("a partial correction scores only its server-derived field mask", async () => {
  const report = await scorePrivateRun({
    ...baseRun({ kind: "reviewed_fields" }, { summary: "candidate" }),
    revalidateEligibility: async () => ({
      valid: true,
      prediction_seal_sha256: "a".repeat(64),
      active_case_ids: ["case-1"],
    }),
    openPermittedLabels: async () =>
      new Map([["case-1", {
        kind: "reviewed_fields",
        reviewed_fields: ["summary"],
        reference: { summary: "reference" },
      }]]),
  });
  assert.deepEqual(report.reviewed_fields.denominator_fields, ["summary"]);
  assert.equal(report.accepted_full_output.denominator_cases, 0);
});

test("copied golden output is invalid rather than a quality pass", async () => {
  const golden = { title: "copied" };
  const report = await scorePrivateRun({
    ...baseRun({ kind: "accepted_full_output" }, golden),
    sealedPredictions: {
      seal_sha256: "a".repeat(64),
      adapter: { mode: "golden" },
      predictions: [{ case_id: "case-1", output: golden }],
    },
    revalidateEligibility: async () => ({
      valid: true,
      prediction_seal_sha256: "a".repeat(64),
      active_case_ids: ["case-1"],
    }),
    openPermittedLabels: async () =>
      new Map([["case-1", {
        kind: "accepted_full_output",
        canonical_output: golden,
      }]]),
  });
  assert.equal(report.status, "invalid_run");
  assert.equal(report.failure_code, "golden_or_copied_prediction");
  assert.equal(report.winner, null);
});

test("labels stay closed when revalidation fails", async () => {
  let opened = false;
  const report = await scorePrivateRun({
    ...baseRun({ kind: "diagnostic_grade" }),
    revalidateEligibility: async () => ({ valid: false }),
    openPermittedLabels: async () => (opened = true, new Map()),
  });
  assert.equal(opened, false);
  assert.equal(report.status, "invalid_run");
  assert.equal(report.failure_code, "stale_or_revoked_case");
});
