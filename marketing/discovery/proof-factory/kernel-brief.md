# DISC-03 kernel brief

**Experiment ID:** `20260827-proof-agent-builders-voice-agent-01`
**Status:** `planned`
**Verified:** 2026-08-27
**Structural state:** `structural_ready: yes`
**Release state:** `release_ready: no`

## Single-variable contract

| Field | Selected value |
| --- | --- |
| Audience: | Individual builders who already use an AI agent and capture work thoughts while walking, driving, or away from a keyboard. |
| Situation: | A short spoken plan arrives before the person returns to the agent they use for work. |
| Tension: | The thought can remain trapped in audio or scattered text instead of becoming usable agent context. |
| Promise: | Voice notes your agent can read. |
| Proof: | A current-build capture shows one synthetic note moving from record to structured note and then being retrieved through the owner-scoped, read-only MCP path. |
| CTA: | Watch the proof, then visit the named App Store campaign destination when DISC-05 supplies it. |
| Experiment ID: | `20260827-proof-agent-builders-voice-agent-01` |
| Material variable: | Opening hook only: the first 3 seconds frame either lost context, the concrete record-to-agent loop, or the return-to-desk moment. The body, proof, CTA, audience, placement, and destination remain fixed. |

## Evidence boundary

- `verified_current`: Throughline's current documented path is owner-scoped and read-only MCP access to saved notes. Source: `docs/CURRENT_STATE.md`, `docs/agent-connect.md`; checked 2026-08-27.
- `repository_assertion`: The discovery baseline records the public App Store listing and a thin owned site as checked on 2026-08-27. Source: `marketing/discovery/_run/baseline.md`.
- `observed_signal`: Reddit requires authentic participation and community-rule compliance; the two named community rule pages expose their headings without disclosing their detailed rules while logged out. Sources: <https://redditinc.com/policies/reddit-rules>, <https://www.reddit.com/r/modelcontextprotocol/about/rules/>, <https://www.reddit.com/r/PKMS/about/rules/>; checked 2026-08-27.
- `hypothesis`: A concrete current-build proof loop will earn more qualified attention from this audience than a generic voice-note category explanation.
- `planned`: Current-build capture and a named App Store campaign destination are prepared but not created by this workstream.
- `blocked`: No result, lift, completion, App Store click, download, first value, or first MCP use can be reported until a separately approved, published experiment has privacy-safe aggregate coverage.

## Baseline and learning design

The primary discovery metric is aggregate first-time App Store downloads attributed to the named source or campaign when Apple exposes it. Same-window aggregate downloads and `auth_succeeded` are only an acquisition proxy, not a matched conversion rate. First value excludes onboarding-promotion activity. Server-side first MCP tool use is an instrumentation coverage gap and must be reported as unavailable, not zero.

Report `debug`, `internal_dogfood`, `external_testflight`, `external_app_store`, and `unknown` separately. Internal TestFlight evidence cannot establish a public-product result. Baseline fields remain `not_run` in `results-retro.md` because this work creates no assets, posts, or campaign actions.

## Editorial selection

**Chosen story:** a person records a fictional return-to-desk plan, receives a structured note, and later asks their agent for the plan. The retrieval proves the differentiated second act without making MCP the opening jargon.

**Rejected: "fastest way" opening.** `needs-verification`; no current comparative evidence or Mike approval supports a superiority claim.

**Rejected: generic productivity montage.** It would obscure the product's verified record -> structure -> agent-read proof loop.

**Rejected: token/setup walkthrough.** It exposes a secret-bearing screen and distracts from the intended user benefit. Setup belongs on the connection page, not in this master proof.

## Gate

Mike's required decision is `approve production | revise | defer`. Approval to produce means only controlled current-build capture and optional disclosed support candidates under the attached plans. It is not approval to publish, schedule, spend, create an account, change product behavior, or use a provider.
