# Part 2: time-horizon task navigation

**Status:** Candidate; mock before implementation  
**Backlog:** `TL-TASK-001`  
**Verified:** 2026-08-25; [feedback intake](../../evidence/2026-08-25-home-feedback-specification-intake.md), current `Todo` fields, and the existing [to-do continuity mock](../../../mockup/todo-continuity.html)

## User problem

Home is one chronological note feed. A user with several extracted tasks cannot focus on what belongs today, what remains this week, or what can wait. Completion state exists but does not create a dependable working view.

## Outcome

Home gains a task-focused, time-based organizer that answers one question at a time: what needs attention today, during the rest of this week, or later. Every task remains traceable to its source note.

## Information architecture

- Add a native segmented task control with **Today**, **This week**, and **Later**. Preserve the recorder as the persistent primary capture action.
- Expose **Completed** as a clearly labeled secondary view from the task-section overflow, not a fourth cramped segment.
- Remember the selected active segment only for the current app session. A new launch starts on Today.
- Each segment shows a count and an honest empty state. It does not hide processing failures or claim that missing dates mean no work exists.

## Date contract

- Only settled, source-bound `Todo` records enter task views.
- `for_date` is calendar-day intent and takes precedence over `due` for grouping. `due` is used when `for_date` is absent.
- Parse declared ISO date or date-time values only. Never infer a date from task text on the client.
- Convert date-time instants through the user's current calendar and time zone. A date-only `for_date` remains that local calendar date and is not shifted through UTC.
- **Today:** open tasks dated today plus overdue open tasks, with overdue expressed in text.
- **This week:** open tasks after today through the end of the user's current locale-aware calendar week.
- **Later:** open tasks after the current week, followed by a separately labeled **Anytime** subgroup for valid undated tasks. Undated never implies scheduled later.
- **Completed:** completed tasks newest-completed first. Reopening returns the task to the bucket derived from its date fields.
- Invalid dates enter Anytime and emit a content-free diagnostic counter; they do not crash, disappear, or expose their value.

## Row and navigation contract

- Use the task hierarchy from Part 5 and task mutations from Part 6.
- Preserve same-text tasks from different notes and open the exact source note from every row.
- Sorting within a bucket is deterministic: overdue before current; then high, medium, low, and unspecified priority; then typed date/time; then source-note recency; then extraction order.
- The selected segment and task state are fully announced by VoiceOver. The control can horizontally adapt or become a menu at accessibility text sizes without truncating labels.
- Relative grouping refreshes at local midnight, on foreground, and after a time-zone change.

## Dependency gate

Implementation is blocked until the server preserves a stable task ID across fetch, completion, editing, and deletion, and until date precedence/parsing is shared and tested. Until then this part remains a product mock under `TL-TASK-001`; a visual mock must not be mistaken for working task routing.

## Metric and guardrails

The primary metric is newly activated users who revisit or complete an extracted task within seven days. A privacy-safe `task_view_changed` event with only the selected bounded view may be added as diagnostic evidence after the metrics allowlist changes.

Guardrails are date-group correction rate, invalid-date coverage, mutation failure rate, duplicate-text targeting, reminder opt-out rate if reminders are ever added separately, and accessibility at narrow widths. Internal TestFlight cohorts remain separate from the public baseline.

## Acceptance criteria

- Pure tests cover date-only and timestamp inputs, locale-aware week boundaries, Sunday/Monday transitions, daylight-saving changes, time-zone moves, overdue items, invalid and missing dates, completed/reopened tasks, duplicate text across notes, stable sorting, and midnight refresh.
- UI tests cover all empty states, segment restoration for the current session, Completed access, source-note navigation, Dynamic Type, and VoiceOver selected state.
- No task can appear in two active buckets at once.
- Every visible task has a stable source and stable mutation ID.

## Non-goals, authority, and rollback

This part does not add reminders, recurrence, natural-language date parsing, calendar sync, new extraction fields, or agent write access. Mike approves the information architecture and mock before implementation.

Rollback removes the segmented organizer and returns to the verified task section without altering task records. The release manifest records the date-contract version, source commit, internal build, calendar/time-zone test matrix, feature control, and rollback commit without task content or identifiers.

