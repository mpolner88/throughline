# Capture recovery production rollout — 2026-09-29

**Owner:** Codex. **Authority:** Mike’s exact-action approval recorded in [decision-log.md](../../decision-log.md).
**Scope:** The reviewed [backend candidate](2026-09-29-capture-backend-candidate.md), synthetic runtime verification and internal build prerequisite. No public app release or evaluation activation.

## Deployed identity

- API advanced from v30 to **v31**, ACTIVE. Deployed bundle SHA-256: `c927f502e4b76326e25fd480aec251e482041ecbd546ee58e37b14fa82b6a783`.
- All 13 downloaded deployed files match the submitted candidate byte-for-byte. Entrypoint, capture contract and shared event hashes match the approved receipt. Handler-level authentication remains in place with `verify_jwt=false`; no auth configuration was changed.
- Migration `capture_recovery` applied successfully as **20260929192508**. Its SHA-256 remains `0681699a3269ebd927713c62bf371722ab6bb645c5c6d8c90089dc9db1dead67`.
- The hosted service assigned that migration timestamp. The local file was renamed from the approved candidate filename to `supabase/migrations/20260929192508_capture_recovery.sql` without changing SQL, preserving the 11-version local/remote migration sequence.
- MCP v15 and private-artifact-delete v3 were not deployed. No secrets, behavior flags, providers/models, evaluation settings or other automation were changed.

## Post-deployment checks

- Four new tables have RLS enabled and zero grants to public/anon/authenticated clients.
- All nine new functions deny anon/authenticated execution, allow service-role execution, and have an empty search path.
- The capture identity column exists. The exact daily SQL cleanup is active at `17 3 * * *`; it removes expired deletion-confirmation records only.
- API health returned 200. Unauthenticated recording and capture-status calls returned 401.
- Security advisor: four additional informational RLS-with-no-policy notices are expected for service-only tables; client denial was independently checked. The prior leaked-password-protection warning is unchanged. References: [service-only RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [existing Auth warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No unrelated Auth setting was changed.

## Hosted synthetic behavior

The committed canary runner at `23ac943d5e6013276509a2cc11c7353c5896cdb9` ran through ordinary authenticated API requests. A narrowly scoped private harness provisioned a disposable synthetic Auth fixture, classified it as internal before processing, held its password/JWT in memory and generated a two-second tone in memory. No personal audio, note, transcript, account or credential appears in this receipt.

**Passed:** four concurrent identical uploads, immutable accepted receipt, subsequent replay, one owner-list recording, one reservation, processing-claimed state observed, processing completed to `processed`, exact-recording deletion, owner-deleted status and replay, no remaining recording, and physical absence of the exact uploaded Storage object. The same fixture was verified by its generated marker before cleanup. Its synthetic events and Auth identity were removed; cleanup was confirmed.

This runtime check observes one reservation and a claimed-processing flag; it does not count provider invocations or prove every failed-upload/deletion race. The independent 12-session SQL test and isolated replay remain the race/claim evidence in the candidate receipt. Real iPhone interruption, protected-file and recovery behavior still needs device testing.

The fixed-key canary result, deployment/upload logs and private fixture harness are retained in the ignored release evidence folder. Raw responses, content, credentials and identifiers are not tracked. No pending canary cleanup remains.

## Delivery and recovery

Backend verification passed before the internal-only iOS upload began. Apple upload success is not availability: the final release receipt records processing and Internal QA assignment separately.

Retain the additive tables, receipts and tombstones. A capture-capable client requires compatible acceptance/status endpoints; do not restore v30 after distributing that client. Any replacement client must preserve and drain the phone’s capture store. A compatible fix-forward is the recovery path; never drop capture tables or reset local audio to roll back.
