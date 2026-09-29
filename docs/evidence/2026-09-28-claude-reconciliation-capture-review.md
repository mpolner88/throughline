# Claude review: reconciled base and capture handoff revision 2

Verified **2026-09-28**. Reviewer: Claude Code (Claude Opus 5.5), in the local, non-synced `throughline-local` checkout, on Mike's authorized request relayed by Codex. This is a local review receipt. It is not a GitHub review or comment, a main-merge approval, a deployment or release receipt, or a Codex review. Nothing here was posted, deployed, published, or committed.

## Identity

| Item | Value |
| --- | --- |
| Branch | `codex/reconcile-september-base`, draft [PR #3](https://github.com/mpolner88/throughline/pull/3) |
| Reviewed revision | `372178b2b68d81691e8228443dacfebeec989e00`; matched `origin` after a fetch at the start of the review; working tree clean before Claude's edits |
| Drift from the feasibility-review revision | `bda1058947397b7bf1b908a0a682eb3966868a54..372178b` changes only `decision-log.md`, `docs/privacy-policy.md` and `docs/privacy/index.html`; the handoff and assets were unchanged |
| Approved policy bytes | Markdown `2b0b68dce68b816f9471df3855fe0d2e7462ae9050c7d0c8ae34a144e71c7fce`; HTML `4be13989c8a52153f4f9faf54770c564a483437ec54ce74803dfbc7d2a455965`; both matched and were not edited |
| PR #3 range | `origin/main` (`fd85d01`)`...372178b`: 305 files, +50,457 / −1,342 |
| Prior handoff | revision 1, `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c`, reviewed by Codex at `bda1058` |

## Method and limits

- Read in the required order: `AGENTS.md`, [current state](../CURRENT_STATE.md), [product](../PRODUCT.md), [brand decisions](../../throughline-brand-decisions.md), the [capture handoff](../handoffs/2026-09-28-home-capture-recovery.md), [workflow](../WORKFLOW.md), [metrics](../../product/metrics.md), [backlog](../../product/backlog.json), [tandem](../AGENT_TANDEM.md), [architecture](../ARCHITECTURE.md), [hosted backend](../hosted-backend.md) (partially), and the [reconciliation plan](2026-09-28-reconciliation-plan.md). Codex's complete feasibility review was read from its local artifact.
- Four read-only Claude subagents in the same session mapped PR #3 by component: SQL; Edge API and shared modules; iOS, measurement and quality tooling; operating and design artifacts with a publication-privacy screen. Claude then re-read the source for each material finding. **CONFIRMED** means Claude read the cited lines at `372178b` and the defect follows from them. **PLAUSIBLE** means Claude verified part of the chain. **REPORTED** means a subagent found it and Claude did not verify it. Subagent output is not treated as Claude's own review.
- Claude read directly: the capture path (`AudioRecorder.swift`, `HomeView.swift` recorder and upload flow, `UploadClient.swift` upload and authorization, `AuthClient.swift` refresh, `AppState.swift`, `Info.plist`); `api/index.ts` upload, storage, persistence, processing, deletion, withdrawal, edit-mutation and event-ownership paths; the SQL functions cited below; the policy diff; and the canonical documents.
- Not run: the Node, Deno and Swift suites, the iOS build, any database replay (no local database), and live GitHub, Pages, Supabase or App Store checks. The PR #1 and PR #2 heads were not fetched. No production data was read.

## Verdict on the shared base

No finding blocks using `372178b` as the base for designing and building the capture slice with all behavior flags off. Two findings (R8, R9) need Mike's explicit decision before the exact main-merge action. The P1 findings are gates on enabling the lineage or Private Evaluation behavior flags, which remain off and are not approved; they do not break flags-off operation. Mutual review of the base is now Claude-reviewed at this revision; Codex's disposition of these findings is pending.

## Findings on the shared base

| ID | Severity and gate | Status | Finding and exact location | Owner and disposition |
| --- | --- | --- | --- | --- |
| R1 | P1, before any lineage flag | CONFIRMED | Enabling lineage before evaluation writes, the documented phase order, breaks note editing. The client picks the private-evaluation mode from the presence of a revision ID alone (`ios/Throughline/Services/EvaluationContributionContract.swift:19-24`) and then sends all five mutation fields (`ios/Throughline/Services/UploadClient.swift:1027-1038`). The server treats that as an evaluation mutation (`supabase/functions/api/index.ts:3340-3350`) and returns 503 `evaluation_runtime_disabled` while writes are off (`:1177-1179`, `:1671-1679`). `HomeView.swift:1192-1202` also swaps out the standard feedback view. The TL-EVAL next action in `product/backlog.json:142` prescribes that order. | Codex: fix the client mode and edit body, or the rollout order, before any flag change |
| R2 | P1, before Private Evaluation | CONFIRMED (SQL) | Withdrawal invalidates only the latest contribution's corpus cases (`supabase/migrations/20260822154500_evaluation_retention.sql:272-316`; the API picks `contributions[0]` at `api/index.ts:916`). A content correction inserts a contribution without superseding the prior one (`20260818000000_evaluation_truth_lineage.sql:909-919`), unlike a regrade (`:1112-1138`). Earlier contributions' cases and private artifacts can survive a withdrawal the policy promises will remove them. | Codex: recording-scoped withdrawal in a forward migration |
| R3 | P1, before Private Evaluation | CONFIRMED | Withdrawal returns 503 "retryable" forever when the source audio is no longer in storage: transcript-only recordings, audio past retention, or a second withdrawal (`api/index.ts:927-940`). A no-op withdrawal also reports `audio_deleted: true` (`:917-925`). | Codex |
| R4 | P1, before Private Evaluation | CONFIRMED (shape) | The iOS edit body sends `todos` as strings (`UploadClient.swift:1007`). The server copies arrays verbatim (`supabase/functions/_shared/note-revisions.ts:201-217`), while the canonical contract requires todo objects (`core/inference-contract.mjs:509-511`). Saves are rejected, or, if validation were relaxed, the editable mask (`note-revisions.ts:115-118`) marks unchanged todos as corrected and creates unintended `content_correction` eligibility. The exact response code was not traced. | Codex |
| R5 | P1, before Private Evaluation | PLAUSIBLE | Re-materialization keeps the first receipt on a case (`on conflict (contribution_id) do nothing`, `20260818000000_evaluation_truth_lineage.sql` near line 1526), so deletions can miss copies under a later receipt. Candidate re-inclusion and the purge path were not traced by Claude. | Codex |
| R6 | P2, before Private Evaluation | CONFIRMED | `commit_evaluation_v1` grades the current revision with a lineage check but no `revision_kind` check (`20260818000000_evaluation_truth_lineage.sql:1015-1032`). An action-state revision can become evaluation truth. This contradicts [current state](../CURRENT_STATE.md) line 121, where only contribution creation from a toggle is blocked. | Codex |
| R7 | P2, now; capture dependency | CONFIRMED, new vs main | The event route now rejects a whole batch with 403 when one event references a recording the caller does not own or is signed out (`api/index.ts:484-491`, `:546-551`). The client keeps 401/403/429 batches and stops flushing (`UploadClient.swift:602-610`), and sign-out keeps the queue (`AppState.swift:79-86`). One stale event stalls analytics until 200 newer events evict it. | Codex; referenced by the capture handoff |
| R8 | P2, main-merge gate | CONFIRMED | Merging removes main's AI-processing consent gate (from `39f8ce8`: `origin/main` `HomeView.swift:19,24,108`, `AppState.swift:3-4`). Local history removed it at `c69fc05` (the 1.0.4 reconstruction), and HEAD has none. `docs/app-store-readiness.md:53` records the missing permission as an unresolved App Store risk, and the approved policy describes no AI permission prompt, which matches HEAD. No decision record says main's gate should be removed. | Mike decides before the main merge; Codex records it |
| R9 | P2, main-merge gate | CONFIRMED (config); Pages setting inferred | `docs/` has no `_config.yml`, and there is no `.nojekyll` at the root or in `docs/`. Pages serves `main` `docs/` ([current state](../CURRENT_STATE.md) lines 42 and 83), so a merge would probably render the new Markdown on the public site: current state, evidence, and the handoff with its unreleased-UI images. The approval covered repository publication only. | Mike decides; Codex can add an explicit Pages include/exclude |
| R10 | P2, now; capture dependency | CONFIRMED | A fresh migration replay fails at `20260823062018_evaluation_artifact_reconciliation_schedule.sql:4-18` unless two Vault secrets exist. CI replays only the baseline and measurement migrations (`scripts/verify-measurement-database.mjs:26-54`), so the evaluation pgTAP suites are not CI-gated. The capture migration will need a working local replay. | Codex |
| R11 | P2, pre-existing on main; capture dependency | CONFIRMED by reading | The final write after asynchronous processing merge-upserts the row (`api/index.ts:623`, `:1457`, `:2222-2239`, `:2991-3002`). A note deleted during processing (`:2343-2376`) is re-created, pointing at deleted audio. | Codex; the capture contract item 4 forbids it for capture uploads |
| R12 | P2 | CONFIRMED (text); package binding REPORTED | The `TL-EVAL-001` next action (`product/backlog.json:142`) still says to install build 2026082801 and run the owner canary, including evaluation writes. The approved policy now says Private Evaluation is not enabled (`docs/privacy-policy.md:35-45`), and Mike deferred the learning loop. The August 23 canary package reportedly binds both policy files (`scripts/build-evaluation-owner-canary-package.mjs:36-37`), so it no longer matches. | Codex updates the backlog |
| R13 | P3 | CONFIRMED | [Current state](../CURRENT_STATE.md) line 125 says real schema-v2 volume is still zero; line 20 says four schema-v2 outcomes now match and explicitly supersedes the zero. | Codex |
| R14 | P3, unchanged from main | CONFIRMED | Action items are identified by normalized text (`api/index.ts:3214-3253`; client `UploadClient.swift:741-755`). Identical texts toggle together, and stale text appends a "manual" item. Relevant to the running list's occurrence identity, not to capture. | Codex, with `TL-TASK-001` |
| R15 | P3 | CONFIRMED | Stale process wording: [current state](../CURRENT_STATE.md) line 9 ("Claude was not contacted"); [tandem](../AGENT_TANDEM.md) lines 31–40 call guides working-tree-only; the decision log and plan describe checkout migration as future, which Mike's later approval supersedes. | Codex |
| R16 | P3 | REPORTED | Quality tooling: `scripts/product-learning-report.mjs:455-458` lets a supplied summary lower the accepted-case floor, and `evals/score-private-audio.mjs:31-35` does not recompute the seal or bind the manifest. The command-line path still ends `invalid_run`. | Codex, before any quality claim |
| R17 | P3, pre-existing | REPORTED | Raw internal error text is returned to clients (`api/index.ts:160-165`); the recording ID is used as the provider file name (around `:1756`); account deletion pages only the first 1,000 recordings (around `:2864`). The privacy manifest reportedly does not declare product-feedback text. | Codex |

Properties Claude confirmed as correct: lineage writes are gated at `api/index.ts:1442` and off with the flags absent; `supabase/functions/mcp` and `_shared/memory-tools.ts` are unchanged from main; commits C2–C8 in the [reconciliation receipt](2026-09-28-reconciliation-plan.md#phase-2-execution-receipt) appear in `git log` with their stated subjects; the approved policy bytes match. A subagent reported, and Claude did not re-verify: UPDATE/DELETE rejection on the lineage tables; RLS with no client grants; `SECURITY DEFINER` functions with an empty `search_path` and service-role-only EXECUTE; owner-scoped revision lookups; the exact-prefix restriction in `private-artifact-delete`; and the publication screen, which found no emails, personal paths, or tokens among added files.

## Capture handoff: disposition of Codex's findings

Revision 2 of the [capture handoff](../handoffs/2026-09-28-home-capture-recovery.md) responds to every finding. Claude evaluated each recommendation rather than copying it.

| Finding | Claude's evaluation | Resolution in revision 2 |
| --- | --- | --- |
| B1 | Agreed. Claude confirmed the server allocates the ID (`api/index.ts:1361`), stores nothing for an empty body (`:2199`), overwrites audio (`:2207`) and merge-upserts (`:2991-3002`), so ID reuse alone could overwrite or double-process. | Data and API contract: owner-scoped reservation, payload identity, replayable receipt, single processing claim, cross-account safety, a deleted-note rule, reconciliation by binding, compatibility and privacy. SQL and API scope named; no implementation. |
| B2 | Agreed. | Base named as `372178b` on PR #3; PR #2 follows and is not a prerequisite; base review and main merge are separate gates. |
| B3 | Agreed with the foreground-queue recommendation. Claude added the recording case: `Info.plist` has no background audio mode. | Foreground queue with four triggers; no background promise; leaving while recording ends and keeps the recording (open choice D2). |
| B4 | Agreed. Claude confirmed `AuthClient.swift:144-152` erases the session on any refresh error and that `AppState` is not told. | Offline refresh keeps the session; a rejected sign-in gets a sign-in-required tray state with same-account recovery through the existing sign-in screen; audio retained; onboarding unchanged. Another-account behavior is open choice D1. |
| B5 | Agreed. | Durable record and file before recording; Stopped early, Interrupted, Not enough space and Couldn't start recording states; no promise that every file is intact. |
| B6 | Agreed. Claude added that `recording_failed` currently labels upload failures `pre_record` (`HomeView.swift:442-449`) and poll exhaustion emits nothing (`:473-503`). | Separated event proposal; session-funnel limitation stated; Codex finalizes metrics before any recovery rate. Metrics untouched. |
| Lost-response discard | Agreed. | Two history-based messages; Discard is local only; no server deletion is implied. |
| Receipt before deletion | Agreed. | Invariant 2; zero-byte bodies never produce a receipt. |
| Account races | Agreed. | Only unsaved captures counted; active recording, in-flight uploads, stale callbacks, local and remote deletion failure specified. |
| Processing | Agreed. | Poll exhaustion is not failure; no re-upload; no reprocessing. |

Claude additions:

- **A1, disclosure check (P3).** The approved policy does not say that unsaved audio waits on the phone, that sign-out deletes unsaved captures from the phone, or that the server keeps a capture ID and audio digest with each recording. None seems strictly required: the audio stays on the phone under the person's control, and the digest is not content and is deleted with the recording. Codex should still check the final behavior against the policy and privacy manifest and stop for Mike if wording is needed. The approved bytes were not edited.
- **A2.** R7 must be resolved before capture events ship.
- **A3.** R10 affects verification of the capture migration.
- **A4.** R11 is folded into capture contract item 4.
- **Product choices for Mike:** D1, another account's captures; D2, recording when the app leaves the foreground. Recommended defaults are in the handoff.

## Files changed by Claude (uncommitted)

| File | Change | SHA-256 |
| --- | --- | --- |
| `docs/handoffs/2026-09-28-home-capture-recovery.md` | Revision 2 | `75eda71e6606374145eb6f2b9fbdea807ad50f9cbd6fa2274f0908e27432c3b9` |
| `docs/handoffs/assets/2026-09-28-home-capture-recovery/selected-mock.html` | States 13–21 added; state 8 copy corrected | `01567883ae0ff2e56beefc92f5ad43fac9b738c7b6e9daacbe4c3ddf7dd18cea` |
| `docs/handoffs/assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt` | 16 entries added or changed | `568d552a1543269553dbdcc06e4cf98fe0092a3517db09c299b12a8b84f183cf` |
| `docs/handoffs/assets/2026-09-28-home-capture-recovery/screens/` | 14 new PNGs; `discard-light` and `discard-dark` re-rendered with revised copy | listed in `SHA256SUMS.txt` |
| This receipt | New | reported with the handoff message, since a file cannot contain its own hash |

All 21 unchanged reference images were re-rendered from the final mock and byte-compared with the stored files: all 21 identical, so states 1–7 and 9–12 are unchanged at the pixel level. The new images are synthetic headless-Chrome renders at device scale 2, inspected by Claude in light, dark and accessibility sizes. No product, backend, canonical, policy, backlog, metrics or decision-log file was edited.

## Checks

| Check | Result |
| --- | --- |
| Base identity and drift | PASS as recorded above |
| `npm run docs:verify` | PASS: 19 backlog items; 47 checked Markdown files |
| `npm run privacy:check` | PASS: `privacy-policy-parity: ok`; this is not a secret scanner |
| `shasum -a 256 -c SHA256SUMS.txt` | PASS: 38 of 38 entries (the mock and 37 PNGs) |
| Relative links in the handoff and this receipt | PASS: 88 relative links in the handoff and 18 in this receipt resolve, including in-page anchors |
| `git diff --check` on Claude's files | PASS: no whitespace errors in the tracked changes or in this new file |
| Privacy screen of Claude's files (emails, personal paths, tokens, identifiers, note content) | PASS: no emails, personal paths, tokens, recording identifiers or note content; all mock text is synthetic |
| Node, Deno and Swift suites; iOS build; database replay | NOT RUN: design-only change; no executable source changed |
| Physical device | NOT RUN: every device check in the handoff remains required |

## Remaining gates

1. Codex dispositions R1–R17 and records its decision on the shared base.
2. Mike decides R8 (the consent gate) and R9 (Pages publication) before the exact main-merge action. The main merge itself remains unapproved.
3. Codex re-reviews capture handoff revision 2 at its exact hashes, then integrates and commits the owned files.
4. Mike answers D1 and D2. Claude then resolves any re-review findings and sets `handoff_ready`. Build entry remains Mike's decision.
5. Before capture events ship: R7. Before the capture migration is verified: R10. Before any deployment: the existing approval rules.
6. Before any lineage or Private Evaluation flag: R1–R6, and Mike's separate learning-loop decision.

**Next action for Codex:** re-review capture handoff revision 2 against `372178b` at the hashes above, and disposition R1–R17 in the canonical sources it owns.
