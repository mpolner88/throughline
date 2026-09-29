# Part 4: dependable top-task selection

**Status:** Implemented and delivered to `Internal QA` 2026-08-27; measurement pending. [Evidence](../../evidence/2026-08-27-home-feedback-first-slice.md)  
**Backlog:** `TL-TASK-001`  
**Verified:** 2026-08-25; [feedback intake](../../evidence/2026-08-25-home-feedback-specification-intake.md), `HomeView.mostImportantItems`, and `ThroughlineNote.displayImportantActionItems`

## User problem

The current **Most important** section is not an importance ranking. It takes every extracted to-do from settled notes, newest note first, deduplicates by normalized text, and stops at six. Low-priority and completed items can appear while same-text tasks from different notes can disappear. The label overstates what the app knows.

## Outcome

Replace the unsupported importance claim with a transparent **Next actions** section. It shows open, source-bound tasks in a deterministic order and explains the organizing principle in the interface.

## Selection contract

- Eligible rows are explicit `Todo` records from processed or legacy-settled notes whose status is open.
- Non-action `most_important` insights, summaries, intentions, accomplishments, and carryover strings never become checkable rows.
- Rank eligible tasks in this order:
  1. overdue or dated today;
  2. explicit high priority;
  3. dated during the current week;
  4. remaining dated tasks;
  5. undated tasks;
  6. source-note recency and extraction order as stable tie-breakers.
- Preserve same-text tasks from different recordings. Identity is source recording plus stable server task ID, never normalized display text.
- Show six rows initially with a truthful count such as **6 of 11**. **See all** expands the section inline until Part 2 supplies the full time-horizon view.
- Reopened tasks return to their deterministic rank. Completed tasks leave the active section immediately and remain reachable from their source note until the Completed view ships.
- If no eligible action exists, show a quiet **No open actions** state only when processed notes exist; otherwise omit the section.
- Beneath the heading, use the short explanation **Due and high-priority items first.** Do not claim model certainty or personalize priority beyond the available fields.

## Presentation boundary

This is a client projection over existing typed fields. It does not change the production prompt, the 14-key extraction schema, or the meaning of `most_important`. If existing task priority/date coverage proves too weak, the UI reports that coverage; it does not silently ask the client to reinterpret free text.

The projection should be a pure, reusable `HomeTaskProjection` rather than more ordering logic embedded in `HomeView`. It retains the original `Todo`, source recording, source note title/date, display grouping, and stable mutation identity separately.

## Metric and guardrails

The primary metric is newly activated users who revisit or complete an extracted task within seven days. Existing `action_item_toggled` and `note_opened` events measure supporting workflow behavior.

Guardrails are completed-item leakage, duplicate suppression across notes, ambiguous mutation targets, task extraction correction rate, invalid date/priority coverage, and task-section expansion rate. Analytics contain bounded state categories and counts only, never task text or identifiers.

## Accessibility and visual behavior

- **Next actions** and its explanation use sentence case and the existing type scale.
- Each task is a single logical VoiceOver element with action, completion state, date/priority when present, and source relationship.
- The completion control meets a 44-point target. Color, position, or strikethrough is never the sole state signal.
- Expansion preserves focus position and supports Dynamic Type without horizontal scrolling.

## Acceptance criteria

- Pure tests prove open-only eligibility; every ranking tier; completed exclusion; reopen behavior; same text in two notes; deterministic ties; invalid and missing date/priority; six-row cap; expansion; and no checkable non-action insight.
- UI tests prove the explanatory copy, count, empty state, source navigation, focus preservation, VoiceOver state, and Dynamic Type behavior.
- Completion targets the original stable ID even if display text or formatting changes.
- Focused extraction-contract tests continue to prove that only explicit to-dos become action items.

## Non-goals, authority, and rollback

This part does not synthesize a new task headline, change model ranking, add reminders, or create time-based tabs. Mike approves the label, explanation, and ordering judgment before implementation.

Rollback restores the preceding list projection without changing stored tasks. The release manifest records the projection version, selected copy, source commit, test matrix, internal build, feature control, and rollback commit without content or identifiers.
