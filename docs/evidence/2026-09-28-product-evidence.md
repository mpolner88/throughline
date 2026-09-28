# Throughline weekly product evidence

Generated: 2026-09-28T17:11:33.215Z

**Audit interpretation:** These are mixed operational aggregates, not a public-product baseline. Activation and retention are below the canonical readiness floors. The generated report printed percentages for very small cohorts; this audit copy suppresses them in favor of counts. No model-quality, activation-lift, or retention conclusion is supported. The original generated output remains private.

## Decision status

**collecting baseline** — 192 events, 25 sessions, and 3 signed-in users are represented.

## Primary KPIs

- 24-hour first real recording activation: collecting baseline (1/1); promoted demo notes are excluded
- Demo → auth → first real recording: collecting baseline (1/1)
- Auth without demo → first real recording: collecting baseline (0/0)
- Authenticated users by entry mode: {"apple":1}
- Authenticated users by account state: {"new":1}
- Home viewers by state: {"empty":1,"populated":2}
- Weekly activated users: 0
- Days 2–7 activated retention: collecting baseline (1/2)
- Scope: mixed operational coverage, not a public-product baseline; the August 17 snapshot remains mixed and legacy

## Funnel coverage

| Step | Unique entities | Events |
| --- | ---: | ---: |
| `first_opened` | 6 | 6 |
| `onboarding_started` | 5 | 5 |
| `demo_recording_completed` | 4 | 4 |
| `auth_succeeded` | 1 | 1 |
| `home_viewed` | 3 | 18 |
| `recording_started` | 2 | 5 |
| `recording_uploaded` | 2 | 6 |
| `recording_processed` | 2 | 6 |

## Processing reconciliation

Post-cutover schema-v2 outcomes only; legacy rows are never joined heuristically. Correctly reconciled: 100% (4/4).

| Cohort | Matched | Event only | Durable only | State mismatch | Duplicate | Total | Correct rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| debug | 0 | 0 | 0 | 0 | 0 | 0 | collecting baseline |
| internal dogfood | 0 | 0 | 0 | 0 | 0 | 0 | collecting baseline |
| external testflight | 0 | 0 | 0 | 0 | 0 | 0 | collecting baseline |
| external app store | 0 | 0 | 0 | 0 | 0 | 0 | collecting baseline |
| unknown | 4 | 0 | 0 | 0 | 0 | 4 | 100% |

- Legacy v1 unattributed outcome rows: 2
- Final durable recordings without a schema-v2 upload marker: 1
- Public-baseline eligible outcomes: 0 (external, confirmed non-internal, App Store, schema v2, and matched only)

## Quality evidence integrity

Quality evidence: collecting. Integrity gate: insufficient sample size; winner: none.

- Complete lineage coverage: collecting baseline (0/0)
- Distinct diagnostic-grade cases: 0 (diagnostic only; excluded from winner coverage)
- Reviewed-field coverage: collecting baseline (unavailable/0 fields across 0 cases; transcript-explicit cases: 0)
- Independent full-schema prediction coverage: collecting baseline (unavailable/unavailable); minimum: 20; sample: insufficient; holdout: unavailable
- Lifecycle count window starts: 2026-08-24T17:11:33.215Z
- Processing operations in lifecycle window: {"started":0,"succeeded":0,"failed":0,"total":0}
- Corpus lifecycle events in lifecycle window: {"materialized":0,"revalidated":0,"invalidated":0,"raw_artifacts_deleted":0}
- Isolation failures: none observed or unavailable
- Retention: {"standard_expired":null,"evaluation_protected":null,"eligibility_ended":null}
- Quarantined explanations: 0 (count only; text excluded)
- Contract-integrity rejections: none observed or unavailable

## Guardrails

- Recording failure rate, trailing 7 days: collecting baseline (0/0)
- Extraction quality responses: 4; average: 4.75; scores ≤2: 0; agent-not-ready: 0
- Extraction issue types: {"transcript_error":1}

## Product feedback intake

- Aggregate submissions: 0; new: 0; contact allowed: 0
- By category: none reported
- By source: none reported

## Recommended next actions

- Collect at least five newly signed-in users before treating activation movement as directional.
- Keep the existing feedback entry point visible; do not add a more aggressive prompt until real usage grows.
