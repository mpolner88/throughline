# Throughline Running List Design

**Status:** Approved to build, 2026-09-09. Mike accepted the defaults on every open question in §13 and started phase 0 of the companion plan. Decision-log entries drafted in the plan move into `decision-log.md` when the slice ships (plan phase 6).

**Source:** Mike's raw notes, 2026-09-08. Grounded against the code on `main` at `fd85d01` (iOS `1.0.5`, Supabase Edge Function `api`, `core/extraction-pipeline.mjs`, `evals/`).

**Prototype:** `mockup/list-redesign/index.html` (also published as an artifact). Every numbered section below that changes UI has a matching annotation in the prototype.

**Companion plan:** `docs/superpowers/plans/2026-09-09-running-list-1-implementation.md`.

---

## 1. Summary

The home screen becomes one running task list, split into three tabs: **today**, **this week**, **later**. The app opens on today. Every voice note adds its tasks to that list. Nothing on screen is replaced when you record again. Items are placed into a tab automatically from what you said, sorted in a fixed order, and cleared with one tap into a done group that empties itself overnight.

This replaces three things that exist today:

- The "unfinished from last night" block, which is a real bug and not just a copy problem (§2.1).
- The "most important" list on the home screen and the overlapping "most important" plus "to-dos" sections in the note detail (§2.2, §6).
- The one-word "saved" label under the record button (§2.3, §7).

It also answers the direct question in the notes: the extraction training loop does **not** work end to end today. The eval harness runs, but no real user signal reaches it (§2.5, §10).

### What does not change

- Recording is still the primary action. The record button stays fixed at the bottom in every state.
- The note is still the user-facing object and the unit of storage. Tasks are derived from notes and always point back to one.
- MCP stays read-only for now. Completion state is already written through the app's own API and is exposed to agents as it is today.
- No new integrations, no calendar sync, no reminders, no notifications.

---

## 2. Findings from the audit

Each of Mike's six notes, what the code actually does, and why it reads the way it does.

### 2.1 "Unfinished from last night" looks like a bug because it is one

`AppState.swift:35-37`:

```swift
var carriedForwardItems: [String] {
    notes.flatMap(\.tomorrowTodos)
}
```

That is the entire rule. Four consequences:

1. **It fires seconds after you record.** Say "tomorrow I'll call the bank" at 9am and, when processing finishes, that line appears at the top of the screen under **UNFINISHED FROM LAST NIGHT**. The note is from this morning and the task is for tomorrow.
2. **It never expires.** There is no date check. A "tomorrow" item from three weeks ago is still "unfinished from last night" today. Notes are cached in `UserDefaults` indefinitely, so it survives restarts.
3. **It ignores completion.** Ticking the same item in "most important" updates `action_items` and `todos` on the server (`supabase/functions/api/index.ts:1625-1660`) but never touches `tomorrow_todos`. A done item stays "unfinished".
4. **It duplicates the list below it.** `displayMostImportant` folds `tomorrowTodos` in (`ThroughlineNote.swift:287`), so the same sentence renders twice on one screen.

The spec (`throughline-product-spec-v0.md` §8) said: label "Carried forward · last night", shown only when `tomorrow_todos` exist **from the previous day's recording**, visible through day N+1, cleared at day N+2. The implementation dropped the date gate and the label. The decision-log entry for carry-forward (2026-04-30) already lists "carry-forward expands to include unfinished priorities" and "multi-day skips" as revisit triggers. This spec is that revisit.

### 2.2 "Most important" and "to-dos" overlap by construction

`most_important` is not a separate thing the model finds. After extraction, `deriveMostImportant` (`core/extraction-pipeline.mjs:221-242`, duplicated in `index.ts:1550-1571`) builds it as a priority-ordered union, capped at five:

model `most_important` → `priorities` → todos with `priority == "high"` → `tomorrow_todos` → `intentions` → `accomplishments` → **all remaining todo texts** → fallback to `summary`.

So the "most important" list is usually the to-do list plus a few non-tasks, and the "to-dos" section under it repeats the to-dos. Things you already did (`accomplishments`) can land in a checkbox list. On the home screen, `mostImportantItems` (`HomeView.swift:282-312`) walks notes newest-first and hard-stops at six items, so a low-priority item from the newest note outranks a high-priority one from the morning, and a second note can push the whole first note off the list. That is the "I'm not sure of the difference" feeling, and it is correct.

Also: the model prompt never says when to set `todo.priority`. The scorer weights it and the merge depends on it, but the model is never told the rule.

### 2.3 The saved confirmation is both too weak and too long

