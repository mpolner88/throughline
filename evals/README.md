# Throughline Eval Foundation

Track A starts here.

The eval suite exists to answer one question before product polish: when a user speaks a messy voice note, does Throughline extract the parts an AI agent needs without inventing anything?

Normalization and deterministic post-processing live in `core/extraction-pipeline.mjs` so the eval runner and backend stub use the same extraction behavior.

## Current scope

The user-facing unit is a Throughline note. Each fixture contains:

- `transcript`: what the user said.
- `expected`: the structured note the extractor should produce.

The scorer currently measures the fields most likely to drive useful agent behavior in v0:

- `type`
- `title`
- `summary`
- `most_important` (extracted and stored, not yet scored in the default suite)
- `todos`
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

Import reviewed alpha feedback with corrected `expected` objects into private, ignored fixtures:

```bash
npm run eval:import-feedback
```

This writes to `evals/tmp/feedback-fixtures` by default. Keep raw user feedback out of committed fixtures unless it has been reviewed and sanitized.

Product feedback now stores extraction grades in Supabase through the API feedback endpoint. A useful self-improving loop is:

1. User grades an extraction in the app and optionally adds correction notes.
2. Low scores or corrections are stored as `needs_review` feedback with the transcript and structured-note snapshot.
3. A reviewer or agent converts the correction into a sanitized `expected` object.
4. `npm run eval:import-feedback` turns reviewed feedback into private fixtures.
5. Prompt or model changes must pass `npm run eval:check` before deploy.

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

## Pass rule

The scorer reports three profiles:

- `full`: the complete extraction contract.
- `action`: the fields an agent is most likely to act on directly: todos, tomorrow todos, priorities, intentions, accomplishments, people, mood, and type.
- `memory`: the fields that make the note easier to retrieve and understand later: title, summary, accomplishments, mood, people, projects, tags, and centers of balance.

For v0, a selected profile passes only when:

- Overall score is at least 90%.
- Critical hallucinations for that profile are zero.

The default selected profile is `full`. Use `--profile action` when evaluating the core “voice note in, agent-usable memory out” path independently from retrieval metadata.

Critical hallucinations include invented todos, people, projects, dates, priorities, accomplishments, tomorrow todos, tags, and centers of balance, scoped to whichever profile is selected. The evaluator only treats an unmatched extraction as critical when it is also unsupported by the original transcript.

For todo scoring, an actual `for_date` equal to the fixture's `user_local_date` is accepted when the expected `for_date` is empty. Same-day dating is useful for agent handoff and should not be penalized as a behavioral error.

This is deliberately strict. Missing something important is bad; inventing something the user did not say is worse because the agent may act on it.

## Fixture suite

The first full suite contains 30 labeled notes:

- Morning, evening, weekly review, and freeform.
- Walking, driving, and stationary speech.
- Clean speech and heavy filler.
- Short, medium, and near-limit recordings.
- Multiple speakers.
- Accents and mixed-language examples where relevant.
