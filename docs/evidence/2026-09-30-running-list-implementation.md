# Running List — implementation and verification

**Verified:** 2026-09-30. **Owner:** Codex. **Work:** [Running List — Today, This Week, Later, PR #4](https://github.com/mpolner88/throughline/pull/4). **Status:** implemented; final review and internal delivery pending. This receipt does not establish a shipped build or hosted deployment.

## Reviewed contract and source

The [ready handoff](2026-09-30-running-list-ready.md) is frozen at `7b372b51c7d967ab218e38543e2cd82b73dfad35`. Handoff SHA-256 `df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946`; asset manifest `237c804b2f0d1e0b48097ca0e33fe630e7996c20436f2bb729acb339d356a54d`. All 32 selected-design entries passed verification. Claude's [presentation clarifications](2026-09-30-running-list-presentation-clarifications.md) cover an uncertain editor Save and circles only on real to-do occurrences; their SHA-256 is `1bacb85dbe9f22310646918a102f854777ac1690f2bd794cab7c309a4fe471ae`.

The implementation is in bounded saved versions: `341fef6` (task storage/API), `68d29084fe0bb8c15eb26c94c3bccb35034a2283` (app, persistence and focused tests), and `d51d08528c551bc504a61e1269e94eb2056fc171` (expanded earlier-notes placement). Final app source `f86d04af6d46a784d3498d20e4b99cad80928804` adds the reviewed stale-receipt retry fix and tenth focused Swift regression group. The active nonsynced checkout is `throughline-local`, branch `codex/running-list`. Long revision identifiers are audit receipts; the feature name and PR identify this work in ordinary discussion.

## What changed

- Home has tap-selected Today, This week and Later. Undated tasks begin on their capture-local day in Today. Explicit dates and stored moves determine placement; age never moves a task. The earlier-notes cutover is account-scoped and stable.
- Each extracted occurrence has a durable identity, even when wording repeats. Completion, Undo, moves and task-preserving note edits use that identity. Editing never invents a match from text. Source labels open the correct note, including notes beyond the initial note list.
- Task changes persist before their optimistic UI and retry with immutable request IDs. Complete/move changes retry automatically. An uncertain note Save preserves its frozen draft across closing/relaunch and retries only through Save. Other surfaces retain confirmed content.
- The service serializes account changes, version-checks edits, returns immutable retry receipts and tombstones removed occurrences. Full snapshots use bounded cursor recovery. Deletion and account changes outrank stale callbacks. Earlier apps can record/read, complete only an unambiguous historical occurrence, and update a title only with unchanged task content; unsafe edits fail atomically.
- Notes preserves existing cards and detail prose. Only real task rows get circles. Home and its capture lifecycle remain mounted when Notes opens. The recorder, capture store/queue, AI controls, onboarding, policy, providers and extraction contract are unchanged.

## Verification completed

| Layer | Result and limit |
| --- | --- |
| Node | 178 tests passed: 169 general and 9 service tests. The service suite required local loopback access; its sandbox-denied first run is not counted as a product failure or success. |
| Deno | 111 API/shared/deletion tests passed using the API import-map configuration. The initial invocation without that configuration failed resolution and is superseded. |
| Swift Running List | Ten focused groups passed, including the final retry regression. Covers calendar dates, Sunday/Monday, month/leap-day boundaries, timezones, both DST transitions, repeated wording, completion/moves across reload, persist-before-optimism, immutable retries, account isolation, earlier cutover/promotion, edits and deletion holds. The final regression covers an unknown Save, newer snapshot, failed detail fetch, relaunch and immutable retry. |
| Capture / AI regressions | CaptureStore six groups plus stream checks; CaptureQueue six groups plus auth checks; AI permission nine groups passed. These use synthetic/mocked data. |
| Real local database | Twelve migrations replayed into isolated Supabase PostgreSQL 17.6 with Vault/pgTAP extensions. 298 assertions passed across ten suites (246 existing, 52 new), plus ten independent concurrency/lifecycle groups, up to twelve simultaneous sessions. Two historical cutoff-specific suites were excluded from this final-schema run. No hosted calls or active cron jobs. Zero fixture rows remained. |
| Isolated app | Debug simulator build passed from a private isolated copy, with all 62 tracked iOS files byte-matched to the saved source. The signed archive and internal-only local export also passed; [candidate receipt](../releases/2026-09-30-ios-1.0.5-2026093001-candidate.md). Upload is pending. |
| Repository checks | Documentation verification, policy parity, whitespace check and project plist syntax passed. Changed paths were scanned for personal home paths and common credential material; fixtures are synthetic. Documentation checks are repeated when the candidate receipts are integrated. |

Final local migration SHA-256: `31b9fabaf46faaabcf1e44db09bf3ddf3f9f66146bc6ce1f458a6a192900b94a`; pgTAP SHA-256: `83420104e0caf1c09e4ddd134be1974f30a14937b86f7d4230dc46f96e42c39e`. The disposable database caught service-execute grants and account-delete cascade issues before they were fixed and the full final replay passed. Its VM is stopped; no secrets or raw database output are tracked.

## Independent review dispositions

An independent Codex engineering reviewer checked the API and app contract. Five findings were fixed before `68d2908`: P2 deletion-hold access to cached editor/detail; P2 local cleanup after confirmed remote deletion; P2 task-only sign-in recovery; P2 promoting an earlier task explicitly to Later from both menu and accessibility actions; P3 ordering Done by parsed instants rather than timestamp strings. The focused state tests cover relevant persistence cases; menu/sign-in wiring also received source review.

A subsequent P2 identified early removal of a frozen editor retry when a newer snapshot requires a fresh detail fetch. If that fetch fails, old cached text could be returned as a successful Save. It is fixed in the subsequent bounded retry commit: the frozen request stays durable until current detail applies, and settlement is atomic. The added regression passes. Root also corrected the expanded earlier-notes hierarchy to heading, task rows, Hide, matching the selected prototype.

## Visual and interaction evidence

The simulator matrix is being captured from the production views with synthetic DEBUG fixtures, with per-file hashes and source receipts. Startup/blank frames are excluded. The browser references approximate native controls; actual iOS sheets, system fonts and maximum Dynamic Type differ. Claude's actual implementation review is still required.

Native simulator interaction already verified moving a task through the menu (Today five to four; This week three to four), expanding earlier notes and exposing all three move actions, circle completion (Today five to four), Reopen, a short drag that does not complete, a drag beyond 76 points that completes, source-note navigation and a renamed task saved from the row editor. The accessibility tree exposes one element per running row with Complete/Reopen, Move and Open the note actions. These checks are distinct from static scenario screenshots. They do not establish spoken VoiceOver, physical-device gestures, real offline networking, interruption behavior or real-audio quality.

### September 30 resumed visual verification

The [native review packet](assets/2026-09-30-running-list/README.md) now contains all 31 handoff visual-matrix frames plus uncertain Save, bound to the final app source and individual SHA-256 values. The dark menu was recaptured correctly. All 32 saved frames passed a local text-recognition sanity check; dark Today, Done and Notes retain their headings, task text and recorder labels. An intermittent image-preview discrepancy hid text that remained in the saved image pixels. No app color or gesture changes were made to compensate. Static first viewports do not prove scrolling or behavior.

A standard iOS Settings control reproduced the automated vertical-drag failure; Settings' separate accessibility Scroll Down action worked. This supports a limitation in automated touch input, not a confirmed Running List defect. Physical scrolling/reachability at maximum text remains unverified. The earlier speculative gesture experiment remains fully reverted.

An independent read-only integrity check reconfirmed all 62 current/isolated iOS files against `f86d04af6d46a784d3498d20e4b99cad80928804`, plus 54 protected capture, AI, inference, policy and preexisting backend files against the frozen design base. Temporary and retained archive executable, IPA and private configuration hashes match the candidate receipt. No implementation change or broad test rerun was needed.

Actual Claude review remains pending. Desktop discovery works, but automatic approval review blocked binding the Claude window until the authorized Throughline session is confirmed in front. The [concrete review request](2026-09-30-running-list-review-request.md) allows Mike to paste one instruction into that session if direct coordination is unavailable. Only Claude's named evidence file is assigned for writing. No backend deployment or upload occurred during this resumed verification.

## Measurement, release and rollback

The canonical [seven-day task-value metric](../../product/metrics.md#seven-day-extracted-task-value) remains uninstrumented/unavailable. Suggested new events have not been silently added. Passing synthetic tests does not establish user outcomes or model-quality improvement.

No Running List backend or internal build is delivered at this receipt's initial recording. Delivery requires resolved engineering findings, Claude's review, source-frozen archive, hosted synthetic compatibility checks, internal-only export and fresh Apple verification for the existing Internal QA group. No main merge, public submission, PR comments, evaluation activation or policy change is authorized here.

Rollback must retain the occurrence-aware API and tables once accounts are enrolled. A compatible app can restore the previous Home presentation while preserving durable task history and capture storage. Do not drop task identities or deploy a pre-task API over enrolled accounts. The preceding internal build can still record/read and use the documented safe legacy mutations against the new API; ambiguous legacy writes intentionally refuse.

## September 30 Claude access follow-up

Mike explicitly approved opening the correct Claude session. Navigation selected **Throughline-working-design-updates** and reported its correct session identity. The subsequent composer attempts did not populate the prompt; paste timed out and text entry did not change its value. No Send action was taken and no implementation review was received. The desktop screenshot and navigation state disagreed, so an ungrounded coordinate retry was refused by automatic approval review. The alternate CLI still reports signed out. Do not request the same access approval again; the remaining action is to send the already-prepared review instruction through a working Throughline composer. No product source, backend, package or release changed.
