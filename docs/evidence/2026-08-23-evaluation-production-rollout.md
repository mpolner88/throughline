# TL-EVAL-001 flags-off production foundation rollout

**Verified:** 2026-08-23  
**Production behavior:** evaluation and lineage writes remain off  
**Private corpus/provider execution:** not run  
**User-visible change:** none

## Scope and authority

This rollout was limited to the already-approved, reversible TL-EVAL flags-off foundation: the frozen three-migration lineage and retention schema, the private-artifact deletion Edge function, the exact flags-off API candidate, synthetic hosted canaries, the protected reconciliation schedule, aggregate baseline measurement, and documentation. It did not authorize real private-audio materialization, provider execution, a provider or base-model change, a data-use-policy change, pricing, recording limits, onboarding, App Store work, or a user-interface change.

## Frozen inputs and provider identities

- Frozen content-free package: SHA-256 `653afc4e94308da4ffa50fb5cb9b5efd33e31c2f90a96f9e79891509c2f4db09`.
- Core migrations:
  - `20260818000000_evaluation_truth_lineage.sql`: `3e28bfb642f0cbf12bb8b5705de243a12ea71ce9a70fbbb2b9db9a9d86dcbd72`
  - `20260822154500_evaluation_retention.sql`: `282f7eb45aa7a3b77301e548292da07ca7bfc2b83979ca93830ca55ba7d49b79`
  - `20260822170000_evaluation_retention_claims.sql`: `4add0d4bd51b71babda3405b8187e4351ea6358e8dfc3378e73bf8280057dd90`
- Scheduled-maintenance migration: `20260823062018_evaluation_artifact_reconciliation_schedule.sql`, SHA-256 `e65f8a44e66c9f4d18d7b727ad96c91e3de01aa7944ee18b520a0e26d30240a1`.
- Active API: version 27, provider function ID `1a5fd742-02c4-4abf-9d1e-8a821a93bd39`, provider source digest `a42629da72f5d998fe5db178231f45afb9282e1333ef5b6585a46ccecf13fcad`.
- Active private-artifact deletion function: version 1, provider function ID `5108cfbc-9f66-4468-b497-0e0d1646a56b`, provider source digest `ce40deef4eee766213d2b66330d424dcefdbb80429279d3d28945f71e4c75dd8`.
- MCP remained on the same source digest `907ed85efaed745b946afdbf1478556e6750b829c8427807fd028c8f35f737e5`; setting operational secrets restarted it as version 13 without changing source.

The downloaded active API and deletion-function sources matched all 13 frozen repository source files byte-for-byte with zero mismatches. Operational secret values were never printed or tracked. The four behavior controls remained absent throughout: lineage writes, evaluation writes, evaluation retention, and compatibility mode.

## Production execution and hosted proofs

The direct deletion Edge-to-Storage preflight passed all seven checks: synthetic upload, Edge deletion, target absence, sibling survival, idempotency, cleanup, and privacy.

The three frozen core migrations then applied in order, the exact flags-off API candidate deployed, and production migration history reached complete local/remote parity. Existing product behavior remained intact: the Auth canary passed, the synthetic recording pipeline completed with eight structured items and no warnings, unauthenticated recordings returned `401`, authenticated MCP health returned `200`, and API health returned `200` with `ok: true`.

The staged reconciliation proof reserved a synthetic receipt before Storage publication, sealed a mode-`0600` recovery file, and waited the fixed 3,600-second stale threshold. Its exercise then passed all eight checks: API reconciliation, deletion Edge-to-Storage, target absence, sibling survival, terminal registry state, idempotency, cleanup, and privacy. The recovery file removed itself after successful cleanup.

Production schema checks found all ten evaluation tables present with RLS enabled, no table grants for anonymous or authenticated clients, and all 14 scoped evaluation/retention functions executable by `service_role` but not by anonymous or authenticated roles. Security advisors reported no TL-EVAL issue; the existing leaked-password-protection warning is outside this slice.

## Protected schedule

The scheduler migration installed `pg_cron` 1.6.4 and `pg_net` 0.20.0 and one active job named `throughline-evaluation-artifact-reconciliation` at `*/15 * * * *`. The command uses the fixed API maintenance endpoint, resolves the exact project URL and API token from two uniquely named Vault secrets at execution time, contains no embedded 64-character credential, and limits the asynchronous request to 30 seconds.

The tracked ten-condition schedule contract was exercised against production; a single aggregate verification independently returned true for all ten conditions. The first real cron execution completed successfully. Its matching `pg_net` response returned HTTP `200`, did not time out, had no transport error, scanned zero rows, performed zero deletions or acknowledgments, and returned an empty aggregate error map.

Production now has ten migrations with complete local/remote parity and zero pending or remote-only migrations.

## First post-cutover evaluation baseline

The first aggregate-only baseline after rollout is intentionally empty for real runtime behavior:

- inference contracts, processing operations, inference attempts, note revisions, evaluations, contributions, quarantined text rows, corpus cases, and corpus events: zero each;
- active evaluation eligibility: zero; and
- synthetic receipt registry: one terminal `deleted` receipt from the hosted canary.

This proves the flags-off foundation and cleanup path, not evaluation quality or user-outcome improvement. No real private corpus was materialized, no private audio was sent to a provider, and no user-visible behavior changed.

## Decision and next boundary

The flags-off TL-EVAL production infrastructure, hosted deletion/reconciliation proof, schedule, and zero baseline are complete. The next quality milestone is a separately governed lineage/evaluation behavior canary and honest independent corpus evaluation. Real private-audio materialization/provider execution remains gated, and no quality or user-outcome claim is authorized from this infrastructure rollout.

**Later 2026-08-23 boundary update:** The separate [production lineage-write behavior canary](2026-08-23-evaluation-lineage-behavior-canary.md) passed and rolled back to the same flags-off state. It left one reusable inference-contract row and zero recording-linked lineage/evaluation runtime rows. This historical foundation record remains the evidence for the preceding flags-off rollout.
