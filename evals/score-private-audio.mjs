#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "../core/inference-contract.mjs";

export async function scorePrivateRun({
  manifest,
  sealedPredictions,
  revalidateEligibility,
  openPermittedLabels,
  split,
  minAcceptedFullOutputCases = 20,
}) {
  const invalid = (failureCode) => ({
    status: "invalid_run",
    failure_code: failureCode,
    winner: null,
    diagnostic_grade: { denominator_cases: 0, average: null },
    reviewed_fields: {
      denominator_cases: 0,
      denominator_fields: [],
      exact_matches: 0,
    },
    accepted_full_output: { denominator_cases: 0, exact_matches: 0 },
  });
  if (
    !sealedPredictions ||
    !/^[0-9a-f]{64}$/u.test(sealedPredictions.seal_sha256 ?? "")
  ) {
    return invalid("prediction_bundle_unsealed");
  }
  if (manifest.purpose !== "real_private_quality") {
    return {
      ...invalid("synthetic_plumbing_only"),
      status: "insufficient_sample_size",
    };
  }
  const cases = manifest.cases.filter((caseRecord) =>
    caseRecord.active === true && caseRecord.split === split
  );
  const predictions = new Map();
  for (const prediction of sealedPredictions.predictions ?? []) {
    if (predictions.has(prediction.case_id)) {
      return invalid("duplicate_prediction");
    }
    predictions.set(prediction.case_id, prediction);
  }
  if (
    cases.some((caseRecord) => !predictions.has(caseRecord.id)) ||
    predictions.size !== cases.length
  ) {
    return invalid("prediction_membership_mismatch");
  }
  if (
    sealedPredictions.adapter?.mode === "golden" ||
    [...predictions.values()].some((prediction) =>
      prediction.provenance?.kind === "golden_copy"
    )
  ) return invalid("golden_or_copied_prediction");
  if (
    typeof revalidateEligibility !== "function" ||
    typeof openPermittedLabels !== "function"
  ) {
    return invalid("revalidation_unavailable");
  }
  const receipt = await revalidateEligibility({
    prediction_seal_sha256: sealedPredictions.seal_sha256,
    case_ids: cases.map((caseRecord) => caseRecord.id),
  });
  if (
    receipt?.valid !== true ||
    receipt.prediction_seal_sha256 !== sealedPredictions.seal_sha256 ||
    !sameSet(receipt.active_case_ids, cases.map((caseRecord) => caseRecord.id))
  ) return invalid("stale_or_revoked_case");

  const labels = await openPermittedLabels(receipt);
  const diagnosticGrades = [];
  const reviewedFields = [];
  let reviewedCases = 0;
  let reviewedExact = 0;
  let acceptedCases = 0;
  let acceptedExact = 0;
  for (const caseRecord of cases) {
    const label = getLabel(labels, caseRecord.id);
    const output = predictions.get(caseRecord.id).output;
    if (!label || label.kind !== caseRecord.label.kind) {
      return invalid("label_contract_mismatch");
    }
    if (label.kind === "diagnostic_grade") {
      if (
        !Number.isInteger(label.grade) || label.grade < 1 || label.grade > 5
      ) return invalid("diagnostic_grade_invalid");
      diagnosticGrades.push(label.grade);
    } else if (label.kind === "reviewed_fields") {
      reviewedCases += 1;
      for (const field of label.reviewed_fields ?? []) {
        reviewedFields.push(field);
        if (
          canonicalJson(output?.[field]) ===
            canonicalJson(label.reference?.[field])
        ) reviewedExact += 1;
      }
    } else if (label.kind === "accepted_full_output") {
      acceptedCases += 1;
      if (canonicalJson(output) === canonicalJson(label.canonical_output)) {
        acceptedExact += 1;
      }
    }
  }
  const enough = acceptedCases >= minAcceptedFullOutputCases;
  return {
    status: enough ? "quality_result" : "insufficient_sample_size",
    failure_code: enough ? null : "accepted_full_output_sample_too_small",
    winner: null,
    diagnostic_grade: {
      denominator_cases: diagnosticGrades.length,
      average: diagnosticGrades.length
        ? diagnosticGrades.reduce((sum, grade) => sum + grade, 0) /
          diagnosticGrades.length
        : null,
    },
    reviewed_fields: {
      denominator_cases: reviewedCases,
      denominator_fields: [...new Set(reviewedFields)].sort(),
      exact_matches: reviewedExact,
    },
    accepted_full_output: {
      denominator_cases: acceptedCases,
      exact_matches: acceptedExact,
    },
  };
}

function sameSet(left, right) {
  return Array.isArray(left) && left.length === right.length &&
    right.every((value) => left.includes(value));
}

function getLabel(labels, id) {
  return labels instanceof Map ? labels.get(id) : labels?.[id];
}

function parseArgs(argv) {
  const args = { minAcceptedFullOutputCases: 20 };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") args.manifest = argv[++index];
    else if (arg === "--predictions") args.predictions = argv[++index];
    else if (arg === "--split") args.split = argv[++index];
    else if (arg === "--min-accepted-full-output-cases") {
      args.minAcceptedFullOutputCases = Number(argv[++index]);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.manifest || !args.predictions || !args.split) {
    throw new Error("manifest, predictions, and split are required");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const manifest = JSON.parse(await fs.readFile(args.manifest, "utf8"));
  let sealedPredictions;
  try {
    const stats = await fs.stat(args.predictions);
    const predictionPath = stats.isDirectory()
      ? path.join(args.predictions, "bundle.json")
      : args.predictions;
    sealedPredictions = JSON.parse(await fs.readFile(predictionPath, "utf8"));
  } catch {
    sealedPredictions = { seal_sha256: "0".repeat(64), predictions: [] };
  }
  const report = await scorePrivateRun({
    manifest,
    sealedPredictions,
    split: args.split,
    minAcceptedFullOutputCases: args.minAcceptedFullOutputCases,
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "quality_result") process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
