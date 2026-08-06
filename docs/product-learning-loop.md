# Throughline Product-Learning Loop

Status: production database and API deployed; iOS version 1.0.1 is being prepared for release.

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

The initial activation event is `recording_processed`: a signed-in user has successfully recorded a real note and received a structured result.

The first funnel is:

`app_opened` → `onboarding_started` → `demo_recording_completed` → `auth_succeeded` → `home_viewed` → `recording_started` → `recording_uploaded` → `recording_processed`

Each product change should name the funnel step it is intended to improve. The first working target is the percentage of newly signed-in users who reach `recording_processed` within 24 hours.

## Signals Captured

- Product events: allowlisted interaction and outcome names, app version, build number, session identifier, timestamp, and small primitive properties.
- Product feedback: category, message, optional permission to follow up by email, account, app version, and backlog status.
- Existing extraction feedback: ratings and intentional corrections attached to a recording.
- Future inputs: App Store reviews and attributed social feedback.

Product events never contain recordings, transcripts, note text, extracted tasks, names, email addresses, or product-feedback text. Before sign-in, events use only a random identifier for the current app session. There is no persistent advertising or device identifier and no third-party analytics SDK.

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

1. Build the weekly evidence synthesis and backlog view.
2. Establish the X content calendar and reply workflow.
3. Add App Store acquisition metrics and review intake.
4. Define ethical community participation; do not use deceptive anonymous personas or coordinated inauthentic activity.
