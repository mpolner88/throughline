# Measurement classification database gate

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** isolated, data-less Docker-backed Supabase reconstruction in GitHub Actions
- **Result:** passed
- **Production impact:** none

## Result

[GitHub Actions run 32158920640](https://github.com/mpolner88/throughline/actions/runs/32158920640) completed successfully in 1 minute 36 seconds. Its 22 Node contract tests passed, followed by the content-safe terminal marker `Measurement database gate passed.`

The run executed CI commit [`bb41b28db764f5c8084891186f3dfae6b0f913e2`](https://github.com/mpolner88/throughline/commit/bb41b28db764f5c8084891186f3dfae6b0f913e2), a one-commit, three-file change over the previously successful database-gate commit `1f58561417f634216438ab83b2157661bec1fdaf`. The three CI file blobs are byte-identical to local commit `4a507131c85a312bb64efe4c13a8ab83cd8b4941`:

- `scripts/preview-branch-contract.mjs`
- `scripts/preview-branch-contract.test.mjs`
- `scripts/verify-measurement-database.mjs`

The unchanged workflow, Supabase configuration, six migrations, and three pgTAP files match the previously successful database-gate inputs.

## Enforced sequence

The exact committed runner:

1. started Supabase CLI 2.98.2 with no Throughline migration present;
2. inventoried optional migration, Auth, and Storage relations without assuming they existed;
3. required one exact empty full-replay classification before copying any Throughline migration;
4. required the exact ordered baseline migrations 1–4, applied them, and passed the 21-assertion baseline;
5. required and applied only `20260817180709_measurement_attribution.sql`, then passed its frozen 30-assertion contract;
6. required and applied only `20260818061933_measurement_privilege_hardening.sql`, then passed its seven-assertion contract;
7. required the exact six-version history, empty service-role REST results, Auth and Storage readiness, public-schema lint, and security and performance advisors; and
8. stopped and removed the unique local project.

Each database command failure now reduces to exactly one of four fixed, content-safe categories. Raw command output, endpoints, credentials, identifiers, and row content are never serialized into the failure message.

## Evidence boundary

This run proves the pristine classification logic and complete database sequence in an isolated local Supabase stack. It does not prove a hosted preview's starting state, pooler behavior, production-derived migration history, hosted default privileges, or production rollout safety. A separately approved hosted preview must still pass before any production migration or API deployment.

The workflow emitted only non-gating GitHub Actions runtime deprecation warnings. No preview, production query, migration, function deployment, account action, TestFlight action, or App Store action occurred.

## Privacy boundary

No raw audio, transcript, note text, feedback text, email, credential, provider project or branch reference, endpoint, or user/session identifier is present in this record.
