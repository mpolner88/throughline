import assert from "node:assert/strict";
import test from "node:test";

const structured = await import("./measurement-structured-contract.mjs")
  .catch(() => ({}));
const management = await import("./hosted-preview-management-query.mjs")
  .catch(() => ({}));
const verifier = await import("./verify-measurement-database.mjs")
  .catch(() => ({}));

const requiredExport = (module, name) => {
  assert.equal(
    typeof module[name],
    "function",
    `expected production export ${name}`,
  );
  return module[name];
};

const EXPECTED = {
  baseline: {
    contract: "measurement_baseline",
    planned: 21,
    transportStage: "measurement_contract_baseline",
  },
  measurement_attribution: {
    contract: "measurement_attribution",
    planned: 30,
    transportStage: "measurement_contract_attribution",
  },
  privilege_hardening: {
    contract: "measurement_privilege_hardening",
    planned: 7,
    transportStage: "measurement_contract_hardening",
  },
};

const passingRow = (phase) => ({
  contract_version: 1,
  contract: EXPECTED[phase].contract,
  planned: EXPECTED[phase].planned,
  executed: EXPECTED[phase].planned,
  failed_assertions: [],
});

const branchTarget = {
  accessToken: `sbp_${"a".repeat(40)}`,
  childBranch: {
    name: "measurement-db-a1b2c3",
    project_ref: "bcdefghijklmnopqrstu",
    parent_project_ref: "abcdefghijklmnopqrst",
    is_default: false,
    with_data: false,
  },
  parentRef: "abcdefghijklmnopqrst",
  expectedBranchName: "measurement-db-a1b2c3",
};

const captureFailure = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("expected promise to reject");
};

test("defines one exact bounded read-only contract for each frozen phase", () => {
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );
  const isAllowedMeasurementContractQuery = requiredExport(
    structured,
    "isAllowedMeasurementContractQuery",
  );

  for (const [phase, expected] of Object.entries(EXPECTED)) {
    const definition = measurementContractDefinition(phase);
    assert.deepEqual(
      Object.keys(definition).sort(),
      ["contract", "phase", "planned", "sha256", "sql", "transportStage"].sort(),
    );
    assert.equal(definition.phase, phase);
    assert.equal(definition.contract, expected.contract);
    assert.equal(definition.planned, expected.planned);
    assert.equal(definition.transportStage, expected.transportStage);
    assert.match(definition.sha256, /^[0-9a-f]{64}$/u);
    assert.ok(new TextEncoder().encode(definition.sql).byteLength <= 65_536);
    assert.doesNotMatch(
      definition.sql,
      /(?:^|;)\s*(?:insert|update|delete|alter|drop|create|grant|revoke|truncate|do|call)\b/imu,
    );
    assert.equal(
      isAllowedMeasurementContractQuery(expected.transportStage, definition.sql),
      true,
    );
    assert.equal(
      isAllowedMeasurementContractQuery(
        expected.transportStage,
        `${definition.sql}\nselect true;`,
      ),
      false,
    );
  }

  assert.equal(
    isAllowedMeasurementContractQuery(
      EXPECTED.baseline.transportStage,
      measurementContractDefinition("measurement_attribution").sql,
    ),
    false,
  );
  assert.throws(
    () => measurementContractDefinition("unknown"),
    /Unknown measurement contract phase/u,
  );
});

