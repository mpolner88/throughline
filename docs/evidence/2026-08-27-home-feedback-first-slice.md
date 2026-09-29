# Home feedback first slice and internal delivery

**Verified:** 2026-08-27 20:33 Pacific  
**Scope:** selected Home feedback Parts 1, 4, and 5; internal-only TestFlight canary

## Outcome

The selected Home slice is implemented and available to the existing internal TestFlight group in Throughline version `1.0.5`, build `2026082601`. The Home surface now uses honest source-bound carryover, deterministic open-task ranking, and summary-first note cards without changing extraction, backend behavior, data-use policy, onboarding, recording limits, App Store submission, or the public release.

Apple accepted the internal-only upload, completed processing, and showed the build as **Ready to Test**. A fresh App Store Connect read then showed build `2026082601` as **Testing** in `Internal QA`; the group contained one tester and five builds. No public App Store workflow was invoked.

## Implemented contract

- **From earlier notes** includes qualifying settled notes from before the current local day, preserves source provenance, and opens the source note without claiming completion state.
- **Next actions** includes open explicit to-dos only, orders them by the approved date/priority tiers, preserves source-bound mutation identity, and expands beyond the initial six rows with a truthful count.
- Task rows present action, typed metadata, and source in that order. Collapsed note cards use the saved summary rather than transcript content.
- Semantic fonts, vertical reflow, accessible labels, and minimum interaction targets preserve the hierarchy at accessibility text sizes.

## Verification

- Pure Home presentation contract: 12 assertions passed.
- Home task projection: 9 focused scenarios passed.
- Existing action-item contract: passed.
- Extraction, privacy, and private-feedback intake suites: 28 Node tests passed.
- Isolated Debug and Release simulator builds: succeeded.
- Manual visual review covered standard light mode and maximum practical Dynamic Type in dark mode with increased contrast. Carryover source navigation and See all/Show less behavior were exercised.
- Signed iPhoneOS archive: succeeded with Xcode 26.3 (`17C529`).
- Archive identity: version `1.0.5`, build `2026082601`; privacy manifest present.
- Release executable SHA-256: `af5470461893fbf7e621a105772f64a3935593cee7e3da577c9c2c1eb120eb75`.
- The isolated iOS source still matched the workspace after upload; the only `diff -qr` entries were generated `.DS_Store`, build output, and Xcode workspace configuration directories.
- Export used `testFlightInternalTestingOnly=true`. Xcode reported `Upload succeeded` with empty error and warning arrays.
- App Store Connect showed upload status **Complete**, build status **Ready to Test**, and the group relationship **Testing** in `Internal QA` with one tester.
- A post-delivery recheck on 2026-08-27 reran all three focused Swift executables successfully, passed 16 focused extraction/privacy/feedback Node tests, and parsed the canonical backlog JSON successfully.

## Source and artifact binding

- Source commit at archive time: `8066ea03bee6304a4268f8c2f6a4570f0521af06`.
- Source tree state: intentionally dirty. The exact current iOS tree was copied to an isolated non-synced release directory and byte-compared before and after archive and upload.
- Archive: `/private/tmp/throughline-home-release-2026082601-v2.H9lLRS/Throughline-1.0.5-2026082601.xcarchive`; ephemeral local retention.
- Rollback target: the preceding valid internal build `2026082501`. No backend, migration, policy, behavior flag, or public release rollback is involved.

## Remaining evidence gap

Installation and the updated Home journey on the tester device are not yet verified. Internal TestFlight use is not a public-product cohort and does not establish user-outcome uplift. The next evidence is on-device use and private feedback, followed by the canonical seven-day task revisit/completion measure when eligible volume exists.
