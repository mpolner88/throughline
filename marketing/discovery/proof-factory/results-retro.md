# DISC-03 results retro

**Experiment ID:** `20260827-proof-agent-builders-voice-agent-01`
**Status:** `not_run`
**External action:** none taken.

## Fixed experiment contract

| Field | Value |
| --- | --- |
| Audience | Individual builders who already use an AI agent and capture work thoughts away from a keyboard. |
| Material variable | Opening hook only: H-01, H-02, or H-03. |
| Constant proof | Current-build synthetic record -> structured note -> read-only retrieval. |
| Primary metric | Aggregate first-time App Store downloads attributed to the named source/campaign when Apple exposes it. |
| Supporting metrics | Video hold/completion, qualified replies, saves, App Store clicks, same-window aggregate `auth_succeeded`, non-demo first value, and days 2-7 repeated value. |
| Coverage gap | First server-side MCP tool use remains unavailable until instrumented. |
| Reporting windows | Platform-native early read at 24-72 hours; aggregate acquisition/product read at a declared same-window after platform reporting is available. |

## Results template

| Field | Result | Evidence state |
| --- | --- | --- |
| Published asset IDs and channels | `not_run` | `planned` |
| Hook selected | `not_run` | `planned` |
| Impressions / plays | `not_run` | `unavailable` until a platform export exists |
| Hold / completion | `not_run` | `unavailable` until a platform export exists |
| Qualified replies | `not_run` | `unavailable` until review; retain only coded aggregate themes |
| Saves / bookmarks | `not_run` | `unavailable` until platform evidence exists |
| App Store clicks | `not_run` | `unavailable` until named campaign link and platform evidence exist |
| First-time App Store downloads | `not_run` | `unavailable` below Apple reporting threshold or without campaign attribution |
| Same-window downloads-to-`auth_succeeded` proxy | `not_run` | `unavailable` until both aggregate sides exist; never call it matched conversion |
| Non-demo first value | `not_run` | `unavailable` until cohort/reconciliation/readiness conditions are met |
| Days 2-7 repeated value | `not_run` | `collecting baseline` until five mature activated users exist |
| First MCP tool use | `not_run` | `coverage gap`, never zero |
| Cohorts | `not_run` | Report `debug`, `internal_dogfood`, `external_testflight`, `external_app_store`, and `unknown` separately |

## Qualitative coding

Store no raw comments, messages, user names, handles, emails, content, or identifiers in this artifact. Use only aggregate coded themes such as `setup friction`, `read-only concern`, `meeting-recorder mismatch`, `retrieval need`, or `unclear value`. Record count, channel, public/internal distribution classification, and decision relevance; suppress small groups where platform privacy thresholds require it.

## Decision rule

- `scale`: the declared primary metric is available and the qualified downstream evidence is directionally consistent with no guardrail breach.
- `iterate`: meaningful aggregate signals or coded objections identify a single next variable to change.
- `pause`: evidence is available but lacks qualified downstream behavior or shows a guardrail concern.
- `retire`: replicated evidence indicates the proof framing is harmful or wrong for the audience.
- `inconclusive`: data is unavailable, below privacy thresholds, unreconciled, mixed across cohorts, or too sparse. Set a measurement action, not a winner.
