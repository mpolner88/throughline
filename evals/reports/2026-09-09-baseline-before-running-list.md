# Baseline before the running list, 2026-09-09

This report records the extraction baseline at the end of phase 0 of the running list slice, before any phase 1 changes to the prompt, the normaliser, or the fixtures.

Phase 0 changed what the eval measures, not what the model does. Until now `supabase/functions/api/index.ts` carried its own inline copy of the extraction prompt (backticks stripped, arrows replaced, no `## Output JSON` block) and its own TypeScript copy of the normaliser. The eval scored `evals/prompts/extract-note-v0.md` and `core/extraction-pipeline.mjs`, so production ran code the eval never saw. The contract now lives once in `core/extraction-contract.mjs`, the prompt once in `evals/prompts/extract-note-v0.md`, and `scripts/sync-extraction-contract.mjs` copies both into `supabase/functions/_shared/`. CI fails when the generated copies are stale.

## Golden self-check

Command: `npm run eval:check`

Run on 2026-09-09 against the 30 labeled fixtures with the `golden` provider.

| Profile | Overall | Criticals | Pass |
| --- | ---: | ---: | --- |
| full | 100 | 0 | yes |
| action | 100 | 0 | yes |
| memory | 100 | 0 | yes |

Every field scored 100 in every profile.

This proves plumbing, not model quality. The golden provider copies the fixture labels into the prediction files, so a perfect score only says the runner, the normaliser, and the scorer agree with each other and with the fixture format. It says nothing about what a model produces.

## Standing production baseline

The most recent live model run is the 2026-05-02 bakeoff in [2026-05-02-groq-model-bakeoff.md](2026-05-02-groq-model-bakeoff.md). The default production model is `openai/gpt-oss-120b`. Its numbers stand as the production baseline:

| Model | Full | Action | Memory | Criticals full/action/memory |
| --- | ---: | ---: | ---: | ---: |
| `openai/gpt-oss-120b` | 78.6 | 86.1 | 68.1 | 10 / 1 / 9 |

Caveat: those numbers were measured against the markdown prompt and `core/extraction-pipeline.mjs`. Production ran the stripped inline copy of the prompt and its own normaliser until phase 0. The bakeoff therefore describes what the eval measured, not exactly what users got. After phase 0 the two are the same code, so the first CI run of the `groq-quality` job on this branch is the true post-unification baseline. If its action or critical numbers differ from the table above, the difference is the cost of the drift, not a regression.

## Live Groq run

A live Groq run could not be executed in this environment. Outbound access to `api.groq.com` is blocked by network policy here, so the runner cannot reach the model.

To produce the run locally:

```bash
GROQ_API_KEY=... npm run eval:run:groq && npm run eval:score:action
```

`eval:run:groq` writes predictions to `evals/runs/latest`. `eval:score:action` prints the action profile summary. Run `npm run eval:score` for the full profile and `npm run eval:score:memory` for memory.

In CI the same run happens in the `groq-quality` job of `.github/workflows/eval.yml` when the `GROQ_API_KEY` secret is present. The job scores the action, full, and memory profiles, writes the table to the job summary, and uploads `evals/runs` as the `eval-runs` artifact, so the prediction files can be inspected after the fact. The job reports only; it does not fail the workflow on a below-threshold score, because the gate from phase 1 onward is "not below baseline", not the 90 bar.

## Acceptance rule for phase 1

Phase 1 adds `timeframe`, the explicit `priority: "high"` rule, and a todo-free `most_important`. The rule that gates it:

- The action profile must not drop below the baseline. That is 86.1 from the 2026-05-02 run until the first `groq-quality` CI run replaces it.
- Critical hallucinations must not rise. That is 1 on the action profile and 10 on the full profile from the same run.
- `npm run eval:check` must still pass at 100 with zero criticals, since new fixtures and scorer fields have to round-trip through the golden provider before they can be trusted on a model.

Once the first `groq-quality` run lands, copy its numbers into this report under a new heading and treat them as the baseline going forward.