`recorderStatusText` (`HomeView.swift:250-280`) is a priority chain. `didJustSave` is set to true immediately after upload, but on the very next line `isProcessing = true` masks it with "translating". "saved" becomes visible only after polling settles (up to ~38 s), as a 14 px secondary-colour word with no animation. It then stays on screen until the next recording starts, because nothing clears the flag on a timer. The moment of saving has no confirmation, and the confirmation that eventually appears never leaves.

### 2.4 A second note appends cards, not tasks

Each recording is its own `CapturedCard`, newest first. There is no merged task list on the client or the server. `list_open_todos` (`backend/memory-tools.mjs:306-368`) concatenates todos per recording with dedup scoped **inside** each recording, so a task spoken on three days appears three times to the agent. There is no sort on `todos` anywhere. Nothing in the app is date-aware beyond the `tomorrow` horizon.

### 2.5 The extraction training loop: the harness works, the loop does not close

What works: `npm run eval:run` and `eval:score` against 30 hand-labelled fixtures, three profiles (full, action, memory), a critical-hallucination check. That is a solid measuring instrument.

What is broken, in the order signal would have to flow:

| Link | State | Evidence |
|---|---|---|
| App captures a correction the eval can use | **Absent.** The card grader sends a 1–5 score only. The detail form can send issue tags and free text, but never an `expected` extraction. | `HomeView.swift:856-884`, `455-484`; `index.ts:1404-1415` (`eval_candidate` requires `expected`) |
| Note edits captured as corrections | **Absent.** `PATCH /recordings/:id` overwrites `structured_note` in place. No before/after, no feedback row. | `index.ts:1662-1713` |
| Production feedback exported to the eval workspace | **Absent.** `import-feedback-fixtures.mjs` reads `backend/data/feedback` (local file store). No script reads `throughline_feedback` from Supabase. | `evals/import-feedback-fixtures.mjs:8`, `scripts/` |
| Feedback → fixtures | Script exists, **has never had input**, and skips rows without `expected`. | `import-feedback-fixtures.mjs:59-79` |
| Eval gate on deploy | **Not enforced.** No CI. `eval:check` is documented as a gate and never run automatically. | no `.github/`, `evals/README.md:93` |
| Eval scores what production runs | **No.** Production inlines its own copy of the prompt (`index.ts:91-183`) which is missing the Output JSON block present in `evals/prompts/extract-note-v0.md`. | prompt drift |
| Eval scores `most_important` / `action_items` | **No.** Not in `FIELD_WEIGHTS`. The field the UI leads with is unmeasured. | `score-extraction.mjs:9-23` |
| Result feeds prompt or model | **Manual by design** (decision 2026-05-02). Fine, but there is no reviewed queue to be manual about. | `decision-log.md:441-449` |

Last eval report: 2026-05-02. Production model `openai/gpt-oss-120b` scored 78.6 full / 86.1 action against a pass bar of 90 with zero criticals. It is shipping as a known eval failure.

---

## 3. The list model

### 3.1 One item type

```ts
interface Task {
  id: string                 // stable slug of normalised text, as action_items today
  text: string               // imperative, as spoken
  recording_id: string       // the note it came from (latest restatement wins, see §4)
  spoken_index: number       // position within that note's todos
  due: string | null         // ISO date, user local
  timeframe: "today" | "this_week" | "later" | null   // NEW: what the user said, when no date
  priority: "high" | null    // collapse medium/low; only "high" changes anything
  status: "open" | "done"
  completed_at: string | null
  first_seen_local_date: string   // for carry-over markers
}
```

`bucket` is **not stored**. It is derived at read time from `due`, `timeframe`, and the user's local date, so an item moves from this week to today overnight without a write.

### 3.2 Bucket derivation (deterministic, in code, not in the model)

Given user local date `D`, week = Monday..Sunday containing `D`:

| Condition | Bucket |
|---|---|
| `status == done` | stays in the bucket it was completed in until the next local day boundary, then leaves the list |
| `due != null && due <= D` | today (with a carried marker when `due < D`) |
| `due != null && due <= end of week` | this week |
| `due != null && due > end of week` | later |
| `due == null && timeframe == today` | today |
| `due == null && timeframe == this_week` | this week |
| `due == null` otherwise | later |

Cues the extractor maps to `timeframe` when no date is resolvable: "today", "this morning", "before lunch", "tonight" → `today`; "this week", "by the end of the week", "in the next few days" → `this_week`; "sometime", "eventually", "at some point", "next week", "next month" → `later`. `due` still wins when a resolvable date is present, and the existing `normalizeDateValue` rules for "tomorrow" and weekday names stay.

