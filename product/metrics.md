# Throughline metric definitions

## Decision this system supports

The weekly review decides whether Throughline should focus next on qualified acquisition, first-value activation, successful repeated use, or a product-quality problem reported by users.

Do not treat a zero or a large percentage swing as a product conclusion until the report says the metric is ready. The initial readiness floor is five newly signed-in users for activation and five mature activated users for retention. These are diagnostic floors, not statistical significance claims.

## Population and evidence rules

- Report the five measurement cohorts separately: `debug`, `internal_dogfood`, `external_testflight`, `external_app_store`, and `unknown`. Do not combine them into a public-product claim.
- The August 17 mixed aggregate snapshot is non-decision-grade: event versions and `surface` coverage differ, and its event and durable-recording populations have not yet been reconciled.
- Before interpreting any processing outcome, reconcile its relevant event population with durable recordings and report the unmatched remainder. A recorded event alone is not proof of durable processing.
- A metric that lacks the required cohort, coverage, reconciliation, or readiness floor is a coverage finding, not a product outcome.

## Processing attribution and reconciliation

The first honest processing baseline begins after the schema-v2 cutover. Schema-v1 outcomes remain `legacy_unattributed` and are never matched by account, timestamp, app version, or any other heuristic.

### Cohort classification

- A schema-v2 outcome with `distribution_channel = debug` is `debug`, including Simulator and verified Xcode traffic.
- A non-debug schema-v2 outcome with `is_internal_user = true` is `internal_dogfood`.
- A schema-v2 outcome with `is_internal_user = false` and `distribution_channel = testflight` is `external_testflight`.
- A schema-v2 outcome with `is_internal_user = false` and `distribution_channel = app_store` is `external_app_store`.
- Every remaining schema-v2 outcome is `unknown`; null attribution is never treated as external.
- A durable-only final recording inherits its cohort only from an exact linked schema-v2 `recording_uploaded` marker. A final recording without that marker stays in legacy/unattributed coverage; account or timestamp proximity never supplies a cohort.

### Mutually exclusive reconciliation populations

- `matched`: one schema-v2 outcome event has a validated recording reference and its outcome agrees with the durable final processing state.
- `event_only`: a schema-v2 outcome has no available durable recording. This includes a null link after deletion; the report does not reconstruct it.
- `durable_only`: a durable final recording has an exact linked schema-v2 `recording_uploaded` marker but no linked schema-v2 outcome event.
- `state_mismatch`: one linked schema-v2 outcome disagrees with the durable processing state.
- `duplicate`: more than one schema-v2 outcome event references the same recording. Count the recording once in the denominator and report excess duplicate events separately.

`recording_processed` agrees only with a durable `processed` state. `recording_failed` agrees with `needs_transcript`, `needs_extractor`, `transcription_failed`, `extraction_failed`, or `processing_failed`; when the event carries a specific final status, it must agree with the durable status. `uploaded` is not a final durable outcome.

The correct reconciliation rate is:

`matched / (matched + event_only + durable_only + state_mismatch + duplicate)`

Only `external_app_store` outcomes that are confirmed non-internal, schema v2, and `matched` enter the public-baseline population. Final recordings without a schema-v2 upload marker and schema-v1 outcome events remain separate legacy/unattributed coverage and never enter the denominator. TestFlight may validate the pipeline but never establishes a public baseline. Private join fields may be used in memory, but reports and dashboards serialize aggregate counts only and never identifiers or user content.

## Primary KPIs

### Product-success ladder

- First value: a signed-in user reaches `recording_processed` from the home recorder with a saved structured note. A demo note promoted during account creation is onboarding value, not activation.
- Repeated value: an activated user reaches another `recording_processed` event on days 2–7.
- Workflow value: a user returns to a saved note, edits it, or changes an extracted action item through `note_opened`, `note_edited`, or `action_item_toggled`.
- Agent value: a user opens agent setup, creates a token, and completes a first MCP tool call. `agent_connection_opened` and `agent_token_created` are instrumented; server-side first-tool-use measurement remains a coverage gap.

The first two levels are the decision KPIs. Workflow and agent events explain whether Throughline is becoming the intended voice-to-knowledge-and-agent system rather than only a one-time recorder.

### Download-to-auth baseline

- App Store Connect is the source of truth for first-time downloads. Supabase is the source of truth for `auth_succeeded`.
- Until a privacy-safe install-to-account join exists, compare the two as same-window aggregate counts and label the ratio an acquisition proxy, not a matched-user conversion rate.
- Report account-creation intent (`mode = create_account`), explicit returning sign-in (`mode = sign_in`), and social-provider continuation (`mode = apple` or `google`) separately. Do not silently classify social continuation as either a new or returning account.

### 24-hour activation

