# Throughline Eval Foundation

Track A starts here.

The eval suite exists to answer one question before product polish: when a user speaks a messy voice note, does Throughline extract the parts an AI agent needs without inventing anything?

The pure extraction contract, meaning normalization and deterministic post-processing, lives in `core/extraction-contract.mjs`. `core/extraction-pipeline.mjs` re-exports it and adds the command runner, so the eval runner and backend stub use the same behavior. `scripts/sync-extraction-contract.mjs` copies the contract, the task list module (`core/task-list.mjs`), and the prompt into `supabase/functions/_shared/` so the Edge Function runs the same code the eval scores.

## Current scope

The user-facing unit is a Throughline note. Each fixture contains:

- `transcript`: what the user said.
- `expected`: the structured note the extractor should produce.

The scorer currently measures the fields most likely to drive useful agent behavior in v0:

- `type`
- `title`
- `summary`
- `most_important` (scored in the `memory` profile only, and only on fixtures that label it)
- `todos` (text, `priority`, `due`, `for_date`, and `timeframe`)
- `priorities`
- `intentions`
- `accomplishments`
- `tomorrow_todos`
- `mood`
- `people`
- `projects`
- `tags`
- `centers_of_balance`

The full product schema remains larger than this scored subset. The eval starts narrow so prompt/model changes are judged on the fields that make the note useful to an agent.

## Timeframe, priority, and most important

The running list (`docs/superpowers/specs/2026-09-09-throughline-running-list-design.md`) added three rules to the contract. All three are enforced by `evals/prompts/extract-note-v0.md` and normalized in `core/extraction-contract.mjs`.

### `todos[].timeframe`

Every todo carries `timeframe`: `"today"`, `"this_week"`, `"later"`, or `null`. It records the time window the user gave in words, so the list can place a task when no date resolves. The prompt's cue table:

| The user says | `timeframe` |
|---|---|
| today, this morning, before lunch, tonight, end of day | `today` |
| this week, by the end of the week, in the next few days, by Friday when no date resolves | `this_week` |
| sometime, eventually, at some point, next week, next month, no time given | `later` |

- The model sets `timeframe` only from the user's words and never infers urgency. `null` means nothing was said; `later` means the user pushed it out.
- A resolvable date still goes in `due` or `for_date`. "Today" resolves to the user's local date and also sets `timeframe: "today"`. "Tomorrow" and weekday names resolve to dates through the existing `normalizeDateValue` rules and do not set `timeframe` on their own.
- A restated task ("actually the dentist can wait until next week") is one todo with the final timeframe, not two.
- `normalizeTodo` keeps only the three valid values (`VALID_TIMEFRAMES`); anything else becomes `null`.

The bucket a task lands in is never stored and never asked of the model. `deriveBucket(todo, { date, weekEnd })` in `core/extraction-contract.mjs` derives it: a `due` or `for_date` on or before the local date is `today`, on or before the Sunday that ends the Monday to Sunday week is `this_week`, and anything after is `later`; with no date, `timeframe` decides, and `null` falls to `later`. `deriveActionItems` copies `timeframe`, `due`, and `priority` onto each todo's action item so agents see them without re-deriving.

### `todos[].priority`

`priority` is `"high"` or `null`. The model sets `"high"` only when the user marks the task (first, first thing, most important, priority, must, before anything else) and never ranks tasks by how urgent they sound. The contract still accepts `medium` and `low` from older notes and edits, but the task list collapses anything other than `high` to `null`.

### Todo-free `most_important`

`most_important` is what an agent should remember from a note that is not a task: decisions, constraints, blockers, and durable context. `deriveMostImportant` builds it from the model's `most_important`, then `priorities`, then `intentions`, drops any entry whose normalized text matches a todo, and keeps the first five. There are no fallbacks to todos, `tomorrow_todos`, accomplishments, or the summary any more, so an empty array is a valid result for a note that is only tasks. In the app this list is labelled "worth remembering" in the notes list cards and the note detail, and no longer appears on the home screen.

## Commands

Generate prediction files with the golden provider:

```bash
npm run eval:run
```

Generate prediction files with Groq:

```bash
GROQ_API_KEY=... npm run eval:run:groq
```

Run a golden self-check against the labeled fixtures:

```bash
node evals/score-extraction.mjs
```

Score model predictions from a directory:

```bash
node evals/score-extraction.mjs --predictions evals/runs/latest
```

Score the core agent-action path only:

```bash
npm run eval:score:action
```

Score the memory enrichment path only:

```bash
npm run eval:score:memory
```

