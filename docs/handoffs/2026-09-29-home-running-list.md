---
handoff_id: "2026-09-29-home-running-list"
project_name: "Running List — Today, This Week, Later"
backlog_id: "TL-TASK-001"
slice_brief: "docs/slices/running-list.md"
tandem_stage: "handoff_ready"
handoff_revision: 2
prior_revision_sha256: "57ff7e1dc4ba12380b0714bd0c389baba8a3cfde95b1c57c6248c2d1fe11c881"
base_revision: "f6983ed"
created_on: "2026-09-29"
verified_on: "2026-09-30"
design_agent: "Claude Code"
implementation_agent: "Codex"
decision_owner: "Mike"
authority: "design_only"
selected_candidate: "A — Three tabs (today, this week, later)"
selection_record: "Mike, 2026-09-29, Claude Code session: \"I like A - but can you confirm the functionality (swipe, etc.) doesn't change?\" then, after the interactive prototype: \"I really like A.\""
product_decisions: "Mike, 2026-09-30: D1 tasks with no time said go to today (\"It should go today\"); build entry approved (\"Get Codex to build running list\"), shipping to internal TestFlight before the categories work; Continue applied to Codex's recommended old-app compatibility approach (RL1)."
owned_paths:
  - "docs/handoffs/2026-09-29-home-running-list.md"
  - "docs/handoffs/assets/2026-09-29-home-running-list/"
  - "mockup/running-list/"
---

# UI Design Handoff: Running List — Today, This Week, Later

Follow [the Claude Code + Codex tandem workflow](../AGENT_TANDEM.md).

**Stage note.** This is revision 2.
- Mike selected Candidate A on 2026-09-29. On 2026-09-30 he decided D1 (tasks with no time said go to today), approved build entry, and applied Continue to the recommended old-app compatibility approach.
- Codex's [feasibility review](../evidence/2026-09-30-running-list-feasibility.md) of revision 1 (`57ff7e1d…`) found the design feasible with seven items, RL1–RL7. This revision resolves them without expanding the selected design.
- Codex re-reviewed revision 2 on 2026-09-30 and found no material findings: the text at `85260ecf…` and all 32 manifest entries. The tandem stage is `handoff_ready`. Codex builds under Mike's approved build entry.
- After Codex's check, one reference image was found stale: `source-light-390x844.png`, the note sheet, which now shows the Edit button. It was re-rendered from the unchanged frozen prototype. Codex re-verifies that one manifest entry.

**Base.** Prepared on the shared local `codex/running-list` branch at `f6983ed`. The capture tray, the recorder, and the shipped one-tap AI controls ("Agree and record", the Settings switch) do not change here. Source line references below are historical, at `6fa119c`. The resolution receipt is [Claude's running-list resolution](../evidence/2026-09-30-claude-running-list-resolution.md).

## Revision 2 changes

| Item | Revision 1 | Revision 2 |
| --- | --- | --- |
| RL1, old app versions | Old clients "keep working" | Old apps keep recording and reading. Completing works only for a to-do whose text is unambiguous, now and in the note's history. Title, summary and transcript edits work only when the submitted to-do list exactly matches the current one. Anything else returns an update message and changes nothing. |
| RL2, editor | Note detail and editing unchanged | Note detail is unchanged. In Edit, only the to-dos field changes, from one text box to one row per to-do, so each keeps its identity. Rows can be renamed, removed or added. Save applies everything or nothing. |
| RL3, Sunday | Tomorrow always in this week | On Sunday, tomorrow is after "through sunday", so it waits in later, labeled "tomorrow", until Monday |
| RL4, moves | Placement never stored | Dates place tasks automatically; a move is stored and wins indefinitely, labeled "moved Tue" once its day has passed. Completion and Undo keep it. Moving an earlier-notes task promotes it. |
| RL5, undated timeframes | Later copy promised "someday" | Nothing infers timeframes. Later holds tasks dated after this week, and tasks you move there. The copy and markers are corrected. |
| RL6, midnight, Reduce Motion, VoiceOver | Mixed statements | Midnight is applied while the app is open and on return. Reduce Motion means no animation. VoiceOver has one element per row, with its actions. |
| RL7, recorder copy and Notes | Fixed first-use recorder title | The recorder title follows the shipped AI control; the Notes screen keeps Home's capture tray running underneath |

The selected three-tab design, tabs, rows, gestures, done group and "from earlier notes" group are unchanged.

## Current

- What the user experiences now:
  - Home shows a date, "Today's plan", and an "unfinished from last night" block, then a "most important" list, then one card per voice note.
  - The "unfinished" block flattens every visible note's `tomorrow_todos`, with no date or completion check. It can call something said this morning "last night", and it never clears.
  - "Most important" walks notes newest-first and stops at six items, so a second note can push the first note's tasks off Home.
  - Task changes match by text, so repeated wording collides. The note editor's to-dos field is one multi-line text box, which loses which to-do is which.
- Verification date: 2026-09-30.
- Evidence type: source inspection (primary), plus synthetic simulator images of the capture build supplied by Codex on 2026-09-29 (visual baseline). There is no physical-device reproduction of the carry-over bug; it is traced in source and reported by Mike.
- Evidence links (line numbers at `6fa119c`):
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift):
    - `visibleCarryForwardItems` at line 231, rendered through `CarryForwardView` (lines 593–598);
    - `mostImportantItems` at line 348 stops at six items;
    - `SwipeCompleteRow` at line 640, with a 76-point threshold at line 645;
    - `CapturedCard` at line 754, with "Read full note" at line 832, "Discard this memory?" at line 852 and the grade at line 962;
    - `NoteEditForm` puts the to-dos in one `EditTextEditor`, around line 1462 in current source.
  - [ThroughlineNote.swift](../../ios/Throughline/Models/ThroughlineNote.swift) `NoteEditDraft.todosText` joins to-dos into one string.
  - Text-based toggles: [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) line 726 and [api/index.ts](../../supabase/functions/api/index.ts) line 3389.
  - Background and review: [slice brief](../slices/running-list.md), [owner feedback, 2026-09-29](../evidence/2026-09-29-capture-owner-feedback.md), and [Codex feasibility review, 2026-09-30](../evidence/2026-09-30-running-list-feasibility.md).
  - The September 9 design from the PR #2 snapshot `55973a48ed1c2ef4db01fb0e7b485fb8e9a92e73`.
