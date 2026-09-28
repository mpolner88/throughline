import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertOwnerCanaryPackagePrivacy,
  buildOwnerCanaryPackage,
  verifyOwnerCanaryPackage,
  writeOwnerCanaryPackage,
} from "./build-evaluation-owner-canary-package.mjs";

const SOURCE_PATHS = [
  "supabase/functions/api/index.ts",
  "supabase/functions/_shared/evaluation-flags.ts",
  "ios/Throughline/Services/EvaluationContributionContract.swift",
  "ios/Throughline/Services/UploadClient.swift",
  "ios/Throughline/Views/HomeView.swift",
  "ios/Throughline/PrivacyInfo.xcprivacy",
  "docs/privacy-policy.md",
  "docs/privacy/index.html",
];

async function syntheticRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "throughline-owner-canary-test-"));
  for (const relativePath of SOURCE_PATHS) {
    const absolutePath = path.join(root, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `synthetic source for ${relativePath}\n`);
  }
  return root;
}

test("package fixes retention before evaluation writes and keeps owner judgment out of automation", async () => {
  const root = await syntheticRoot();
  const canary = await buildOwnerCanaryPackage({ root });

  assert.deepEqual(
    canary.execution.phases.map((phase) => phase.id),
    [
      "flags_off_preflight",
      "lineage_enablement",
      "retention_enablement",
      "evaluation_write_enablement",
      "owner_diagnostic_grade",
      "owner_reviewed_fields",
      "owner_full_output_acceptance",
      "owner_withdrawal",
      "content_free_postflight",
    ],
  );
  assert.equal(
    canary.execution.phases.findIndex((phase) => phase.id === "retention_enablement") <
      canary.execution.phases.findIndex((phase) => phase.id === "evaluation_write_enablement"),
    true,
  );
  assert.deepEqual(canary.owner_boundary.agent_must_not_supply, [
    "grade",
    "correction",
    "readiness",
  ]);
  assert.equal(canary.owner_boundary.recording_user_is_only_evaluator, true);
  assert.equal(canary.execution.phases[4].actor, "recording_owner");
  assert.equal(canary.execution.phases[5].actor, "recording_owner");
  assert.equal(canary.execution.phases[6].actor, "recording_owner");
});

test("package binds the exact local client and API sources and is deterministic", async () => {
  const root = await syntheticRoot();
  const first = await buildOwnerCanaryPackage({ root });
  const second = await buildOwnerCanaryPackage({ root });

  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first.sources), SOURCE_PATHS);
  for (const source of Object.values(first.sources)) {
    assert.match(source.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(source.bytes > 0, true);
  }
  assert.match(first.package_sha256, /^[0-9a-f]{64}$/u);
});

test("rollback becomes retention-aware after any active eligibility", async () => {
  const root = await syntheticRoot();
  const canary = await buildOwnerCanaryPackage({ root });

  assert.equal(canary.rollback.before_active_eligibility.mode, "stable");
  assert.deepEqual(canary.rollback.before_active_eligibility.flags, {
    lineage_writes: false,
    evaluation_writes: false,
    evaluation_retention: false,
  });
  assert.equal(canary.rollback.after_active_eligibility.mode, "retention_aware");
  assert.deepEqual(canary.rollback.after_active_eligibility.flags, {
    lineage_writes: false,
    evaluation_writes: false,
    evaluation_retention: true,
  });
});

test("privacy guard rejects owner values, private identifiers, content, and credentials", async () => {
  const root = await syntheticRoot();
  const canary = await buildOwnerCanaryPackage({ root });
  assert.equal(assertOwnerCanaryPackagePrivacy(canary), true);

  for (const unsafe of [
    { grade: 4 },
    { correction: "private corrected note" },
    { readiness: true },
    { recording_id: "00000000-0000-4000-8000-000000000001" },
    { transcript: "private transcript" },
    { token: "private credential" },
  ]) {
    assert.throws(
      () => assertOwnerCanaryPackagePrivacy({ ...canary, unsafe }),
      /privacy-safe/iu,
    );
  }
});
test("verifier detects source drift and package tampering before any hosted action", async () => {
  const root = await syntheticRoot();
  const canary = await buildOwnerCanaryPackage({ root });
  assert.deepEqual(await verifyOwnerCanaryPackage(canary, { root }), {
    status: "verified",
    scope: "local_preparation_only",
    phase_count: 9,
    source_binding_count: 8,
    package_sha256: canary.package_sha256,
  });

  await writeFile(
    path.join(root, SOURCE_PATHS[0]),
    "drifted synthetic API source\n",
  );
  await assert.rejects(
    verifyOwnerCanaryPackage(canary, { root }),
    /source binding drift/iu,
  );

  const fresh = await buildOwnerCanaryPackage({ root });
  const tampered = structuredClone(fresh);
  [tampered.execution.phases[2], tampered.execution.phases[3]] = [
    tampered.execution.phases[3],
    tampered.execution.phases[2],
  ];
  await assert.rejects(
    verifyOwnerCanaryPackage(tampered, { root }),
    /package integrity/iu,
  );
});


test("writer refuses a tracked destination and emits a mode-0600 private package", async () => {
  const root = await syntheticRoot();
  const canary = await buildOwnerCanaryPackage({ root });
  await assert.rejects(
    writeOwnerCanaryPackage(canary, path.join(root, "owner-canary.json")),
    /private temporary namespace/iu,
  );

  const destination = path.join(
    os.tmpdir(),
    `throughline-evaluation-owner-canary-${process.pid}.json`,
  );
  await writeOwnerCanaryPackage(canary, destination);
  const metadata = await stat(destination);
  assert.equal(metadata.mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), canary);
});