Week boundary is Monday–Sunday in the user's timezone. On Sunday the this-week tab is naturally short. See open question Q4.

### 3.3 Extraction changes

- Add `timeframe` to the todo shape in `core/extraction-pipeline.mjs`, the eval prompt, the production prompt, and the Swift `Todo` model. Prompt rule: *"Set `timeframe` only from the user's words. Never infer urgency."*
- Add a prompt rule for `priority`: *"Set `priority: "high"` only when the user marks it (first, most important, priority, must, before anything else). Otherwise null."* Medium and low are dropped from the contract.
- Keep `tomorrow_todos` and `most_important` in the output for MCP compatibility. Both become derived-only (§6). The prompt stops asking the model for `most_important` as a ranked list of actions.
- Production must import the prompt and `normalizeExtraction` from `core/` (or a build step copies the same file) so the eval scores what ships. This is a precondition for §10, not a nice-to-have.

### 3.4 Where the running list lives

Three options were weighed.

| Option | Description | Cost | Risk |
|---|---|---|---|
| A. Client-derived view | iOS builds the list from cached recordings on every render. No schema change. | Lowest | Same logic must be duplicated in `memory-tools` for agents. Dedup across notes runs on the phone. |
| B. Server-derived view | Edge Function adds `GET /tasks` that merges, dedups, and buckets across the user's recordings. iOS renders what it gets. MCP `list_open_todos` calls the same function. | Medium | Merge rules live in one place. Still no new table. |
| **C. Materialised task table** | New `throughline_tasks` rows written at extraction and edit time. | Highest | Migration, backfill, two sources of truth during transition. |

**Recommendation: B.** One implementation of merge/dedup/bucket, shared by the app and the agent, no migration. Completion already writes to `action_items` inside the recording, so B keeps that. Move to C only if per-task history or cross-device edit conflicts become real problems.

---

## 4. Merging notes into one list

### 4.1 Rules

1. **A new note never replaces the list.** Its tasks are inserted; existing rows are untouched unless matched.
2. **Match by normalised text** (lowercase, strip punctuation, collapse whitespace), the same key `action_items` already uses. Exact match only in v1. Fuzzy matching is Q2.
3. **A restatement is an update.** If a matched task arrives with a new `due` or `timeframe`, the newer value wins and `recording_id` moves to the newer note. "Actually, the dentist can wait until next week" re-buckets the dentist item; it does not create a second one.
4. **A restatement never un-completes.** If the matched task is done, the new mention is dropped and the done item stays done. (Q3 covers whether a strong restatement should reopen it.)

### 4.2 Sort order, fixed per tab

| Tab | Order |
|---|---|
| today | carried-over (due < D) first, then `priority == high`, then `spoken_index` within the newest note first |
| this week | `due` ascending, then priority, then spoken order |
| later | newest `recording_id` first, then spoken order |

No manual reordering in v1. If people reach for it, that is a signal to add drag-to-reorder as a stored `manual_rank`.

### 4.3 Provenance

Every row shows a quiet source label: the note's label and time ("morning walk · 7:42 am"). Tapping the label opens the note detail, which is where the transcript, summary, and grading already live.

---

## 5. Clearing and day rollover

- Tap the circle. The row moves to a **done** group at the foot of the same tab, struck through, with an inline **undo**. Swipe-to-complete is kept as a secondary gesture.
- Done items leave the list at the next local-day boundary. They remain in the note, in `action_items` with `status: completed`, and in MCP output. Nothing is deleted.
- Open items in today that are not cleared by the day boundary stay in today with a **from yesterday** marker (or "from Mon" after more than one day). They are not moved to a separate block.
- This-week items whose `due` becomes `D` move into today on their own.
- A task older than 7 days that is still open in today drops to later with its marker. This stops today filling with stale carry-over. (Q5.)

The day boundary is the user's local midnight, evaluated when the app comes to the foreground and when the list is fetched. There is no background job.

---

## 6. Most important vs to-dos: resolution

Two lists that share lines cannot both be right. The proposal separates them by kind, not by rank.

- **The home list is tasks only.** Priority is a property of a task: it changes ordering and shows a small "priority" mark. There is no second "most important" list on the home screen.
- **In the note detail, "most important" is renamed "worth remembering"** and holds only non-task takeaways: decisions, constraints (`intentions`), context the agent should keep. To-dos are excluded from it at derivation time. Accomplishments get their own existing section.
- **For the agent,** `most_important` stays in the note payload but is derived as `priorities` + `intentions` + decisions, with todos excluded. `action_items` remains the agent's task surface and gains `bucket` and `timeframe`.