- Known evidence gaps: no device reproduction; how many open tasks people keep; how often the same words recur; real travel and timezone behavior.

## User problem

- One problem: tasks spoken across several voice notes do not add up to one dependable list. A new note hides earlier tasks, completion does not carry through, and date labels are not true.
- Who experiences it: every signed-in person who records more than one note with tasks in a day or a week.
- Why it matters now: Mike named the running list next after capture recovery, and the carry-over bug is in the delivered app. It is rung three of the outcome ladder in [PRODUCT.md](../PRODUCT.md), "return and reuse".

## Evidence

- Decision-ready evidence: the source defects above, Mike's report, the September 9 audit, and Codex's feasibility review.
- Assumptions: people want tasks grouped by when they matter more than by note; a visible source label is enough traceability.
- Unknowns: list length in practice; whether people want the last tab remembered.

## Canonical fit

- Product principles: speed (no triage required); trustworthy structure (true dates, nothing merged by wording, nothing inferred); traceability (every row names its note); portability (task history stays in the note).
- Brand/design principles from [throughline-brand-decisions.md](../../throughline-brand-decisions.md): 2, 3, 4, 5 (the separate "most important" list goes), 6 (notes one tap away), 7 (blue marks new, dated, selected and primary), 8 (native editor and sheets), 9 (swipe stays; every action also has a button), 11. The recorder and tray keep their accepted shape.
- Relevant decisions: the [decision log](../../decision-log.md) entries of 2026-04-30, 2026-08-28 and 2026-09-28, and the 2026-09-30 entries recording Mike's selection, D1, build entry and the compatibility approach (Codex-owned).
- Backlog state and slice phase: Codex maintains them in [backlog.json](../../product/backlog.json) and the [slice brief](../slices/running-list.md).

## Candidates

All three shared the list rules, kept the capture tray and recorder, removed "unfinished from last night", and linked every task to its note. Source: [candidates.html](../../mockup/running-list/candidates.html), now marked historical. It was inspected in light, dark and the largest text size on 2026-09-29.

### Candidate A — Three tabs

- Core idea: Home becomes today, this week and later tabs; note cards move one tap away behind "notes".
- Mock source: [candidates.html](../../mockup/running-list/candidates.html) frames A1–A5, then the [interactive prototype](../../mockup/running-list/candidate-a-interactive.html).
- Inspected screenshot: [today, light](assets/2026-09-29-home-running-list/screens/today-light-390x844.png) and the full matrix below.
- Strengths: strongest sorting; continues the September 9 direction; short tabs.
- Risks: the week is one tap away; notes leave Home.

### Candidate B — One rolling list

- Core idea: the same groups as sections of one scroll, then note cards.
- Mock source: [candidates.html](../../mockup/running-list/candidates.html) frames B1–B5.
- Inspected screenshot: inspected in the browser on 2026-09-29; no image retained.
- Strengths: nothing hidden. Risks: long scroll.

### Candidate C — Today, then everything

