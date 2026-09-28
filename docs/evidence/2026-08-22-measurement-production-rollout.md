# Measurement attribution production rollout

**Verified:** 2026-08-22

## Scope and authority

Mike explicitly approved the exact TL-DATA-001 production rollout and its stated risks. The authorized slice was limited to the two additive measurement migrations, the API measurement-attribution build, a synthetic aggregate-only canary, rollback, measurement, and documentation. It did not authorize a provider, base-model, data-use policy, pricing, recording-limit, onboarding, App Store, or user-interface change.

## Production outcome

- The ordered production migration history contains exactly six migrations. Both measurement migrations are applied, with zero pending and zero remote-only migrations.
- The first API candidate attempt reached provider version 23, then stopped on a canary-oracle mismatch and automatically restored the exact control source at version 24. No database rollback was attempted.
- The mismatch was in the verifier, not the candidate event payload: PostHog consumes the capture-only person-profile control instead of retaining it as a stored event property, provider event UUIDs are pseudonymous, and the first aggregate read can precede complete ingestion.
- The corrected oracle retained every explicit forbidden-key and raw-marker check, required the exact three-event taxonomy, and added only bounded stabilization for safe partial ingestion.
- The reviewed retry deployed the sealed candidate as active API version 25. The downloaded provider source matched the frozen candidate bundle, JWT behavior remained exact, and the non-API function fingerprint did not change.
- The synthetic canary verified exactly three expected events: one legacy-v1 failure control, one schema-v2 upload, and one linked schema-v2 failure outcome. It observed three unique event UUIDs, one pseudonymous analytics identity, zero invalid identities, and zero raw-data leaks.
- First-party synthetic Auth, database, and storage state was removed. Provider deletion was accepted under the canary's bounded asynchronous-deletion contract. The rollout completed GO without rollback.

## Verification

Before the successful retry:

- rollout executor: 51 of 51 tests passed;
- read-only production preflight: 21 of 21 tests passed;
- MCP aggregate canary: 30 of 30 tests passed;
- direct canary: 20 of 20 tests passed;
- structured measurement contract: 18 of 18 tests passed;
- all four executable modules passed syntax checks; and
- all frozen dependencies matched their recorded SHA-256 bindings.

The live read-only preflight returned GO with API version 24 at the exact control digest, six applied migrations, zero pending or remote-only migrations, one unchanged non-API function, all four required analytics secret names present, healthy capture/deletion configuration, an exact rollback download, and confirmed transient cleanup.

## First post-cutover baseline

The aggregate-only product-learning report generated at 2026-08-22T16:56:51Z is the first report after cutover. It remains a collecting baseline:

- 596 mixed operational events, 83 sessions, and five signed-in users were represented;
- all eight funnel event names were observed;
- schema-v2 real processing outcomes: zero;
- public-baseline-eligible outcomes: zero;
- legacy-v1 unattributed outcomes: 25;
- final durable recordings without a schema-v2 upload marker: eight; and
- days 2-7 retention remains below its interpretation floor.

These counts do not establish product improvement. Historical activity remains legacy/unattributed and is not heuristically reclassified. The next real schema-v2 processing outcome can now enter the declared cohort and reconciliation contract.

## Decision and next action

TL-DATA-001 has completed production rollout and entered measurement. TL-EVAL-001 is no longer blocked on rollout evidence. Begin the already-approved evaluation-truth-and-lineage runtime slice by freezing the current-control inference contract without changing provider or model behavior, while continuing to collect real schema-v2 reconciliation evidence.
