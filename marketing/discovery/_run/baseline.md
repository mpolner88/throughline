# Discovery Run Baseline

**Run date:** 2026-08-27
**Slice:** `TL-DISC-001`
**Coordinator route:** 5.6 Sol, high effort
**Status:** frozen pre-run baseline; postflight recorded below

## Verified Current

| Surface | Verified state | Evidence |
| --- | --- | --- |
| Public App Store | Version `1.0.4` is live in the US. The listing names AI voice notes, structured to-dos, and MCP access. | Verified 2026-08-27: <https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241> |
| Owned website | Root is a minimal support/privacy page with no App Store action or product proof. | Verified 2026-08-27: <https://mpolner88.github.io/throughline/> |
| Internal build | Version `1.0.5`, build `2026082601`, is in Apple's one-tester Internal QA group; installation and updated Home use remain unproved. | Verified 2026-08-27: `docs/CURRENT_STATE.md`, `docs/evidence/2026-08-27-home-feedback-first-slice.md` |
| MCP product path | Owner-scoped, read-only remote MCP remains part of the current product contract. | Verified 2026-08-27: `docs/CURRENT_STATE.md`, `docs/agent-connect.md` |
| First tool use | Server-side first MCP tool use remains an instrumentation gap. | Verified 2026-08-27: `product/metrics.md` |
| Higgsfield | The local Codex registry lists Higgsfield as enabled, and the plugin's read-only balance endpoint authenticated successfully. No generation has occurred. | Verified 2026-08-27: local `codex mcp list` plus Higgsfield `balance`; generation quality remains unproved |
| Adobe creative connector | Session initialization succeeded and exposes Firefly image generation/editing plus Adobe video workflows. No asset was uploaded or generated. | Verified 2026-08-27: Adobe mandatory initialization response; output quality remains unproved |

## Repository Assertions

- Existing campaign links and draft experiments are present under `marketing/experiments/`; their live platform state is not implied.
- The discovery queue contains `ROOT-00`, five workstreams, and `ROOT-99`; its structure must be revalidated before dispatch.

## Hypotheses

- A concise current-build proof of record, structure, and agent retrieval will outperform generic AI voice-note positioning with qualified agent users.
- Agent-native discovery, an owned proof page, proof-led content, small high-fit seeding, and existing-demand capture can create complementary acquisition paths.
- The message “fastest way to get your voice to an AI agent” is strategically sharp but requires comparative evidence before being stated as fact.

## Measurement Boundary

The primary metric is first-time App Store downloads attributed to a named source or campaign when Apple exposes the aggregate. Compare aggregate downloads with aggregate `auth_succeeded` activity only as a same-window proxy. Keep internal and public cohorts separate. Treat unavailable attribution and first-tool-use coverage as unavailable, not zero.

## External Gates

The owned static site may be built and deployed after verification. Paid spend, creator compensation, direct outreach, account posting, community or directory submissions, App Store changes, and live product changes require exact-action approval.

## Postflight

On 2026-08-27 the verified owned discovery surface replaced the placeholder at <https://mpolner88.github.io/throughline/> and added <https://mpolner88.github.io/throughline/voice-to-task-list/>. Pages build `1179780269` reported `built` from commit `1770db3`. This result changes the owned-surface baseline only; acquisition and downstream product results remain unmeasured.