- Core idea: Home shows today only, with a "Coming up" row.
- Mock source: [candidates.html](../../mockup/running-list/candidates.html) frames C1–C5.
- Inspected screenshot: inspected in the browser on 2026-09-29; no image retained.
- Strengths: calmest Home. Risks: the week is least visible.

## Selection

- Selected candidate: A, three tabs.
- Mike's exact selection record: 2026-09-29, "I like A - but can you confirm the functionality (swipe, etc.) doesn't change?"; after the interactive prototype, "I really like A."
- Claude recommended B; Mike chose A. The interactive prototype answered his question: every existing interaction is kept.
- Required revisions from the September 9 design:
  1. **No merging by wording.** Each occurrence keeps its own row.
  2. **Nothing moves by age.**
  3. **The shipped recorder and capture tray stay.**
  4. **A visible ••• on every row,** plus press-and-hold.
  5. **Tabs switch on tap only.**
  6. **Notes from before this update** sit in a collapsed "from earlier notes" group.
  7. **Out of scope:** the note-detail rename, extraction changes and agent tools.
- Rejected alternatives: B, because Mike prefers dedicated tabs; C, because hiding the week makes planning harder.

## Selected experience

Frozen target: [selected-prototype.html](assets/2026-09-29-home-running-list/selected-prototype.html), an interactive prototype with synthetic content. Open it to try every interaction, including Next morning through to the following Monday and Edit on a note. Add `?shot=<state>` for one fixed state (for example `?shot=editor`) and `&theme=dark` for dark appearance.

### Layout

- **Top bar:** the wordmark; on the right, a **notes** text button and the settings gear.
- **Tabs:** `today`, `this week`, `later`.
  - Each shows its open-task count, plus a blue `+n` for about three seconds after a note adds tasks there.
  - The selected tab has the blue underline. The app opens on today every launch.
  - Tabs change on tap only.
- **Tab header:**
  - today: "today" over the full date;
  - this week: "through sunday" over "Wed to Sun" (on Sunday, "Sunday");
  - later: "after this week" over "Later".
- **Groups:**
  - "open";
  - then "done today" with its count;
  - in later only, a collapsed "from earlier notes" group with a Show / Hide row.
- **Bottom:** the capture tray and the full-width recorder exactly as shipped. The recorder's title follows the shipped AI control: "Agree and record" while AI is off, otherwise "Record today's plan" or "Start recording" as today.

### Task row

- A completion circle: 44-point target, 22-point circle. Open is a grey stroke; done is filled blue with a check.
- The task text, wrapping as needed.
- A meta line: an optional marker pill, then the **source label**, "note title · time". The time is relative: time only for today, "yesterday 6:10 PM", "Mon 6:10 PM", or a date such as "Aug 21" beyond a week. The label is a button that opens the note.
- Trailing: **•••** on open rows (44 points); **Undo** on done rows.
- Rows from the note that just landed carry a small blue dot until Home is next opened.

### Markers

| Where | Marker | Style |
| --- | --- | --- |
| today | "today", when the task's date is today | blue date pill |
| today | "from yesterday" / "from Mon" / "from Sep 28", when a task's date or undated day has passed and it is still open | neutral pill |
| this week | "tomorrow", or the weekday ("Thu") | blue date pill |
| later | the date ("Oct 5"), or "tomorrow" on a Sunday | blue date pill |
| any tab | "moved Tue" / "moved yesterday", on a task you moved, once the day you moved it has passed | neutral pill |
| from earlier notes | none | — |

No marker is ever inferred from wording such as "someday" or "next week".

### Where tasks go

- **A task with a date** goes by that date:
  - today or earlier: today;
  - after today through this Sunday: this week;
  - after this Sunday: later.
  On Sunday, tomorrow is next week, so it waits in later, labeled "tomorrow", and moves to today on Monday.
- **A task with no date** goes to today on the day it was said, and stays there with its age label until done or moved (D1).
- **A task you move** goes where you put it and stays there, indefinitely, until you move it again. That holds after its week ends and after it would otherwise have a date. Once the day you moved it has passed, it shows "moved Tue".
- **Earlier notes:** open to-dos from notes captured before the running list started for your account sit in later's "from earlier notes" group. Moving one promotes it into the chosen tab for good.
- **Nothing moves because it is old.**

### Completing and reopening

- **Tap the circle.** The row moves to "done today" at the foot of the tab it was in, struck through, with **Undo**. Undo, or tapping again, puts it back exactly where it was, including a moved tab or the earlier-notes group.
- **Swipe right** at least 76 points: a blue "✓ Done" appears behind the row and it completes. On a done row, a grey "↺ Reopen" appears instead. The threshold and spring are today's `SwipeCompleteRow`.
- Done rows leave at local midnight. They stay completed in their note and in agent output. Nothing is deleted.

### Moving and opening

