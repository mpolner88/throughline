import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExecutionAuthorized,
  assertPrivacySafeCanaryOutput,
  parseCliArgs,
  readHostedCanaryConfig,
  runLineageCanary,
} from "./verify-evaluation-lineage-canary.mjs";

const RECORDING_REF = "rec_00000000-0000-4000-8000-000000000001";

function completeLineage() {
  return {
    recording_count: 1,
    inference_contract_count: 1,
    operation_count: 1,
    succeeded_operation_count: 1,
    extraction_attempt_count: 1,
    succeeded_extraction_attempt_count: 1,
    transcription_attempt_count: 0,
    original_revision_count: 1,
    original_revision_key_count: 14,
    pointer_integrity: true,
    evaluation_count: 0,
    contribution_count: 0,
    corpus_case_count: 0,
  };
}

function cleanState() {
  return {
    marker_count: 0,
    recording_count: 0,
    operation_count: 0,
    attempt_count: 0,
    revision_count: 0,
    evaluation_count: 0,
    contribution_count: 0,
    quarantine_count: 0,
    corpus_case_count: 0,
  };
}

function createRuntime(overrides = {}) {
  const trace = [];
  let enabled = false;
  let created = false;
  const runtime = {
    trace,
    async inspectBehaviorControls() {
      trace.push("controls");
      return enabled ? ["THROUGHLINE_LINEAGE_WRITES_ENABLED"] : [];
    },
    async activeEligibilityCount() {
      trace.push("eligibility");
      return 0;
    },
    async enableLineage() {
      trace.push("enable-lineage");
      enabled = true;
    },
    async awaitHealthy() {
      trace.push(enabled ? "health:on" : "health:off");
      return true;
    },
    async createSyntheticRecording() {
      trace.push("create");
      created = true;
      return RECORDING_REF;
    },
    async inspectLineage(recordingRef) {
      trace.push("inspect-lineage");
      assert.equal(recordingRef, RECORDING_REF);
      return completeLineage();
    },
    async deleteSyntheticRecording(recordingRef) {
      trace.push("delete");
      assert.ok(recordingRef === RECORDING_REF || recordingRef === null);
      created = false;
      return recordingRef ? [recordingRef] : [];
    },
    async inspectCleanup(recordingRefs) {
      trace.push("inspect-cleanup");
      assert.ok(Array.isArray(recordingRefs));
      return created ? { ...cleanState(), recording_count: 1 } : cleanState();
    },
    async disableLineage() {
      trace.push("disable-lineage");
      enabled = false;
    },
    ...overrides,
  };
  return runtime;
}

test("CLI and environment require a double authorization lock", () => {
  assert.deepEqual(parseCliArgs(["--execute-hosted"]), { executeHosted: true });
  assert.throws(() => parseCliArgs([]), /explicit hosted execution flag/iu);
  assert.throws(() => parseCliArgs(["--unknown"]), /unknown argument/iu);
  assert.throws(
    () => assertExecutionAuthorized({ executeHosted: true, env: {} }),
    /authorization environment gate/iu,
  );
  assert.equal(
    assertExecutionAuthorized({
      executeHosted: true,
      env: { THROUGHLINE_LINEAGE_HOSTED_CANARY_AUTHORIZED: "true" },
    }),
    true,
  );
});

test("hosted configuration is frozen to the production project", () => {
  const env = {
    SUPABASE_URL: "https://ywsenspsfyrdhgyxgcrv.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role",
    THROUGHLINE_API_TOKEN: "synthetic-api-token",
  };
  const config = readHostedCanaryConfig(env);
  assert.equal(config.origin, env.SUPABASE_URL);
  assert.equal(config.projectRef, "ywsenspsfyrdhgyxgcrv");
  for (const override of [
    { SUPABASE_URL: "https://other-project.supabase.co" },
    { SUPABASE_SERVICE_ROLE_KEY: "" },
    { THROUGHLINE_API_TOKEN: "" },
  ]) {
    assert.throws(
      () => readHostedCanaryConfig({ ...env, ...override }),
      /configuration/iu,
    );
  }
});

test("successful lineage canary proves lineage, absence, cleanup, and rollback", async () => {
  const runtime = createRuntime();
  const result = await runLineageCanary({ runtime });
  assert.deepEqual(result, {
    mode: "hosted-lineage-write-canary",
    status: "pass",
    checks: [
      "flags_off_preflight",
      "zero_active_eligibility",
      "lineage_only_enablement",
      "synthetic_transcript_processing",
      "complete_immutable_lineage",
      "evaluation_absence",
      "recording_cascade_cleanup",
      "flags_off_rollback",
      "privacy",
    ],
  });
  assert.deepEqual(runtime.trace, [
    "controls",
    "eligibility",
    "enable-lineage",
    "controls",
    "health:on",
    "create",
    "inspect-lineage",
    "delete",
    "inspect-cleanup",
    "disable-lineage",
    "controls",
    "health:off",
  ]);
});