test("preserves text literal case and fails closed on the full insert surface", () => {
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );
  const sql = measurementContractDefinition("measurement_attribution").sql;

  assert.doesNotMatch(sql, /\blower\s*\(/iu);
  assert.match(sql, /throughline_product_events_event_name_check/u);
  assert.match(sql, /throughline_product_events_platform_check/u);
  assert.match(sql, /throughline_product_events_properties_check/u);
  assert.match(sql, /not\s+trigger_record\.tgisinternal/iu);
  assert.match(sql, /pg_catalog\.pg_rewrite/iu);
  assert.match(sql, /attgenerated/u);
  assert.match(sql, /attidentity/u);
  assert.match(
    sql,
    /position\s*\(\s*\$\$'\^\[a-z\]\[a-z0-9_\]\*\$'::text\$\$/u,
  );
  assert.match(sql, /regexp_replace\s*\(\s*pg_get_expr/iu);
  assert.match(
    sql,
    /throughline_product_events_pkey:id:predicate=<null>/u,
  );
  assert.match(
    sql,
    /throughline_product_events_recording_id_idx:recording_id:predicate=\(recording_id IS NOT NULL\)/u,
  );
  assert.match(sql, /has_any_column_privilege/iu);
  assert.match(sql, /'UPDATE,REFERENCES'/u);
  assert.match(sql, /'maintain'/iu);
});

test("binds every baseline index to its exact owning table", () => {
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );
  const sql = measurementContractDefinition("baseline").sql;

  assert.match(
    sql,
    /throughline_feedback_auth_user_created_idx:throughline_feedback:auth_user_id,created_at/u,
  );
  assert.match(
    sql,
    /throughline_product_events_name_occurred_idx:throughline_product_events:event_name,occurred_at/u,
  );
  assert.match(
    sql,
    /throughline_recordings_processing_idx:throughline_recordings:processing_status/u,
  );
});

test("rejects data-changing CTEs without mistaking quoted text for SQL", () => {
  const isReadOnlyMeasurementContractSql = requiredExport(
    structured,
    "isReadOnlyMeasurementContractSql",
  );
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );

  for (const phase of Object.keys(EXPECTED)) {
    assert.equal(
      isReadOnlyMeasurementContractSql(
        measurementContractDefinition(phase).sql,
      ),
      true,
    );
  }
  assert.equal(
    isReadOnlyMeasurementContractSql(
      "with changed as (delete from public.items returning 1) select * from changed",
    ),
    false,
  );
  assert.equal(
    isReadOnlyMeasurementContractSql(
      "select 'delete from private', $$insert into private$$ -- update hidden\n",
    ),
    true,
  );
});

test("accepts only an exact typed contract summary for each phase", () => {
  const parseMeasurementContractRows = requiredExport(
    structured,
    "parseMeasurementContractRows",
  );
  const assertMeasurementContractPass = requiredExport(
    structured,
    "assertMeasurementContractPass",
  );

  for (const phase of Object.keys(EXPECTED)) {
    assert.deepEqual(parseMeasurementContractRows(phase, [passingRow(phase)]), {
      contract: EXPECTED[phase].contract,
      planned: EXPECTED[phase].planned,
      executed: EXPECTED[phase].planned,
      failedAssertions: [],
    });
    assert.deepEqual(
      assertMeasurementContractPass(phase, [passingRow(phase)]),
      {
        contract: EXPECTED[phase].contract,
        planned: EXPECTED[phase].planned,
        executed: EXPECTED[phase].planned,
        failedAssertions: [],
      },
    );
  }
});

test("rejects malformed contract rows and unsafe failed-assertion sets", () => {
  const parseMeasurementContractRows = requiredExport(
    structured,
    "parseMeasurementContractRows",
  );
  const base = passingRow("baseline");
  const malformed = [
    [],
    [base, base],
    [null],
    [[base]],
    [{ ...base, extra: true }],
    [{ ...base, contract_version: 2 }],
    [{ ...base, contract: "measurement_attribution" }],
    [{ ...base, planned: 30 }],
    [{ ...base, executed: 20 }],
    [{ ...base, failed_assertions: "2" }],
    [{ ...base, failed_assertions: [0] }],
    [{ ...base, failed_assertions: [-1] }],
    [{ ...base, failed_assertions: [1.5] }],
    [{ ...base, failed_assertions: [2, 2] }],
    [{ ...base, failed_assertions: [8, 2] }],
    [{ ...base, failed_assertions: [22] }],
  ];

  for (const rows of malformed) {
    assert.throws(
      () => parseMeasurementContractRows("baseline", rows),
      /invalid structured contract response/u,
    );
  }
});

test("reports structured failures using assertion numbers only", () => {
  const assertMeasurementContractPass = requiredExport(
    structured,
    "assertMeasurementContractPass",
  );
  const row = { ...passingRow("baseline"), failed_assertions: [2, 8] };

  assert.throws(
    () => assertMeasurementContractPass("baseline", [row]),
    (error) => {
      assert.equal(
        error.message,
        "measurement_baseline failed assertions: 2,8",
      );
      assert.doesNotMatch(
        error.message,
        /PRIVATE_SENTINEL|select|schema|table|project|token/iu,
      );
      return true;
    },
  );
});

