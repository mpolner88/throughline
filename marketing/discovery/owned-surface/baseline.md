# Owned discovery surface baseline

**Slice:** `TL-DISC-001` / `DISC-02`
**Checked:** 2026-08-27

## Current baseline

| Claim | Status | Evidence | Checked |
| --- | --- | --- | --- |
| The public US App Store listing is Throughline 1.0.4. | `verified_current` | [public listing](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241); [current state](../../../docs/CURRENT_STATE.md) | 2026-08-27 |
| The prior public root was a support/privacy placeholder without product proof or an App Store action. | `verified_current` | [run baseline](../_run/baseline.md); prior `docs/index.html` source inspection | 2026-08-27 |
| Throughline turns voice notes into structured notes with summaries and to-dos. | `repository_assertion` | [product charter](../../../docs/PRODUCT.md); [claim register](../proof-factory/claim-register.md) | 2026-08-27 |
| Saved notes can be read by an owner-selected agent through owner-scoped, read-only MCP access. | `verified_current` | [current state](../../../docs/CURRENT_STATE.md); [agent connection guide](../../../docs/agent-connect.md) | 2026-08-27 |
| First MCP tool use lacks canonical server-side measurement. | `verified_current` | [metric definitions](../../../product/metrics.md) | 2026-08-27 |

## Measurement boundary

The public page has no analytics instrumentation in this slice. A website App Store click is therefore not measured locally. The prepared `website-aug26` campaign link is the attributable destination, and Apple first-time downloads are reportable only when Apple exposes the aggregate. Same-window `auth_succeeded` is an aggregate proxy, not a matched install-to-auth conversion. Public, internal, TestFlight, debug, and unknown cohorts remain separate. Unavailable telemetry is a coverage gap, not zero.

## Proof baseline

The approved first deployment uses only the three visually inspected public-listing screenshots in `app-store/screenshots/iphone-6.9/`. They are public 1.0.4 creative with synthetic planning content; they do not evidence internal 1.0.5. No inspected MP4 exists. Motion proof is deferred and tracked as a blocker.

## Non-goals

- No deployment, App Store action, spend, outreach, posting, submission, or product change.
- No native-agent, OAuth, write-capability, comparative-speed, customer-outcome, or telemetry claim.
