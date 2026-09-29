# Running list — TL-TASK-001

**Verified baseline:** 2026-09-29; capture source `9878718aca01429891a2ca5d597f633ca57d56e8`, internal delivery 1.0.5 (2026092901). [Owner feedback and source findings](../evidence/2026-09-29-capture-owner-feedback.md).
**Backlog state:** `ready_for_mock`
**Slice phase:** `candidate`
**Tandem stage:** `design_brief`
**Current:** Mike requests the running list next and reports the persistent unfinished-from-last-night bug. This opens the next slice; it does not establish that the old PR is compatible with the delivered capture work.
**Evidence:** [original PR #2](https://github.com/mpolner88/throughline/pull/2), reviewed snapshot `55973a48ed1c2ef4db01fb0e7b485fb8e9a92e73`; [reconciliation disposition](../evidence/2026-09-28-reconciliation-plan.md); [current feedback](../evidence/2026-09-29-capture-owner-feedback.md). Local retained PR snapshot was inspected; remote PR state was not refreshed in this follow-up.
**Next gate:** Claude refreshes the existing running-list design around the capture tray, then Codex reviews the contract before implementing. Claude access needs restored login. No running-list feature has been implemented in this follow-up.
**Authority:** Mike's September 29 request starts this next slice. Preserve Claude design/Codex engineering and mutual review. No wholesale PR #2 import, GitHub comment, main merge, provider/model/evaluation activation, pricing/limit change or public release.

## Problem and selected direction to carry forward

Tasks from several voice notes should remain a dependable list. A second recording must not replace earlier tasks; completion must stay completed; date labels must describe real dates. Keep the earlier **Today / This week / Later** proposal as the starting direction and retain source-note navigation. Adapt it to the delivered capture tray rather than its historical save confirmation.

Reference files at PR snapshot: `docs/superpowers/specs/2026-09-09-throughline-running-list-design.md`, companion `docs/superpowers/plans/2026-09-09-running-list-1-implementation.md`, and `mockup/list-redesign/index.html`. The historical approved label does not resolve conflicts with current capture/account/lineage behavior.

## Claude design assignment

Prepare a fresh handoff and compact current/target visual comparison: the running task surface, Today/This week/Later, completed/undo treatment, source-note navigation, empty/loading/offline/error states, and unchanged persistent capture/recovery. Remove the false unfinished-last-night block. Include dark mode, larger text, VoiceOver and non-gesture controls. Reuse existing brand tokens; no new onboarding or unrelated navigation redesign.

Show any material changes to the original design explicitly. The old global normalized-text merge and automatic movement of week-old tasks must not be silently imported: repeated wording is not proof of the same task, and age alone is not a new due date. Propose the smallest behavior that preserves separate occurrences and truthful dates; resolve any resulting visible differences in the refreshed handoff.

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
- Old clients retain their API contract. Unit/contract tests cover real boundary behavior; device checks and Claude visual review are separately recorded.

## Measurement, rollback and evidence

Primary metric proposed by TL-TASK-001: newly activated users who revisit or complete an extracted task within seven days. Before implementation, define its exact occurrence-level numerator, denominator and coverage in the only metric-definition source, [product/metrics.md](../../product/metrics.md); current workflow events alone do not establish that measure. Keep internal TestFlight evidence separate from public outcomes; no lift claim before reconciled coverage. Guardrails: no capture loss, duplicated/lost tasks, cross-owner writes, or invented task meaning.

Rollback restores presentation through a compatible build while preserving durable capture storage and task history. Do not drop tables/identities or use an older binary that cannot safely read the capture store. The eventual implementation/release manifest must name exact source, schema compatibility, tests, peer review, build and unverified device behaviors.
