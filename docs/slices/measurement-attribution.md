# Measurement Attribution and Reconciliation Slice

**Backlog state:** `measuring`
**Slice phase:** `measuring`
**Selected:** 2026-08-17
**Current evidence:** 2026-08-22; [production rollout and first post-cutover baseline](../evidence/2026-08-22-measurement-production-rollout.md)
**Backlog:** `TL-DATA-001`
**Program:** [Core Quality and Learning](../programs/core-quality-learning.md)
**Control:** [iOS 1.0.4 / API v22 provenance closure](../releases/2026-08-17-ios-1.0.4-2026081602-provenance.md)

## Problem

The current aggregate baseline mixes founder dogfood, prerelease, public, anonymous, and legacy traffic. Processing events are not linked to durable recordings, so an event count cannot prove that a recording was saved and processed. The current baseline is therefore a coverage finding, not a product outcome.

## Outcome

Every new processing outcome will carry:

- a conservative distribution channel: `debug`, `testflight`, `app_store`, or `unknown`;
- a server-owned internal-user classification: `true`, `false`, or unknown;
- an event schema version; and
- a validated, first-party-only recording reference when a durable recording exists.

The private aggregate report will reconcile event outcomes against durable recordings and keep internal dogfood, external TestFlight, external App Store, debug, unknown, and legacy populations separate. Recording, account, and session identifiers remain private join keys and never enter PostHog or serialized reports.

## Locked design

### Distribution attribution

- Debug builds, Simulator, and verified StoreKit Xcode transactions map to `debug`.
- A non-Debug build with a verified StoreKit sandbox transaction maps to `testflight` for analytics under the current distribution policy. Sandbox is prerelease evidence, not a unique TestFlight entitlement, and must never be used for access control.
- A verified production transaction maps to `app_store`.
- Unverified, unavailable, failed, or future-unknown environments map to `unknown`.
- Existing queued events remain compatible and are stored as legacy schema v1 with unknown attribution.

### Internal attribution

- A service-only allowlist stores confirmed internal account UUIDs. No emails or UUIDs are committed.
- The API derives membership; it ignores any client-supplied internal flag.
- An authenticated allowlist hit is `true`, a confirmed non-hit is `false`, and anonymous/service traffic is null.
- An allowlist lookup failure is retryable and must not silently classify traffic as external.
- Mike's two accounts are added only after private confirmation. Historical rows for other accounts remain unknown rather than being guessed external.

### Recording reconciliation

- Schema-v2 `recording_uploaded` and `recording_processed` events require a top-level `recording_id`; a processing-stage failure requires it when a recording already exists.
- The API verifies that the referenced recording belongs to the authenticated account before accepting the link.
- `recording_id` is stored only in first-party Supabase data and removed from the PostHog projection.
- Legacy events are never heuristically matched by account and timestamp.

## Metric and gate

**Primary metric:** correctly cohort-attributed, state-consistent event/recording pairs divided by the union of matched, event-only, durable-only, duplicate, and state-mismatched processing outcomes in the post-cutover window.

**Acceptance gate:** controlled canaries reach 100% correct attribution and reconciliation. Production establishes a baseline; this slice does not invent a lift target.

Only external, non-internal, verified App Store, schema-v2, correctly reconciled outcomes may eventually support a public-product baseline. TestFlight can validate the pipeline but cannot establish a public baseline.

## Aggregate report populations

For every measurement window, report counts and rates for:

- matched event and durable outcome;
- event without a recording link;
- durable final recording without a linked outcome event;
- event/durable state mismatch;
- duplicate outcome events per recording; and
- legacy v1 unattributed rows.

Split those populations into debug, internal dogfood, external TestFlight, external App Store, and unknown. Serialize aggregates only.

## Rollout

1. Preserve the current local report, report tests, dashboard generator, and their package commands before editing them.
2. Add and verify the database schema and service-only allowlist.
3. Deploy the backward-compatible API contract and run authenticated ingestion canaries.
4. Build the instrumented iOS app. Internal-only delivery to the existing `Internal QA` group may follow the standing 2026-08-25 decision only within an already-approved bounded iteration; external TestFlight distribution, App Store submission or review, and public release remain Mike-approved.
5. Privately add confirmed internal accounts and backfill only those known rows.
6. Update the aggregate report and establish the first post-cutover baseline after controlled canaries pass.

## Guardrails

- No audio, transcript, note, feedback text, email, credential, or raw account/session/recording identifier in PostHog, dashboards, reports, or tracked evidence.
- No onboarding copy, layout, or flow change.
- No provider, model, prompt, data-use policy, pricing, recording-limit, subscription, credit, or App Store-submission change.
- Old clients remain accepted; unknown stays unknown; historical classifications are not fabricated.
- The attribution schema and API are additive. A separately ordered privilege-hardening migration makes existing intended access explicit without changing RLS policies; rollback reverts app/API behavior while leaving the nullable evidence columns and safer explicit grants intact.

## Known caveats

- StoreKit sandbox is not uniquely TestFlight; the channel is an analytics inference under the supported distribution path.
- Events authenticate when the offline queue flushes, not when captured. Account switching while events are queued remains a follow-up risk.
- A deleted recording nulls its event link and must appear as unmatched rather than being reconstructed.
- The first honest baseline begins after the instrumented rollout; the August 17 mixed snapshot remains `legacy_unattributed`.

## Acceptance

- Database constraints, indexes, RLS, and privileges pass automated tests.
- Old event JSON decodes; new event JSON round-trips with schema v2.
- Server attribution overrides forged client properties.
- No raw identifier appears anywhere in the serialized PostHog request or aggregate report.
- Controlled debug and TestFlight recordings reconcile 100% against durable rows.
- A clean unsigned Release build passes.
- Deployment and rollback evidence are recorded without changing a Mike-gated surface.
