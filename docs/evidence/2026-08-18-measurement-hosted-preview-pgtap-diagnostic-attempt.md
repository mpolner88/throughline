# Measurement hosted-preview pgTAP diagnostic attempt

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** exactly one explicitly approved, short-lived, billable, data-less Supabase preview
- **Runner:** SHA-256 `bfd036fad27535346a6a0ad3500b3ac3283c882ab4998d5517fe68cf49b1ee89`
- **Result:** blocked at the baseline pgTAP command with a bounded unknown category
- **Production impact:** none
- **Cleanup:** confirmed

## Authority and preflight

Mike explicitly approved exactly one preview using the frozen runner above. Its test artifact was SHA-256 `0c21bd5cefbf30aeb6e08e5d44c796fd30ecfc166435f3bb14610f69566718c6`.

Immediately before creation:

- 11 of 11 focused runner tests and 29 of 29 repository contract tests passed;
- all 15 of 15 frozen repository blobs matched;
- the selected CLI was version 2.98.2;
- zero non-default previews existed; and
- the production project was healthy, API v22 matched the recorded control, and exactly two migrations remained pending in the required order:
  1. `20260817180709_measurement_attribution.sql`;
  2. `20260818061933_measurement_privilege_hardening.sql`.

The approval authorized no automatic retry, production mutation, migration, function deployment, provider or model change, pricing or recording-limit change, onboarding change, TestFlight action, or App Store action.

## Execution result

The cleanup-armed runner:

1. passed four of four provider-health checks;
2. created and validated exactly one data-less preview;
3. passed four of four direct database, Auth, REST, and Storage readiness checks;
4. obtained two identical, valid `delta-only` starting-state snapshots;
5. invoked the 21-assertion baseline pgTAP contract; and
6. stopped when that child command exited 1 with only the fixed, content-safe result `pgTAP failure category: unknown`.

Neither pending migration was applied, and no function was deployed. The runner deleted the preview, confirmed cleanup, and reported `productionMutation:false`. The complete attempt took 35 seconds.

## Evidence boundary

The fixed unknown category proves only that the baseline pgTAP child command exited nonzero and its bounded diagnostic found no recognized safe category. It does not identify a failed assertion, transport failure, CLI failure, pooler incompatibility, pgTAP failure, or any other root cause. No one of those causes should be inferred from this attempt.

The stable `delta-only` classification and readiness checks remain valid within their bounded contracts, but they do not replace the baseline's detailed policy, privilege, index, bucket, and pgTAP execution assertions. Local and CI evidence proves the 21, 30, and 7 assertion contracts against reconstructed databases; it does not prove this hosted command path.

## Independent post-check

A fresh read-only post-check confirmed:

- zero non-default previews remained;
- the production project was healthy;
- production API v22 remained active and matched the recorded control;
- the same exact two migrations remained pending in the same order; and
- the remote-only migration count remained zero.

No production mutation occurred. The one-use preview approval is consumed, and no retry is authorized.

## Recommendation and next gate

Repeated classification work has now isolated the unresolved boundary to the hosted `db test --db-url` path without producing a safely actionable diagnosis. The agent recommendation is to retire that hosted command path instead of adding another classifier or requesting another retry.

The next action is a Mike discussion and explicit build decision on an architecture-level, non-billable structured-JSON contract executor over the database-query transport that already passed hosted readiness and classification. Before any hosted or production use, that executor should be cross-checked locally against the existing 21-, 30-, and 7-assertion pgTAP contracts on both passing and deliberately failing fixtures. This recommendation is not approval to build or roll out that architecture.

Production rollout remains blocked. `TL-EVAL-001` runtime work remains blocked on the incomplete `TL-DATA-001` rollout dependency.

## Privacy boundary

This record contains no provider project or preview reference, endpoint, credential, raw command or database output, user or session identifier, email, audio, transcript, note text, feedback text, or row content.
