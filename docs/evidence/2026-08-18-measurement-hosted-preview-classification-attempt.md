# Measurement hosted-preview classification attempt

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** one separately and explicitly approved, short-lived, billable, data-less Supabase preview
- **Runner:** SHA-256 `6ae07f49d6115e9ee5d404f7b4bd3879d55c0c741b2ab370fd76f207b0b77055`
- **Result:** runtime readiness passed; the gate stopped before database classification or migrations
- **Production impact:** none

## Result

This attempt followed the earlier [hosted-preview attempt](2026-08-18-measurement-hosted-preview-attempt.md) under a fresh approval authorizing exactly one additional preview.

The provider preflight reported all four required services healthy. After the single data-less preview was created, the preview itself reported healthy `auth`, `db`, `rest`, and `storage` services through the Management API. Its direct readiness sequence also passed: `select true` over the selected `pooler` database route, followed by successful Auth, REST, and Storage HTTP probes. The runner emitted `directServicesHealthy: 4`.

Immediately afterward, the richer count-only database query needed to classify the preview's starting schema and migration history failed with the controlled result `database probe command was unavailable`. Stable classification therefore never completed. Within the hosted gate, no migration dry-run, migration apply, pgTAP test, post-migration history check, final zero-row REST check, lint, or advisor step ran.

The readiness result proves point-in-time service availability only. It does not establish the preview's starting schema, migration history, data state, or migration safety, and it cannot satisfy the hosted database gate.

## Cleanup and production post-check

The cleanup-armed runner deleted its exact preview target and confirmed cleanup. A separate post-check confirmed:

- zero non-default previews remained;
- production `api` remained active at v22 and matched the recorded control digest;
- the exact pending production migrations remained unchanged and in order:
  1. `20260817180709_measurement_attribution.sql`
  2. `20260818061933_measurement_privilege_hardening.sql`.

No function deployment occurred. The reviewed runner performed no production migration or production data mutation.

## Diagnosis and safe next step

The successful `select true` query proves that the CLI, pooler route, and database credential worked immediately before the failure. The next operation was the first richer classification query. The runner converted every nonzero query result—including a SQL, permission, connection, timeout, or invocation failure—into the same generic message, so the underlying class cannot be recovered from this run.

Production migration, API deployment, and production canaries remain blocked. Before another hosted attempt is proposed, the runner must preserve a fixed, content-safe failure class without retaining raw command output, and the classification query must be exercised against the isolated local database gate. The exact revised runner then requires independent review before execution.

The one-preview approval was consumed. No additional preview is authorized. Any further short-lived billable preview requires Mike's fresh explicit approval.

## Privacy and authority boundary

No raw audio, transcript, note text, feedback text, email, credential, project reference, branch reference, endpoint, or user/session identifier is present in this record. No account, TestFlight, App Store, base-model, data-use-policy, onboarding, pricing, recording-limit, subscription, or credit action occurred, and no production provider configuration changed.
