# AI Cost Measurement — TL-COST-001

**Scoped:** 2026-10-25 by Claude, after Mike sequenced Throughline Plus behind AI cost measurement ([decision log](../../decision-log.md), 2026-10-25). Base: `claude/paid-tier-scope` at `3d6b0bb` (source identical to `codex/running-list` at `eabb79c`).
**Backlog state:** `approved_for_build`
**Slice phase:** `selected`. Mike chose Option B and approved build entry on 2026-10-25 ([decision log](../../decision-log.md)).
**Next gate:** Codex answers F1–F6 and writes a bounded plan from this brief at its committed revision (`planned`), then implements. Claude reviews the result under [the tandem rules](../AGENT_TANDEM.md#daily-working-agreement) before the switch is turned on in production.
**Program:** [Core Quality and Learning](../programs/core-quality-learning.md)
**Unblocks:** [Throughline Plus](premium-subscription.md) (TL-PREM-001), which waits for cost per successful recording.
**Authority:** Agents may build measurement within an approved slice. Provider, model, data-use policy and pricing changes need Mike's explicit approval. Mike's approval covers Option B as written, including the synthetic curve's Groq spend of under $1. It changes no provider or model setting, prompt, retry rule or policy.

## Problem

Groq transcribes and extracts every recording, and no one knows what a recording costs. Plus will allow recordings six times longer than free ones, for $4.99 a month. Before it ships, Mike wants measured cost per successful recording, split by stage and by duration.

## Baseline evidence (verified 2026-10-25 from source)

- **The live path discards usage.** Real users go through `processRecording` ([api/index.ts:1634](../../supabase/functions/api/index.ts)). Its Groq loops, `transcribeWithGroq` (:2192) and `requestGroqExtraction` (:2309), read only the transcript text and the message content. They drop the response's `usage`, and nothing records how many retries ran or why.
- **The path that keeps usage is off.** `processRecordingWithLineage` (:1699) records each attempt with `latency_ms` and `usage_snapshot` into `throughline_inference_attempts`, which already has an unused `cost_microunits` column ([migration](../../supabase/migrations/20260818000000_evaluation_truth_lineage.sql)). It runs only when `THROUGHLINE_LINEAGE_WRITES_ENABLED` is on. That flag was rolled back, and real-user coverage is zero ([CURRENT_STATE](../CURRENT_STATE.md)). Those rows also hold private transcript and input/output snapshots, and they cascade-delete with the recording.
- **Logs are too coarse.** `logRecordingHealth` (:3440) logs total latency, a duration bucket whose top bucket is "60 seconds or more", and an audio-size bucket. It records no model, tokens, attempts or cost.
- **The metric is defined but not built.** [product/metrics.md § Cost efficiency](../../product/metrics.md) defines the metric, its required fields and its privacy rule. [CURRENT_STATE](../CURRENT_STATE.md) lists "No product cost ledger" as a gap.
- **Models and request settings** come from [core/inference-contract.mjs](../../core/inference-contract.mjs):
  - Transcription: `whisper-large-v3-turbo` with `response_format: "json"`.
  - Extraction: `openai/gpt-oss-120b` with a JSON-object response.
  - Each stage defaults to 3 retries and a 60 s timeout.
  - No `reasoning_effort` or output-token cap is set, so the model's reasoning tokens are billed as output.
  - The extraction prompt is about 6,100 characters, roughly 1,500 tokens.
- **What Groq returns and charges** (official docs, read 2026-10-25):
  - **Transcription:**
    - The response has only `text` (plus `x_groq.id`), with no usage or duration ([API reference](https://console.groq.com/docs/api-reference)).
    - It is billed at $0.04 per audio hour, with "a minimum of 10 seconds" per request ([speech-to-text guide](https://console.groq.com/docs/speech-to-text)).
    - Its cost has to be computed from the recording's duration.
  - **Extraction:**
    - `usage` has `prompt_tokens`, `completion_tokens`, `total_tokens` and timings ([API reference](https://console.groq.com/docs/api-reference)).
    - Prompt caching is automatic for `gpt-oss-120b`, and cached tokens appear in `usage.prompt_tokens_details.cached_tokens` ([prompt caching](https://console.groq.com/docs/prompt-caching)).
    - Price per million tokens: $0.15 input, $0.075 cached input, $0.60 output ([model page](https://console.groq.com/docs/model/openai/gpt-oss-120b)).
- **Low live volume.** Since 2026-10-06 the only human-looking activity has been internal use, and every schema-v2 event reports `distribution_channel = unknown` (TL-DATA-001). A ledger of real use alone would take a long time to give a decision-grade cost by duration, especially for recordings over 5 minutes, which free users can't make.
- **The internal-user allowlist exists:** `throughline_internal_users`, read through `lookupInternalUser` (:602). A ledger can reuse it to keep internal use separate from other use.

### Rough estimate, not a measurement

These figures come from the published prices, about 150 spoken words per minute and the prompt size. The unknown is the extraction output, mostly reasoning tokens, so it is shown as a range.

| Recording | Transcription | Extraction (input + output) | Total |
| --- | --- | --- | --- |
| 1 min | $0.0007 | ~$0.0005–0.0015 | ~$0.001–0.002 |
| 5 min | $0.0033 | ~$0.0007–0.0025 | ~$0.004–0.006 |
| 30 min | $0.0200 | ~$0.0025–0.0060 | ~$0.023–0.026 |

After Apple's 15% commission, $4.99 leaves about $4.24. At this estimate, one subscriber would need well over 100 thirty-minute recordings a month before AI cost used up that margin. The estimate suggests cost is unlikely to block Plus. Even so, it is not measured, retries multiply it, and output-token behavior is the largest unknown. Option B measures each of these.

## Options

| | A. Read Groq's bill | B. Content-free ledger plus a synthetic duration curve (recommended) | C. Turn lineage back on and price its attempts |
| --- | --- | --- | --- |
| What it is | Mike reads Groq console spend by model for a date range. An agent counts processed recordings for the same range. | A new service-only ledger records every Groq attempt: units, latency and estimated cost, with no content and no user or recording link. A one-off script runs synthetic recordings at 1, 5, 15 and 30 minutes through the exact production contract. | Re-enable `THROUGHLINE_LINEAGE_WRITES_ENABLED` and fill in `cost_microunits` from `usage_snapshot`. |
| Answers | An average cost per recording, and only if the API key isn't shared with development and evaluation traffic | Cost per successful recording; p50 and p95; split by stage, retry, failure and duration; the cost curve for Plus | Per-attempt cost, but only for recordings that still exist |
| Code | None | One migration, live-path instrumentation, a price table, a report and a curve script | One flag and a cost backfill |
| Gaps | No p50/p95 and no stage or retry split. Development traffic is mixed in. Nothing beyond 5 minutes. | The curve is synthetic speech. Real-use cost by duration takes time to build up. | Stores private transcripts for every real user, which is a data-use change tied to the deferred Private Evaluation. Cost history is deleted along with recordings. Nothing beyond 5 minutes. |
| Verdict | Use it as a monthly cross-check inside B | **Recommended** | Not recommended |

## Option B in detail

### Ledger

Use two new tables. RLS is enabled with no policies, so only the service role can read them. Neither table has a foreign key to recordings or users, so rows survive recording and account deletion and cannot be joined back to content.

- **`throughline_ai_usage_operations`**: one row per processing run.
  - A random `operation_id`, generated for this ledger. It is not the recording ID or the lineage operation ID.
  - `usage_date`: UTC date only, with no timestamp.
  - `recording_kind`: `demo` or `signed_in`.
  - `is_internal_user`: from the existing allowlist, or null for demos.
  - `duration_bucket`: under 1 min, 1–5, 5–15, 15–30, or over 30.
  - `audio_seconds`, rounded to whole seconds.
  - `processing_path`: `legacy` or `lineage`.
  - `outcome`: `processed`, `transcription_failed`, `extraction_failed` or `other_failed`.
  - `price_table_version`.
- **`throughline_ai_usage_attempts`**: one row per HTTP attempt to Groq.
  - `operation_id`, `stage`, `provider`, `model` and `attempt_number`.
  - `status` and `safe_failure_code`, using the existing enum.
  - `latency_ms`.
  - Transcription: `billed_audio_seconds`, which is the larger of 10 and the audio seconds.
  - Extraction: `prompt_tokens`, `cached_prompt_tokens` and `completion_tokens`.
  - `estimated_cost_microusd`. It is null when unpriced, never a silent zero.

Store a fixed allowlist of numeric usage fields only. Never store the raw `usage` object, the response body or `x_groq.id`.

### Instrumentation

- **Live path:** pass a per-run collector into the retry loops of `transcribeWithGroq` and `requestGroqExtraction`. It records every HTTP attempt: success, 429, JSON-validation retry, timeout and HTTP error. Each record has its latency and, for extraction, the usage numbers. Transcript and output handling stay the same.
- **Lineage path:** map `commit.attempts` into the same rows, so turning lineage on later keeps cost coverage.
- **Skipped stages:** when a transcript already exists and transcription is skipped, the run records extraction only.
- **Demos:** demo recordings are included and labeled, because they cost money.
- **Write timing:** ledger writes run after `persistRecording` through `EdgeRuntime.waitUntil`. A ledger failure never changes processing status, adds latency or fails the request. It logs a content-free counter.
- **Switch:** the server switch `THROUGHLINE_AI_USAGE_LEDGER_ENABLED` turns all of this on or off. It defaults to off until the canary.

### Price table

`core/ai-price-table.mjs` exports dated, versioned entries copied from the official pages above, each with its source URL.

- **Versioning:** a price change adds a new version and never edits an old one.
- **When cost is computed:** at write time, with the version stored, so it can be recomputed from the raw units.
- **Unknown models:** a model missing from the table yields a null cost and an `unpriced` count in the report.
- **What gets priced:**
  - successful attempts;
  - extraction attempts that returned usage;
  - successful transcription attempts.
- **Unpriced attempts:** failed attempts without usage are recorded with null cost.
- **Cross-check:** whether Groq bills timeouts or 429s is settled by the Option A reconciliation, not by assumption.

### Report

`npm run product:cost -- --from YYYY-MM-DD --to YYYY-MM-DD` reads aggregates with the service role. It prints:

- daily total cost;
- cost per successful recording, which is total cost (including failed runs) divided by `processed` operations;
- p50 and p95 cost per processed operation;
- the split between transcription and extraction;
- retry share and cost of failed processing;
- cached-token share;
- results by duration bucket and recording kind.

Internal and other use are reported separately, with an `unpriced` count. Evidence files record aggregates only.

### Synthetic duration curve

`scripts/measure-ai-cost-curve.mjs` sends synthetic audio straight to Groq. It uses the deployed contract's models, prompt and message construction, without going through the upload path, so the 5-minute free cap doesn't apply.

- **Audio:**
  - The speech is generated on a Mac with `say`, from a monologue written for this purpose that is shaped like a walking voice note.
  - It is encoded at the app's recording settings.
  - No real user audio is used.
- **Runs:** three at each of 1, 5, 15 and 30 minutes. Each run records units, latency and estimated cost.
- **What stays out of the repository:** generated audio, transcripts and outputs. The repository tracks only the script and an aggregate evidence file.
- **Spend:** expected Groq spend is under $1.

### Decision-grade bar (accepted by Mike, 2026-10-25)

Plus can be reconsidered when all three of these hold:

1. The synthetic curve is complete.
2. The ledger has run on production for at least 14 days with zero processing regressions.
3. Ledger cost for a calendar period is within ±20% of Groq's console spend for the same period, or any difference is explained.

Real public-use cost by duration stays a measuring item. It does not block Plus.

## Primary metric and guardrails

- **Primary:** AI cost per successful recording, as defined in [metrics.md](../../product/metrics.md#cost-efficiency).
- **Guardrails:**
  - Ledger writes add no user-visible latency.
  - The processing failure rate does not change.
  - Neither ledger table has any content, user, recording, email, prompt or key field. A test checks the columns.
  - Every priced row names its `price_table_version`.

## Acceptance and testing

- **Unit tests:**
  - Price arithmetic, including the 10-second minimum and cached tokens.
  - A model not in the table yields a null cost.
  - The usage allowlist drops unknown fields.
- **Retry-loop tests:** each attempt outcome produces exactly one attempt row with the right status and failure code. That covers 429-then-success, JSON-validation retry, timeout and HTTP error.
- **Failure isolation:** with the ledger insert forced to fail, processing still returns `processed` with the same timing budget.
- **Schema test:** the column list contains no forbidden field, and RLS denies anon and authenticated reads.
- **Canary:** with the switch on, run synthetic uploads on an allowlisted internal account. Show matching operation and attempt rows, the right outcomes and a priced total. Show that deleting the recording leaves the ledger rows in place.

## Rollback

Turn off `THROUGHLINE_AI_USAGE_LEDGER_ENABLED`. Processing never depends on the ledger, so nothing else changes. The tables can stay, or a down-migration can drop them, since they hold no product data.

## Non-goals

- Changing a model, `reasoning_effort`, output caps, prompts, retries, timeouts or the provider. Any finding goes back to Mike as a separate approval-bound decision.
- Per-user or per-account cost.
- Cost in PostHog.
- Billing alerts.
- Plus-tier labeling. Plus Phase 1 adds a `plan` column when it exists.
- Fixing TL-DATA-001's `unknown` channel.
- Turning lineage on.

## Codex feasibility questions

- **F1:** Instrument the legacy retry loops directly, or route the live path through `runRecordingOperation` with lineage writes off? The second removes duplicate retry logic but changes the live path more.
- **F2:** Compute cost in the edge function at write time, or in a SQL view over the raw units? The brief prefers write time with the stored version.
- **F3:** Is `EdgeRuntime.waitUntil` reliable enough for ledger writes after the response, or should the insert be awaited with a short timeout?
- **F4:** Can `buildExtractionMessages` move into `core/` so the curve script uses the exact production message construction?
- **F5:** Is a migration plus an api deploy behind a default-off switch routine reversible work under the [workflow](../WORKFLOW.md)? It should be.
- **F6:** Does recording the `is_internal_user` lookup per run add a request on the processing path? If it does, reuse the value already resolved for that request.

## Mike's decisions (2026-10-25)

1. **Option B:** build it.
2. **Decision-grade bar:** accepted as written above.
3. **TL-EVAL-001:** dropped as a dependency. Option B doesn't need lineage.

**Privacy-policy check for the implementer:** the ledger is designed to need no privacy-policy change. It holds no content and no user or recording link, which fits the policy's existing "recording-processing outcomes" wording. One caveat: while a recording still exists, `audio_seconds` plus `usage_date` could be joined back to it by someone with the service role. If review finds the ledger needs new policy text, or whole-second audio length is judged too linkable, stop and bring it back to Mike. A data-use policy change is his to approve.

## Evidence

- 2026-10-25: Mike chose Option B, accepted the decision-grade bar and dropped the TL-EVAL-001 dependency ([decision log](../../decision-log.md)).
- 2026-10-25: this baseline; Groq prices and usage fields read from the official pages linked above.
