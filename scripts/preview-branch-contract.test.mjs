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

test("builds complete starting-state SQL without referencing absent relations", () => {
  const buildStartingStateClassificationSql = requiredExport(
    branchContract,
    "buildStartingStateClassificationSql",
  );
  const absentInventory = {
    migrationHistory: false,
    authUsers: false,
    storageObjects: false,
    storageBuckets: false,
  };
  const absentSql = buildStartingStateClassificationSql(absentInventory);
  const classificationColumns = [
    "history",
    "tables",
    "measurement_column_count",
    "measurement_constraint_count",
    "measurement_index_exists",
    "allowlist_exists",
    "auth_user_count",
    "storage_object_count",
    "bucket_count",
    "throughline_bucket_count",
  ];

  for (const column of classificationColumns) {
    assert.match(absentSql, new RegExp(`\\bas ${column}\\b`, "u"));
  }
  assert.match(absentSql, /from\s+pg_catalog\.pg_tables/iu);
  assert.match(absentSql, /from\s+pg_catalog\.pg_constraint/iu);
  assert.doesNotMatch(absentSql, /from\s+(?:pg_tables|pg_constraint)\b/iu);
  assert.doesNotMatch(
    absentSql,
    /from\s+(?:supabase_migrations\.schema_migrations|auth\.users|storage\.(?:objects|buckets))/iu,
  );

  const mixedSql = buildStartingStateClassificationSql({
    migrationHistory: true,
    authUsers: false,
    storageObjects: true,
    storageBuckets: false,
  });
  assert.match(mixedSql, /from\s+supabase_migrations\.schema_migrations/iu);
  assert.doesNotMatch(mixedSql, /from\s+auth\.users/iu);
  assert.match(mixedSql, /from\s+storage\.objects/iu);
  assert.doesNotMatch(mixedSql, /from\s+storage\.buckets/iu);
});

test("rejects malformed starting-state relation inventories", () => {
  const buildStartingStateClassificationSql = requiredExport(
    branchContract,
    "buildStartingStateClassificationSql",
  );
  const valid = {
    migrationHistory: false,
    authUsers: false,
    storageObjects: false,
    storageBuckets: false,
  };

  for (const malformed of [
    null,
    [],
    { ...valid, authUsers: "false" },
    { ...valid, storageBuckets: undefined },
    { ...valid, unexpected: false },
    {
      migrationHistory: false,
      authUsers: false,
      storageObjects: false,
    },
  ]) {
    assert.throws(
      () => buildStartingStateClassificationSql(malformed),
      /exact Boolean relation inventory/i,
    );
  }
});

