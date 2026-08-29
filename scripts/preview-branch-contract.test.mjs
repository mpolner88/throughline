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

test("requires separate fifth-only and hardening-only local migration dry-runs", () => {
  const assertExactPendingMigration = requiredExport(
    databaseGate,
    "assertExactPendingMigration",
  );
  const measurement = "20260817180709_measurement_attribution.sql";
  const hardening = "20260818061933_measurement_privilege_hardening.sql";
  const dryRun = (expected) => [
    "DRY RUN: migrations will not be pushed to the database.",
    "Would you like to push these migrations to the local database?",
    ` • ${expected}`,
    "Finished supabase db push.",
  ].join("\n");

  assert.equal(assertExactPendingMigration(dryRun(measurement), measurement), measurement);
  assert.equal(assertExactPendingMigration(dryRun(hardening), hardening), hardening);
  assert.throws(
    () =>
      assertExactPendingMigration(
        `${dryRun(measurement)}\n • ${hardening}`,
        measurement,
      ),
    /exactly one pending migration/i,
  );
  assert.throws(
    () => assertExactPendingMigration("No pending migrations.", measurement),
    /exactly one pending migration/i,
  );
  assert.throws(
    () =>
      assertExactPendingMigration(
        `${dryRun(hardening)}\n • ${hardening}`,
        hardening,
      ),
    /exactly one pending migration/i,
  );
});

test("defines measurement then privilege hardening as two ordered phases", () => {
  const measurementMigrationPhases = requiredExport(
    databaseGate,
    "measurementMigrationPhases",
  );

  assert.deepEqual(measurementMigrationPhases(), [
    {
      migration: "20260817180709_measurement_attribution.sql",
      test: "measurement_attribution_test.sql",
      tests: 30,
    },
    {
      migration: "20260818061933_measurement_privilege_hardening.sql",
      test: "measurement_privilege_hardening_test.sql",
      tests: 7,
    },
  ]);
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
  for (const adversarial of [
    `${passing}\nFiles=1, Tests=30,  1 wallclock secs`,
    `${passing}\nResult: PASS`,
    `${passing}\nResult: FAIL`,
    `Files=1, Tests=29,  1 wallclock secs\n${passing}`,
  ]) {
    assert.throws(
      () => assertExactPgTapPass(adversarial),
      /Files=1, Tests=30, Result: PASS/,
    );
  }
});

test("requires one exact baseline pgTAP summary and result", () => {
  const assertExactBaselinePgTapPass = requiredExport(
    databaseGate,
    "assertExactBaselinePgTapPass",
  );
  const passing = [
    "All tests successful.",
    "Files=1, Tests=21,  1 wallclock secs",
    "Result: PASS",
  ].join("\n");

  assert.deepEqual(assertExactBaselinePgTapPass(passing), {
    files: 1,
    tests: 21,
    result: "PASS",
  });
  for (const adversarial of [
    `${passing}\nFiles=1, Tests=21,  1 wallclock secs`,
    `${passing}\nResult: PASS`,
    `${passing}\nResult: FAIL`,
    `Files=1, Tests=20,  1 wallclock secs\n${passing}`,
  ]) {
    assert.throws(
      () => assertExactBaselinePgTapPass(adversarial),
      /Files=1, Tests=21, Result: PASS/,
    );
  }
});

test("requires one exact privilege-hardening pgTAP summary and result", () => {
  const assertExactHardeningPgTapPass = requiredExport(
    databaseGate,
    "assertExactHardeningPgTapPass",
  );
  const passing = [
    "All tests successful.",
    "Files=1, Tests=7,  1 wallclock secs",
    "Result: PASS",
  ].join("\n");

  assert.deepEqual(assertExactHardeningPgTapPass(passing), {
    files: 1,
    tests: 7,
    result: "PASS",
  });
  for (const adversarial of [
    `${passing}\nFiles=1, Tests=7,  1 wallclock secs`,
    `${passing}\nResult: PASS`,
    `${passing}\nResult: FAIL`,
    `Files=1, Tests=6,  1 wallclock secs\n${passing}`,
  ]) {
    assert.throws(
      () => assertExactHardeningPgTapPass(adversarial),
      /Files=1, Tests=7, Result: PASS/,
    );
  }
});

test("summarizes pgTAP failures as assertion numbers only", () => {
  const summarizePgTapFailure = requiredExport(
    databaseGate,
    "summarizePgTapFailure",
  );
  const output = [
    "# Failed test 18: PRIVATE_SENTINEL service role detail",
    "# Failed test 3: PRIVATE_SENTINEL schema detail",
    "  Failed test:  3 18",
  ].join("\n");

  assert.equal(summarizePgTapFailure(output), "failed assertions: 3,18");
  assert.equal(
    summarizePgTapFailure("pgTAP exited before producing TAP"),
    "failed assertions unavailable",
  );
  assert.doesNotMatch(summarizePgTapFailure(output), /PRIVATE_SENTINEL/);
});

const captureFailure = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("expected promise to reject");
};

test("bounds stdout and stderr without echoing child output", async () => {
  const runBoundedCommand = requiredExport(databaseGate, "runBoundedCommand");

  for (const stream of ["stdout", "stderr"]) {
    const failure = await captureFailure(
      runBoundedCommand(
        process.execPath,
        [
          "-e",
          `process.${stream}.write("DO_NOT_ECHO".repeat(256)); setInterval(() => {}, 1000);`,
        ],
        `${stream} overflow fixture`,
        { timeoutMs: 2_000, maxOutputBytes: 128, terminateGraceMs: 50 },
      ),
    );

    assert.match(failure.message, new RegExp(`${stream} exceeded bounded output`));
    assert.doesNotMatch(failure.message, /DO_NOT_ECHO/);
  }
}, { timeout: 5_000 });

