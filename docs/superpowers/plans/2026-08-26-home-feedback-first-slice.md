# Home feedback first-slice implementation plan

**Status:** Internal canary delivered 2026-08-27, rejected in owner review, and rolled back to the preceding Home presentation in build `2026082801` on 2026-08-28. [Delivery evidence](../../evidence/2026-08-27-home-feedback-first-slice.md) · [Rollback evidence](../../evidence/2026-08-28-home-ui-rollback.md)
**Selected and design-approved:** 2026-08-26
**Backlog:** `TL-TASK-001`
**Binding specifications:** [umbrella](../specs/2026-08-25-home-feedback-part-specs.md), [Part 1](../specs/2026-08-25-home-feedback-01-honest-carryover.md), [Part 4](../specs/2026-08-25-home-feedback-04-dependable-top-task-selection.md), and [Part 5](../specs/2026-08-25-home-feedback-05-task-card-hierarchy.md)

## Global constraints

- Preserve all unrelated dirty work, especially the current private-evaluation changes in `HomeView.swift`, `ThroughlineNote.swift`, `UploadClient.swift`, and the Xcode project.
- Keep raw audio, transcript, note/task text, feedback text, emails, credentials, and raw identifiers out of tracked artifacts, analytics, fixtures, and release manifests.
- Do not change provider, base model, production prompt/schema/normalizer, data-use policy, pricing, recording limits, onboarding, backend behavior flags, App Store submission, or public release.
- A non-action `most_important` insight never becomes a checkable task.
- This slice remains presentation-first. Completion continues through the compatibility route, so display text must stay byte-identical to the source action text.
- Reuse the existing quiet visual system. Use sentence case, weights no heavier than 500, the existing electric blue, 0.5-point borders, and current card radius.
- Every visible control has a minimum 44 by 44 point interaction target and a non-gesture accessibility path.
- Build and archive from an isolated non-synced copy of the exact current iOS tree because the direct cloud-backed checkout has a known Xcode source-scanning stall.

## Task 1: Pure Home task projection

**Owns:** `ios/Throughline/Models/HomeTaskProjection.swift`, `ios/Tests/HomeTaskProjectionTests.swift`, and only the new file references required in `ios/Throughline.xcodeproj/project.pbxproj`.

1. Write a standalone Swift executable test first and confirm it fails because `HomeTaskProjection` is absent.
2. Define source-bound carryover rows from settled notes before the local-day boundary, preserving same-text rows across different notes and opening provenance through the recording ID.
3. Define open explicit to-do rows only. Rank overdue/today, high priority, current week, later dated, and undated items, then source recency and extraction order.
4. Preserve original task text and source identity. Exclude completed tasks and every non-action `most_important` value.
5. Expose total count, initial six-row presentation, expandable all rows, honest empty-state eligibility, localized date/context metadata, and accessibility strings without analytics content.
6. Re-run the focused standalone Swift test to green, then re-run the existing action-item contract test.

## Task 2: Home integration and hierarchy

**Owns:** `ios/Throughline/Views/HomeView.swift`, `ios/Throughline/AppState.swift`, and `ios/Tests/HomePresentationContractTests.swift`.

1. Write a standalone presentation-contract test first and confirm it fails against the old carryover/title/preview behavior.
2. Replace the old flattened carryover strings with projected **From earlier notes** rows that show source/date, open the exact source note, and never present a completion control.
3. Replace **Most important** with **Next actions**, the explanation **Due and high-priority items first.**, truthful count, inline See all/Show less behavior, and the specified empty state.
4. Render task primary text at medium weight, then typed date/context, then source note/date. Preserve original text for completion mutation.
5. Make completion controls at least 44 points and provide combined VoiceOver action/state/metadata/source descriptions.
6. Make collapsed note cards use saved summary rather than transcript. Render only explicit open to-dos, up to three, and show a truthful remaining count/link rather than silently hiding them.
7. Re-run the presentation test, task-projection test, action-item contract test, and an isolated unsigned Release simulator build.

## Task 3: Verification, evidence, and internal delivery

**Owns:** the selected specification status, `product/backlog.json` `TL-TASK-001` state only, one dated implementation evidence record, and one immutable release manifest.

1. Run focused Swift, extraction-contract, privacy, and private-feedback intake tests.
2. Build Debug and Release simulator artifacts from an isolated copy. Launch the populated Home preview and inspect screenshots at a standard phone size plus the largest practical Dynamic Type/light-dark matrix.
3. Verify the old false labels are absent, task ordering/count/source hierarchy is visible, carryover source rows navigate correctly, controls remain reachable, and unrelated private-evaluation UI still compiles.
4. Archive a new `1.0.5` internal-only build using the next unused date-sequence build number, validate it, export with `testFlightInternalTestingOnly=true`, upload, and poll Apple to `VALID`.
5. Freshly verify the build relationship to `Internal QA`. An upload receipt alone is insufficient.
6. Record the exact dirty-source binding, hashes, test/build evidence, internal group state, rollback to the preceding valid internal build, and the remaining on-device/user-outcome gaps without private content or identifiers.

## Rollback

The UI rollback restores the preceding Home projection and card rendering without changing stored tasks or notes. Internal testers may remain on the preceding valid build. No backend, migration, behavior flag, policy, App Store submission, or public release state changes in this slice.

## 2026-08-28 owner outcome

Owner review rejected the canary's Home presentation. The rollback path above was executed: the preceding carry-forward, most-important, and captured-note presentation was restored; the newer Home projection and presentation files were removed; private-evaluation, privacy, backend, and stored-data behavior remained in place; and internal-only build `2026082801` was verified in `Internal QA`. This plan is closed as rolled back, with no user-outcome claim.