test("runs each contract only through the exact child read-only Management query", async () => {
  const runChildMeasurementContract = requiredExport(
    management,
    "runChildMeasurementContract",
  );
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );

  for (const phase of Object.keys(EXPECTED)) {
    const observed = {};
    const result = await runChildMeasurementContract({
      ...branchTarget,
      phase,
      fetchImpl: async (url, init) => {
        observed.url = url;
        observed.init = init;
        return new Response(JSON.stringify([passingRow(phase)]), { status: 201 });
      },
    });
    assert.deepEqual(result, {
      contract: EXPECTED[phase].contract,
      planned: EXPECTED[phase].planned,
      executed: EXPECTED[phase].planned,
      failedAssertions: [],
    });
    assert.equal(
      observed.url,
      "https://api.supabase.com/v1/projects/bcdefghijklmnopqrstu/database/query/read-only",
    );
    assert.equal(observed.init.method, "POST");
    assert.deepEqual(JSON.parse(observed.init.body), {
      query: measurementContractDefinition(phase).sql,
    });
  }
});

test("fails before fetch for unknown phases, invalid targets, or modified contract SQL", async () => {
  const runChildMeasurementContract = requiredExport(
    management,
    "runChildMeasurementContract",
  );
  const runChildManagementQuery = requiredExport(
    management,
    "runChildManagementQuery",
  );
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );
  const noFetch = async () => assert.fail("invalid request must not be fetched");

  const unknown = await captureFailure(runChildMeasurementContract({
    ...branchTarget,
    phase: "unknown",
    fetchImpl: noFetch,
  }));
  assert.match(unknown.message, /Unknown measurement contract phase/u);

  const invalidTarget = await captureFailure(runChildMeasurementContract({
    ...branchTarget,
    childBranch: { ...branchTarget.childBranch, with_data: true },
    phase: "baseline",
    fetchImpl: noFetch,
  }));
  assert.equal(invalidTarget.safeReason, "target_validation");

  const definition = measurementContractDefinition("baseline");
  const modified = await captureFailure(runChildManagementQuery({
    ...branchTarget,
    stage: definition.transportStage,
    sql: `${definition.sql}\nselect true;`,
    fetchImpl: noFetch,
  }));
  assert.equal(modified.safeReason, "invalid_request");
});

test("applies the smaller response bound to structured contracts", async () => {
  const runChildMeasurementContract = requiredExport(
    management,
    "runChildMeasurementContract",
  );
  let cancelled = false;
  const failure = await captureFailure(runChildMeasurementContract({
    ...branchTarget,
    phase: "baseline",
    fetchImpl: async () => ({
      status: 201,
      headers: new Headers({ "content-length": "9000" }),
      body: {
        cancel: async () => {
          cancelled = true;
        },
      },
    }),
  }));

  assert.equal(failure.safeReason, "invalid_response");
  assert.equal(failure.retryable, false);
  assert.equal(cancelled, true);
});

test("never exposes a provider body when a structured contract fails", async () => {
  const runChildMeasurementContract = requiredExport(
    management,
    "runChildMeasurementContract",
  );
  const failure = await captureFailure(runChildMeasurementContract({
    ...branchTarget,
    phase: "baseline",
    fetchImpl: async () =>
      new Response("PRIVATE_SENTINEL credential=top-secret", { status: 403 }),
  }));

  assert.equal(failure.safeReason, "authentication");
  assert.doesNotMatch(
    failure.message,
    /PRIVATE_SENTINEL|top-secret|bcdefghijklmnopqrstu|sbp_/u,
  );
});

test("rejects stage swaps before fetch and never retries provider failures", async () => {
  const runChildMeasurementContract = requiredExport(
    management,
    "runChildMeasurementContract",
  );
  const runChildManagementQuery = requiredExport(
    management,
    "runChildManagementQuery",
  );
  const measurementContractDefinition = requiredExport(
    structured,
    "measurementContractDefinition",
  );
  let fetchCalls = 0;
  const noFetch = async () => {
    fetchCalls += 1;
    assert.fail("stage-swapped SQL must fail before fetch");
  };
  const baseline = measurementContractDefinition("baseline");
  const swapped = await captureFailure(runChildManagementQuery({
    ...branchTarget,
    stage: "measurement_contract_attribution",
    sql: baseline.sql,
    fetchImpl: noFetch,
  }));
  assert.equal(swapped.safeReason, "invalid_request");
  assert.equal(fetchCalls, 0);

  const providerFailure = await captureFailure(runChildMeasurementContract({
    ...branchTarget,
    phase: "baseline",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("PRIVATE_SENTINEL", { status: 503 });
    },
  }));
  assert.equal(providerFailure.safeReason, "provider_unavailable");
  assert.equal(providerFailure.retryable, true);
  assert.equal(fetchCalls, 1);
});