- **••• or press and hold** opens a native action sheet:
  - title: the task text;
  - message: "From your drive home note, Mon 6:10 PM.";
  - buttons: the two other destinations (Move to today, Move to this week, Move to later), then Open the note, then Cancel.
- **The source label** opens that note's existing detail sheet, unchanged.
- **notes** shows the Notes screen: the existing cards, newest first, with "‹ Back" returning to the same tab. The capture tray and its lifecycle keep running underneath; Notes is shown within Home rather than leaving it. Pull to refresh works there too.

### Editing a note's to-dos

Note detail is unchanged. Tapping **Edit** shows the existing editor, with title, summary, most important, to-dos and transcript. Only the to-dos field changes:

- **One row per to-do,** in the order said, inside the same bordered field.
  - Each row is a single text field that keeps that task's identity, so a renamed to-do is the same task, with its completion, move and place kept.
  - A completed to-do shows a small "done" tag.
- **Remove:** each row has a ⊖ button (44 points), labeled "Remove to-do: {text}". On Save, that task leaves the list. A row left empty is also removed.
- **Add:** "+ Add a to-do" appends an empty row, "New to-do". On Save it becomes a new task in that note; with no date, it goes to today.
- **Return** moves to the next row; on the last row it adds a new one. There is no reordering in this slice.
- **Save** applies every change or none.
  - If the note changed since editing began, nothing is saved and the existing error area shows: "This note changed since you started editing. Nothing was saved. Close it and edit again."
  - **Cancel** discards the edits.
- Title, summary, most important and transcript editing behave as today.

### Older app versions

The server protects task identity for people still on older builds.

- **What keeps working:**
  - recording;
  - reading notes and tasks;
  - **completing a to-do** only when its text is unambiguous both now and in the note's history. It must match exactly one current to-do, and no removed to-do in that note may ever have had the same words;
  - **editing a note's title, summary or transcript** only when the to-do list sent with the edit exactly matches the note's current to-dos.
- **What is refused:**
  - changing to-dos in any way (adding, renaming, removing or reordering);
  - completing a to-do whose text is ambiguous. That includes a to-do that was removed and replaced with the same words, even if only one current row now has that text;
  - any edit that carries a to-do list differing from the current one. A title edit sent with a stale cached list is refused in full.
  The server returns: "Update Throughline to change to-dos in this note. Nothing was saved." The whole request is refused, never partly applied.
- Old apps show the server's message as their error text; nothing about the old apps' own screens changes.

### When a note lands

- The capture tray behaves exactly as shipped.
- The note's own to-dos are added. Nothing already on the list moves, disappears or changes state.
- Each tab that received tasks shows `+n`; new rows fade in once and carry the blue dot.

### The day boundary

- The day turns at local midnight:
  - while the app is open, at midnight itself;
  - otherwise when the app returns to the foreground, after a fetch, or when the clock or timezone changes.
  There is no background job.
- At the turn:
  - "done today" empties;
  - open tasks whose day has passed stay in today with "from …";
  - dated tasks now due move into today;
  - moved tasks stay where they are.

### Unchanged interactions

- Tap the circle; swipe right to complete or reopen.
- Pull to refresh, with "syncing" under the recorder.
- Note cards keep "Read full note", the trash button with "Discard this memory?", their to-do circles and the 1–5 grade. Ticking a to-do on a card changes the same task in the list.
- Note detail and grading; editing, apart from the to-dos rows above.
- The capture tray, recorder, recovery states and the shipped AI controls.

### Removed

- The "unfinished from last night" block and the string itself.
- The separate "most important" list on Home.
- Note cards on Home; they move to the Notes screen.

### Exact copy

| Where | Copy |
| --- | --- |
| Tabs | today · this week · later |
| Top bar button | notes |
| Today header | today / Tuesday, September 29 (the full local date) |
| This week header | through sunday / Wed to Sun (Sunday: Sunday) |
| Later header | after this week / Later |
| Group labels | open · done today · from earlier notes |
| Earlier notes, collapsed | To-dos from notes before this update · Show |
| Earlier notes, expanded | Hide |
| Done row action | Undo |
| Swipe reveals | ✓ Done · ↺ Reopen |
| Row menu message | From your {note title} note, {day} {time}. |
| Row menu buttons | Move to today · Move to this week · Move to later · Open the note · Cancel |
| Markers | today · from yesterday · from {weekday or date} · tomorrow · {weekday} · {date} · moved {yesterday, weekday or date} |
| Empty today | Nothing for today yet. / Say what's on your mind. Tasks you mention land here, in this week, or later. |
| Empty this week | Nothing dated for this week. / Tasks you give a day this week, like "by Friday", land here. |
| Empty this week, Sunday | Nothing else this week. / Tomorrow's tasks wait in later until Monday. |
| Empty later | Nothing for later. / Tasks with a date after this week, or ones you move here, show up here. |
| Offline line | Offline. Changes save when you're connected. |
| Notes screen | Notes · ‹ Back |
| Editor, to-dos | to-dos · New to-do · + Add a to-do · done · Remove to-do: {text} |
| Editor, conflict | This note changed since you started editing. Nothing was saved. Close it and edit again. |
| Old app, refused to-do change | Update Throughline to change to-dos in this note. Nothing was saved. |
| VoiceOver, tab | Today, 5 open tasks. / Today, 5 open tasks, 2 new. |
| VoiceOver, row | {task}. {marker}. From {note title}, {time}. |
| VoiceOver, row default action | Complete (done rows: Reopen) |
| VoiceOver, row custom actions | Move to {each other tab} · Open the note |
| VoiceOver, after completing | Done. Undo available. |