test("uses a safe failure summarizer without echoing child output", async () => {
  const runBoundedCommand = requiredExport(databaseGate, "runBoundedCommand");
  const summarizePgTapFailure = requiredExport(
    databaseGate,
    "summarizePgTapFailure",
  );
  const failure = await captureFailure(
    runBoundedCommand(
      process.execPath,
      [
        "-e",
        'process.stdout.write("not ok 18 - PRIVATE_SENTINEL\\n"); process.stderr.write("PRIVATE_ERROR\\n"); process.exit(7);',
      ],
      "pgTAP failure fixture",
      { summarizeFailure: summarizePgTapFailure },
    ),
  );

  assert.equal(
    failure.message,
    "pgTAP failure fixture failed with exit code 7 (failed assertions: 18)",
  );
  assert.doesNotMatch(failure.message, /PRIVATE_SENTINEL|PRIVATE_ERROR/);
});

test("SIGKILL bounds a child that ignores SIGTERM", async () => {
  const runBoundedCommand = requiredExport(databaseGate, "runBoundedCommand");
  const startedAt = Date.now();
  const failure = await captureFailure(
    runBoundedCommand(
      process.execPath,
      [
        "-e",
        "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);",
      ],
      "timeout fixture",
      { timeoutMs: 150, maxOutputBytes: 128, terminateGraceMs: 50 },
    ),
  );

  assert.match(failure.message, /timeout fixture exceeded its bounded timeout/);
  assert.ok(Date.now() - startedAt < 2_000, "timeout child must be reaped promptly");
}, { timeout: 3_000 });

test("accepts only a bodyless successful REST HEAD with exact zero count", () => {
  const assertEmptyHeadResponse = requiredExport(
    databaseGate,
    "assertEmptyHeadResponse",
  );
  const empty = new Response(null, {
    status: 200,
    headers: { "content-range": "*/0" },
  });

  assert.equal(assertEmptyHeadResponse(empty, "REST fixture"), 0);
  assert.throws(
    () =>
      assertEmptyHeadResponse(
        new Response(null, {
          status: 200,
          headers: { "content-range": "0-0/1" },
        }),
        "REST fixture",
      ),
    /exact total count zero/,
  );
  assert.throws(
    () =>
      assertEmptyHeadResponse(
        new Response(null, { status: 403 }),
        "REST fixture",
      ),
    /returned status 403/,
  );
});

test("uses a schema-valid content-free projection for every REST probe", () => {
  const serviceRoleRestProbes = requiredExport(
    databaseGate,
    "serviceRoleRestProbes",
  );
  const baseline = [
    { table: "throughline_recordings", column: "id" },
    { table: "throughline_feedback", column: "id" },
    { table: "throughline_product_events", column: "id" },
    { table: "throughline_product_feedback", column: "id" },
  ];

  assert.deepEqual(serviceRoleRestProbes(false), baseline);
  assert.deepEqual(serviceRoleRestProbes(true), [
    ...baseline,
    { table: "throughline_internal_users", column: "auth_user_id" },
  ]);
  assert.throws(
    () => serviceRoleRestProbes("true"),
    /Boolean allowlist selection/i,
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

test("uses only the trusted platform temporary root", () => {
  const resolveMeasurementTemporaryRoot = requiredExport(
    databaseGate,
    "resolveMeasurementTemporaryRoot",
  );

  assert.equal(resolveMeasurementTemporaryRoot("darwin"), "/private/tmp");
  assert.equal(resolveMeasurementTemporaryRoot("linux"), "/tmp");
  assert.throws(
    () => resolveMeasurementTemporaryRoot("win32"),
    /unsupported measurement database platform/i,
  );
});

test("builds cleanup only for one matching unique temporary project", () => {
  const buildCleanupPlan = requiredExport(databaseGate, "buildCleanupPlan");
  const suffix = "a1b2c3d4e5f6";
  const projectId = `throughline-measurement-db-${suffix}`;
  const temporaryRoot = "/private/tmp";
  const workdir = `${temporaryRoot}/${projectId}`;

  assert.deepEqual(buildCleanupPlan({ workdir, projectId, temporaryRoot }), {
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
    () =>
      buildCleanupPlan({
        workdir: "/private/tmp/unrelated",
        projectId,
        temporaryRoot,
      }),
    /validated unique temporary project/i,
  );
  assert.throws(
    () =>
      buildCleanupPlan({
        workdir,
        projectId: "throughline-measurement-db-ffffffffffff",
        temporaryRoot,
      }),
    /validated unique temporary project/i,
  );
  assert.throws(
    () =>
      buildCleanupPlan({
        workdir: "/private/tmp/throughline-measurement-db-",
        projectId: "throughline-measurement-db-",
        temporaryRoot,
      }),
    /validated unique temporary project/i,
  );
  assert.deepEqual(
    buildCleanupPlan({
      workdir: `/tmp/${projectId}`,
      projectId,
      temporaryRoot: "/tmp",
    }),
    {
      stopArgs: [
        "--workdir",
        `/tmp/${projectId}`,
        "--agent=no",
        "stop",
        "--project-id",
        projectId,
        "--no-backup",
      ],
      removeDirectory: `/tmp/${projectId}`,
    },
  );
  assert.throws(
    () =>
      buildCleanupPlan({
        workdir: `/var/tmp/${projectId}`,
        projectId,
        temporaryRoot: "/var/tmp",
      }),
    /validated unique temporary project/i,
  );
});