Alternative considered: keep "most important" on home as a pinned top section limited to `priority == high`. Rejected because it recreates two lists and the eyebrow copy would still read as a category rather than a rank.

---

## 7. Saved confirmation

Mike's note reads "more hold". Interpreted as: the confirmation should be bolder and should hold, rather than flash. If "hold" was a typo for "bold", the proposal still covers it.

Sequence after stop:

| Phase | Trigger | Status line | Visual |
|---|---|---|---|
| finishing | stop tapped | "finishing" | as today |
| saving | upload in flight | "saving" | as today |
| **saved** | upload 2xx | **"saved"**, primary colour, weight 500, filled blue tick | a 2 px bar under the status drains over 2.6 s so the hold is visible; one light haptic |
| sorting | processing in flight | "sorting into today, this week, later" | secondary colour |
| landed | processed | "3 added" | each tab that received items shows a **+n** pill for ~3 s; new rows fade in |
| idle | 1.8 s later | "tap to record" | |

If processing fails, the saved state still happened (the audio and transcript are safe); the failure message replaces "sorting" and the note card shows its existing processing-status row.

Rationale: the thing the user is anxious about at stop time is "did that go through". Confirm it at the moment it is true, hold it long enough to read, then hand off to the list itself as the second, richer confirmation.

---

## 8. Home screen structure

```
top bar        wordmark · [notes →] · gear
tabs           today (n)   this week (n)   later (n)
content        date heading (today) / "Through Sunday" (this week) / "No date yet" (later)
               task rows
               done group (per tab)
bottom         record button · status line · hold bar
```

- The app opens on today. The selected tab is not persisted across launches.
- The recording cards move behind a **notes →** affordance in the top bar (next to the gear). The chronological card list, note detail, edit form, and grading all continue to live there unchanged. Q1 asks whether this is the right home for them.
- Empty states per tab: today "Nothing for today yet. Say what is on your mind." · this week "Nothing dated for this week." · later "Nothing parked for later." No illustration, no coaching copy.
- The four canonical home states in the v0 spec (empty, empty + carry-forward, morning captured, loop closed) are superseded by tab content. The throughline visual between morning and evening cards moves with the cards to the notes view.

---

## 9. Agent surface

- `list_open_todos` gains `bucket` on each item, dedups **across** recordings using the same key as §4, and accepts `bucket?: "today" | "this_week" | "later"` as a filter.
- `get_today` includes `tasks: Task[]` for today's bucket so "what's on my plate" needs one call.
- `action_items[]` gains `bucket`, `timeframe`, `due`.
- No write tools in this slice. Completing from the agent is the next MCP decision, not this one.

---

## 10. Making the extraction training loop actually work

Definition of "works": a correction made in the app on Monday can be a scored fixture on Tuesday without anyone hand-copying JSON, and a prompt change cannot ship if it lowers the action score or adds a critical hallucination.

Minimum set of fixes, in dependency order:

1. **Capture edits as corrections.** `PATCH /recordings/:id` writes a `throughline_feedback` row with `status: eval_candidate`, `expected` = the note after the edit, `recording_snapshot` = the note before. The user did the labelling by editing; use it. Re-bucketing a task (Q6 adds a "move to" action) is also an edit.
2. **Export.** `scripts/export-feedback.mjs` pulls `eval_candidate` rows from Supabase with the service role into `backend/data/feedback/` (gitignored), redacting nothing yet because the workspace is private, but tagging each with `source: production`.
3. **Import** is already written; it starts receiving input once 1 and 2 exist. Keep the manual review step from the 2026-05-02 decision: candidates go to `evals/tmp/`, a human promotes to `evals/fixtures/labeled/`.
4. **One prompt, one normaliser.** Production imports `core/extraction-pipeline.mjs` and the prompt file, or a script generates the TS constant from the markdown and CI fails if they differ.
5. **Score what the UI shows.** Add `todos[].timeframe`, `todos[].priority` (already), and derived `bucket` to the scorer. Add `most_important` to the memory profile with the new, todo-free definition.
6. **Gate.** A GitHub Actions job runs `eval:check` on any change under `core/`, `evals/prompts/`, or `supabase/functions/api/`. It uses the fake extractor for structure and the Groq adapter for quality when the secret is present.

Not in this slice: automated prompt revision, fine-tuning, per-user adaptation. The 2026-05-02 decision stands.

---

## 11. Analytics

