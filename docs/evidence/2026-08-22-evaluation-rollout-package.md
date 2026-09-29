# TL-EVAL-001 frozen hosted rollout package

**Verified:** 2026-08-22  
**Scope:** local source, synthetic-only tests, and content-free deployment inputs  
**Production change:** none  
**User-visible change:** none

## Outcome

The flags-off TL-EVAL hosted candidate is frozen and independently byte-reviewed. The content-free package is [2026-08-22-evaluation-rollout-package.json](2026-08-22-evaluation-rollout-package.json), SHA-256 `653afc4e94308da4ffa50fb5cb9b5efd33e31c2f90a96f9e79891509c2f4db09`, 7,788 bytes.

The package binds:

- the exact three additive migration filenames, sizes, and SHA-256 identities;
- the API bundle, all thirteen repository build inputs including the explicit Deno lockfile, and the Deno 2.9.5 build command;
- flags-off and retention-aware rollback manifests whose identities are derived from their complete non-secret values;
- the private-artifact Edge bundle, its source, the exact Supabase function configuration, and its build command;
- the same-project deletion route, fixed `throughline-audio/evaluation-artifacts` scope, 1,000-object deletion limit, and 249-case materialization limit;
- the required secret name without its value; and
- the bounded stale-receipt reconciliation endpoint, defaults, and required-before-materialization scheduling gate.

Two independently generated API bundles were byte-identical at `f06d7969b0cc8c1d9285bda51ab7ccf6fc39e5d96176f60ff5fa72e8aa1122bb` (188,656 bytes). Two artifact-service bundles were byte-identical at `8f6eb243b470e427807773a42113f4af7f356ced653fd41ba5879a47e5487663` (9,636 bytes). Rebuilding the package from the second bundles with both input lists reversed reproduced the tracked package byte-for-byte.

## Crash and deletion safety closed

Receipt state is reserved before Storage publication. Stale cleanup atomically claims a receipt with a bounded UUID lease and moves it to `deleting`, which prevents a late corpus commit. External deletion is acknowledged only with the exact receipt, claim token, status, and count; failure releases the claim when possible, and an abandoned lease becomes reclaimable.

Deterministic database rejection removes exactly the objects uploaded by that attempt and deliberately leaves the receipt pending for reconciliation. Ambiguous network or receipt results preserve remote artifacts and local staging so a potentially committed corpus is never deleted speculatively. The server and materializer both reject more than 249 cases, keeping the worst case to 997 objects: four per case plus one manifest, below the deletion service's 1,000-object limit.

## Verification

- Full Deno evaluation/API/artifact sweep: 79 passed, 0 failed.
- Full Node contract/evaluation/package sweep: 107 passed, 0 failed.
- Focused corpus pgTAP: 48 passed, 0 failed.
- Full six-file evaluation database sweep: 161 passed, 0 failed.
- Deno database-contract suite: 4 passed, 0 failed.
- Package builder: 7 passed, 0 failed, including migration drift, source/config closure, derived identities, and order-independent reproduction.
- API suite: 21 passed, 0 failed, including service-only stale reconciliation, deletion-before-acknowledgment, exact claim release, malformed-proof rejection, and aggregate-only responses.
- Private-artifact Edge suite: 11 passed, 0 failed.
- Independent byte review recomputed every migration, source-input, configuration, bundle, and package identity and found no remaining package defect.
- Privacy scan found no hostname, URL, credential value, bearer value, UUID, prompt, or private content. The package declares only a required secret name.

Disposable database verification used a fresh PostgreSQL 17 cluster because the Docker socket was unavailable. The cluster was stopped and removed afterward.

## Remaining hosted gates

This package is planned, not deployed. Before any private materialization:

1. Deploy the private-artifact Edge function first with the flags-off configuration and record the actual provider function identity.
2. Execute the content-free direct deletion Edge to Supabase Storage preflight using the verified hosted runner.
3. Apply the three migrations and deploy the API with all evaluation behavior flags still off; record the actual provider bundle/function identities.
4. Prepare the synthetic stale receipt, wait for the fixed stale window, and exercise API Edge to deletion Edge to Storage. Prove exact target deletion, sibling survival, idempotency, terminal registry acknowledgment, aggregate-only output, and cleanup.
5. Install and verify the protected stale-receipt reconciliation schedule.

No real private corpus was materialized, no provider received private audio, no evaluation behavior flag was enabled, and no production deployment occurred. Real private-audio materialization/provider execution and any provider or base-model change remain separately gated.

## Subsequent hosted completion

The statements above describe the package-freeze boundary on 2026-08-22. On 2026-08-23, the package was deployed with all evaluation behavior controls still absent. Both hosted canary phases passed, the exact three core migrations and flags-off API reached production, downloaded provider source matched the frozen inputs byte-for-byte, and the protected 15-minute reconciliation schedule completed its first real HTTP `200` execution. Production migration history has complete local/remote parity after the separate operational scheduler migration.

No real private corpus was materialized, no private audio was sent to a provider, and no user-visible behavior changed. See [TL-EVAL flags-off production foundation rollout](2026-08-23-evaluation-production-rollout.md) for dated provider identities, aggregate canary results, schedule evidence, and the first zero runtime baseline.
