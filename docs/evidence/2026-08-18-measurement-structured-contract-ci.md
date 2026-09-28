# Measurement structured-contract CI gate

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** isolated, data-less PostgreSQL 17/Supabase reconstruction in GitHub Actions
- **Result:** passed
- **Production impact:** none

## Result

GitHub Actions run [32221015322](https://github.com/mpolner88/throughline/actions/runs/32221015322) completed successfully at commit `61e4a3523248949bc7da96db9c58a5680c3cd95b`. The fast contract layer passed 45 of 45 tests, and the database verifier emitted its terminal marker `Measurement database gate passed.`

The verifier admits that marker only after all of the following pass in a disposable local stack:

1. pristine full-replay classification;
2. migrations 1–4 followed by the 21-assertion baseline pgTAP and structured contracts;
3. migration `20260817180709` followed by the unchanged 30-assertion pgTAP contract and the 30-assertion structured contract;
4. migration `20260818061933` followed by the unchanged seven-assertion pgTAP contract and the seven-assertion structured contract;
5. exact migration histories and zero-row checks;
6. REST, Auth, Storage, lint, and advisor checks; and
7. stack cleanup.

The gate also introduced and restored seven isolated failure witnesses: a forbidden `schema_version` column added to the baseline, uppercase channel default, restrictive unvalidated check, insert-breaking expression index, widened schema check, widened channel check, and excess profile-delete privilege. For every witness, pgTAP and the structured contract had to report the same expected assertion number; after restoration, both passing contracts had to succeed again.

## Structured contract

The structured path returns one bounded row containing only `contract_version`, `contract`, `planned`, `executed`, and `failed_assertions`. Each exact contract is phase-bound and preserves the existing 21/30/7 numbering while avoiding the hosted `db test --db-url` process boundary that failed without diagnostic detail.

The structured-contract path adds three exact stage/query pairs to the read-only Management adapter; its two existing classification pairs remain, for five allowlisted pairs in total. For a structured contract, the path requires the validated data-less child identity, performs one request with no retry, bounds the SQL query at 65,536 bytes and the streamed response at 8,192 bytes, uses fatal UTF-8 decoding, and exposes only fixed content-safe errors. The CI run exercises the same SQL locally; it does not call the hosted Management API.

## Diagnostic and correction

The first isolated CI attempt correctly rejected attribution assertion 10. Fixed-label diagnostics narrowed the mismatch to PostgreSQL 17's formatting of the legacy event-name check. The final contract ignores only whitespace and parenthesis rendering noise while separately requiring the exact raw regex, `ios`, and `object` literal bytes. It does not lowercase expressions. Independent review found no Critical or Important issue, and the diagnostic query and environment flag are absent from the passing commit.

The passing branch differs from the prior CI base in exactly six paths:

- `.github/workflows/measurement-database.yml`
- `scripts/hosted-preview-management-query.mjs`
- `scripts/measurement-structured-contract.mjs`
- `scripts/measurement-structured-contract.test.mjs`
- `scripts/preview-branch-contract.test.mjs`
- `scripts/verify-measurement-database.mjs`

## Evidence boundary

This run proves the SQL syntax and behavior against reconstructed PostgreSQL 17 state, the pgTAP-to-structured failure witnesses, and the isolated workflow's cleanup. It does not prove hosted Management API permissions or visibility, hosted child compatibility, production-derived migration history, or production rollout safety.

No Supabase preview was created, no billable preview approval was consumed, no production database was queried or mutated, and no function was deployed. A future hosted proof remains a separate Mike-approved action.

The shared iCloud checkout's `.git/HEAD` and `.git/config` remain unavailable. The passing remote CI commit and its six blobs are therefore the durable integration evidence; the damaged local Git metadata was not reconstructed or modified.

## Privacy boundary

This record contains no Supabase project or preview reference, Supabase endpoint, credential, raw database output, user or session identifier, email, recording, transcript, note text, feedback text, or row content.
