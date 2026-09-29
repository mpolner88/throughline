#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SCHEMA_VERSION = "throughline_evaluation_owner_canary_package_v1";
const PRIVATE_FILENAME_PATTERN = /^throughline-evaluation-owner-canary-[a-z0-9._-]+\.json$/u;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu;
const UNSAFE_KEYS = new Set([
  "audio",
  "authorization",
  "correction",
  "credential",
  "feedback",
  "grade",
  "note",
  "prompt",
  "readiness",
  "recording_id",
  "reference",
  "secret",
  "token",
  "transcript",
]);

export const OWNER_CANARY_SOURCE_PATHS = [
  "supabase/functions/api/index.ts",
  "supabase/functions/_shared/evaluation-flags.ts",
  "ios/Throughline/Services/EvaluationContributionContract.swift",
  "ios/Throughline/Services/UploadClient.swift",
  "ios/Throughline/Views/HomeView.swift",
  "ios/Throughline/PrivacyInfo.xcprivacy",
  "docs/privacy-policy.md",
  "docs/privacy/index.html",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function phases() {
  return [
    {
      id: "flags_off_preflight",
      actor: "agent",
      requires: ["all_behavior_controls_absent", "active_eligibility_zero"],
      proves: ["api_healthy", "retention_aware_rollback_ready"],
    },
    {
      id: "lineage_enablement",
      actor: "agent",
      requires: ["flags_off_preflight_passed"],
      proves: ["complete_immutable_lineage"],
    },
    {
      id: "retention_enablement",
      actor: "agent",
      requires: ["lineage_enablement_passed", "exact_cutover_timestamp"],
      proves: ["ordinary_and_evaluation_retention_separated"],
    },
    {
      id: "evaluation_write_enablement",
      actor: "agent",
      requires: ["retention_enablement_passed"],
      proves: ["owner_only_revision_bound_writes_available"],
    },
    {
      id: "owner_diagnostic_grade",
      actor: "recording_owner",
      requires: ["private_disclosure_seen", "readiness_off"],
      proves: ["diagnostic_only", "not_full_output_eligible"],
    },
    {
      id: "owner_reviewed_fields",
      actor: "recording_owner",
      requires: ["material_correction_personally_saved", "readiness_off"],
      proves: ["reviewed_fields_only", "not_full_output_eligible"],
    },
    {
      id: "owner_full_output_acceptance",
      actor: "recording_owner",
      requires: [
        "all_14_canonical_fields_inspectable",
        "exact_revision_payload_and_contract_bound",
        "deliberate_acceptance",
      ],
      proves: ["accepted_full_output_eligible"],
    },
    {
      id: "owner_withdrawal",
      actor: "recording_owner",
      requires: ["removal_personally_requested"],
      proves: ["active_eligibility_zero", "private_artifacts_removed"],
    },
    {
      id: "content_free_postflight",
      actor: "agent",
      requires: ["owner_withdrawal_passed"],
      proves: ["aggregate_cleanup", "correct_rollback_phase"],
    },
  ];
}

export function assertOwnerCanaryPackagePrivacy(value) {
  function inspect(entry) {
    if (Array.isArray(entry)) {
      for (const child of entry) inspect(child);
      return;
    }
    if (entry && typeof entry === "object") {
      for (const [key, child] of Object.entries(entry)) {
        if (UNSAFE_KEYS.has(key.toLowerCase())) {
          throw new Error("Owner canary package is not privacy-safe");
        }
        inspect(child);
      }
      return;
    }
    if (typeof entry === "string") {
      if (UUID_PATTERN.test(entry) || /https?:\/\//iu.test(entry) || /bearer\s+\S+/iu.test(entry)) {
        throw new Error("Owner canary package is not privacy-safe");
      }
    }
  }
  inspect(value);
  return true;
}

export async function buildOwnerCanaryPackage({ root = process.cwd() } = {}) {
  const sources = {};
  for (const relativePath of OWNER_CANARY_SOURCE_PATHS) {
    const bytes = await readFile(path.resolve(root, relativePath));
    sources[relativePath] = {
      sha256: sha256(bytes),
      bytes: bytes.byteLength,
    };
  }

  const body = {
    schema_version: SCHEMA_VERSION,
    production_target: "throughline_supabase_production",
    scope: "local_preparation_only",
    sources,
    owner_boundary: {
      recording_user_is_only_evaluator: true,
      agent_must_not_supply: ["grade", "correction", "readiness"],
      private_values_are_never_serialized: true,
    },
    execution: {
      phases: phases(),
      stop_on_failed_requirement: true,
      real_private_materialization: false,
      independent_provider_execution: false,
    },
    rollback: {
      before_active_eligibility: {
        mode: "stable",
        flags: {
          lineage_writes: false,
          evaluation_writes: false,
          evaluation_retention: false,
        },
      },
      after_active_eligibility: {
        mode: "retention_aware",
        flags: {
          lineage_writes: false,
          evaluation_writes: false,
          evaluation_retention: true,
        },
      },
    },
    excluded_actions: [
      "policy_publication",
      "app_store_changes",
      "binary_release",
      "real_private_audio_materialization",
      "independent_provider_execution",
    ],
  };
  assertOwnerCanaryPackagePrivacy(body);
  const result = { ...body, package_sha256: sha256(canonicalJson(body)) };
  assertOwnerCanaryPackagePrivacy(result);
  return result;
}

function allowedPrivateDestination(destination) {
  const absolute = path.resolve(destination);
  const allowedRoots = [path.resolve(os.tmpdir()), "/private/tmp", "/tmp"];
  return PRIVATE_FILENAME_PATTERN.test(path.basename(absolute)) &&
    allowedRoots.some((root) => absolute === path.join(root, path.basename(absolute)));
}
export async function verifyOwnerCanaryPackage(
  canary,
  { root = process.cwd() } = {},
) {
  assertOwnerCanaryPackagePrivacy(canary);
  if (!canary || typeof canary !== "object" || Array.isArray(canary)) {
    throw new Error("Owner canary package integrity is invalid");
  }
  const { package_sha256: recordedHash, ...body } = canary;
  if (
    typeof recordedHash !== "string" ||
    recordedHash !== sha256(canonicalJson(body))
  ) {
    throw new Error("Owner canary package integrity is invalid");
  }
  if (
    body.schema_version !== SCHEMA_VERSION ||
    body.scope !== "local_preparation_only" ||
    !body.sources || typeof body.sources !== "object" ||
    Object.keys(body.sources).join("\n") !== OWNER_CANARY_SOURCE_PATHS.join("\n")
  ) {
    throw new Error("Owner canary package integrity is invalid");
  }
  for (const relativePath of OWNER_CANARY_SOURCE_PATHS) {
    const bytes = await readFile(path.resolve(root, relativePath));
    const binding = body.sources[relativePath];
    if (
      !binding || binding.sha256 !== sha256(bytes) ||
      binding.bytes !== bytes.byteLength
    ) {
      throw new Error("Owner canary source binding drift detected");
    }
  }
  return {
    status: "verified",
    scope: body.scope,
    phase_count: body.execution.phases.length,
    source_binding_count: OWNER_CANARY_SOURCE_PATHS.length,
    package_sha256: recordedHash,
  };
}


export async function writeOwnerCanaryPackage(canary, destination) {
  assertOwnerCanaryPackagePrivacy(canary);
  if (!allowedPrivateDestination(destination)) {
    throw new Error("Owner canary package must use the private temporary namespace");
  }
  await writeFile(destination, `${JSON.stringify(canary, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  return destination;
}

async function main() {
  const destination = process.argv[2];
  if (!destination || process.argv.length !== 3) {
    throw new Error(
      "Usage: node scripts/build-evaluation-owner-canary-package.mjs /private/tmp/throughline-evaluation-owner-canary-<label>.json",
    );
  }
  const canary = await buildOwnerCanaryPackage();
  await writeOwnerCanaryPackage(canary, destination);
  process.stdout.write(JSON.stringify({
    status: "prepared",
    scope: canary.scope,
    package_sha256: canary.package_sha256,
  }) + "\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
