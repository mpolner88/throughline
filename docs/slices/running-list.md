# Running list — TL-TASK-001

**Verified baseline:** 2026-09-30; local source `3d5c3acebb9f447b3bf5086283ed11715ff5ac6b`, last verified internal delivery 1.0.5 (2026092902), app source `77192374e5f1de339047904c7ee0825e9863b96f`. [Feasibility and exact hashes](../evidence/2026-09-30-running-list-feasibility.md); [last delivery receipt](../releases/2026-09-29-ios-1.0.5-2026092902-delivery.md). No fresh Apple/backend check is claimed.
**Backlog state:** `approved_for_build`
**Slice phase:** `selected`
**Tandem stage:** `selected_pending_codex_feasibility_resolution`
**Current:** Mike selected Candidate A, decided undated tasks go to Today, and approved build entry/internal TestFlight before subsequent product work. Codex completed initial feasibility; no feature implementation has started.
**Evidence:** [selected handoff](../handoffs/2026-09-29-home-running-list.md), SHA-256 `57ff7e1dc4ba12380b0714bd0c389baba8a3cfde95b1c57c6248c2d1fe11c881`; all 23 asset entries verified; [findings and F1–F7 answers](../evidence/2026-09-30-running-list-feasibility.md).
**Next gate:** Resolve RL1 legacy-write compatibility with Mike and the handoff findings with Claude. Claude marks its revised handoff ready; Codex rechecks the bytes and builds under the already-granted approval. Actual Claude implementation review precedes internal delivery.
**Authority:** Approved running-list implementation and internal-only TestFlight to existing Internal QA. Preserve shipped capture, recorder and AI controls. No extraction prompt/schema change, wholesale PR #2 import, PR comment, main merge, provider/model/evaluation activation, policy change or public release. Categories/search follow delivery; Private Evaluation follows categories/search.

## Problem and selected direction to carry forward

Tasks from several voice notes should remain a dependable list. A second recording must not replace earlier tasks; completion must stay completed; date labels must describe real dates. Use the selected Candidate A **Today / This week / Later** direction and retain source-note navigation. Adapt it to the delivered capture tray rather than its historical save confirmation.

Reference files at PR snapshot: `docs/superpowers/specs/2026-09-09-throughline-running-list-design.md`, companion `docs/superpowers/plans/2026-09-09-running-list-1-implementation.md`, and `mockup/list-redesign/index.html`. The historical approved label does not resolve conflicts with current capture/account/lineage behavior.

## Claude feasibility resolution

Candidate A is already selected and its supplied handoff/assets passed integrity checks. Resolve RL2–RL6 in the [Codex receipt](../evidence/2026-09-30-running-list-feasibility.md), incorporate the Mike-owned RL1 decision when available, and explicitly defer first-use recorder copy to shipped AI state. Return revised hashes and mark the contract ready only after the affected findings are resolved. Preserve the three tabs, existing tokens, capture tray and selected scope; a new round of candidate selection is not requested.

The unresolved issues are task identity through editing, manual move/Undo and earlier-group semantics, Sunday-to-Monday placement, truthful undated-timeframe copy, and consistent midnight/accessibility behavior. Preserve the existing note detail presentation; any necessary editor interaction change needs Claude's explicit design disposition. Only one party may use simulator or browser rendering at a time.

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
- Old clients retain recording/read compatibility; the missing-identity limitation on unsafe task writes is an explicit pending Mike decision (RL1), not a silently waived invariant. Unit/contract tests cover real boundary behavior; device checks and Claude visual review are separately recorded.

## Measurement, rollback and evidence

Primary metric proposed by TL-TASK-001: newly activated users who revisit or complete an extracted task within seven days. Its exact numerator, denominator and coverage are defined in the only metric-definition source, [product/metrics.md](../../product/metrics.md#seven-day-extracted-task-value); instrumentation remains unverified, and current workflow events alone do not establish that measure. Keep internal TestFlight evidence separate from public outcomes; no lift claim before reconciled coverage. Guardrails: no capture loss, duplicated/lost tasks, cross-owner writes, or invented task meaning.

Rollback restores presentation through a compatible build while preserving durable capture storage and task history. Do not drop tables/identities or use an older binary that cannot safely read the capture store. The eventual implementation/release manifest must name exact source, schema compatibility, tests, peer review, build and unverified device behaviors.
