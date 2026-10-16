# Throughline Plus — TL-PREM-001

**Scoped:** 2026-10-15 by Claude with Mike (conversation 2026-10-12 to 2026-10-15). Base: `codex/running-list` at `eabb79c`.
**Backlog state:** `collecting_evidence` (unchanged until Mike records the Phase 0 decisions below)
**Slice phase:** `baseline` — baseline established and scope chosen by Mike in conversation. Build selection and the approval-bound decisions are not yet recorded in [decision-log.md](../../decision-log.md). Recording them moves the backlog state and phase forward together.
**Next gate:** Mike reviews this brief and records the four Phase 0 decisions. Codex reviews feasibility under [the tandem rules](../AGENT_TANDEM.md#daily-working-agreement).
**Authority:** Pricing, recording-limit, provider, data-use policy and App Store submission changes each require Mike's explicit approval ([WORKFLOW.md](../WORKFLOW.md)). This brief approves none of them. It does not authorize code, App Store Connect changes, RevenueCat setup, policy edits or a release.

## Problem

Throughline caps every authenticated recording at five minutes and has no way to accept payment. A thought that runs longer — a long commute, an extended walk — is cut off, and there is no path to keep going.

Mike's two goals for the first paid version:

1. **Payments ready:** subscription purchase, entitlement and server enforcement work end to end in sandbox and internal TestFlight.
2. **Learn if people pay:** put one small, real paid offer in front of users and find out whether anyone buys and why.

## Selected scope

Chosen by Mike in conversation, 2026-10-12 to 2026-10-15.

| Question | Choice | Considered, not chosen |
| --- | --- | --- |
| Goal | Payments plumbing verified first, then a minimal real offer | Full revenue launch; cost recovery only |
| Paid benefit | **30-minute** cap per recording | 15 min; 60 min; unlimited with hidden safety cap |
| Data portability | **Deferred** out of v1 (new backlog item) | Obsidian/Markdown sync; one-tap export; original audio |
| Price | **$4.99/month**, one auto-renewing product, no trial | $9.99/month; monthly + annual; one-time unlock |
| First offer | One-time sheet **after the first note finishes processing** | At the five-minute cap; staged; post-purchase welcome |
| After dismissal | **Settings row + one quiet line** when a free recording stops at 5:00 | Settings only; repeating sheet |
| Entitlement provider | **RevenueCat** | Own StoreKit 2 verification + App Store Server Notifications; client-only check |

This scope supersedes the 2026-04-30 Paid tier ($9.99/month, 30 minutes, no daily cap, different transcription) and reopens the 2026-08-17 decision that premium limits stay backlog-only until cost baselines are decision-grade. Both must be recorded in the decision log (Phase 0).

## Baseline evidence

Verified in source on 2026-10-15 unless noted.

- **The five-minute cap is client-only.** `maxRecordingSeconds = 300` in [HomeView.swift](../../ios/Throughline/Views/HomeView.swift); see the "Authenticated recording limit" row in [CURRENT_STATE.md](../CURRENT_STATE.md).
- **The server checks length only for demos,** using the client-reported `x-throughline-duration-seconds` header ([api/index.ts](../../supabase/functions/api/index.ts), `DEMO_MAX_DURATION_SECONDS`). Authenticated uploads have no duration check.
- **No purchase code exists.** StoreKit is imported only for `AppTransaction` attribution in [ProductEventAttribution.swift](../../ios/Throughline/Services/ProductEventAttribution.swift).
- **Recording is foreground-only.** No `UIBackgroundModes` entry exists in the iOS project, and the app does not disable the idle timer. [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift) records AAC, 44.1 kHz, mono, "high" quality, with no explicit bitrate.
- **Portability today** is read-only agent access over MCP ([agent-connect.md](../agent-connect.md)). There is no in-app export.
- **AI cost per recording is not measured** (`TL-COST-001`, `collecting_evidence`).
- **User base:** about seven accounts ever, from a 2026-10-10 analytics probe. That probe is not a tracked evidence file; re-verify before treating it as a baseline.
- **External, read 2026-10-15, re-verify in Phase 1:** Groq's [speech-to-text guide](https://console.groq.com/docs/speech-to-text) lists a 25 MB upload limit; its [Whisper Large v3 page](https://console.groq.com/docs/model/whisper-large-v3) lists 100 MB for paid tiers via URL. Third-party summaries of RevenueCat pricing say it is free up to $2.5K monthly tracked revenue, then 1%; one says server-side webhooks need a paid plan. RevenueCat's [webhook docs](https://www.revenuecat.com/docs/integrations/webhooks) recommend an authorization header and re-reading the customer record after each event.

## User experience

**Throughline Plus** is a working name; Mike chooses the final name during design.

| | Free (unchanged) | Plus |
| --- | --- | --- |
| Maximum per recording | 5 minutes | **30 minutes** |
| Onboarding demo | 30 seconds | 30 seconds |
| Everything else | Unchanged | Unchanged |

**Offer surfaces**

1. **One-time sheet** after a user's first recording finishes processing into a note. The server records that it was shown, so reinstalling or using a second device does not show it again. Existing users, who already have notes, see it once after their next processed note following the update.
2. **Settings row:** subscribe, current status, manage (opens Apple's subscription management) and restore purchases.
3. **At the free cap:** when a free recording stops at 5:00, it saves exactly as it does today. One quiet line beside it links to the offer. No sheet appears at that moment.

**Required on the offer (Apple guideline 3.1.2):** price and billing period, an auto-renewal statement, links to the Terms of Use and Privacy Policy, and restore purchases.

**When a subscription ends:** new recordings return to the five-minute limit. Notes already created from long recordings are unaffected.

Copy and visual treatment follow [throughline-brand-decisions.md](../../throughline-brand-decisions.md): calm and restrained, with no urgency, scarcity or countdown language.

## Architecture

Component names are proposals; Codex owns the final implementation.

### Identity

Each Throughline account gets a random `billing_customer_id` (UUID) generated by the server. It is RevenueCat's App User ID and the only identifier RevenueCat receives — never the auth ID, email or any note content. This follows the existing PostHog pseudonymous-identifier pattern. The app configures RevenueCat with this ID after sign-in, never creates an anonymous RevenueCat user, and disables purchase until configuration succeeds.

### Server

- **`billing_accounts` table**, one row per account: `account_id`, `billing_customer_id`, `plus_active`, `plus_expires_at`, `environment` (sandbox or production), `refreshed_at` and `plus_offer_shown_at`. RLS: owners can read their own row; only service code writes.
- **API routes:** one returns the caller's billing ID (creating the row if missing), Plus status and offer-shown state; one records that the one-time offer was shown.
- **`billing-webhook` Edge Function:** verifies RevenueCat's authorization header (and HMAC signature if enabled), returns 200 promptly, then re-reads the customer from RevenueCat's REST API and upserts `billing_accounts`. Unknown or anonymous IDs are logged without identifiers and ignored.
- **On-demand refresh:** if an upload claims more than 300 seconds and the account's row does not grant Plus, the server reads RevenueCat's REST API once before rejecting. This covers a purchase whose webhook has not arrived yet. It also keeps enforcement correct if webhooks fail or turn out to need a paid RevenueCat plan.
- **Server switch:** `THROUGHLINE_PLUS_ENABLED`, off by default, with an internal-account allowlist for Phase 1. When off, offer surfaces are hidden and the server limit stays 300 seconds, except that active subscribers keep 1,800 (see Rollback).

### Limit enforcement in the capture path

```text
limit = 300
if Plus is enabled for the account and plus_expires_at >= now - 24h:
    limit = 1800
accept when reported_duration <= limit + 10 seconds
       and (reported_duration <= 300 or bytes <= size_ceiling(limit))
```

- The 24-hour window covers a subscription lapsing mid-recording and capture-queue retries after expiry.
- The size ceiling applies only to uploads claiming more than 300 seconds. It is derived from the fixed bitrate with headroom, because reported duration can be forged. Uploads of 300 seconds or less keep today's acceptance, so older app builds are unaffected.
- **Over the limit:** a non-retryable 4xx with code `recording_limit_exceeded`. The capture queue keeps the local copy and shows a clear message; it does not retry-loop.
- **RevenueCat unreachable during refresh:** a retryable 503 with code `entitlement_unavailable`. A paying user's recording is never rejected permanently because of a provider outage.

### iOS

- **RevenueCat SDK** (Swift Package Manager), one offering containing one monthly package: App Store product `throughline_plus_monthly`, entitlement `plus`.
- **Custom SwiftUI offer sheet,** not RevenueCat Paywalls, to keep brand control.
- **Settings row** and **at-cap line** as described above.
- **HomeView** takes `maxRecordingSeconds` from entitlement (300 or 1,800); the near-limit display scales with it.
- **Long-recording reliability:**
  - Enable the `audio` background mode so recording continues when the screen locks.
  - Handle interruptions (calls, Siri) and route changes (CarPlay, Bluetooth) by finalizing safely into the existing durable capture.
  - Set an explicit encoding of 16 kHz mono at about 32 kbps (about 7 MB per 30 minutes; Whisper processes 16 kHz audio). This also changes free recordings, so it needs an evaluation check for transcription accuracy before release.

### Processing

A 30-minute recording produces a transcript about six times longer than today's maximum. Verify extraction quality, extraction latency, and Edge Function wall-clock limits end to end with a real 30-minute recording.

### Account deletion

Delete the `billing_accounts` row and request deletion of the RevenueCat customer, matching the existing processor-deletion request for PostHog. Deleting an account does not cancel an Apple subscription; the deletion flow must say so and link to subscription management.

### Privacy policy

Add RevenueCat as a processor. It receives the random billing ID and Apple purchase and subscription data — never audio, transcripts or notes. This is a data-use policy change and needs Mike's approval (Phase 0).

## Rollout

### Phase 0 — Mike only

Agents cannot accept agreements or enter banking or tax details.

- Accept the Paid Applications Agreement in App Store Connect and complete banking and tax details.
- Enroll in the App Store Small Business Program (15% commission instead of 30%).
- Create the RevenueCat account and project.
- Record four decisions in `decision-log.md`:
  1. Plus is priced at $4.99/month, one auto-renewing product, no trial.
  2. The Plus recording limit is 30 minutes; the free limit is unchanged at 5 minutes.
  3. RevenueCat is approved as a processor, with the data-use and privacy-policy change described above.
  4. TL-PREM-001 starts ahead of the TL-COST-001 baseline, superseding the 2026-04-30 Paid tier and reopening the 2026-08-17 decision.

### Phase 1 — Payments working, hidden

- **Backend:** `billing_accounts`, API routes, `billing-webhook`, capture-limit enforcement, account-deletion cleanup, server switch with allowlist.
- **iOS:** RevenueCat integration, Settings row, background recording, interruption handling, fixed bitrate, dynamic cap.
- **Metrics:** add the new event and metric definitions to [product/metrics.md](../../product/metrics.md) and the product-event contract.
- **Exit:** on a physical iPhone, in internal TestFlight with sandbox purchases: purchase → 30-minute recording with the screen locked → note processed → cancel or expire → five-minute limit restored. No capture is lost at any step. Restore works after reinstall.

### Phase 1b — Design (in parallel)

Claude runs `/ui-handoff` for the offer sheet, Settings row and at-cap line. Mike selects a candidate; Claude writes the handoff from [the template](../templates/UI_DESIGN_HANDOFF.md); Codex reviews feasibility and implements.

### Phase 2 — Live

App Store submission with the subscription attached (Apple requires a first subscription to be submitted with an app version; submission needs Mike's approval), then the server switch is turned on for everyone.

## Primary metric and guardrails

- **Primary metric:** eligible users who start and retain a Plus subscription (from the TL-PREM-001 backlog entry). At current scale, report counts, not rates. **Phase 2 success:** at least one real paying user and an understanding of why they paid.
- **Guardrails:** free recording-completion rate unchanged; zero lost captures; refund count; AI cost per Plus recording.
- **New events** (pseudonymous, no content): `offer_shown` (surface: first_note, settings, cap_line), `offer_dismissed`, `purchase_started`, `purchase_completed`, `purchase_failed` (reason category), `restore_completed`, `recording_cap_reached` (tier), `plus_recording_processed` (duration bucket, estimated cost).
- **Revenue:** RevenueCat dashboard; not copied into tracked artifacts.

## Acceptance and testing

- **Unit tests:** limit selection, the 24-hour window, the size ceiling and its 300-second exemption, webhook authorization and HMAC, `entitlement_unavailable` behavior, and account-deletion cleanup.
- **Xcode StoreKit configuration tests:** purchase, cancel, expire, restore and refund.
- **Sandbox end to end** in internal TestFlight on a physical device (Phase 1 exit above).
- **Device matrix:** screen lock, incoming call, Siri, CarPlay or Bluetooth route change, low storage, airplane mode during upload. Label simulator and physical-device evidence separately.
- **Evaluation:** transcription accuracy at the new bitrate against the existing corpus, with no regression beyond the eval's noise band.
- **Processing:** at least one real 30-minute recording through transcription and extraction in production-equivalent settings.
- **Claude review** of the implemented surfaces against the selected design before internal release.

## Rollback

- **Stop selling:** turn off `THROUGHLINE_PLUS_ENABLED` to hide offer surfaces, and remove the product from sale in App Store Connect. Active subscribers keep the 30-minute limit until their period ends; rollback must never take away a paid benefit mid-period.
- **Bitrate:** revert in an app build if evaluation or users show a regression.
- **Background audio:** revert in an app build. Plus stays gated off until long recordings are reliable again.
- **RevenueCat removal** requires an app release and a migration of entitlement records. Not expected in v1.

## Non-goals

Data portability or export (tracked as a new backlog item), annual plans, free trials, introductory or promotional offers, daily caps, Family Sharing, Android or web purchase, changes to the onboarding demo limit, putting any existing feature behind payment, and meeting or team recording.

## Open technical questions for Phase 1

Each must be answered with dated evidence before Phase 2.

1. RevenueCat: confirm current pricing and whether webhooks are available on the free plan, from RevenueCat's official pricing page.
2. Groq: confirm the upload limit for `whisper-large-v3-turbo` on Throughline's account tier.
3. Baseline: what happens today, on a physical device, to a recording when the screen auto-locks.
4. Baseline: the actual file size of a five-minute recording at current settings.
5. Edge Function wall-clock and extraction quality for a 30-minute transcript.
6. Capture-queue behavior on a non-retryable 4xx limit rejection.
7. App Review: background-audio justification and subscription metadata (display name, description, review screenshot).
8. Final product name (Mike, during design).

## Evidence and release manifest

To be filled as work proceeds: Phase 0 decision-log entries, Codex feasibility receipt, selected design and handoff, Phase 1 sandbox end-to-end evidence, evaluation result, device matrix, release manifest and App Store submission record.
