# Running List Implementation Plan

**Spec:** `docs/superpowers/specs/2026-09-09-throughline-running-list-design.md`
**Prototype:** `mockup/list-redesign/index.html`
**Status:** Proposed. Sequenced by uncertainty, not by visual polish. Nothing starts until the spec's open questions Q1, Q6, Q7, Q8 have answers or their defaults are accepted.

## Global constraints

- Product behaviour changes ship behind the eval gate (phase 0) so extraction quality is measured before and after.
- No Supabase migration in this slice. The list is a server-derived view (spec §3.4 option B).
- No new user content in analytics events.
- iOS changes are foreground-only, as before.
- App Store submission, prompt model changes, and MCP write tools each remain separate approval gates.

## Sequence

### Phase 0 · Make the eval trustworthy (riskiest spike, ~1 day)

The whole slice changes what the extractor outputs. If the eval cannot see production's prompt, nothing after this can be judged.

- [ ] Make `supabase/functions/api/index.ts` consume the prompt from `evals/prompts/extract-note-v0.md` and the normaliser from `core/extraction-pipeline.mjs`. Deno can import the `.mjs` directly; if bundling is a problem, add `scripts/sync-extraction-prompt.mjs` that regenerates the TS constant and a check that fails when they differ.
- [ ] Add `.github/workflows/eval.yml`: on changes under `core/`, `evals/`, `supabase/functions/api/`, run `npm run eval:check` with the fake extractor, and `eval:run:groq` + `eval:score:action` when `GROQ_API_KEY` is present.
- [ ] Record a fresh baseline run and commit `evals/reports/2026-09-xx-baseline-before-running-list.md`.

Acceptance: CI fails when the production prompt and the eval prompt diverge. Baseline numbers exist for full, action, memory.

### Phase 1 · Extraction: `timeframe`, `priority` rule, todo-free `most_important` (~1 day)

- [ ] `core/extraction-pipeline.mjs`: add `timeframe` to `normalizeTodo`; add `deriveBucket(todo, userLocalDate)` (pure function, exported); change `deriveMostImportant` to exclude todo texts; add `bucket`, `timeframe`, `due` to `deriveActionItems`.
- [ ] `evals/prompts/extract-note-v0.md`: add the `timeframe` field, the cue table from spec §3.2, and the explicit `priority: "high"` rule. Update the Output JSON block.
- [ ] `evals/score-extraction.mjs`: score `todos[].timeframe` and derived `bucket` in the action profile; add `most_important` to the memory profile.
- [ ] Add 8–10 fixtures under `evals/fixtures/labeled/` that exercise: "today" cue, "this week" cue, "sometime" cue, weekday name, "tomorrow", mixed note with all three buckets, a restated task, a done-then-restated task.
- [ ] Run the eval. Action profile must not drop below baseline; criticals must not rise.

Acceptance: `deriveBucket` has unit tests for every row in the spec §3.2 table plus week boundaries (Sunday, Monday, timezone offset).

### Phase 2 · Server: `GET /tasks` and cross-note dedup (~1–2 days)

- [ ] `backend/memory-tools.mjs` and `supabase/functions/api/index.ts`: add `buildTaskList(recordings, userLocalDate)` implementing spec §4 (match key, restatement wins, done never reopens) and §4.2 sort. One implementation in `core/`, imported by both.
- [ ] New route `GET /tasks?date=YYYY-MM-DD` on the stub server and the Edge Function. Response: `{ today: Task[], this_week: Task[], later: Task[], done: Task[] }` with the client's local date passed in, so the server never guesses timezone.
- [ ] `PATCH /recordings/:id/action-items` unchanged, but the response should include the rebuilt task list to save a round-trip.
- [ ] `list_open_todos`: dedup across recordings, add `bucket`, accept a `bucket` filter. `get_today` adds `tasks`.
- [ ] Extend `backend/smoke-note-edits.mjs` (or add `smoke-task-list.mjs`) to post two notes with an overlapping task and assert one row.

Acceptance: spec §14 bullets 2, 3, 4, 9 pass against the stub server.

### Phase 3 · Capture corrections (~1 day, can run parallel to phase 2)

