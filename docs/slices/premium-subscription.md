# Throughline Plus — TL-PREM-001

**Scoped:** 2026-10-15 by Claude with Mike (conversation 2026-10-12 to 2026-10-15). Base: `codex/running-list` at `eabb79c`. Updated 2026-10-25 with measured file sizes and official RevenueCat and Groq documentation.
**Backlog state:** `collecting_evidence`. Plus is sequenced after TL-COST-001.
**Slice phase:** `baseline`. The Phase 0 decisions were recorded in [decision-log.md](../../decision-log.md) on 2026-10-25: price, recording limit and processor approved; starting before the cost baseline declined. Build entry waits for AI cost measurement and Mike's prioritization.
**Next gate:** TL-COST-001 ([scoped brief](ai-cost-measurement.md)) reports AI cost per successful recording, then Mike decides whether Plus enters build. Design selection (candidates A, B and C) and the product name stay open until then. Codex reviews feasibility under [the tandem rules](../AGENT_TANDEM.md#daily-working-agreement) once Plus is prioritized.
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
| Data portability | **Deferred** out of v1 (TL-PORT-001) | Obsidian/Markdown sync; one-tap export; original audio |
| Price | **$4.99/month**, one auto-renewing product, no trial | $9.99/month; monthly + annual; one-time unlock |
| First offer | One-time sheet **after the first note finishes processing** | At the five-minute cap; staged; post-purchase welcome |
| After dismissal | **Settings row + one quiet line** when a free recording stops at 5:00 | Settings only; repeating sheet |
| Entitlement provider | **RevenueCat** | Own StoreKit 2 verification + App Store Server Notifications; client-only check |

Recorded 2026-10-25: the $4.99 price supersedes the 2026-04-30 Paid tier price ($9.99/month), and the 30-minute limit replaces the 15-minute premium figure from 2026-08-17. Mike declined to reopen the 2026-08-17 sequencing, so premium work stays backlog-only until cost baselines are decision-grade.

## Baseline evidence

Verified in source on 2026-10-15 unless noted.

- **The five-minute cap is client-only.** `maxRecordingSeconds = 300` in [HomeView.swift](../../ios/Throughline/Views/HomeView.swift); see the "Authenticated recording limit" row in [CURRENT_STATE.md](../CURRENT_STATE.md).
- **The server checks length only for demos,** using the client-reported `x-throughline-duration-seconds` header ([api/index.ts](../../supabase/functions/api/index.ts), `DEMO_MAX_DURATION_SECONDS`). Authenticated uploads have no duration check.
- **No purchase code exists.** StoreKit is imported only for `AppTransaction` attribution in [ProductEventAttribution.swift](../../ios/Throughline/Services/ProductEventAttribution.swift).
- **Recording is foreground-only.** No `UIBackgroundModes` entry exists in the iOS project, and the app does not disable the idle timer. [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift) records AAC, 44.1 kHz, mono, "high" quality, with no explicit bitrate. A Mac estimate of those settings (AVAudioFile with the same encoder settings, 125 seconds of synthetic speech, 2026-10-25) measured about 63 kbps: about 2.4 MB per five minutes and 14.2 MB per 30 minutes. Confirm on a physical device.
- **Portability today** is read-only agent access over MCP ([agent-connect.md](../agent-connect.md)). There is no in-app export.
- **AI cost per recording is not measured** (`TL-COST-001`, `collecting_evidence`).
- **User base:** an untracked 2026-10-17 analytics probe (aggregate counts only) found about 17 first-open sessions since 2026-08-15, about 14 of them human-looking, roughly matching 16 App Store downloads. Only Mike was active after 2026-10-06, and the acquisition channel was always `unknown`. Re-verify before treating it as a baseline.
- **External, read from official pages on 2026-10-25; re-verify in Phase 1:**
  - **Groq:** the [speech-to-text guide](https://console.groq.com/docs/speech-to-text) caps direct file uploads at 25 MB on every tier; larger files, up to 100 MB on the dev tier, must use the `url` parameter. Throughline sends a direct file upload ([api/index.ts](../../supabase/functions/api/index.ts)), so 25 MB binds, and a 30-minute recording at today's settings fits. The [model page](https://console.groq.com/docs/model/whisper-large-v3-turbo) lists a flat 100 MB without that split; the guide is the stricter source. Transcription bills $0.04 per audio hour with a 10-second minimum per request, so a 30-minute recording costs about $0.02 to transcribe. Extraction cost remains unmeasured (`TL-COST-001`).
  - **RevenueCat:** the [pricing page](https://www.revenuecat.com/pricing) is free up to $2,500 monthly tracked revenue; above that, 1% applies to all tracked revenue. The free tier is the Pro plan, and the [webhook docs](https://www.revenuecat.com/docs/integrations/webhooks) say webhooks are available on Pro, so they should work at no cost. That is an inference; confirm when the account exists. The docs recommend an authorization header and re-reading the customer after each event. The REST API reads a customer with v1 `GET /subscribers/{app_user_id}` or v2 `GET /projects/{project_id}/customers/{customer_id}` (480 requests per minute); neither states a plan restriction. [Customer deletion](https://www.revenuecat.com/docs/api-v1/customers) is v1 `DELETE /subscribers/{app_user_id}`, queued asynchronously.

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
- **On-demand refresh:** if an upload claims more than 300 seconds and the account's row does not grant Plus, the server reads RevenueCat's REST API once before rejecting. This covers a purchase whose webhook has not arrived yet. It also keeps enforcement correct if webhooks are delayed or fail.
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
- The size ceiling applies only to uploads claiming more than 300 seconds. It is derived from the recording bitrate measured on device, with headroom, because reported duration can be forged. Uploads of 300 seconds or less keep today's acceptance, so older app builds are unaffected.
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
  - Keep today's encoding. At about 63 kbps a 30-minute recording is about 14 MB, under Groq's 25 MB direct-upload limit, so free recordings do not change. Codex may pin the measured bitrate explicitly so the server's size ceiling is deterministic. A lower-quality encoding (16 kHz at 32 kbps measured about 7.3 MB per 30 minutes) is held in reserve; any change that lowers quality needs an evaluation check before release.

### Processing

A 30-minute recording produces a transcript about six times longer than today's maximum, and an upload of about 14 MB. Verify extraction quality, extraction latency, and Edge Function wall-clock limits end to end with a real 30-minute recording.

### Account deletion

Delete the `billing_accounts` row and request deletion of the RevenueCat customer (asynchronous; a retry treats 200 or 404 as success), matching the existing processor-deletion request for PostHog. Deleting an account does not cancel an Apple subscription; the deletion flow must say so and link to subscription management.

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

**Outcome (2026-10-25, [decision log](../../decision-log.md)):** 1–3 approved, with no trial because the free 5-minute tier is the way to try Throughline before paying. Decision 4 was declined: Mike wants AI cost measurement (TL-COST-001) first. The App Store Connect agreement, Small Business Program and RevenueCat steps have not started and wait for build entry.

### Phase 1 — Payments working, hidden

- **Backend:** `billing_accounts`, API routes, `billing-webhook`, capture-limit enforcement, account-deletion cleanup, server switch with allowlist.
- **iOS:** RevenueCat integration, Settings row, background recording, interruption handling, on-device bitrate check, dynamic cap.
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
- **Evaluation:** only if the encoding changes, transcription accuracy against the existing corpus, with no regression beyond the eval's noise band.
- **Processing:** at least one real 30-minute recording through transcription and extraction in production-equivalent settings.
- **Claude review** of the implemented surfaces against the selected design before internal release.

## Rollback

- **Stop selling:** turn off `THROUGHLINE_PLUS_ENABLED` to hide offer surfaces, and remove the product from sale in App Store Connect. Active subscribers keep the 30-minute limit until their period ends; rollback must never take away a paid benefit mid-period.
- **Background audio:** revert in an app build. Plus stays gated off until long recordings are reliable again.
- **RevenueCat removal** requires an app release and a migration of entitlement records. Not expected in v1.

## Non-goals

Data portability or export (tracked as TL-PORT-001), annual plans, free trials, introductory or promotional offers, daily caps, Family Sharing, Android or web purchase, changes to the onboarding demo limit, putting any existing feature behind payment, and meeting or team recording.

## Open technical questions for Phase 1

Each must be answered with dated evidence before Phase 2.

1. RevenueCat pricing and webhooks. **Answered 2026-10-25** (Baseline evidence): free to $2,500 monthly tracked revenue; webhooks expected on the free Pro plan. Confirm webhooks when the account exists.
2. Groq upload limit. **Answered 2026-10-25:** 25 MB for direct uploads on every tier.
3. Baseline: what happens today, on a physical device, to a recording when the screen auto-locks.
4. Baseline five-minute file size. **Partly answered 2026-10-25:** about 2.4 MB from a Mac estimate; confirm on a physical device.
5. Edge Function wall-clock and extraction quality for a 30-minute transcript.
6. Capture-queue behavior on a non-retryable 4xx limit rejection.
7. App Review: background-audio justification and subscription metadata (display name, description, review screenshot).
8. Final product name (Mike, during design).

## Evidence and release manifest

To be filled as work proceeds: Phase 0 decision-log entries, Codex feasibility receipt, selected design and handoff, Phase 1 sandbox end-to-end evidence, on-device file-size measurement, device matrix, release manifest and App Store submission record.

- 2026-10-25: [Offer surface design candidates](../evidence/2026-10-25-plus-offer-candidates.md) (A, B, C), awaiting Mike's selection.
- 2026-10-25: Phase 0 decisions recorded in [decision-log.md](../../decision-log.md): price, limit and processor approved; early start declined, so Plus is sequenced after TL-COST-001.