- First use: before a person has any notes, the today tab shows the accepted empty Home content ("Say today's to-dos." with the preview rows), and the recorder title follows the shipped AI control.
- Motion:
  - completing moves the row into done today in about 0.2 seconds;
  - new rows fade in once;
  - `+n` fades after about three seconds.
  With Reduce Motion on, nothing animates; changes appear at once.
- Haptics/audio: the same as today's completion. None is added.

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | Cached list shows at once; "syncing" under the recorder while fetching. | `today` screens |
| Empty | First use keeps the accepted empty Home; an empty tab shows its line, including the Sunday line for this week. | `empty`, `empty-later`, `sunday-week` screens |
| Error/retry | A failed refresh keeps the cached list with the existing quiet line. A task change that is refused or fails permanently removes only that pending change; the row returns to its saved state with a quiet note. An editor conflict saves nothing and shows the conflict line. | `editor-conflict` screen; engineering tests |
| Offline/degraded | Offline line; completing and moving save on the phone first and send when connected; the tray shows its own offline rows. | `offline` screen |
| Permission denied | Recorder and AI states as shipped. | capture and AI-control handoffs |
| Long/localized content | Task text, meta, menu titles and editor rows wrap; German-length strings wrap, not truncate. | `ax` screens |
| Light and dark appearance | Existing tokens only; blue on the selected tab, `+n`, date pills, new dots, Undo, links, Save and Add. | dark screens |
| Dynamic Type | Semantic styles; at accessibility sizes, rows and meta wrap and the tab bar scrolls horizontally rather than truncating. | `ax` screens |
| VoiceOver/focus order | Tab bar first (tabs with counts), then the header, then rows.<br>Each row is one element: its label reads task, marker and source. Its default action completes (done rows reopen), and custom actions move or open the note. The circle, source label and ••• are not separate focus stops, so nothing is read twice.<br>In the editor, each to-do field and its remove button are separate controls. | VoiceOver pass on device |
| Reduce Motion | No animation; the swipe still reveals its action. | Reduce Motion pass on device |

## Production mapping

- Existing components to reuse: `SwipeCompleteRow` behavior, `CapturedCard`, the note detail sheet and `NoteEditForm` (all but its to-dos field), `Eyebrow`, `Pill`, the `Theme` tokens, native sheets, the capture tray and `RecordButton` with the shipped AI title logic.
- Files likely affected (Codex owns the final list):
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift):
    - the tabbed running list;
    - the notes button and a Notes presentation kept within Home;
    - `NoteEditForm`'s to-dos field replaced by identity-preserving rows;
    - the card and detail bindings made occurrence-aware.
  - New, names suggested: `Views/RunningListView.swift`, `Views/TaskRow.swift`, `Views/NotesView.swift`, `Views/TodoRowsEditor.swift`, and tests under `ios/Tests/`.
  - [ThroughlineNote.swift](../../ios/Throughline/Models/ThroughlineNote.swift): stable occurrence identity (never generated at decoding); the editor draft carrying rows with identities instead of one string.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) and [api/index.ts](../../supabase/functions/api/index.ts): occurrence-level complete, reopen, move and edit with expected versions; the old-app compatibility rules above.
- New assets/tokens: none. SF Symbols `checkmark`, `arrow.uturn.left`, `ellipsis` and `minus.circle`.

### List rules

Codex owns the mechanics. Revision 2 settles the visible behavior per Codex's feasibility review.

