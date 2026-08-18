import assert from "node:assert/strict";
import test from "node:test";

import * as branchContract from "./preview-branch-contract.mjs";
import * as databaseGate from "./verify-measurement-database.mjs";

const requiredExport = (module, name) => {
  assert.equal(typeof module[name], "function", `${name} must be exported`);
  return module[name];
};

test("accepts only an own Boolean false with_data value", () => {
  const isExplicitlyDataLess = requiredExport(branchContract, "isExplicitlyDataLess");
  const inherited = Object.create({ with_data: false });

  for (const candidate of [
    {},
    inherited,
    { with_data: null },
    { with_data: true },
    { with_data: "false" },
  ]) {
    assert.equal(isExplicitlyDataLess(candidate), false);
  }
  assert.equal(isExplicitlyDataLess({ with_data: false }), true);
});

test("selects exactly one branch by exact name", () => {
  const selectExactBranchByName = requiredExport(
    branchContract,
    "selectExactBranchByName",
  );
  const target = { name: "measurement-db-a1b2c3", with_data: false };

  assert.equal(
    selectExactBranchByName(
      [
        { name: "measurement-db-a1b2c3-extra", with_data: false },
        target,
      ],
      "measurement-db-a1b2c3",
    ),
    target,
  );
  assert.throws(
    () => selectExactBranchByName([], "measurement-db-a1b2c3"),
    /exactly one branch/i,
  );
  assert.throws(
    () => selectExactBranchByName([target, { ...target }], target.name),
    /exactly one branch/i,
  );
});

test("requires a fifth-only local migration dry-run", () => {
  const assertExactPendingMigration = requiredExport(
    databaseGate,
    "assertExactPendingMigration",
  );
  const expected = "20260817180709_measurement_attribution.sql";
  const fifthOnly = [
    "DRY RUN: migrations will not be pushed to the database.",
    "Would you like to push these migrations to the local database?",
    ` • ${expected}`,
    "Finished supabase db push.",
  ].join("\n");

  assert.equal(assertExactPendingMigration(fifthOnly, expected), expected);
  assert.throws(
    () =>
      assertExactPendingMigration(
        `${fifthOnly}\n • 20260806044304_product_feedback_and_events.sql`,
        expected,
      ),
    /exactly one pending migration/i,
  );
  assert.throws(
    () => assertExactPendingMigration("No pending migrations.", expected),
    /exactly one pending migration/i,
  );
  assert.throws(
    () => assertExactPendingMigration(`${fifthOnly}\n • ${expected}`, expected),
    /exactly one pending migration/i,
  );
});

test("requires exact pgTAP Files=1, Tests=30, Result: PASS", () => {
  const assertExactPgTapPass = requiredExport(databaseGate, "assertExactPgTapPass");
  const passing = [
    "All tests successful.",
    "Files=1, Tests=30,  1 wallclock secs",
    "Result: PASS",
  ].join("\n");

  assert.deepEqual(assertExactPgTapPass(passing), {
    files: 1,
    tests: 30,
    result: "PASS",
  });
  assert.throws(
    () => assertExactPgTapPass(passing.replace("Files=1", "Files=2")),
    /Files=1, Tests=30, Result: PASS/,
  );
  assert.throws(
    () => assertExactPgTapPass(passing.replace("Tests=30", "Tests=29")),
    /Files=1, Tests=30, Result: PASS/,
  );
  assert.throws(
    () => assertExactPgTapPass(passing.replace("Result: PASS", "Result: FAIL")),
    /Files=1, Tests=30, Result: PASS/,
  );
});

test("rejects a frozen-input hash mismatch", () => {
  const assertFrozenHash = requiredExport(databaseGate, "assertFrozenHash");
  const expected = "a".repeat(64);

  assert.equal(assertFrozenHash(expected, expected, "candidate"), expected);
  assert.throws(
    () => assertFrozenHash("b".repeat(64), expected, "candidate"),
    /candidate SHA-256 mismatch/,
  );
});

test("builds cleanup only for one matching unique temporary project", () => {
  const buildCleanupPlan = requiredExport(databaseGate, "buildCleanupPlan");
  const suffix = "a1b2c3d4e5f6";
  const projectId = `throughline-measurement-db-${suffix}`;
  const workdir = `/private/tmp/${projectId}`;

  assert.deepEqual(buildCleanupPlan({ workdir, projectId }), {
    stopArgs: [
      "--workdir",
      workdir,
      "--agent=no",
      "stop",
      "--project-id",
      projectId,
      "--no-backup",
    ],
    removeDirectory: workdir,
  });
  assert.throws(
    () => buildCleanupPlan({ workdir: "/private/tmp/unrelated", projectId }),
    /validated unique temporary project/i,
  );
  assert.throws(
    () =>
      buildCleanupPlan({
        workdir,
        projectId: "throughline-measurement-db-ffffffffffff",
      }),
    /validated unique temporary project/i,
  );
  assert.throws(
    () =>
      buildCleanupPlan({
        workdir: "/private/tmp/throughline-measurement-db-",
        projectId: "throughline-measurement-db-",
      }),
    /validated unique temporary project/i,
  );
});
