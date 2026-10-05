# Running List — Today, This Week, Later

**Progress:** Accepted on Mike’s phone; public candidate uploaded and selected, reviewed listing applied; awaiting working App Review access.
**What you will get:** One dependable task list with Today, This week and Later; each task stays separate and links back to its note. The recorder and capture tray stay as shipped.
**Next:** Verify the confirmed in-app App Review account, then submit 1.0.5 (2026100502). [Preparation and remaining dependencies](../evidence/2026-10-05-app-store-preparation.md).
**Review PR:** [Running List — Today, This Week, Later · #4](https://github.com/mpolner88/throughline/pull/4), last verified open as a draft on September 30. It includes capture and recording-control prerequisites. This October 5 app-only delivery did not refresh or mutate the remote PR.

## Technical record

**Original implementation baseline (historical September 30):** source `f6983ed01cd41355cc950dd9bd1226cb9da85294`, before Running List delivery. [Readiness receipt](../evidence/2026-09-30-running-list-ready.md). Current delivery is recorded below.
**Backlog state:** `shipped`
**Slice phase:** `canary`
**Tandem stage:** `owner_accepted` (public release authorized; submission checks pending)
**Current:** Verified October 5: Mike accepted internal 2026100501. Public 1.0.5 (2026100502), source `d7f26769a7c28e0bcfed50b8ae0ba61fb4fd6044`, is uploaded, VALID, APP_STORE_ELIGIBLE and selected. PREPARE_FOR_SUBMISSION with automatic release after approval; not public. Compiled app code matches accepted internal source. The isolated archive now includes the existing anon sign-in configuration omitted from the preceding internal package. [Public candidate](../releases/2026-10-05-ios-1.0.5-2026100502-candidate.md), [configuration and release evidence](../evidence/2026-10-05-app-store-preparation.md).
**Evidence:** [handoff](../handoffs/2026-09-29-home-running-list.md), SHA-256 `df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946`; all 32 asset entries verified; [RL1–RL7 disposition](../evidence/2026-09-30-running-list-ready.md), [initial F1–F7 answers](../evidence/2026-09-30-running-list-feasibility.md).
**Next gate:** the Throughline test credentials saved in App Review Information must issue a session (fresh retry: email_not_confirmed). Claude's exact listing/image review and copy recheck pass; the listing is applied and all five screenshot deliveries are COMPLETE. Mike's App Store Connect login and release approval are established. Prior simulator limits remain recorded in the [swipe/scroll review](../evidence/2026-10-05-codex-swipe-scroll-review.md); owner acceptance is not a claim that every timed/accessibility case was exercised.
**Authority:** Mike accepted the repair and explicitly authorized accurate ASO, public upload, submission and automatic release on October 5. Preserve shipped capture, recorder and AI behavior. No extraction prompt/schema change, wholesale PR #2 import, PR comment, main merge, provider/model/evaluation activation, policy change or unrelated features. Categories/search follows; Private Evaluation follows categories/search.

## Problem and selected direction to carry forward

Tasks from several voice notes should remain a dependable list. A second recording must not replace earlier tasks; completion must stay completed; date labels must describe real dates. Use the selected Candidate A **Today / This week / Later** direction and retain source-note navigation. Adapt it to the delivered capture tray rather than its historical save confirmation.

Reference files at PR snapshot: `docs/superpowers/specs/2026-09-09-throughline-running-list-design.md`, companion `docs/superpowers/plans/2026-09-09-running-list-1-implementation.md`, and `mockup/list-redesign/index.html`. The historical approved label does not resolve conflicts with current capture/account/lineage behavior.

## Claude feasibility resolution

Claude's revision 2 resolves the selected editor, Sunday placement, persistent moves, earlier-group Undo, truthful timeframe copy, midnight/accessibility and shipped recorder/Notes lifecycle behavior. Codex's [readiness receipt](../evidence/2026-09-30-running-list-ready.md) closes RL1–RL7 at exact hashes. Claude's rendering slot is released; Codex coordinates subsequent simulator work and returns the actual implementation for Claude review. The selected handoff is frozen; production implementation does not edit its bytes.

## Codex engineering sequence

1. Inventory the selected design's API/extraction assumptions against current contracts; freeze occurrence-level identity and legacy compatibility before UI work. Keep task completion separate from evaluation eligibility.
2. Add deterministic task projection from explicit task fields, source references, calendar/date handling and completion history. Never promote accomplishments, summary or arbitrary important strings into tasks. Keep provenance and immutable revision checks.
3. Integrate the selected list without replacing the capture store/queue, stable capture IDs, owner boundaries, retries or accepted-save receipts. New captures append work.
4. Verify date/identity/concurrency/failure behavior, iOS rendering and exact-source Claude review. Deliver a fresh internal build under standing authority only after the selected handoff and checks are ready.

The original proposal also changes extraction schema/prompt and deduplicates across notes by normalized text. Those changes require a scoped contract and quality review; they are not implementation shortcuts. No reminders, calendar integration, background recording, provider/model switch, automatic training or private-evaluation rollout belongs here.

## Acceptance

- Today, yesterday, older notes, midnight, timezone changes and daylight-saving boundaries have truthful bucket/age labels.
- Completing a task survives refresh/relaunch and changes only its occurrence; repeated text within/across notes stays independently actionable.
- Stale edits cannot recreate a removed task or mutate another occurrence; current revisions and source notes remain connected.
- New recordings append tasks without removing existing work. Source labels open the correct note.
- Completed items leave the active list according to the selected rule without deleting source history; unknown legacy state is not called confirmed unfinished.
- Capture interruption, offline recovery, uncertain saves, owner isolation and deletion behavior remain covered.
- Old clients retain recording/read and unambiguous completion compatibility. Unsafe versionless task edits and ambiguous completion selectors receive a conflict/update-required result; they never silently change another task or restore a deleted one. Mike directed continuation after this recommended approach was explained. Unit/contract tests cover real boundary behavior; device checks and Claude visual review are separately recorded.

## Measurement, rollback and evidence

Primary metric proposed by TL-TASK-001: newly activated users who revisit or complete an extracted task within seven days. Its exact numerator, denominator and coverage are defined in the only metric-definition source, [product/metrics.md](../../product/metrics.md#seven-day-extracted-task-value); instrumentation remains unverified, and current workflow events alone do not establish that measure. Keep internal TestFlight evidence separate from public outcomes; no lift claim before reconciled coverage. Guardrails: no capture loss, duplicated/lost tasks, cross-owner writes, or invented task meaning.

Rollback restores presentation through a compatible build while preserving durable capture storage and task history. Do not drop tables/identities or use an older binary that cannot safely read the capture store. The eventual implementation/release manifest must name exact source, schema compatibility, tests, peer review, build and unverified device behaviors.
