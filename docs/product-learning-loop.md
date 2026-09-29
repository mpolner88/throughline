# Throughline Product-Learning Loop

> **Historical, noncanonical document.** The body preserves the product-learning view recorded in August 2026 and its live-status language is not current proof. Use [CURRENT_STATE.md](CURRENT_STATE.md), [PRODUCT.md](PRODUCT.md), [WORKFLOW.md](WORKFLOW.md), [product metrics](../product/metrics.md), and the [prioritized backlog](../product/backlog.json) for current truth.

Status: iOS version 1.0.1 is live; first-party events and feedback are deployed; the PostHog analysis layer is live and was verified end to end on August 6, 2026.

## Goal

Turn acquisition, product usage, and user feedback into a repeatable loop:

1. Bring the right people to Throughline.
2. Measure whether they reach a useful first outcome.
3. Ask what helped or got in the way.
4. Synthesize evidence into a prioritized backlog.
5. Mock the proposed change and obtain approval.
6. Ship with a clear metric hypothesis.
7. Tell affected users what changed.

## First Activation Metric

The initial activation event is a non-demo `recording_processed`: a signed-in user has successfully recorded a new note from the home recorder and received a structured result. A demo note saved during account creation is onboarding value and is excluded from activation.

The in-app first-run funnel is:

`first_opened` → `onboarding_started` → `demo_recording_completed` → `auth_succeeded` → `home_viewed(state=empty|populated)` → `recording_started(surface=home)` → `recording_uploaded(surface=home)` → `recording_processed(surface=home)`

`first_opened` fires once per installation and is the closest privacy-safe in-app proxy for a download. App Store Connect remains the source of truth for actual downloads. Each product change should name the funnel step it is intended to improve. The first working target is the percentage of newly signed-in users who reach `recording_processed(surface=home)` within 24 hours. Report that metric separately for users who completed the demo before auth and users who authenticated without completing the demo.

App Store Connect first-time downloads and Supabase authentication are separate aggregate sources. Until Throughline has a privacy-safe install-to-account join, their same-window ratio is an acquisition proxy rather than a matched-user conversion rate. `auth_succeeded` includes `account_state=new|existing|unknown`, `mode`, and `onboarding_path=demo|direct` so account creation, returning sign-in, and demo exposure are not conflated.

## Signals Captured

- Product events: allowlisted interaction and outcome names, app version, build number, session identifier, timestamp, and small primitive properties.
- Product feedback: category, message, optional permission to follow up by email, account, app version, and backlog status.
- Existing extraction feedback: ratings and intentional corrections attached to a recording.
- Future inputs: App Store reviews and attributed social feedback.

Product events never contain recordings, transcripts, note text, extracted tasks, names, email addresses, or product-feedback text. Events received before authentication use only a random identifier for the current app session. There is no persistent advertising or device identifier and no third-party analytics SDK.

## Analytics Architecture

- App Store Connect remains the acquisition source of truth for impressions, product-page views, downloads, and store conversion.
- Supabase remains the canonical source for first-party product events, feedback, user accounts, and account deletion.
- The Supabase Edge Function sends PostHog a best-effort, server-side copy of allowlisted events for funnels, retention, and dashboards.
- PostHog receives keyed pseudonymous identifiers, not Supabase user IDs or raw session IDs. GeoIP enrichment, autocapture, session replay, and person properties such as name or email are disabled or omitted.
- Signed-in events create a pseudonymous person so product retention can be measured. Anonymous events do not create a person profile.
- Account deletion first asks PostHog to delete the pseudonymous person and queue historical-event deletion, then removes the canonical Supabase data and account.

The first dashboard should track:

1. Weekly activated users: signed-in users with `recording_processed`.
2. New signed-in users reaching `recording_processed` within 24 hours.
3. Activated users returning for another `recording_processed` on days 2–7.
4. Funnel step conversion and the rate of `recording_failed`.

The live [Throughline product loop dashboard](https://us.posthog.com/project/335982/dashboard/1968663) currently shows production app opens and the baseline-readiness rules. Add the remaining funnel, activation, reliability, and retention insights after PostHog observes their event names. The private `npm run product:weekly` report reads canonical Supabase data and prevents missing instrumentation from being presented as user drop-off.

## Backlog States

Product feedback moves through:

`new` → `reviewing` → `planned` → `shipped` → `closed`

The synthesis step should cluster evidence by problem rather than by requested feature. Each candidate backlog item should include:

- User problem and supporting evidence.
- Funnel step and baseline.
- Proposed hypothesis.
- Success metric and guardrail.
- Mockup link and approval state.
- Release version and outcome after shipping.

## Weekly Operating Rhythm

1. Pull new feedback, extraction-quality issues, and funnel results.
2. Cluster recurring problems and identify the highest-leverage drop-off.
3. Create or update backlog candidates with evidence.
4. Produce mocks for the top candidate.
5. Wait for product approval before production implementation.
6. After shipping, compare the selected metric with its baseline.
7. Close the loop with release notes, direct replies where permission exists, and later push/email only when notification consent and messaging infrastructure are ready.

## Approval Gates

- Mock approval before production implementation.
- Explicit approval before deploying database or Edge Function changes.
- Explicit approval before submitting an App Store build.
- Separate review of privacy disclosures whenever collected data changes.
- Separate approval before publishing social posts, replies, push notifications, or email.

## Next Slice

After this instrumentation and feedback foundation is approved and deployed:

1. Review and schedule the working weekly evidence synthesis and backlog view.
2. Establish the X content calendar and reply workflow.
3. Add App Store acquisition metrics and review intake.
4. Define ethical community participation; do not use deceptive anonymous personas or coordinated inauthentic activity.
