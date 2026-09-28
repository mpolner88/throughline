# Part 1: honest carryover

**Status:** Implemented and delivered to `Internal QA` 2026-08-27; measurement pending. [Evidence](../../evidence/2026-08-27-home-feedback-first-slice.md)  
**Backlog:** `TL-TASK-001`  
**Verified:** 2026-08-25; [feedback intake](../../evidence/2026-08-25-home-feedback-specification-intake.md), `AppState.carriedForwardItems`, and `CarryForwardView`

## User problem

Home currently presents every stored `tomorrow_todos` string under language that implies both unfinished status and immediate recency. The data proves neither. A user cannot tell which note produced an item or open its source, so the section feels arbitrary rather than trustworthy.

## Outcome

The first release uses honest, neutral language and makes provenance visible. It never calls an item unfinished, overdue, or from the previous night unless typed task state and dates prove that claim.

## Interaction contract

- Rename the section to **From earlier notes**. Use sentence case; do not use the brand underline or all caps.
- Include only strings from a settled source note created before the start of the user's current local calendar day. A string from today's note is not carryover.
- Present the original text without client-side rewriting. Beneath it, show the source note title and relative capture date.
- Tapping a row opens that source note. The row has no completion circle until it is backed by a stable task identity and explicit open/completed state.
- Sort by source-note creation time newest first, then by the original order inside that note.
- Preserve same-text items from different source notes. Deduplicate only repeated occurrences within the same recording and field position; normalized text across unrelated notes is not identity.
- If no qualifying item exists, omit the section. Do not show a zero-state card.
- Relative dates refresh when the app returns to the foreground and when the local day changes.

## Later typed-state upgrade

Once Part 4 establishes a source-bound task ID, this section may become **Carried forward** and contain only open tasks whose typed `for_date` or `due` falls before today. Legacy strings with unknown completion state remain source-note context; they do not silently become actionable tasks.

## Metric and guardrails

The primary metric is the canonical `TL-TASK-001` outcome: an activated user revisits or completes an extracted task within seven days. `note_opened` with a privacy-safe `surface = carryover` is a diagnostic driver only after the surface property is allowlisted.

Guardrails are wrong-source opens, duplicate rows, date-boundary errors, falsely actionable legacy strings, and accessibility coverage. A raw task, note title, or identifier never enters analytics.

## Accessibility and visual behavior

- The whole row is a minimum 44-point target.
- VoiceOver announces the item as context from an earlier note and includes the source title and date; it does not announce a completion action.
- Dynamic Type may expand the item and source to multiple lines. No information is available only through color.
- Reuse the current quiet list styling and blue link treatment; add no new card or icon language.

## Acceptance criteria

- Tests cover today's source, yesterday's source, older source, future-dated device clock, local midnight, daylight-saving transitions, empty strings, same text in two notes, duplicate text within one note, processing states, and deterministic ordering.
- A UI test proves a row opens the correct source note.
- VoiceOver labels contain the source relationship and expose no false completion state.
- The old recency/incompletion claim no longer appears in production strings.

## Non-goals, authority, and rollback

This part does not infer dates from free text, change extraction, create reminders, or add task completion for legacy strings. It is a reversible presentation/source-binding change under `TL-TASK-001`; Mike selects and approves the copy and hierarchy before implementation.

Rollback restores the prior section implementation without deleting or rewriting note data. The release manifest records source commit, selected copy, tested calendar/time-zone matrix, internal build, and rollback commit without user content or identifiers.
