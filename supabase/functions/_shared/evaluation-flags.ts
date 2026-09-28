export type EvaluationCompatibilityMode =
  | "candidate"
  | "stable"
  | "retention_aware";

export type EvaluationFlags = {
  compatibilityMode: EvaluationCompatibilityMode;
  lineageWrites: boolean;
  evaluationWrites: boolean;
  retentionEnforcement: boolean;
  requiresStableEligibilityCheck: boolean;
};

type EvaluationFlagEnvironment = Record<string, string | undefined>;

export function resolveEvaluationFlags(
  env: EvaluationFlagEnvironment,
): EvaluationFlags {
  const configuredMode = env.THROUGHLINE_EVAL_COMPATIBILITY_MODE?.trim();
  if (
    configuredMode && configuredMode !== "stable" &&
    configuredMode !== "retention_aware"
  ) {
    throw new Error("evaluation_compatibility_mode_invalid");
  }

  if (configuredMode === "retention_aware") {
    return {
      compatibilityMode: "retention_aware",
      lineageWrites: false,
      evaluationWrites: false,
      retentionEnforcement: true,
      requiresStableEligibilityCheck: false,
    };
  }

  if (configuredMode === "stable") {
    return {
      compatibilityMode: "stable",
      lineageWrites: false,
      evaluationWrites: false,
      retentionEnforcement: false,
      requiresStableEligibilityCheck: true,
    };
  }

  return {
    compatibilityMode: "candidate",
    lineageWrites: env.THROUGHLINE_LINEAGE_WRITES_ENABLED === "true",
    evaluationWrites: env.THROUGHLINE_EVALUATION_WRITES_ENABLED === "true",
    retentionEnforcement:
      env.THROUGHLINE_EVALUATION_RETENTION_ENABLED === "true",
    requiresStableEligibilityCheck: false,
  };
}

export function assertStableCompatibilityAllowed(
  flags: EvaluationFlags,
  activeEligibilityCount: number,
) {
  if (
    !Number.isSafeInteger(activeEligibilityCount) || activeEligibilityCount < 0
  ) {
    throw new Error("evaluation_compatibility_count_invalid");
  }
  if (
    flags.compatibilityMode === "stable" && activeEligibilityCount !== 0
  ) {
    throw new Error("retention_aware_rollback_required");
  }
}
