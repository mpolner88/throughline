# Running List backend rollout — September 30, 2026

**Owner:** Codex. **Status:** reviewed database/API deployed; hosted synthetic task and capture checks passed with cleanup confirmed after Mike explicitly approved the exact test. See the [internal delivery](../releases/2026-09-30-ios-1.0.5-2026093001-delivery.md). The initial approval block below is historical. [Running List — PR #4](https://github.com/mpolner88/throughline/pull/4).

## Deployed source

- Corrected app/API source: `a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068`, approved by [Claude's passing recheck](2026-09-30-claude-running-list-implementation-review.md#recheck-of-f1f3-and-p3-1).
- Fresh baseline: API v31, eleven migrations, no task tables/RPC, 21 recordings, zero evaluation-linked recordings, zero processing operations and zero note revisions. No private content was read.
- Applied the reviewed additive `running_list_occurrences` migration. Hosted version is **20260930231946**, making twelve migrations. SQL SHA-256 remains `31b9fabaf46faaabcf1e44db09bf3ddf3f9f66146bc6ce1f458a6a192900b94a`.
- The local migration file is renamed to match the hosted-assigned version; SQL bytes are identical to the reviewed `20260930000000_running_list_occurrences.sql` at the source above. Historical Claude references retain that original filename.
- API advanced to **v32**, ACTIVE, bundle SHA-256 `f55c917086d752012bd08133173ce2fffe23ad12e4c0470e9f5943e30ec52954`.
- All **14 deployed files** were downloaded and matched byte-for-byte to the reviewed source. Compared with v31, only `api/index.ts` changed and `api/tasks.ts` was added. All twelve other files, including capture, inference and evaluation controls, are unchanged.
- Existing handler authentication and `verify_jwt=false` remain unchanged. No secrets, flags, provider/model settings, evaluation activation, automation or other function deployment was performed.

## Passed verification

- Three task tables have RLS enabled. Public/anonymous/authenticated clients have zero direct table grants and zero helper/RPC execute grants. The service role can execute the application entrypoint; all ten task functions have an empty search path.
- API health returned 200. Unauthenticated tasks and recordings returned 401.
- After deployment and the blocked test attempts: 21 recordings, zero evaluation-linked recordings, zero enrolled task accounts, task occurrences and mutation receipts, and zero synthetic running-list Auth fixtures. The preflight condition for Claude's P3-8 remains clear.
- The private test runner's eight mocked boundary tests passed. Its old-app assertions now also require the exact F3 refusal text. These mocked checks do not establish hosted behavior.
- Existing [correction tests and signed candidate](2026-09-30-running-list-recheck.md) remain unchanged. No app/API source changed after Claude's pass.

## Exact remaining test and approval block

The prepared hosted test uses exactly **two new disposable, internally classified Auth accounts**, generated credentials held only in memory, and synthetic tasks. It checks enrollment, occurrence identity with repeated wording, pagination invalidation, cross-account refusal, concurrent replay, stale edits, completion/moves, safe/unsafe old-app writes and exact refusal copy, note deletion and account cascade cleanup.

The capture compatibility step adds a **two-second generated tone** through the existing recording API and normal, unchanged transcription/extraction providers. It checks concurrent upload/replay, durable acceptance, completed processing, deletion and physical absence of the exact audio object. It then removes the exact synthetic notes/audio, events and accounts and verifies cleanup. No existing user account or real user content is a fixture. Private identifiers/journals stay outside Git; tracked results are aggregate only.

Automatic approval review rejected this execution twice, interpreting Mike's phrase **“Synthetic content only in tracked files”** as a prohibition on hosted synthetic accounts/audio. Codex supplied the existing routine-verification/internal-delivery authority and retried the same action; it was rejected again. **The command never ran, no fixture workspace or synthetic account was created, and no provider call occurred.** No alternate route was used to bypass the rejection.

**Next:** Mike explicitly approves this exact hosted synthetic test (including its account creation, generated-tone processing and verified cleanup). Codex then runs it, resolves any failure, refreshes Apple build-number availability, and uploads/assigns the already reviewed internal-only candidate to existing Internal QA. This is an execution-approval block, not a newly discovered app defect. Do not upload until the hosted checks pass.

## Release and recovery boundary

[Rebuilt candidate 1.0.5 (2026093001)](../releases/2026-09-30-ios-1.0.5-2026093001-recheck.md) is signed and retained privately but **not uploaded**. No main merge, PR comment, public App Store action or new tester population is included. The last verified internal build remains 2026092902.

Preserve the additive task schema, identities, receipts and existing capture store. Recovery uses a compatible fix-forward API/client; do not drop task tables or restore a pre-task API after an account enrolls. No existing data was bulk-enrolled by this migration. Actual device scrolling, VoiceOver, offline/relaunch, midnight and timezone acceptance still belongs on the eventual internal build. Categories/search follow that delivery; Private Evaluation stays deferred.

## Approved hosted verification completed — September 30

Mike explicitly approved the exact test described above. The unchanged private harness ran against API v32 using two new internally classified disposable accounts, synthetic task content and one generated two-second tone. No real user note/account was used as a fixture and no provider/model configuration changed.

**Passed:** all **12 hosted task check groups**: fixture identity/binding, stable enrollment/cutover, post-enrollment undated-task classification, occurrence identity despite repeated wording, pagination and invalidation, account isolation, four concurrent identical completion receipts and conflicting retry refusal, persistent moves, safe and unsafe legacy writes with exact F3 copy, atomic identity-preserving edits/replay/conflicts/tombstones, second-owner completion and note deletion. Account deletion with a live task and mutation receipt cascaded successfully.

**Capture passed:** concurrent upload/replay, accepted receipt, claimed processing, completed `processed` state, exact note deletion and verified physical absence of the generated audio object. This verifies ordinary API/provider processing, not extraction quality, actual device microphone recovery or an independently counted provider invocation total.

**Cleanup confirmed:** both synthetic Auth accounts, their notes/tasks/receipts/enrollments, synthetic events and capture data were removed. An independent aggregate query returned the original 21 recordings, zero evaluation-linked recordings, zero task accounts/occurrences/mutations and zero running-list fixture accounts. No cleanup remains pending.

**Unchanged services:** API v32 retains its verified bundle; MCP v15 and private-artifact-delete v3 were not changed. Private journals, exact fixture identities, test-source hashes and aggregate receipts are retained in ignored release storage. Only this content-free summary is tracked.

The automatic approval block is resolved. Hosted checks passed before upload; [the delivery manifest](../releases/2026-09-30-ios-1.0.5-2026093001-delivery.md) records the separate Apple result and remaining device checks.
