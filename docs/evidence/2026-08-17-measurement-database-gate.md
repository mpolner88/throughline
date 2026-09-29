# Measurement database gate evidence

- **Verified:** 2026-08-17 America/Los_Angeles
- **Scope:** data-less local Supabase reconstruction on GitHub-hosted Ubuntu
- **Result:** pass
- **Production impact:** none

## Result

[GitHub Actions run 32107892008](https://github.com/mpolner88/throughline/actions/runs/32107892008) completed successfully at CI-only commit `1f58561417f634216438ab83b2157661bec1fdaf`. The two required workflow steps passed: 16 Node contract tests followed by the pinned Supabase database runner.

The successful runner enforces and therefore proved this sequence:

1. reconstruct repository migrations 1–4 in one unique local, data-less project;
2. pass the 21-assertion structural/RLS/row-safety baseline;
3. dry-run and apply only frozen migration `20260817180709_measurement_attribution.sql`;
4. pass its unchanged 30-assertion pgTAP contract and exact five-version history;
5. dry-run and apply only `20260818061933_measurement_privilege_hardening.sql`;
6. pass its seven-assertion exact-grant contract and exact six-version history;
7. pass empty Auth, Storage, and Throughline row checks plus bodyless zero-count service-role REST reads;
8. pass public-schema lint and security/performance advisors at fail-on-warning strength; and
9. stop and remove only the validated temporary project.

The authoritative local source is commits `c75632c3300ee1f9142e0451d167db128c64f40c` and `9f892251ea3fe9889d70aaf7669b4170a0748a6c`. The CI-only execution files were byte-compared to local source before push. Draft PR #1 is an evidence surface only and is not intended to merge.

## Fixed defects

- Older automatic grants retained unintended `authenticated.DELETE` on profiles because the historical migration granted three operations without first clearing the inherited/default grant.
- Recordings and extraction feedback depended on implicit service-role CRUD; the new migration declares the runtime-required CRUD explicitly.
- The final REST probe now uses each table's real content-free projection: `id` for the four API tables and `auth_user_id` for the service-only allowlist.

## Boundary

This evidence does not prove a hosted preview or production rollout. No Supabase preview was created, no production project was linked or queried, no migration or function was deployed, and no TestFlight/App Store action occurred. A new short-lived billable data-less preview still requires Mike's explicit approval.

The workflow emitted one non-blocking platform annotation: several pinned actions currently target deprecated Node 20 and GitHub forced them to Node 24. Both product-defined gate steps passed.