1. **Occurrence identity.** Each task is one occurrence with a stable server identity. Rows, completion, reopening, moves and edits target it, never text. Two entries in a note's to-dos are two tasks even when the words match.
2. **Placement.** Automatic placement is derived from valid dates (`due` first, then `for_date`) and the local date and timezone. A person's move is stored as an explicit destination that overrides it, with the move's local date kept for its label and order.
3. **No date said (D1).** Today, from the local day it was captured, with an age label; that day is kept even across travel.
4. **No inferred timeframes.** "Someday", "next week" or "this week" without a date is undated. There is no extraction, prompt or model change.
5. **Tomorrow.** It comes from `todos` only; `tomorrow_todos` is never a second source. After today through Sunday it is this week; on Sunday, tomorrow is later until Monday.
6. **Done.** Completion is per occurrence with its instant. "done today" shows occurrences completed within the current local day, in the tab they were completed from. Undo restores the prior placement, including a move or the earlier-notes group.
7. **Moves** persist indefinitely until moved again. Moving an earlier-notes task promotes it permanently; completing and undoing does not.
8. **Earlier notes.** One cutover per account, set when the list first starts. It is classified by original capture time. Unknown historical completion is never shown as "done today" or "unfinished".
9. **Edits** use the row editor above, with an expected version. Renames keep identity; removals leave the list for good; additions are new occurrences created now. A conflict applies nothing.
10. **Appending.** A new note only adds its own occurrences.
11. **Order:**
    - today: by the task's date or day (moved tasks by the day moved), oldest first, then capture time and order said;
    - this week: dated by date, then moved tasks by the day moved;
    - later: dated by date, then moved tasks newest first;
    - earlier notes: newest note first.
    Ties break by capture time, order said, then identity.
12. **Counts:** open tasks in the tab after any pending local changes. Done today and the earlier-notes group are excluded.

- Invariants Codex must preserve:
  - the capture store, queue, receipts and owner boundaries;
  - the shipped AI controls;
  - no text-based merging and no inferred timeframes;
  - nothing deleted by the day boundary;
  - never a partial edit;
  - no task text or identifiers in analytics.
- Deliberately open implementation choices: storage shapes, the offline task outbox mechanics, the midnight timer, and how Notes is presented while keeping Home's lifecycle.

## Feasibility review (Codex, 2026-09-30)

Codex's [feasibility review](../evidence/2026-09-30-running-list-feasibility.md) answered F1–F7. The visible consequences are folded in above:

