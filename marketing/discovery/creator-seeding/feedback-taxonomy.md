# DISC-04 Feedback Coding Plan

**Prepared:** 2026-08-27
**Status:** `planned`; coded learning only.

## Codes

| Code | Use when the observed feedback concerns | Next decision rule |
| --- | --- | --- |
| `setup_friction` | connection, setup, or trial steps are hard to understand or complete | Inspect the exact safe setup step; do not infer product failure from one code. |
| `unclear_value` | the record -> structure -> retrieval benefit is unclear | Compare the proof sequence and message against the claim register. |
| `privacy_concern` | owner control, read access, retention, or token boundary is questioned | Escalate for privacy/technical review before another action. |
| `wrong_audience` | the workflow is not relevant to the person's public audience or practice | Revisit cohort lens; do not press for coverage. |
| `proof_disbelief` | the synthetic demonstration is not credible or inspectable enough | Require direct proof review; do not strengthen claims. |
| `missing_agent` | a desired client, capability, or connection path is absent | Record as a product question only; do not imply support. |
| `missing_use_case` | the proof does not cover the job the person names | Consider a new synthetic scenario after approval. |
| `positive_trial_intent` | independent interest in inspecting the controlled workflow | Requires a separate exact trial approval. |
| `content_fit` | the proposed format or audience angle is appropriate or inappropriate | Use only with product-fit and downstream guardrails. |
| `no_response` | no reply is recorded after one approved send window | Neutral state; no automated or repeated contact. |

## Coding Procedure

- Store one or more codes, never a correspondence excerpt or summary that can reconstruct it.
- Record a count by code, audience lens, and approved campaign label only when the count is safe to report.
- Preserve `none_recorded` when there is no approved interaction. Missing information is not a negative signal.
- Treat three independent instances of the same material concern as a candidate messaging or product question. A single concern is evidence, not a trend.
- Never convert a positive trial signal into a testimonial, endorsement, or public proof without a separate written disclosure and rights decision.

## Example Aggregate Output

`planned`: no coded feedback, no trial outcome, no attributed downloads, and no conclusion. The future report will separate `debug`, `internal_dogfood`, `external_testflight`, `external_app_store`, and `unknown` cohorts as defined in [metrics](../../../product/metrics.md).
