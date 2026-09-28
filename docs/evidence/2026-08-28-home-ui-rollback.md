# Home UI rollback and internal delivery

**Verified:** 2026-08-28 17:33 Pacific
**Scope:** restore the preceding Home presentation while preserving evaluation, privacy, backend, and stored-data behavior

## Outcome

The Home presentation introduced in internal build `2026082601` was rejected in owner review and rolled back. The internal candidate again shows the preceding carry-forward, most-important, and captured-note presentation. The newer Home projection, ranking, expansion, and summary-first card files are no longer compiled or present.

Throughline version `1.0.5`, build `2026082801`, was archived from an isolated copy of the exact current iOS tree and uploaded with `testFlightInternalTestingOnly=true`. Apple processed the build to `VALID`, reported it as not expired, and the build relationship to the existing one-tester `Internal QA` group was freshly verified. No public App Store workflow was invoked.

## Rollback boundary

- The rollback changed only `HomeView.swift`, `AppState.swift`, the Xcode project references, and the four Home presentation/projection source and test files introduced by the rejected slice.
- `AppState.swift` is back to its preceding source state. The remaining `HomeView.swift` and Xcode-project differences from the tracked base are the separate private-evaluation integration, not the rejected Home slice.
- The compiled evaluation contract SHA-256 remains `143d1425b30ae920d269529de0484b3f927550485d247fcea80d43ce2e14db25`, matching the preceding internal feedback iteration.
- No Supabase function, migration, behavior flag, provider, model, prompt, schema, normalizer, privacy policy, onboarding, pricing, recording limit, stored task, or stored note changed.

## Verification

- Existing action-item Swift contract: passed.
- Private evaluation coding/copy/rating-mode Swift contract: passed.
- Extraction, privacy-policy parity, and private TestFlight feedback intake: 16 Node tests passed.
- Isolated Debug and Release simulator builds: succeeded.
- Direct QA-simulator screenshot review showed the preceding Home hierarchy and card presentation; the rejected Home section names and projection symbols were absent.
- Signed iPhoneOS archive: succeeded with Xcode 26.3 (`17C529`).
- Archive identity: version `1.0.5`, build `2026082801`, bundle `app.throughline.ios`; privacy manifest present.
- Release executable SHA-256: `9984447cdfae79fe5c72fc8407dec2194bfe5baeb46cf22f4e2b5945ab18fbcd`.
- Xcode package analysis and upload completed successfully. A first account-based export attempt stopped before upload because Xcode did not expose an App Store Connect account; the retry used the already-configured App Store Connect API credential without copying or exposing it.
- Fresh App Store Connect API reads showed processing state `VALID`, not expired, present in `Internal QA`, with one tester.

## Source and artifact binding

- Source commit at archive time: `1ec0cbbd7699bda2c5e2bb646a6ebfb31c8f21b7`.
- Source tree state: intentionally dirty. The exact current iOS tree was copied to an isolated non-synced release directory before the simulator builds and archive.
- Archive: `/private/tmp/throughline-home-rollback-2026082801.qR6gqm/Throughline-1.0.5-2026082801.xcarchive`; ephemeral local retention.
- Rollback target if this build itself is unsuitable: valid internal build `2026082501`. No backend, migration, policy, behavior-flag, submission, or public-release rollback is involved.

## Remaining evidence gap

Installation and the restored journey on the tester device remain unverified. This internal result records owner rejection and successful recovery; it does not establish public-product or user-outcome uplift. Any later task-home presentation requires a newly selected, bounded product/design candidate.