- **F1:** stable server identity, versions and old-app rules (RL1).
- **F2:** no inferred timeframes.
- **F3:** a durable, owner-bound local change queue, which the offline line relies on.
- **F4:** `todos` only.
- **F5:** a per-account cutover by capture time.
- **F6:** civil-date calendar handling, including daylight saving and travel.
- **F7:** the metric defined in [metrics.md](../../product/metrics.md#seven-day-extracted-task-value), reported only once instrumented and reconciled.

| Item | Resolution in revision 2 |
| --- | --- |
| RL1 P1 | Mike's Continue applied: see [Older app versions](#older-app-versions). Not every old edit is compatible; nothing is partly applied. |
| RL2 P1 | [Editing a note's to-dos](#editing-a-notes-to-dos): the smallest change is identity rows in the existing editor. Note detail is unchanged; everything saves or nothing does. |
| RL3 P2 | [Where tasks go](#where-tasks-go) and acceptance check 8: Sunday's tomorrow waits in later. |
| RL4 P2 | Stored move destination, "moved" label, completion and Undo keep placement, earlier-notes promotion only by moving. |
| RL5 P2 | No inferred markers; the later copy and prototype data are corrected. |
| RL6 P2 | Midnight while open plus on return; Reduce Motion means no animation; one VoiceOver element per row. |
| RL7 P2 | The recorder title follows the shipped AI control; Notes keeps Home's capture lifecycle. |

## Acceptance

- Behavioral checks:
  1. Launch opens on today with the recorder visible without scrolling.
  2. Record "call Marcus back today, send the invoice by Friday, look at running shoes someday". Rows land in today (Marcus), this week (invoice, Fri) and today (shoes, no date). `+n` appears on today and this week. Nothing else moves.
  3. Repeat "call the bank" in a second note: a second row with its own source. Completing one leaves the other open.
  4. Tap a circle: done today with Undo; Undo restores. Swipe 76 points or more does the same; a shorter swipe does nothing; swiping a done row reopens it.
  5. ••• and press-and-hold open the same menu. Move to this week, then roll past Sunday into Monday: the task stays in this week with "moved Tue". Complete it and Undo: it returns to this week.
  6. Tap a source label: the right note opens.
  7. notes: the existing cards work: discard, grade and to-do toggles. Back returns to the same tab, and a capture saving in the tray keeps going.
  8. Sunday: a task dated Monday shows in later as "tomorrow", and this week shows the Sunday line if nothing was moved there. On Monday it is in today.
  9. Midnight while the app is open: done today empties at midnight. Open tasks stay with "from yesterday"; dated tasks due today move in; moved tasks stay.
  10. Earlier notes: after updating, old open to-dos appear only under "from earlier notes", collapsed, and never as "unfinished". Moving one promotes it; completing and undoing leaves it in the group. The string "unfinished from last night" no longer exists.
  11. Edit a note:
      - rename a to-do: same row, same place, same completion;
      - remove one: it leaves the list;
      - add one: it appears in today;
      - edit from a second device first, then save: the conflict line appears and nothing changes.
  12. Offline: complete and move tasks, then reconnect. Each change saves once. A refused change returns only that row to its saved state.
  13. Old app:
      - recording and reading work;
      - completing a to-do whose text is unambiguous now and in the note's history works;
      - completing a to-do that was removed and replaced with the same words is refused;
      - a title edit sent with an outdated to-do list is refused in full;
      - changing to-dos is refused.
      Each refusal shows "Update Throughline to change to-dos in this note. Nothing was saved." and changes nothing.
  14. Timezone travel and both daylight-saving nights: labels stay true.
  15. Reduce Motion: nothing animates. VoiceOver: each row is read once, with Complete, Move and Open the note as its actions.
- Visual comparison views and sizes: compare simulator captures with the reference images below. All are synthetic renders of the frozen prototype. The manifest is [SHA256SUMS.txt](assets/2026-09-29-home-running-list/SHA256SUMS.txt).

| State | Light, 390 × 844 | Dark, 390 × 844 | Other sizes |
| --- | --- | --- | --- |
| Today | [image](assets/2026-09-29-home-running-list/screens/today-light-390x844.png) | [image](assets/2026-09-29-home-running-list/screens/today-dark-390x844.png) | [375 × 667](assets/2026-09-29-home-running-list/screens/today-light-375x667.png), [430 × 932](assets/2026-09-29-home-running-list/screens/today-light-430x932.png) |
| A note just landed | [image](assets/2026-09-29-home-running-list/screens/landed-light-390x844.png) | | |
| Recording while a note structures | [image](assets/2026-09-29-home-running-list/screens/recording-light-390x844.png) | | |
| This week | [image](assets/2026-09-29-home-running-list/screens/week-light-390x844.png) | | |
| Later | [image](assets/2026-09-29-home-running-list/screens/later-light-390x844.png) | | |
| From earlier notes, expanded | [image](assets/2026-09-29-home-running-list/screens/earlier-light-390x844.png) | | |
| Done today with Undo | [image](assets/2026-09-29-home-running-list/screens/done-light-390x844.png) | [image](assets/2026-09-29-home-running-list/screens/done-dark-390x844.png) | |
| Swipe to complete | [image](assets/2026-09-29-home-running-list/screens/swipe-light-390x844.png) | | |
| Row menu | [image](assets/2026-09-29-home-running-list/screens/menu-light-390x844.png) | [image](assets/2026-09-29-home-running-list/screens/menu-dark-390x844.png) | |
| Source note opened | [image](assets/2026-09-29-home-running-list/screens/source-light-390x844.png) | | |
| Notes screen | [image](assets/2026-09-29-home-running-list/screens/notes-light-390x844.png) | [image](assets/2026-09-29-home-running-list/screens/notes-dark-390x844.png) | |
| Discard a note | [image](assets/2026-09-29-home-running-list/screens/discard-light-390x844.png) | | |
| Empty today | [image](assets/2026-09-29-home-running-list/screens/empty-light-390x844.png) | | |
| Empty later | [image](assets/2026-09-29-home-running-list/screens/empty-later-light-390x844.png) | | |
| Offline | [image](assets/2026-09-29-home-running-list/screens/offline-light-390x844.png) | | |
| Next morning | [image](assets/2026-09-29-home-running-list/screens/morning-light-390x844.png) | | |
| Sunday: tomorrow in later | [image](assets/2026-09-29-home-running-list/screens/sunday-light-390x844.png) | | |
| Sunday: this week | [image](assets/2026-09-29-home-running-list/screens/sunday-week-light-390x844.png) | | |
| A moved task after the week ends | [image](assets/2026-09-29-home-running-list/screens/moved-light-390x844.png) | | |
| Editing to-dos | [image](assets/2026-09-29-home-running-list/screens/editor-light-390x844.png) | [image](assets/2026-09-29-home-running-list/screens/editor-dark-390x844.png) | |
| Editor conflict | [image](assets/2026-09-29-home-running-list/screens/editor-conflict-light-390x844.png) | | |
| Same words, two notes | [image](assets/2026-09-29-home-running-list/screens/repeat-light-390x844.png) | | |
| Largest text | [image](assets/2026-09-29-home-running-list/screens/ax-light-390x844.png) | | [375 × 667](assets/2026-09-29-home-running-list/screens/ax-light-375x667.png) |

  The images are browser renders. The status bar, system font, native sheets and the note detail sheet will differ on device. The detail and editor sheets in the prototype stand in for the existing ones; only the to-dos rows are new. The recorder in the references shows AI already on.
- Automated tests:
  - placement across dates, the Sunday/Monday boundary, month and leap-day boundaries, both daylight-saving transitions and timezone travel;
  - repeated wording as separate occurrences;
  - completion, Undo and moves across refresh, relaunch and week boundaries;
  - earlier-notes cutover and promotion;
  - editor renames, removals, additions and conflicts;
  - the offline outbox with ambiguous responses;
  - old-app compatibility, both accepted and refused;
  - existing suites and the capture store and queue tests.
- Build commands: `npm run ios:build` and `npm run ios:build:device`, from an isolated copy of the tree.
- Physical-device checks: checks 1–9, 11, 12 and 15; the largest text size; a swipe on a long, wrapping row.

## Measurement and safety

- Primary metric: new activated users who revisit or complete an extracted task within seven days, as defined by Codex in [metrics.md](../../product/metrics.md#seven-day-extracted-task-value). It is reported only once instrumented and reconciled. Internal TestFlight does not establish public lift.
- Guardrails: no capture loss; no lost or duplicated tasks; no cross-owner writes; no invented task meaning; task extraction correction rate.
- Suggested content-free events for Codex and Mike to accept or change: `tab_selected {tab}`, `task_completed {tab, carried, via: tap | swipe | voiceover}`, `task_reopened`, `task_moved {from, to}`, `task_edit_saved {renamed, removed, added}` as counts, `notes_view_opened`, `earlier_notes_expanded`. No task text or identifiers.
- Privacy/data boundary: no new processor or destination; task text stays in the note.
- Non-goals:
  - reminders, notifications and calendar sync;
  - drag to reorder, sub-tasks, and categories or search (the next spec, after internal delivery, followed by Private Evaluation);
  - agent write tools;
  - extraction prompt, schema or model changes;
  - the note-detail redesign;
  - Private Evaluation (after categories and search);
  - AI-control changes;
  - recorder or tray changes;
  - background recording;
  - App Store changes.
- Authority class: product and design direction, selected by Mike, with build entry approved on 2026-09-30.
- Rollback: a compatible build that restores the previous Home presentation, while keeping capture storage and task identities and history. It never restores the unsafe text-based task changes.

## Codex handoff

- Exact handoff revision: revision 2, uncommitted in the local `throughline-local` checkout on `codex/running-list` at `f6983ed`. Identity: [SHA256SUMS.txt](assets/2026-09-29-home-running-list/SHA256SUMS.txt) for the prototype and images, and this document's SHA-256 in [Claude's resolution receipt](../evidence/2026-09-30-claude-running-list-resolution.md).
- Codex-owned paths: production app and backend files, tests, canonical documents and integration. Claude owns this document, its assets, `mockup/running-list/` and its resolution receipt.
- Required evidence manifest: source revision; tests; simulator captures for every row of the visual matrix; device results; review receipts; rollback target.
- Readiness: `handoff_ready` since Codex's re-review passed on 2026-09-30. No design findings are unresolved.
- Next gate: Codex builds and verifies, then requests Claude's implementation review of exact source and simulator captures. Codex then delivers to internal TestFlight under its standing authority.

## Mutual review receipts

- Codex feasibility reviewer and date: Codex, 2026-09-30.
- Exact selected handoff revision reviewed: revision 1, `57ff7e1dc4ba12380b0714bd0c389baba8a3cfde95b1c57c6248c2d1fe11c881`, with asset manifest `bc7fdccaa2bbad07b92f7cb4da0421787e118b6ab79d9880c7ee606b273e43ce`, at source `3d5c3ac`.
- Technical findings and resolution: feasible with RL1–RL7; resolved in revision 2 above; receipt in [Codex's feasibility review](../evidence/2026-09-30-running-list-feasibility.md).
- Codex re-review of revision 2: Codex, 2026-09-30.
  - Text at `eb38d0b8086408bf9a5bb8bef81033243975d1e3dd3264684b4e9318b29b5554`: the design fixes pass. Codex asked for two precise old-app conditions and two record corrections.
  - Final text at `85260ecfc0670d9d…`: passed. All 32 manifest entries passed, and Codex inspected the editor, Sunday, moved-week and largest-text images. No material findings remain.
  - The note-sheet reference image was corrected after that check; see the stage note.
- Claude implementation reviewer and date: pending; follows implementation.
- Exact implementation revision and visual/behavior evidence reviewed: pending.
- Design, interaction, accessibility, and failure-state findings and resolution: pending.
- Remaining unverified checks: implementation, the re-verification of one corrected image, and every device check.
- Next owner and one next action: Codex builds Running List — Today, This Week, Later from this handoff.

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
