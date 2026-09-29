# Measurement hosted-preview Management classification attempt

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** exactly one approved, short-lived, billable, data-less Supabase preview
- **Result:** blocked at the baseline pgTAP command
- **Production impact:** none
- **Cleanup:** confirmed

## Preflight

Mike explicitly approved this one preview attempt. The executed runner had SHA-256 `2f01bd829160e2d557df743f3df26323db7474bf7f842c40d3ddde14c68bad2b`; its test artifact had SHA-256 `d54bc6d00ed270a7cd44e748ad8fa1af7261d3ae25f038d77e962d69856bc33e`. Fresh local verification passed 7 of 7 runner tests and 27 of 27 repository contract tests, and an independent artifact review found no Critical, Important, or Minor issues.

The read-only provider preflight found zero non-default previews, active production API v22 at the recorded control digest, and the same ordered pair of production migrations pending. The runner reported the default Micro price of `$0.01344` per hour before creation.

## Execution result

The runner:

1. validated four of four parent provider-health services;
2. armed cleanup while the non-default preview count was zero;
3. issued exactly one create call and validated the child as data-less;
4. reached healthy aggregate readiness, four-of-four control-plane health, and four-of-four direct database/Auth/REST/Storage readiness;
5. completed bounded read-only Management inventory and snapshot probes and obtained two identical valid `delta-only` classifications; and
6. invoked the 21-test baseline pgTAP contract without applying the four baseline migrations, as required for a `delta-only` child.

The baseline pgTAP child command exited with code 1. The gate stopped immediately. Neither `20260817180709_measurement_attribution.sql` nor `20260818061933_measurement_privilege_hardening.sql` was applied. The runner then deleted the preview and reported `productionMutation:false`; total duration was 54 seconds.

## Failure boundary

The failure occurred before the runner's pgTAP summary parser. On a nonzero child exit, this reviewed runner intentionally discarded raw stdout and stderr and retained only the generic command failure. The surviving evidence therefore cannot distinguish:

- a failed assertion within the 21-test baseline contract;
- a hosted CLI or pooler incompatibility in the `db test` path; or
- another nonzero pgTAP invocation failure.

The stable `delta-only` classification proves only its bounded relation, history, column, constraint, index, allowlist, and empty-data inventory. It does not prove every detailed baseline index, policy, privilege, bucket, or pgTAP execution invariant. Local and CI reconstruction proves the baseline contract from repository migrations, not the exact hosted child state.

The next safe step is non-billable local or CI diagnostic instrumentation that separates TAP assertion numbers from connection, invocation, and malformed-output failures without retaining raw database output. There is no authorization for another preview.

## Independent post-check

A fresh independent read-only post-check confirmed:

- zero non-default previews;
- production API `ACTIVE` at version 22 and the recorded control digest prefix;
- `20260817180709_measurement_attribution.sql` followed by `20260818061933_measurement_privilege_hardening.sql` still pending; and
- no production mutation.

Production rollout remains blocked.

## Privacy boundary

This record contains no provider project or branch reference, credential, endpoint, raw database output, user or session identifier, email, audio, transcript, note text, feedback text, or row content.