- Definition: newly signed-in users whose first non-demo `recording_processed` event occurs within 24 hours of their first `auth_succeeded` event.
- Denominator: distinct signed-in users with `auth_succeeded` in the measurement window.
- Numerator: those users with `recording_processed` from the home recorder within the following 24 hours. Events with `surface = onboarding_promotion` are excluded.
- Segments: `demo_recording_completed` before auth in the same onboarding session versus auth without a completed demo; also break out `auth_succeeded.properties.mode`.
- Decision: investigate the largest preceding funnel drop when activation is weak.
- Caveat: users without an instrumented `auth_succeeded` event are excluded rather than silently treated as failures.

### Weekly activated users

- Definition: distinct signed-in users with at least one `recording_processed` event in the trailing seven days.
- Decision: distinguishes growth in people receiving value from repeated activity by the same person.
- Caveat: this is a count, so pair it with acquisition volume and activation rate.

### Days 2–7 activated retention

- Definition: activated users with another `recording_processed` event between 48 hours and seven days after their first activation.
- Denominator: activated users whose first activation is at least seven days old.
- Numerator: those users with a qualifying repeat activation.
- Decision: determines whether Throughline is becoming a repeated workflow after first value.
- Caveat: the measure should remain hidden as “collecting baseline” until five mature users exist.

## Driver metrics

- Unique-session funnel: `app_opened` → `onboarding_started` → `demo_recording_completed` → `auth_succeeded` → `home_viewed` → `recording_started` → `recording_uploaded` → `recording_processed`.
- Instrumentation coverage: required funnel event names observed, signed-in users observed, and the share of expected steps represented in the window.
- Product-feedback intake: new submissions by category and status.
- Feedback completion: `feedback_submitted / feedback_opened`, paired with `feedback_submit_failed`.
- Feedback-signal integrity: submitted feedback that passes validation, deduplication, classification, and quarantine gates; report duplicate and quarantined shares separately without retaining feedback text.
- Workflow depth: distinct activated users with `note_opened`, `note_edited`, or `action_item_toggled`.
- Agent adoption: `agent_connection_opened` → `agent_token_created` → first server-side MCP tool call. The final step is not yet canonical.
- Agent-ready answer coverage: eligible extraction-feedback submissions with non-null `agent_ready` divided by eligible extraction-feedback submissions. Report the ready/not-ready rate only alongside that coverage and deduplicated recording and user counts; never retain feedback text or identifiers.

## Instrumentation coverage

- Sign-in funnel: `auth_started`, `auth_confirmation_required`, `auth_succeeded`, and `auth_failed`, segmented by provider or mode where available.
- Core product funnel: app open through processed recording is implemented and reported by the private Supabase report.
- Retention: days 2–7 activated retention is defined and calculated, but remains below the five-mature-user interpretation floor.
- Product understanding: settings opens, note opens, note edits, action-item changes, feedback, and agent-connection intent are instrumented. Search/retrieval and first successful MCP tool use remain future coverage.
- Learning-signal coverage: feedback validation, deduplication, classification, quarantine, and eligible-signal outcomes require aggregate, content-safe instrumentation before they can guide promotion.
- Agent-ready feedback coverage: a non-null `agent_ready` response on eligible extraction-feedback submissions is required before reporting ready/not-ready rates, together with deduplicated recording and user counts.
- Privacy: analytics properties describe actions and operational state only; never send user content or raw identifiers to PostHog.

## Cost efficiency

- Primary unit metric: total AI processing cost divided by successful `recording_processed` outcomes.
- Stage metrics: transcription cost, extraction cost, retry cost, and failed-processing cost.
- Required fields: provider, model, processing stage, audio duration, input tokens, output tokens, retry count, latency, and estimated USD cost using a versioned price table.
- Report: daily total AI cost, cost per successful recording, and p50/p95 cost per successful recording.
- Current gap: Groq powers transcription and extraction, but Throughline does not yet persist a decision-grade usage and cost ledger.
- Privacy: cost records must never contain audio, transcript, prompts, extracted note content, user email, provider keys, or raw analytics identifiers.

## Guardrails

- Recording failure rate: `recording_failed / (recording_failed + recording_processed)` over the trailing seven days.
- Extraction quality: average intentional quality rating, ratings of two or lower, and explicit `agent_ready = false` responses.
- Trust and privacy: no recordings, transcripts, note text, feedback text, email, raw user IDs, or raw session IDs in PostHog.

## Initial operating thresholds

These thresholds are provisional until Throughline has a stable baseline:

- Activation is interpretable at five newly signed-in users and decision-grade at 20.
- Retention is interpretable at five mature activated users and decision-grade at 20.
- A single explicit product problem is evidence, not a trend. Three independent reports of the same problem promote it for mock exploration.
- Any credible data-loss, privacy, account-access, or recording-processing failure can bypass the frequency threshold.
