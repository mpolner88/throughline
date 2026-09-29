import {
  assertStableCompatibilityAllowed,
  resolveEvaluationFlags,
} from "./evaluation-flags.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("evaluation behavior flags default off", () => {
  const flags = resolveEvaluationFlags({});
  assert(flags.compatibilityMode === "candidate", "expected candidate mode");
  assert(flags.lineageWrites === false, "lineage writes must default off");
  assert(
    flags.evaluationWrites === false,
    "evaluation writes must default off",
  );
  assert(flags.retentionEnforcement === false, "retention must default off");
});

Deno.test("retention-aware compatibility disables writes and preserves retention", () => {
  const flags = resolveEvaluationFlags({
    THROUGHLINE_EVAL_COMPATIBILITY_MODE: "retention_aware",
    THROUGHLINE_LINEAGE_WRITES_ENABLED: "true",
    THROUGHLINE_EVALUATION_WRITES_ENABLED: "true",
    THROUGHLINE_EVALUATION_RETENTION_ENABLED: "false",
  });
  assert(
    flags.compatibilityMode === "retention_aware",
    "expected retention-aware mode",
  );
  assert(
    flags.lineageWrites === false,
    "compatibility must disable lineage writes",
  );
  assert(
    flags.evaluationWrites === false,
    "compatibility must disable evaluation writes",
  );
  assert(
    flags.retentionEnforcement === true,
    "compatibility must preserve retention",
  );
});

Deno.test("stable compatibility is allowed only with zero active eligibility", () => {
  const flags = resolveEvaluationFlags({
    THROUGHLINE_EVAL_COMPATIBILITY_MODE: "stable",
    THROUGHLINE_LINEAGE_WRITES_ENABLED: "true",
    THROUGHLINE_EVALUATION_WRITES_ENABLED: "true",
    THROUGHLINE_EVALUATION_RETENTION_ENABLED: "true",
  });
  assert(
    flags.lineageWrites === false,
    "stable mode must disable lineage writes",
  );
  assert(
    flags.evaluationWrites === false,
    "stable mode must disable evaluation writes",
  );
  assert(
    flags.retentionEnforcement === false,
    "stable mode is retention unaware",
  );
  assertStableCompatibilityAllowed(flags, 0);
  let code = "";
  try {
    assertStableCompatibilityAllowed(flags, 1);
  } catch (error) {
    code = error instanceof Error ? error.message : String(error);
  }
  assert(
    code === "retention_aware_rollback_required",
    "expected phase-two rollback guard",
  );
});

Deno.test("invalid compatibility configuration fails closed", () => {
  let code = "";
  try {
    resolveEvaluationFlags({ THROUGHLINE_EVAL_COMPATIBILITY_MODE: "unknown" });
  } catch (error) {
    code = error instanceof Error ? error.message : String(error);
  }
  assert(
    code === "evaluation_compatibility_mode_invalid",
    "expected configuration failure",
  );
});