test("requires the exact four baseline migrations in order", () => {
  const assertExactPendingMigrations = requiredExport(
    databaseGate,
    "assertExactPendingMigrations",
  );
  const baseline = [
    "0001_throughline_memory.sql",
    "20260510025558_enable_rls_for_throughline.sql",
    "20260516173641_user_accounts_and_mcp_tokens.sql",
    "20260806044304_product_feedback_and_events.sql",
  ];
  const dryRun = (migrations) => [
    "DRY RUN: migrations will not be pushed to the database.",
    ...migrations.map((migration) => ` • ${migration}`),
    "Finished supabase db push.",
  ].join("\n");

  assert.deepEqual(assertExactPendingMigrations(dryRun(baseline), baseline), baseline);
  for (const adversarial of [
    baseline.slice(1),
    [baseline[0], baseline[0], ...baseline.slice(1)],
    [baseline[1], baseline[0], ...baseline.slice(2)],
    [...baseline, "20260817180709_measurement_attribution.sql"],
  ]) {
    assert.throws(
      () => assertExactPendingMigrations(dryRun(adversarial), baseline),
      /exact pending migration sequence/i,
    );
  }
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

test("summarizes pgTAP command failures with fixed content-safe categories", () => {
  const summarizePgTapCommandFailure = requiredExport(
    databaseGate,
    "summarizePgTapCommandFailure",
  );
  const fixtures = [
    {
      output: [
        "\u001B[31mnot ok 18 - PRIVATE_SENTINEL credential=top-secret\u001B[0m",
        "FATAL: password authentication failed for user private-user",
      ].join("\n"),
      expected: "failed assertions: 18",
    },
    {
      output: "FATAL: password authentication failed PRIVATE_SENTINEL postgres://secret@private.invalid/db",
      expected: "database failure category: authentication",
    },
    {
      output: "ERROR: permission denied PRIVATE_SENTINEL select * from private_table",
      expected: "database failure category: sql_or_permission_or_catalog",
    },
    {
      output: "could not connect to server: Connection refused PRIVATE_SENTINEL https://private.invalid/ref-a1b2c3",
      expected: "database failure category: connection_or_timeout",
    },
    {
      output: "Error: unknown flag: --local PRIVATE_SENTINEL /private/path",
      expected: "pgTAP failure category: invocation",
    },
    {
      output: "Usage:\n  supabase db test [flags]\nPRIVATE_SENTINEL --private-flag",
      expected: "pgTAP failure category: invocation",
    },
    {
      output: "Error: flag needs an argument: --db-url PRIVATE_SENTINEL postgres://secret@private.invalid/db",
      expected: "pgTAP failure category: invocation",
    },
    {
      output: "failed to parse connection string PRIVATE_SENTINEL postgres://secret@private.invalid/db",
      expected: "pgTAP failure category: invocation",
    },
    {
      output: "invalid dsn PRIVATE_SENTINEL postgres://secret@private.invalid/db",
      expected: "pgTAP failure category: invocation",
    },
    {
      output: "Usage:\n  supabase test db [flags]\nPRIVATE_SENTINEL --private-flag",
      expected: "pgTAP failure category: invocation",
    },
    {
      output: "TAP version 13\n1..21\n# PRIVATE_SENTINEL no safe assertion number",
      expected: "pgTAP failure category: malformed_or_no_summary",
    },
    {
      output: "PRIVATE_SENTINEL https://private.invalid/ref-a1b2c3 credential=top-secret",
      expected: "pgTAP failure category: unknown",
    },
  ];

  for (const { output, expected } of fixtures) {
    const summary = summarizePgTapCommandFailure(output);
    assert.equal(summary, expected);
    assert.doesNotMatch(
      summary,
      /PRIVATE_SENTINEL|private\.invalid|ref-a1b2c3|top-secret|postgres:\/\/|private_table|private-user|private-path/i,
    );
    assert.ok(summary.length <= 80, "pgTAP failure summary must stay bounded");
  }

  assert.equal(
    summarizePgTapCommandFailure(
      "not ok 3 - PRIVATE_SENTINEL\nError: unknown command \"test\" for \"supabase\"\nFATAL: password authentication failed",
    ),
    "failed assertions: 3",
  );
  assert.equal(
    summarizePgTapCommandFailure(
      "Error: unknown flag: --local\nFATAL: password authentication failed PRIVATE_SENTINEL",
    ),
    "database failure category: authentication",
  );
  assert.equal(
    summarizePgTapCommandFailure(
      "Usage: unrelated PRIVATE_SENTINEL\nprivate command details",
    ),
    "pgTAP failure category: unknown",
  );
  assert.equal(
    summarizePgTapCommandFailure(
      Array.from({ length: 10_000 }, (_, index) => `not ok ${index + 1}`)
        .join("\n"),
    ),
    "pgTAP failure category: malformed_or_no_summary",
  );
  assert.equal(
    summarizePgTapCommandFailure("not ok 31 - PRIVATE_SENTINEL"),
    "pgTAP failure category: malformed_or_no_summary",
  );
});

test("classifies database command failures into fixed content-safe categories", () => {
  const summarizeDatabaseCommandFailure = requiredExport(
    databaseGate,
    "summarizeDatabaseCommandFailure",
  );
  const fixtures = [
    {
      output: "could not connect to server: Connection refused PRIVATE_SENTINEL https://private.invalid/ref-a1b2c3",
      expected: "database failure category: connection_or_timeout",
    },
    {
      output: "ERROR: permission denied for relation PRIVATE_SENTINEL credential=top-secret",
      expected: "database failure category: sql_or_permission_or_catalog",
    },
    {
      output: "FATAL: password authentication failed for user PRIVATE_SENTINEL postgres://secret@private.invalid/db",
      expected: "database failure category: authentication",
    },
    {
      output: "PRIVATE_SENTINEL ref-a1b2c3 credential=top-secret https://private.invalid",
      expected: "database failure category: unknown",
    },
    {
      output: "failed to connect to postgres: failed to connect to host: Tenant or user not found PRIVATE_SENTINEL",
      expected: "database failure category: connection_or_timeout",
    },
    {
      output: "failed to query rows: unexpected EOF PRIVATE_SENTINEL",
      expected: "database failure category: connection_or_timeout",
    },
    {
      output: "query error: driver: bad connection PRIVATE_SENTINEL",
      expected: "database failure category: connection_or_timeout",
    },
    {
      output: "failed to connect to postgres: SQLSTATE 08006 PRIVATE_SENTINEL",
      expected: "database failure category: connection_or_timeout",
    },
    {
      output: "failed to parse rows: unsupported value PRIVATE_SENTINEL",
      expected: "database failure category: unknown",
    },
  ];

  for (const { output, expected } of fixtures) {
    const summary = summarizeDatabaseCommandFailure(output);
    assert.equal(summary, expected);
    assert.doesNotMatch(
      summary,
      /PRIVATE_SENTINEL|private\.invalid|ref-a1b2c3|top-secret|postgres:\/\//i,
    );
    assert.ok(summary.length <= 64, "database failure summary must stay bounded");
  }
});

test("attaches only a fixed database failure category to probe failures", async () => {
  const runBoundedCommand = requiredExport(databaseGate, "runBoundedCommand");
  const summarizeDatabaseCommandFailure = requiredExport(
    databaseGate,
    "summarizeDatabaseCommandFailure",
  );
  const failure = await captureFailure(
    runBoundedCommand(
      process.execPath,
      [
        "-e",
        'process.stdout.write("permission denied PRIVATE_SENTINEL https://private.invalid/ref-a1b2c3\\n"); process.stderr.write("credential=top-secret\\n"); process.exit(9);',
      ],
      "database probe fixture",
      { summarizeFailure: summarizeDatabaseCommandFailure },
    ),
  );

  assert.equal(
    failure.message,
    "database probe fixture failed with exit code 9 (database failure category: sql_or_permission_or_catalog)",
  );
  assert.doesNotMatch(
    failure.message,
    /PRIVATE_SENTINEL|private\.invalid|ref-a1b2c3|top-secret|credential/i,
  );
});

test("accepts only one exact full-replay data-less starting-state row", () => {
  const assertFullReplayStartingState = requiredExport(
    databaseGate,
    "assertFullReplayStartingState",
  );
  const fullReplay = {
    history: [],
    tables: [],
    measurement_column_count: 0,
    measurement_constraint_count: 0,
    measurement_index_exists: false,
    allowlist_exists: false,
    auth_user_count: 0,
    storage_object_count: 0,
    bucket_count: 0,
    throughline_bucket_count: 0,
  };

  assert.equal(assertFullReplayStartingState([fullReplay]), "full-replay");
  for (const malformed of [
    null,
    {},
    [],
    [fullReplay, fullReplay],
    [{ ...fullReplay, history: "[]" }],
    [{ ...fullReplay, auth_user_count: "0" }],
    [{ ...fullReplay, tables: ["throughline_recordings"] }],
    [{ ...fullReplay, unexpected: 0 }],
    [{
      history: [],
      tables: [],
      measurement_column_count: 0,
      measurement_constraint_count: 0,
      measurement_index_exists: false,
      allowlist_exists: false,
      auth_user_count: 0,
      storage_object_count: 0,
      bucket_count: 0,
    }],
  ]) {
    assert.throws(
      () => assertFullReplayStartingState(malformed),
      /exact full-replay data-less starting state/i,
    );
  }
});

test("accepts only the exact populated baseline classification row", () => {
  const assertDeltaOnlyStartingState = requiredExport(
    databaseGate,
    "assertDeltaOnlyStartingState",
  );
  const deltaOnly = {
    history: [
      "0001",
      "20260510025558",
      "20260516173641",
      "20260806044304",
    ],
    tables: [
      "throughline_feedback",
      "throughline_mcp_tokens",
      "throughline_product_events",
      "throughline_product_feedback",
      "throughline_profiles",
      "throughline_recordings",
    ],
    measurement_column_count: 0,
    measurement_constraint_count: 0,
    measurement_index_exists: false,
    allowlist_exists: false,
    auth_user_count: 0,
    storage_object_count: 0,
    bucket_count: 1,
    throughline_bucket_count: 1,
  };

  assert.equal(assertDeltaOnlyStartingState([deltaOnly]), "delta-only");
  for (const malformed of [
    [{ ...deltaOnly, history: [] }],
    [{ ...deltaOnly, tables: [...deltaOnly.tables, "unexpected_table"] }],
    [{ ...deltaOnly, bucket_count: 0 }],
    [{ ...deltaOnly, throughline_bucket_count: "1" }],
    [{ ...deltaOnly, unexpected: false }],
  ]) {
    assert.throws(
      () => assertDeltaOnlyStartingState(malformed),
      /exact delta-only data-less starting state/i,
    );
  }
});

test("executes count-only classification against the exact child Management API target", async () => {
  const management = await import("./hosted-preview-management-query.mjs")
    .catch(() => ({}));
  const runChildManagementQuery = requiredExport(
    management,
    "runChildManagementQuery",
  );
  const parentRef = "abcdefghijklmnopqrst";
  const childBranch = {
    name: "measurement-db-a1b2c3",
    project_ref: "bcdefghijklmnopqrstu",
    parent_project_ref: parentRef,
    is_default: false,
    with_data: false,
  };
  const accessToken = `sbp_${"a".repeat(40)}`;
  const startingStateRelationInventorySql = requiredExport(
    branchContract,
    "startingStateRelationInventorySql",
  );
  const sql = startingStateRelationInventorySql();
  let observed = null;

  const rows = await runChildManagementQuery({
    accessToken,
    childBranch,
    parentRef,
    expectedBranchName: childBranch.name,
    sql,
    stage: "classification_inventory",
    fetchImpl: async (url, init) => {
      observed = { url: String(url), init };
      return new Response(JSON.stringify([{ ok: true }]), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(rows, [{ ok: true }]);
  assert.equal(
    observed.url,
    "https://api.supabase.com/v1/projects/bcdefghijklmnopqrstu/database/query/read-only",
  );
  assert.equal(observed.init.method, "POST");
  assert.equal(observed.init.headers.Authorization, `Bearer ${accessToken}`);
  assert.equal(observed.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(observed.init.body), { query: sql });
  assert.ok(observed.init.signal instanceof AbortSignal);
});

test("reports only fixed Management API query stages and failure classes", async () => {
  const management = await import("./hosted-preview-management-query.mjs")
    .catch(() => ({}));
  const runChildManagementQuery = requiredExport(
    management,
    "runChildManagementQuery",
  );
  const base = {
    accessToken: `sbp_${"b".repeat(40)}`,
    childBranch: {
      name: "measurement-db-a1b2c3",
      project_ref: "bcdefghijklmnopqrstu",
      parent_project_ref: "abcdefghijklmnopqrst",
      is_default: false,
      with_data: false,
    },
    parentRef: "abcdefghijklmnopqrst",
    expectedBranchName: "measurement-db-a1b2c3",
    sql: branchContract.buildStartingStateClassificationSql({
      migrationHistory: false,
      authUsers: false,
      storageObjects: false,
      storageBuckets: false,
    }),
    stage: "classification_snapshot",
  };
  const fixtures = [
    { status: 403, safeReason: "authentication", retryable: false },
    { status: 404, safeReason: "target_unavailable", retryable: false },
    { status: 429, safeReason: "provider_unavailable", retryable: true },
    { status: 503, safeReason: "provider_unavailable", retryable: true },
    { status: 200, safeReason: "unexpected_status", retryable: false },
  ];

  const targetFailure = await captureFailure(runChildManagementQuery({
    ...base,
    childBranch: { ...base.childBranch, project_ref: base.parentRef },
    fetchImpl: async () => assert.fail("invalid target must not be fetched"),
  }));
  assert.equal(targetFailure.stage, "classification_snapshot");
  assert.equal(targetFailure.safeReason, "target_validation");
  assert.equal(targetFailure.retryable, false);

  for (const invalidTarget of [
    { childBranch: { ...base.childBranch, name: "measurement-db-wrong" } },
    { childBranch: { ...base.childBranch, is_default: true } },
    { childBranch: { ...base.childBranch, with_data: true } },
    {
      childBranch: {
        ...base.childBranch,
        parent_project_ref: "cdefghijklmnopqrstuv",
      },
    },
    { childBranch: { ...base.childBranch, project_ref: "invalid-ref" } },
    { expectedBranchName: "measurement-db-wrong" },
  ]) {
    const failure = await captureFailure(runChildManagementQuery({
      ...base,
      ...invalidTarget,
      fetchImpl: async () => assert.fail("invalid target must not be fetched"),
    }));
    assert.equal(failure.safeReason, "target_validation");
    assert.equal(failure.retryable, false);
  }

  for (const fixture of fixtures) {
    const failure = await captureFailure(runChildManagementQuery({
      ...base,
      fetchImpl: async () =>
        new Response("PRIVATE_SENTINEL credential=top-secret", {
          status: fixture.status,
        }),
    }));
    assert.equal(failure.stage, "classification_snapshot");
    assert.equal(failure.safeReason, fixture.safeReason);
    assert.equal(failure.retryable, fixture.retryable);
    assert.doesNotMatch(
      failure.message,
      /PRIVATE_SENTINEL|top-secret|bcdefghijklmnopqrstu|sbp_/,
    );
  }

  const connectionFailure = await captureFailure(runChildManagementQuery({
    ...base,
    fetchImpl: async () => {
      throw new Error("PRIVATE_SENTINEL connection detail");
    },
  }));
  assert.equal(connectionFailure.stage, "classification_snapshot");
  assert.equal(connectionFailure.safeReason, "connection_or_timeout");
  assert.equal(connectionFailure.retryable, true);
  assert.doesNotMatch(connectionFailure.message, /PRIVATE_SENTINEL/);

  const cancellationFailure = await captureFailure(runChildManagementQuery({
    ...base,
    fetchImpl: async () => ({
      status: 503,
      body: {
        cancel: async () => {
          throw new Error("PRIVATE_SENTINEL cancellation detail");
        },
      },
    }),
  }));
  assert.equal(cancellationFailure.safeReason, "provider_unavailable");
  assert.equal(cancellationFailure.retryable, true);
  assert.doesNotMatch(cancellationFailure.message, /PRIVATE_SENTINEL/);
});

test("fails closed on malformed or oversized Management API query output", async () => {
  const management = await import("./hosted-preview-management-query.mjs")
    .catch(() => ({}));
  const runChildManagementQuery = requiredExport(
    management,
    "runChildManagementQuery",
  );
  const base = {
    accessToken: `sbp_${"c".repeat(40)}`,
    childBranch: {
      name: "measurement-db-a1b2c3",
      project_ref: "bcdefghijklmnopqrstu",
      parent_project_ref: "abcdefghijklmnopqrst",
      is_default: false,
      with_data: false,
    },
    parentRef: "abcdefghijklmnopqrst",
    expectedBranchName: "measurement-db-a1b2c3",
    sql: branchContract.startingStateRelationInventorySql(),
    stage: "classification_inventory",
  };
  const fixtures = [
    "not-json PRIVATE_SENTINEL",
    JSON.stringify({ rows: [{ ok: true }], private: "PRIVATE_SENTINEL" }),
  ];

  for (const body of fixtures) {
    const failure = await captureFailure(runChildManagementQuery({
      ...base,
      fetchImpl: async () => new Response(body, { status: 201 }),
    }));
    assert.equal(failure.stage, "classification_inventory");
    assert.equal(failure.safeReason, "invalid_response");
    assert.equal(failure.retryable, false);
    assert.doesNotMatch(failure.message, /PRIVATE_SENTINEL|x{16}/);
  }

  let pulls = 0;
  let cancelled = false;
  const chunk = new Uint8Array(40_000).fill(120);
  const chunkedBody = new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  const oversizedFailure = await captureFailure(runChildManagementQuery({
    ...base,
    fetchImpl: async () => ({
      status: 201,
      headers: new Headers(),
      body: chunkedBody,
      arrayBuffer: async () => assert.fail("must not buffer the entire response"),
    }),
  }));
  assert.equal(oversizedFailure.safeReason, "invalid_response");
  assert.equal(cancelled, true);
  assert.ok(pulls <= 3, "response stream must be cancelled at the byte bound");

  const declaredOversizeFailure = await captureFailure(runChildManagementQuery({
    ...base,
    fetchImpl: async () => ({
      status: 201,
      headers: new Headers({ "content-length": "70000" }),
      body: {
        cancel: async () => {
          throw new Error("PRIVATE_SENTINEL cancellation detail");
        },
      },
    }),
  }));
  assert.equal(declaredOversizeFailure.safeReason, "invalid_response");
  assert.doesNotMatch(declaredOversizeFailure.message, /PRIVATE_SENTINEL/);
});

test("rejects unbounded or non-allowlisted Management queries before fetch", async () => {
  const management = await import("./hosted-preview-management-query.mjs")
    .catch(() => ({}));
  const runChildManagementQuery = requiredExport(
    management,
    "runChildManagementQuery",
  );
  const base = {
    accessToken: `sbp_${"d".repeat(40)}`,
    childBranch: {
      name: "measurement-db-a1b2c3",
      project_ref: "bcdefghijklmnopqrstu",
      parent_project_ref: "abcdefghijklmnopqrst",
      is_default: false,
      with_data: false,
    },
    parentRef: "abcdefghijklmnopqrst",
    expectedBranchName: "measurement-db-a1b2c3",
    stage: "classification_inventory",
    fetchImpl: async () => assert.fail("invalid query must not be fetched"),
  };

  for (const sql of [
    "select * from auth.users;",
    "select true;".repeat(2_000),
  ]) {
    const failure = await captureFailure(runChildManagementQuery({ ...base, sql }));
    assert.equal(failure.safeReason, "invalid_request");
    assert.equal(failure.retryable, false);
  }
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

test("uses the safe pgTAP command category without echoing child output", async () => {
  const runBoundedCommand = requiredExport(databaseGate, "runBoundedCommand");
  const summarizePgTapCommandFailure = requiredExport(
    databaseGate,
    "summarizePgTapCommandFailure",
  );
  const failure = await captureFailure(
    runBoundedCommand(
      process.execPath,
      [
        "-e",
        'process.stdout.write("Error: unknown flag: --local PRIVATE_SENTINEL\\n"); process.stderr.write("PRIVATE_ERROR\\n"); process.exit(7);',
      ],
      "pgTAP failure fixture",
      { summarizeFailure: summarizePgTapCommandFailure },
    ),
  );

  assert.equal(
    failure.message,
    "pgTAP failure fixture failed with exit code 7 (pgTAP failure category: invocation)",
  );
  assert.doesNotMatch(failure.message, /PRIVATE_SENTINEL|PRIVATE_ERROR/);
});

test("rejects an overlong otherwise-valid failure summary", async () => {
  const runBoundedCommand = requiredExport(databaseGate, "runBoundedCommand");
  const overlongSummary = `failed assertions: ${Array.from(
    { length: 64 },
    () => "1",
  ).join(",")}`;
  const failure = await captureFailure(
    runBoundedCommand(
      process.execPath,
      ["-e", "process.exit(7);"],
      "overlong summary fixture",
      { summarizeFailure: () => overlongSummary },
    ),
  );

  assert.equal(
    failure.message,
    "overlong summary fixture failed with exit code 7 (failure summary unavailable)",
  );
  assert.doesNotMatch(failure.message, /failed assertions|PRIVATE_SENTINEL/);
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