- [ ] `applyRecordingEdits` writes a `throughline_feedback` row: `status: eval_candidate`, `expected` = post-edit `structured_note`, `recording_snapshot` = pre-edit note and transcript, `answers.rubric_version: "note_edit_v1"`, `source: "note_edit"`.
- [ ] `scripts/export-feedback.mjs`: service-role read of `throughline_feedback where status = 'eval_candidate'` into `backend/data/feedback/`. Idempotent by id.
- [ ] `evals/import-feedback-fixtures.mjs`: no change expected; verify it now produces fixtures. Document the human promotion step in `evals/README.md`.
- [ ] If Q6 is yes: `PATCH /recordings/:id/action-items` accepts `timeframe` and writes the same kind of feedback row with the before/after todo.

Acceptance: spec §14 bullet 10.

### Phase 4 · iOS: tabs, list, clearing, rollover (~3 days)

- [ ] `Models/`: add `Task` and `TaskListResponse`; add `timeframe` to `Todo`.
- [ ] `AppState`: replace `carriedForwardItems` with `taskList` fetched from `GET /tasks`; cache it; re-derive buckets locally on foreground when the local date changed since the cache was written. Delete `todaysMorningNote` / `todaysEveningNote` if unused after the move.
- [ ] `HomeView`: tab strip (custom, not `TabView`, to keep the fixed top bar and bottom recorder), per-tab heading, `TaskRow`, done group with undo, empty states. Remove `CarryForwardView`, `MostImportantView`, and the home-screen `mostImportantItems`.
- [ ] `NotesView`: move `CapturedCard` list, `NoteDetailSheet`, edit form, and grading behind the `notes →` top-bar affordance. Rename the detail's "most important" section to "worth remembering" and feed it the todo-free derivation.
- [ ] Long-press row menu: move to today / this week / later (if Q6 yes) and open source note.
- [ ] Analytics events from spec §11.
- [ ] Update `scripts/generate-app-store-screenshots.mjs` fixtures so screenshots stop showing "carried forward".

Acceptance: spec §14 bullets 1–6, 8.

### Phase 5 · iOS: saved confirmation (~half day)

- [ ] Replace `didJustSave: Bool` with `recorderPhase: enum { idle, preparing, recording, finishing, saving, saved(until: Date), sorting, landed(count: Int, until: Date) }`.
- [ ] Status line styles per phase; hold bar view; haptic on `.saved`; `+n` pills on tabs from the `GET /tasks` diff.
- [ ] Respect Reduce Motion: no bar animation, same durations.

Acceptance: spec §14 bullet 7.

### Phase 6 · Verify and ship

- [ ] Eval: action profile ≥ baseline, criticals ≤ baseline, new timeframe fixtures pass.
- [ ] Manual acceptance on device: the three-note scenario from the prototype, plus a real overnight.
- [ ] Decision-log entries below move from draft to logged.
- [ ] TestFlight to Internal QA before any App Store submission.

## File ownership

| Area | Files |
|---|---|
| Shared extraction and task logic | `core/extraction-pipeline.mjs` (+ new `core/task-list.mjs`) |
| Prompt and evals | `evals/prompts/extract-note-v0.md`, `evals/score-extraction.mjs`, `evals/fixtures/labeled/*`, `.github/workflows/eval.yml` |
| Local backend | `backend/stub-server.mjs`, `backend/memory-tools.mjs`, `backend/smoke-*.mjs` |
| Hosted backend | `supabase/functions/api/index.ts`, `supabase/functions/_shared/memory-tools.ts`, `scripts/export-feedback.mjs` |
| iOS | `AppState.swift`, `Views/HomeView.swift`, new `Views/NotesView.swift`, new `Views/TaskListView.swift`, `Models/ThroughlineNote.swift`, new `Models/Task.swift` |
| Docs | this plan, the spec, `decision-log.md`, `throughline-product-spec-v0.md` §8 (mark superseded) |

## What not to build yet

- A `throughline_tasks` table. Revisit when per-task history or multi-device conflict shows up.
- Fuzzy dedup. Collect near-miss examples first.
- Drag reorder, reminders, notifications, agent write tools.
- Automated prompt revision from eval failures.

## Rollback

Phases 0–3 are additive on the server: old clients keep working because `structured_note` keeps every existing field. Phase 4 ships as a new iOS build; rollback is the previous TestFlight build. If `GET /tasks` misbehaves, the client can fall back to deriving buckets from cached recordings with the same `core/task-list.mjs` logic ported to Swift, which is why that logic must stay pure and small.

---

## Decision-log drafts (not yet logged)

These are written in the repo's decision format so they can be pasted into `decision-log.md` once approved. Dates are placeholders.

