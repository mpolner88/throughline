# Groq Model Bakeoff — 2026-05-02

This report compares live Groq extraction runs against the 30 labeled Throughline voice-note fixtures.

All runs used:

- Prompt: `evals/prompts/extract-note-v0.md`
- Runner: `evals/run-extraction.mjs`
- Scorer: `evals/score-extraction.mjs`
- Pass rule: selected profile score >= 90 and zero critical hallucinations

## Results

| Model | Full | Action | Memory | Criticals full/action/memory | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| `llama-3.3-70b-versatile` | 73.8 | 84.9 | 57.9 | 11 / 2 / 9 | Better than 8B, but weak on projects and memory metadata. |
| `openai/gpt-oss-120b` | 78.6 | 86.1 | 68.1 | 10 / 1 / 9 | Best overall quality and best current default candidate. |
| `qwen/qwen3-32b` | 75.5 | 82.2 | 66.4 | 26 / 8 / 18 | Much slower in this setup and more critical hallucinations. |

Previous baseline:

| Model | Full | Action | Memory | Notes |
| --- | ---: | ---: | ---: | --- |
| `llama-3.1-8b-instant` | 64.5 | 77.8 | 47.2 | Cheap and fast, but below quality bar. |

## Readout

`openai/gpt-oss-120b` is the best Groq model tested so far, but it still does not pass the v0 eval. The core action path is close, especially for todos, tomorrow carry-forward, mood, and people. The remaining action gap is mostly priorities, intentions, and a handful of date/carry-forward misclassifications.

Memory enrichment remains materially below bar. Titles and summaries are hard to score with token overlap, but projects and tags are also genuinely inconsistent.

## Recommendation

Use `openai/gpt-oss-120b` as the default Groq eval model for now, but do not treat extraction quality as solved. The next engineering step should be a product extraction pipeline, not more prompt-only tuning:

- Model pass for raw extraction.
- Deterministic normalization for dates and schema invariants.
- Lightweight post-processing to derive safe priorities, carry-forward fields, and projects from already extracted todos and transcript nouns.
- A stricter split between agent-action fields and memory-enrichment fields.

The eval is doing its job: it says the product can be wired end to end, but the extraction layer is not yet launch-quality.