Run the full local plumbing check:

```bash
npm run eval:check
```

Export `eval_candidate` feedback rows from Supabase into the ignored `backend/data/feedback/` directory:

```bash
npm run feedback:export
```

Import feedback with corrected `expected` objects into private, ignored fixtures:

```bash
npm run eval:import-feedback
```

This reads `backend/data/feedback` and writes to `evals/tmp/feedback-fixtures` by default. Keep raw user feedback out of committed fixtures unless it has been reviewed and sanitized.

### Corrections loop

Every edit a user makes in the app is an extraction correction, and the backend captures it as one. `PATCH /recordings/:id` (note edits) and the timeframe branch of `PATCH /recordings/:id/action-items` (moving a task between tabs) each write a `throughline_feedback` row with `status: "eval_candidate"`, `source: "note_edit"` or `"task_move"`, `expected` set to the structured note after the change, and `recording_snapshot` holding the transcript and the structured note before it. `answers.rubric_version` is `"note_edit_v1"` and the grading fields are `null`. Completion toggles do not write feedback. The grading UI still writes `alpha_feedback` rows: `eval_candidate` when the user supplied a corrected `expected`, otherwise `needs_review`.

The loop from a correction in the app to a scored fixture is:

1. The user edits a note or moves a task. The backend stores an `eval_candidate` row with the before and after snapshots.
2. `npm run feedback:export` pulls those rows with the service role key into `backend/data/feedback/<id>.json`. Flags: `--status` (default `eval_candidate`) and `--out` (default `backend/data/feedback`). It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment or from `.env.local` / `.env`, pages through the table in batches, rewrites a file only when its content changed, and prints counts only (fetched, written, unchanged), never row contents.
3. `npm run eval:import-feedback` turns each row that has a transcript and an `expected` object into a fixture under `evals/tmp/feedback-fixtures/`.
4. A human reviews the candidate, sanitizes it, and promotes it to `evals/fixtures/labeled/`. This step stays manual on purpose: an edit is a high-fidelity label, but it is still user content, and the 2026-05-02 decision keeps prompt changes behind human review.
5. Prompt or model changes must pass `npm run check` before deploy. That runs the contract check, `eval:check`, and the smoke tests (`note:edit:smoke`, `task:smoke`, `agent:smoke`, `mcp:smoke`). The GitHub Actions workflow in `.github/workflows/eval.yml` runs the same checks, plus a Deno type-check of both Edge Functions, on pull requests and pushes to main that touch `core/`, `evals/`, `backend/`, `supabase/functions/`, `package.json`, the sync and deploy scripts, or the workflow itself, and runs the live Groq eval when `GROQ_API_KEY` is set.

Prediction files should be named `{fixture_id}.json` and contain either the extraction object directly or `{ "actual": { ... } }`.

## Extractor runner

`evals/run-extraction.mjs` writes predictions to `evals/runs/latest`.

The default `golden` provider copies fixture labels into prediction files. This does not test model quality; it tests that the eval plumbing is sound.

After provider output is normalized, the runner applies deterministic post-processing. For example, date strings like `tomorrow` or `Tuesday` are converted to ISO dates using fixture metadata. If a todo is dated for tomorrow, the runner also mirrors it into `tomorrow_todos` so the model does not have to maintain that duplicate invariant perfectly.

To plug in a model, use the command provider:

```bash
node evals/run-extraction.mjs --provider command --command ./path/to/extractor-adapter
```

The adapter is called once per fixture. It receives JSON on stdin:

```json
{
  "id": "001-morning-launch-pricing",
  "metadata": {},
  "transcript": "What the user said",
  "prompt": "The extraction prompt"
}
```

It must print strict JSON extraction output to stdout.

If a run fails partway through, rerun with `--keep-existing --skip-existing` to resume without regenerating completed prediction files.

### Groq adapter

`evals/adapters/groq-extract.mjs` is the first concrete adapter. It calls Groq's OpenAI-compatible chat completions API and prints the model's JSON response.

Environment variables:

- `GROQ_API_KEY` required.
- `GROQ_MODEL` optional, defaults to `openai/gpt-oss-120b`.
- `GROQ_BASE_URL` optional, defaults to `https://api.groq.com/openai/v1`.
- `GROQ_TIMEOUT_MS` optional, defaults to `30000`.
- `GROQ_MAX_RETRIES` optional, defaults to `5`.

The npm script uses a 2.5-second delay between fixtures. The adapter retries 429s, transient fetch failures, and Groq JSON validation failures.

## Contract sync