### 2026-09-xx — Home screen is a running task list with today / this week / later tabs

**Decision:** The home screen shows one task list derived from all notes, split into today, this week, and later tabs, opening on today. Recording cards move behind a `notes →` affordance. Supersedes the four canonical home states and the carry-forward block from 2026-04-30.

**Context:** Dogfood showed the "unfinished from last night" block appearing for tasks recorded minutes earlier, never expiring, and duplicating the list below it. Multiple notes produced stacked cards rather than one list, and "most important" and "to-dos" overlapped. The 2026-04-30 carry-forward decision listed "unfinished priorities" and "multi-day skips" as revisit triggers; both happened.

**Alternatives considered:** Fix the carry-forward date filter only. Keep cards and add a merged list above them. Four tabs including notes. A single list with date headers instead of tabs.

**Reasoning:** A task's timeframe is the one dimension people reach for when they open the app ("what's on for today"). Tabs make that dimension the primary navigation while keeping the record button fixed. A derived list keeps the note as the unit of storage, which protects the memory-persistence moat and the MCP contract.

**Revisit when:** Users mostly live in the notes view rather than the list, the later tab becomes a graveyard, or the agent surface becomes the primary place tasks are completed.

### 2026-09-xx — Time bucket is derived in code from `due` and a spoken `timeframe`

**Decision:** The extractor outputs `todos[].timeframe` (today / this_week / later / null) only from the user's words. The bucket shown to the user is derived deterministically from `due`, `timeframe`, and the user's local date. `due` always wins over `timeframe`. Buckets are never stored.

**Context:** Bucketing by model judgement would invent urgency; storing buckets would go stale overnight.

**Alternatives considered:** Model-assigned bucket. Stored bucket with a nightly job. Client-only heuristics on todo text.

**Reasoning:** Consistent with the 2026-05-02 decision that deterministic invariants live in code, not the model. A pure function is testable and can run on server and client.

**Revisit when:** Timeframe extraction accuracy stays below the action-profile bar after fixtures exist, or users routinely move items between tabs.

### 2026-09-xx — "Most important" excludes tasks; the list owns priority

**Decision:** `most_important` is derived from priorities, intentions, and decisions with todo texts excluded. In the app it is labelled "worth remembering" and appears only in the note detail. Task priority is a property of a task that affects sort order and shows a small mark.

**Context:** The derived union made "most important" a superset of the to-do list, so the two sections repeated each other and the difference was unclear.

**Alternatives considered:** Keep both sections and dedupe visually. Drop `most_important` entirely. Pin high-priority tasks in a separate block on home.

**Reasoning:** Separate by kind (task vs takeaway), not by rank. The agent still gets both; the person sees each line once.

**Revisit when:** Agents or users ask for a ranked "top three" view, or `most_important` scoring shows the todo-free definition loses signal.

### 2026-09-xx — Note edits are extraction corrections

**Decision:** Every edit to a note's structured fields writes a feedback row with `status: eval_candidate`, the pre-edit snapshot, and the post-edit note as `expected`. An export script brings production candidates into the eval workspace. Human review before promotion to labelled fixtures remains, per 2026-05-02.

**Context:** The app's grading UI only sends a score, so no real correction has ever reached the eval suite. Edits are the correction signal users already produce.

**Alternatives considered:** Build a dedicated "teach" flow. Treat low scores alone as candidates. Skip capture until volume justifies it.

**Reasoning:** Zero extra user effort, highest-fidelity label, and it closes the first missing link in the loop without changing the trust posture.

**Revisit when:** Edit volume makes manual promotion the bottleneck, or privacy review requires redaction before export.

### 2026-09-xx — Saved is a held state, confirmed at upload

**Decision:** After stopping a recording, "saved" shows the moment the upload succeeds, in primary text weight with a filled tick, held for at least 2.6 s with a visible draining bar and a light haptic, then hands off to "sorting" and a per-tab "+n" when tasks land.

**Context:** The existing "saved" label was masked by "translating" until processing finished and then never cleared.

**Alternatives considered:** Toast overlay. Sheet with the transcript. No confirmation (the 2026-04-30 "stop = save" decision).

**Reasoning:** Confirm the thing the user is worried about at the moment it becomes true, without leaving the home screen. The list landing is the second, richer confirmation. "Stop = save" still holds; this only makes the save legible.

**Revisit when:** Users report missing it, or processing latency drops enough that a single combined confirmation is better.
