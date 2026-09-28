# Part 5: task-card information hierarchy

**Status:** Implemented and delivered to `Internal QA` 2026-08-27; measurement pending. [Evidence](../../evidence/2026-08-27-home-feedback-first-slice.md)  
**Backlog:** `TL-TASK-001`  
**Verified:** 2026-08-25; [feedback intake](../../evidence/2026-08-25-home-feedback-specification-intake.md), `SwipeCompleteRow`, `ActionItemsView`, and `CapturedCard`

## User problem

Task rows and note cards do not consistently distinguish the next action from its supporting context. Long task text, repeated note titles, and transcript-first card previews make the feed harder to scan. The data already contains action, context, date, priority, source, summary, and transcript, but the current presentation does not give them clear roles.

## Outcome

Make the extracted action the unmistakable primary line and move date, context, and source into restrained supporting text. Notes remain readable summaries; full transcript stays available in detail.

## Task-row hierarchy

1. **Primary line:** the existing imperative `todo.text`, displayed at the current body size with medium weight. Do not generate or rewrite a second action string on the client.
2. **Action metadata:** typed date and context, when present. Use concise, localized labels and omit empty separators.
3. **Source:** source note title plus relative capture date, visually quieter but still readable.

At standard text sizes the primary line may use two lines before truncation; at accessibility sizes it expands without a fixed line limit. Tapping the row opens the task editor from Part 6, while a separate source affordance opens the note. The original task text and stable ID remain available independently of any display truncation.

If the extracted task itself is too long, the user edits it. This part does not ask the model to invent a shorter headline. Repeated evidence that imperative to-do text is structurally poor belongs in a later extraction-contract candidate with the full quality gates.

## Note-card hierarchy

- Preserve capture type/time, note title, and structured highlights.
- Use the saved note `summary` as the card's secondary body. Do not prefer the raw transcript for the collapsed preview.
- Keep the transcript inside the full-note detail view, where its relationship to the summary is clear.
- Show at most three source-bound open tasks on the card, using the same row hierarchy. A count or disclosure opens the rest rather than silently omitting them.
- Do not render a labeled task subsection when there are no explicit to-dos, even if non-action `most_important` insights exist.

## Visual and accessibility contract

- Follow [brand decisions](../../../throughline-brand-decisions.md): sentence case, weights no heavier than 500, electric blue for actions, neutral supporting text, 0.5-point borders, and the current compact radius.
- The completion circle has a minimum 44-point interaction frame even if its visible mark remains smaller.
- VoiceOver reads action, state, due/context, and source in that order and exposes separate Complete/Reopen, Edit, Open source, and Delete actions when Part 6 is present.
- Secondary text must retain sufficient contrast in light and dark mode. Color is not the only priority or completion cue.
- Dynamic Type, bold-text accessibility, and long localized dates may reflow vertically; no horizontal clipping or overlapping controls.

## Metric and guardrails

The primary metric is the `TL-TASK-001` seven-day task revisit/completion outcome. Supporting evidence is `note_opened`, `note_edited`, and `action_item_toggled` by aggregate cohort.

Guardrails are edit rate caused by truncated/unclear actions, source-open failure, inaccessible control size, summary/transcript mismatch reports, and layout failure at accessibility sizes. No displayed text enters analytics or tracked snapshots.

## Acceptance criteria

- UI tests cover short and long actions; missing/present context and dates; duplicate source titles; missing summaries; transcript presence; zero, one, three, and more than three tasks; completed state; and processing state.
- Snapshot/manual review covers light/dark mode, largest Dynamic Type, bold text, increased contrast, and narrow phone widths.
- VoiceOver order matches the hierarchy and every action has a non-gesture path.
- A regression test proves collapsed note cards use summary rather than raw transcript.
- A regression test proves non-action highlights never render as checkable tasks.

## Non-goals, authority, and rollback

This part does not change extraction, rewrite task text, change the production prompt, add new typography or colors, or redesign note detail. Mike approves the hierarchy and density before implementation.

Rollback restores the prior row/card rendering without touching note or task data. The release manifest records source commit, selected hierarchy, visual/accessibility matrix, internal build, and rollback commit without screenshot feedback or user content.
