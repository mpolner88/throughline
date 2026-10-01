# Capture recovery backend candidate — 2026-09-29

**Reviewer:** Codex coordinator and independent read-only engineering reviewer.
**Scope:** TL-CAP-001 implementation; local `codex/capture-tray` from `ee2e7914410fe3ad32635878ce698db5a6b71b18`. This receipt is preparation evidence, not deployment evidence.

## Reviewed behavior

Owner/capture reservations bind immutable payload metadata; incomplete writes resume against the same object and recording. Acceptance returns one immutable receipt and claims processing at most once. Deleted notes leave minimal tombstones. Processing and edit completion update existing rows only. Account-deletion holds serialize capture and legacy Storage writes, drain incomplete/orphan objects, and retain hashed confirmation capabilities for 30 days. A daily SQL-only cleanup removes expired capabilities. Private milestone identities are not sent to PostHog.

Independent review found and resolved: deletion recovery that only polled status (the client now exposes explicit same-token authenticated Try again); legacy object writes racing account deletion (owner-prefix guard and cleanup). Foreground/relaunch performs status lookup only. No automatic destructive retries were added.

## Exact candidate hashes

| Path | SHA-256 |
| --- | --- |
| `supabase/migrations/20260929120000_capture_recovery.sql` | `0681699a3269ebd927713c62bf371722ab6bb645c5c6d8c90089dc9db1dead67` |
| `supabase/functions/api/index.ts` | `775b6eedb6351669d7132fefb8fa2df5cec4aa998ee582ddfed5cb424da9bb9c` |
| `supabase/functions/api/capture.ts` | `51cc31e91b57e3468a400100a12d296e883324652a68a41e69e0adc5f02648de` |
| `supabase/functions/_shared/product-event-contract.ts` | `2c31155cbb8151a0da6b5f1a326d4e951648eceac50b5f8f5a6856dcbff6c6fb` |

## Verification

- 99 Deno tests passed across all 15 API/shared test files, discovered explicitly. No provider or live service calls.
- 246 pgTAP assertions passed across nine current-head suites, including 45 capture assertions and the evaluation/lineage/measurement regression suites.
- All 11 migrations replayed in a disposable, network-isolated Supabase Postgres 17.6.1.121 container with real Vault, pgTAP, pg_cron and pg_net. Inert synthetic Vault prerequisites; cron execution disabled. Capture migration replayed twice.
- Twelve actual concurrent SQL sessions established one reservation/object/recording/receipt/processing claim. Deletion serialized with in-flight object writes, blocked later writes, and prevented finalization after deletion.
- Two historical migration-cutoff suites were excluded because their assertions deliberately describe earlier schema stages, not current head.
- Physical Storage failed-upload cleanup has source evidence, but no hosted runtime canary yet. SQL concurrency is not proof of object-store behavior.
- Temporary logs are local only; synthetic tests and this content-free receipt are tracked. Test VM was stopped after verification.

## Live preflight and proposed deployment

Read-only checks on 2026-09-29 confirmed API version 30, active, handler-level authentication (`verify_jwt=false`), with the existing ten migrations. Downloaded live API sources match the clean starting base byte-for-byte. The candidate changes the API entrypoint and event allowlist, adds `capture.ts`, and leaves inference/provider/model/evaluation configuration unchanged.

Proposed exact action for Mike: apply only migration `20260929120000_capture_recovery.sql` at the hash above, including its daily expiration cleanup, then deploy only `api` with this reviewed candidate and unchanged handler-level authentication. Do not deploy other functions, change secrets, enable evaluation or change behavior flags. Verify the resulting schema/privileges/function identity, anonymous refusal paths and a synthetic authenticated capture receipt/replay/deletion canary before enabling the internal TestFlight build.

The live backend also serves the public app, so compatibility tests cover legacy requests. The new TestFlight app needs these endpoints to save/recover captures. Internal delivery is approved; this document does not claim separate production deployment approval.

Rollback: retain additive tables, receipts and tombstones. Before any capture-capable build is delivered, the privately preserved version-30 API can be restored if needed. Once such builds exist, use a compatible API that preserves the capture contract; never drop the schema or strand pending phone captures. A compatible replacement app must preserve and drain its local store.