test("cancels a chunked structured response at the smaller byte bound", async () => {
  const runChildMeasurementContract = requiredExport(
    management,
    "runChildMeasurementContract",
  );
  let cancelled = false;
  let fetchCalls = 0;
  const oversized = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5_000));
      controller.enqueue(new Uint8Array(5_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const failure = await captureFailure(runChildMeasurementContract({
    ...branchTarget,
    phase: "baseline",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(oversized, { status: 201 });
    },
  }));

  assert.equal(failure.safeReason, "invalid_response");
  assert.equal(failure.retryable, false);
  assert.equal(fetchCalls, 1);
  assert.equal(cancelled, true);
});

test("defines the minimum local pgTAP equivalence fixtures in phase order", () => {
  const measurementEquivalenceFixtures = requiredExport(
    verifier,
    "measurementEquivalenceFixtures",
  );
  const fixtures = measurementEquivalenceFixtures();

  assert.deepEqual(
    fixtures.map(({ phase, expectedAssertions }) => ({
      phase,
      expectedAssertions,
    })),
    [
      { phase: "baseline", expectedAssertions: [4] },
      { phase: "measurement_attribution", expectedAssertions: [8] },
      { phase: "measurement_attribution", expectedAssertions: [10] },
      { phase: "measurement_attribution", expectedAssertions: [10] },
      { phase: "measurement_attribution", expectedAssertions: [11] },
      { phase: "measurement_attribution", expectedAssertions: [12] },
      { phase: "privilege_hardening", expectedAssertions: [2] },
    ],
  );
  for (const fixture of fixtures) {
    assert.deepEqual(
      Object.keys(fixture).sort(),
      ["expectedAssertions", "mutationSql", "phase", "restoreSql"].sort(),
    );
    assert.equal(typeof fixture.mutationSql, "string");
    assert.equal(typeof fixture.restoreSql, "string");
    assert.doesNotMatch(fixture.mutationSql, /PRIVATE_SENTINEL|sbp_|Bearer /u);
    assert.doesNotMatch(fixture.restoreSql, /PRIVATE_SENTINEL|sbp_|Bearer /u);
  }
  fixtures[0].expectedAssertions.push(99);
  assert.deepEqual(
    measurementEquivalenceFixtures()[0].expectedAssertions,
    [4],
  );
});

test("accepts only bounded assertion-only pgTAP failure errors", () => {
  const parseSafePgTapFailureAssertions = requiredExport(
    verifier,
    "parseSafePgTapFailureAssertions",
  );

  assert.deepEqual(
    parseSafePgTapFailureAssertions(
      new Error("fixture failed with exit code 1 (failed assertions: 4,12)"),
    ),
    [4, 12],
  );
  for (const error of [
    new Error("fixture failed with exit code 1 (failed assertions: 12,4)"),
    new Error("fixture failed with exit code 1 (failed assertions: 4,4)"),
    new Error("fixture failed with exit code 1 (pgTAP failure category: unknown)"),
    new Error("PRIVATE_SENTINEL failed with exit code 1 (failed assertions: 31)"),
    "fixture failed with exit code 1 (failed assertions: 4)",
  ]) {
    assert.throws(
      () => parseSafePgTapFailureAssertions(error),
      /pgTAP equivalence fixture returned an invalid safe failure/u,
    );
  }
});

test("requires pgTAP and structured contracts to fail on the same fixture assertions", () => {
  const assertEquivalentMeasurementFailures = requiredExport(
    verifier,
    "assertEquivalentMeasurementFailures",
  );
  const pgTapError = new Error(
    "fixture failed with exit code 1 (failed assertions: 10)",
  );
  const rows = [{
    ...passingRow("measurement_attribution"),
    failed_assertions: [10],
  }];

  assert.deepEqual(assertEquivalentMeasurementFailures({
    phase: "measurement_attribution",
    pgTapError,
    structuredRows: rows,
    expectedAssertions: [10],
  }), {
    phase: "measurement_attribution",
    failedAssertions: [10],
  });

  assert.throws(
    () => assertEquivalentMeasurementFailures({
      phase: "measurement_attribution",
      pgTapError,
      structuredRows: [{ ...rows[0], failed_assertions: [11] }],
      expectedAssertions: [10],
    }),
    /Measurement oracle equivalence mismatch/u,
  );
});