New allowlisted events, no content: `tab_selected {tab}`, `task_completed {bucket, carried: bool}`, `task_reopened`, `task_rebucketed {from, to}` (if Q6 ships), `note_merged {added_today, added_week, added_later, deduped}`, `saved_confirmation_shown`, `notes_view_opened`. Funnel step of interest: `recording_processed` → first `task_completed` within 24 h.

---

## 12. Non-goals

- Reminders, notifications, calendar or Todoist sync.
- Manual drag ordering.
- Sub-tasks, projects as containers, tags as filters.
- Agent write tools.
- Backfilling `timeframe` on historical notes (they bucket by `due` or fall to later).
- Fixing eval score to 90. This slice makes the loop measurable; raising the number is the next slice.

---

## 13. Open questions

All nine were decided on 2026-09-09 by accepting the default in the right-hand column. They are kept here so the reasoning stays next to the decision.

| # | Question | Decision (defaults accepted 2026-09-09) |
|---|---|---|
| Q1 | Where do the recording cards live once tabs take the home? Options: `notes →` in the top bar (proposed), a fourth tab, or below the list on today. | Top-bar affordance. Three tabs stay three. |
| Q2 | Fuzzy dedup ("call Marcus" vs "call Marcus about the deck")? | Exact normalised match only. Log near-misses in an eval fixture set before adding fuzziness. |
| Q3 | Should restating a done task reopen it? | No. Done stays done; the new mention is dropped. |
| Q4 | Sunday problem: this-week tab is nearly empty on Sunday. Roll to "next week" after 6 pm Sunday? | Keep Mon–Sun strictly. Observe. |
| Q5 | Carry-over ceiling: after how many days does an uncleared today item drop to later? | 7 days. |
| Q6 | Do we ship a manual "move to today / this week / later" action in v1? It is the cheapest correction signal for the timeframe extractor. | Yes, as a long-press menu on a row; it writes a feedback row. |
| Q7 | Mike's note "cleared items should …" is cut off. Assumed: cleared items stay visible in a done group until the day boundary, then leave the list but stay in memory. | As assumed. |
| Q8 | "Saved confirmation should be more hold." Assumed: bolder and held ~2.6 s, not a toast. | As assumed. |
| Q9 | Is `priority` worth keeping at all, or is "today, spoken order" enough? | Keep `high` only. |

---

## 14. Acceptance criteria

- Launching the app lands on the today tab with the record button visible without scrolling, in every state.
- A note containing "call Marcus today, send the deck by Friday, book the dentist sometime" produces exactly one row in each tab, in that order of tabs, with correct due labels.
- Recording a second note that repeats "call Marcus" adds zero rows for it; a second note that says "dentist next week" moves the dentist row to later without duplicating it.
- Within today, carried-over rows precede priority rows precede the rest; the order is stable across refreshes.
- Tapping a row's circle moves it to the done group with undo; on the next local day it is gone from the tab and still present in the note detail and in `list_open_todos` with `status: completed`.
- A "tomorrow" item recorded this morning appears in this week labelled "tomorrow", never in today, and never under any "last night" label. The string "unfinished from last night" no longer exists in the app.
- After stopping a recording, "saved" appears within 300 ms of upload success in primary colour with the hold bar, stays at least 2.6 s, and is followed by "+n" pills on the tabs that received items.
- The note detail shows no line in both "worth remembering" and "to-dos".
- `list_open_todos` returns each open task once across all recordings and includes `bucket`.
- Editing a note's to-dos in the app produces a `throughline_feedback` row with `status: eval_candidate`; `npm run eval:import-feedback` after `scripts/export-feedback.mjs` yields a fixture from it.
- `eval:check` runs in CI on prompt and pipeline changes, and the production prompt is byte-identical to the eval prompt.

---

## 15. Risks

- **Bucket errors are more visible than missed todos.** A task placed in later when the user meant today is a trust hit. Mitigation: Q6's move action, `timeframe` scored in evals, and `due` always winning over `timeframe`.
- **Cross-note dedup can merge distinct tasks** ("call Mom" on two different days may be two calls). Mitigation: exact match only, and a done task is never matched again.
- **Option B adds a server round-trip** to render the list. Mitigation: cache the last `GET /tasks` response locally and re-derive buckets on the client for the day boundary.
- **Prompt unification touches production extraction.** Mitigation: it is the first spike (see plan) and ships behind the eval gate.
- **The v0 spec's four home states and carry-forward decision are superseded.** Mitigation: decision-log drafts in the plan make the supersession explicit rather than silent.