The Edge Function cannot import from `core/` or `evals/` at deploy time, so it reads generated copies instead. `scripts/sync-extraction-contract.mjs` writes three files:

- `supabase/functions/_shared/extraction-contract.mjs`: the contents of `core/extraction-contract.mjs` with a generated-file header.
- `supabase/functions/_shared/task-list.mjs`: the contents of `core/task-list.mjs` (the running list: merge, dedup, buckets, sort) with the same header. Its relative import of `./extraction-contract.mjs` resolves to the generated copy.
- `supabase/functions/_shared/extraction-prompt.ts`: `EXTRACTION_PROMPT` as the exact bytes of `evals/prompts/extract-note-v0.md`, plus `EXTRACTION_PROMPT_PATH`.

Regenerate them after changing the prompt or the contract, and commit the result:

```bash
npm run contract:sync
```

Check that they are current without writing anything:

```bash
npm run contract:check
```

`contract:check` exits 1 and names each stale file. CI runs it first and fails the build when the generated files are behind. `npm run supabase:deploy` runs it before deploying for the same reason. Do not edit the generated files by hand.

## Pass rule

The scorer reports three profiles:

- `full`: the complete extraction contract.
- `action`: the fields an agent is most likely to act on directly: todos, tomorrow todos, priorities, intentions, accomplishments, people, mood, and type.
- `memory`: the fields that make the note easier to retrieve and understand later: title, summary, most important, accomplishments, mood, people, projects, tags, and centers of balance.

For v0, a selected profile passes only when:

- Overall score is at least 90%.
- Critical hallucinations for that profile are zero.

The default selected profile is `full`. Use `--profile action` when evaluating the core “voice note in, agent-usable memory out” path independently from retrieval metadata.

Critical hallucinations include invented todos, people, projects, dates, priorities, accomplishments, tomorrow todos, tags, and centers of balance, scoped to whichever profile is selected. The evaluator only treats an unmatched extraction as critical when it is also unsupported by the original transcript.

For todo scoring, an actual `for_date` equal to the fixture's `user_local_date` is accepted when the expected `for_date` is empty. Same-day dating is useful for agent handoff and should not be penalized as a behavioral error.

### Todo weights and skip rules

Each matched todo scores 0.6 on fuzzy text, and 0.1 each on exact `priority`, exact `due`, `for_date` (with the same-day allowance above), and exact `timeframe`. A fixture written before `timeframe` existed has no `timeframe` key on its expected todos, so those todos skip that component and score with the earlier split (0.7 text, 0.1 for each of the other three). Fixtures 001 to 030 therefore score exactly as they did before.

`most_important` is scored only in the `memory` profile, at weight 10, and only when the fixture's `expected` object has the key. A fixture without it contributes no weight for that field, so its profile score is computed over the fields it actually labels; the aggregate for a skipped field is `null` rather than zero. `bucket` is not a scored field: it is derived in code from `due`, `timeframe`, and the local date, so scoring `timeframe` and the dates covers it.

This is deliberately strict. Missing something important is bad; inventing something the user did not say is worse because the agent may act on it.

## Fixture suite

The first full suite contains 30 labeled notes:

- Morning, evening, weekly review, and freeform.
- Walking, driving, and stationary speech.
- Clean speech and heavy filler.
- Short, medium, and near-limit recordings.
- Multiple speakers.
- Accents and mixed-language examples where relevant.

Fixtures 031 to 040 were added with the running list. Each labels `timeframe` on every todo and `most_important` under the todo-free definition:

| Fixture | Exercises |
|---|---|
| `031-morning-today-cues` | Two "today" cues with no resolvable date (`timeframe: today`, `due: null`) |
| `032-freeform-this-week-cue` | "This week" cues; `most_important` is empty because the note is only tasks |
| `033-freeform-sometime-cue` | "Sometime" and "eventually" cues (`later`) |
| `034-morning-weekday-name` | A weekday name resolves to `due` and leaves `timeframe: null` |
| `035-evening-tomorrow-prescription` | "Tomorrow" resolves to `for_date` and `tomorrow_todos`, no `timeframe` |
| `036-morning-mixed-buckets` | One note with a today, a this-week, and a later task, plus a spoken priority |
| `037-freeform-restated-task` | A task restated with a new timeframe yields one todo, not two |
| `038-morning-priority-marker` | "Nothing else until" marks one task `priority: high` and the rest `null` |
| `039-freeform-no-time-given` | No time words at all, so every `timeframe` is `null` |
| `040-evening-done-and-tomorrow` | A completed task stays out of `todos`; a decision lands in `most_important` |
