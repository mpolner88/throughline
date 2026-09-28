# TL-EVAL-001 receipt-scoped artifact deletion and disposable canary

**Verified:** 2026-08-22
**Scope:** local synthetic implementation and disposable containers only
**Production change:** none
**Private-data access:** none

> Historical boundary note: this record proves the earlier local-filesystem/container deletion design. Its candidate hashes and canary topology are superseded for the current hosted target by the [frozen same-project Supabase Edge/Storage rollout package](2026-08-22-evaluation-rollout-package.md). It is not hosted canary evidence.

## User protection established

An authorized offline materialization now places the manifest and every case artifact under one direct receipt-addressed child of the configured private root. The trusted deletion service accepts only the lowercase SHA-256 receipt, derives that direct child itself, and cannot receive a caller-selected bucket, root, path, case, recording, account, or contribution identifier.

Deletion is authenticated, bounded, idempotent, symlink rejecting, and crash recoverable. It atomically renames the complete receipt root to a reserved in-progress child before recursive removal. Its public responses contain only `deleted` or `not_found` plus a non-negative root count. The service does not log request bodies, bearer values, receipts, paths, or private content.

## Independent local verification

- Receipt-root materializer regression: 2 passed, 0 failed. The test proved the manifest and staged audio are under `<private root>/<receipt>`, while an unrelated sibling remains untouched.
- Deletion service: 9 passed, 0 failed. Coverage includes exact request shape, timing-safe bearer comparison, body bounds, full-root deletion, idempotency, concurrent convergence, interrupted-delete recovery, and symlink/non-directory rejection.
- Canary contract suite: 8 passed, 0 failed.
- Contract-only canary: all eight declared checks passed.
- Real disposable canary: isolated PostgreSQL 17, PostgREST 14.1, and the unprivileged service container passed `health`, `auth`, `request_shape`, `receipt_scope`, `idempotency`, `sibling_survival`, `privacy`, and `cleanup` on three consecutive clean central runs.
- Cleanup audit after the three runs found zero matching containers, networks, volumes, or temporary directories.
- Central review caught a missing unique volume name in the initial canary adapter. A failing regression was added before the fix; the corrected adapter namespaces every disposable resource and the three clean real runs followed that correction.

Only generated synthetic bytes and two synthetic registry rows were used. The canary reads the registered receipt inventory through PostgREST, seeds a disposable named volume, deletes exactly one receipt root through the service, proves the sibling survives, and scans bounded responses/logs for receipt, credential, path, and private-content patterns.

## Candidate identities

These identities describe undeployed local artifacts. They are not live Supabase function digests, registry attestations, or production reachability evidence.

| Artifact | Identity |
| --- | --- |
| API Deno 2.9.5 single-file runtime bundle, 183,095 bytes, reproduced twice | `6a95b5ece7cd209a6d4aef0d0cc7527b59f5d8877e68b684f0ff0a94c713a215` |
| Flags-off configuration manifest | `ac62396c2171658a3d74195e60730a33201f8dff09357c4bc3274b70e811afe8` |
| Retention-aware compatibility configuration manifest | `fa67c33dced606500fba369695e1c569117fe338759a8ca2ea171f1ea47f014a` |
| Artifact-service canonical four-file build context | `748edd55ed35f90d414c7f65f1a7ea4c6dc45993a141f99b28eaba3fa1e36ca1` |
| Local service image ID | `sha256:6fe9ca30b92484c33872e57ca88fbe5a2ba9a82a704cac4f3d3e2eb0e920b5a4` |
| Evaluation truth/lineage migration | `f33f1ccd488401773333345a172fdfa00a2629255a198ae921be7cb027e9d9f0` |
| Evaluation retention migration | `282f7eb45aa7a3b77301e548292da07ca7bfc2b83979ca93830ca55ba7d49b79` |
| Evaluation retention-claims migration | `4add0d4bd51b71babda3405b8187e4351ea6358e8dfc3378e73bf8280057dd90` |

The flags-off and retention-aware modes use the same code bundle and different content-free configuration manifests. The local image ID is not a portable registry digest. The actual Supabase deploy-bundle digest and deployed function version can exist only after the separately governed hosted bundling/deployment path and must be recorded from that provider response; the local Deno bundle must not be substituted for live evidence.

## Remaining rollout gates

- The three additive migrations, API candidate, retention-aware compatibility target, and artifact service remain undeployed.
- Production still has all three evaluation behavior flags off/unset and compatibility mode unset.
- A production-grade artifact-service host, registry digest/attestation, private root, service credential, network allowlist, monitoring, backup exclusion, and Edge Function reachability canary are not configured.
- No real private corpus has been materialized. No provider received private audio. No independent prediction or quality result exists.
- Before any eligible contribution is enabled, freeze and independently review the exact hosted rollout package, record the actual provider deploy-bundle and registry identities, deploy the artifact service first, prove a content-free Edge-to-service deletion canary, then apply the database/API rollout with behavior flags still off. Enabling real private-audio materialization or provider execution remains a separate provider/data-use decision.