test("preflight rejects any existing behavior control and nonzero eligibility", async () => {
  const wrongFlag = createRuntime({
    async inspectBehaviorControls() {
      this.trace.push("controls");
      return ["THROUGHLINE_EVALUATION_WRITES_ENABLED"];
    },
  });
  await assert.rejects(
    runLineageCanary({ runtime: wrongFlag }),
    /behavior controls are not absent/iu,
  );
  assert.doesNotMatch(wrongFlag.trace.join(","), /enable-lineage/u);

  const eligible = createRuntime({
    async activeEligibilityCount() {
      this.trace.push("eligibility");
      return 1;
    },
  });
  await assert.rejects(
    runLineageCanary({ runtime: eligible }),
    /active eligibility is not zero/iu,
  );
  assert.doesNotMatch(eligible.trace.join(","), /enable-lineage/u);
});

test("post-enable inspection rejects evaluation or retention controls", async () => {
  let calls = 0;
  const runtime = createRuntime({
    async inspectBehaviorControls() {
      this.trace.push("controls");
      calls += 1;
      if (calls === 1) return [];
      if (calls === 2) {
        return [
          "THROUGHLINE_LINEAGE_WRITES_ENABLED",
          "THROUGHLINE_EVALUATION_RETENTION_ENABLED",
        ];
      }
      return [];
    },
  });
  await assert.rejects(
    runLineageCanary({ runtime }),
    /lineage-only behavior state is invalid/iu,
  );
  assert.match(runtime.trace.join(","), /disable-lineage/u);
  assert.doesNotMatch(runtime.trace.join(","), /create/u);
});

test("incomplete lineage and unexpected evaluation rows fail closed", async () => {
  for (const proof of [
    { ...completeLineage(), original_revision_key_count: 13 },
    { ...completeLineage(), evaluation_count: 1 },
  ]) {
    const runtime = createRuntime({
      async inspectLineage() {
        this.trace.push("inspect-lineage");
        return proof;
      },
    });
    await assert.rejects(
      runLineageCanary({ runtime }),
      /lineage proof is invalid|evaluation rows were created/iu,
    );
    assert.match(runtime.trace.join(","), /delete/u);
    assert.match(runtime.trace.join(","), /disable-lineage/u);
  }
});

test("cleanup residue and rollback failure are both fatal", async () => {
  const residue = createRuntime({
    async inspectCleanup() {
      this.trace.push("inspect-cleanup");
      return { ...cleanState(), operation_count: 1 };
    },
  });
  await assert.rejects(
    runLineageCanary({ runtime: residue }),
    /cleanup proof is invalid/iu,
  );
  assert.match(residue.trace.join(","), /disable-lineage/u);

  const rollback = createRuntime({
    async disableLineage() {
      this.trace.push("disable-lineage");
      throw new Error("synthetic rollback failure");
    },
  });
  await assert.rejects(
    runLineageCanary({ runtime: rollback }),
    /rollback failed/iu,
  );
});

test("an ambiguous create failure still runs marker-based recovery and rollback", async () => {
  const runtime = createRuntime({
    async createSyntheticRecording() {
      this.trace.push("create");
      throw new Error("synthetic response timeout");
    },
  });
  await assert.rejects(runLineageCanary({ runtime }), /response timeout/iu);
  assert.deepEqual(runtime.trace.slice(-5), [
    "delete",
    "inspect-cleanup",
    "disable-lineage",
    "controls",
    "health:off",
  ]);
});

test("privacy guard rejects identifiers, URLs, credentials, and transcript content", () => {
  assert.equal(
    assertPrivacySafeCanaryOutput({ status: "pass", checks: ["privacy"] }),
    true,
  );
  for (const unsafe of [
    RECORDING_REF,
    "00000000-0000-4000-8000-000000000001",
    "https://project.supabase.co/functions/v1/api",
    "Bearer synthetic-credential",
    "service_role_key=not-safe",
    "transcript_raw: buy milk",
  ]) {
    assert.throws(
      () => assertPrivacySafeCanaryOutput(unsafe),
      /privacy-safe/u,
    );
  }
});
