# Running List — public App Store release preparation

**Verified:** 2026-10-05. **Owner:** Codex. **Source:** `d7f26769a7c28e0bcfed50b8ae0ba61fb4fd6044` on `codex/running-list` in the active nonsynced checkout. **Public candidate:** 1.0.5 (2026100502). Mike accepted internal 2026100501 and explicitly authorized ASO, upload and public release. This supersedes the swipe/scroll owner-acceptance hold; no new release approval is requested.

## Current

Apple has accepted the upload, processed it to VALID, marked it APP_STORE_ELIGIBLE and selected it for version 1.0.5. The version remains PREPARE_FOR_SUBMISSION, with AFTER_APPROVAL release behavior. **Not submitted, approved or publicly available.** [Processed-build receipt](assets/2026-10-05-app-store/apple-build.json), [selected-build receipt](assets/2026-10-05-app-store/apple-selected.json).

The exact [ASO and screenshot packet](../../app-store/releases/1.0.5/README.md) is now applied to the pending 1.0.5 version, after actual Claude review. Final read-back at 22:04 UTC verified exact metadata/review notes, selected build, all five screenshot checksums and their order. All five assets are COMPLETE, including the fully opaque RGBA images. Only the current APP_IPHONE_67 set remains. The six obsolete draft images were privately backed up as full-resolution Apple-rendered PNGs before their draft set was removed; these are recoverable rendered copies, not a claim of original-file byte identity. The public 1.0.4 version was not mutated. [Listing receipt](assets/2026-10-05-app-store/listing-verified.json), [draft-image replacement](assets/2026-10-05-app-store/old-draft-screenshots-retired.json).

Final packet manifest SHA-256: `898f1adb7bfb680c6a9683556435c13f3d36401d60d91bd2ac8aaa589b61e10b`. The final What's New text is 370 characters. Initial preparation used 375 characters; the two precise wording corrections below supersede that initial packet.

## Package verification and corrected finding

All 64 tracked iOS files match the frozen revision. Against accepted source `7887d39cabbadd9ee796db3e875cef1a792cf55d`, the sole tracked iOS difference is CURRENT_PROJECT_VERSION 2026100501 → 2026100502. **Compiled machine-code SHA-256 is identical to the accepted TestFlight build.** Isolated signed Release archive, public export, both signatures and archive/export UUID/code identity pass. DEBUG previews are absent, get-task-allow=false, internal-testing-only=false, and the service API token is empty. [Source comparison](assets/2026-10-05-app-store/accepted-source-comparison.json), [source hashes](assets/2026-10-05-app-store/source-hashes.json), [package receipt](assets/2026-10-05-app-store/package-verification.json).

**P1 packaging issue, resolved for the public candidate:** copying tracked source alone omitted ignored LocalRelease.xcconfig. The first attempted public archive and the preceding internal 2026100501 archive therefore lacked the anon client key used by fresh sign-in. Existing signed-in sessions can mask this, so Mike's accepted list experience did not establish fresh-sign-in readiness. The first archive/export were quarantined privately before any upload. The corrected public archive includes the same existing anon key as delivered build 2026093002; the key's role and project were verified in memory. No key was created/rotated, no service-role credential was embedded and no new secret was added to Git. [Configuration receipt](assets/2026-10-05-app-store/release-configuration.json).

New [packaged-configuration verifier](../../scripts/verify-ios-release-config.mjs) checks the actual packaged app, expected build and endpoint, existing anon scope/project and absence of a service token. It passes the corrected archive and exported app and rejects the quarantined missing-key archive. Run it on both archive and export before future uploads; never assume a source-only copy includes ignored release settings.

## Content review

The read-only Codex ASO reviewer checked official Apple field/search/screenshot guidance, the copy's delivered-feature claims and all five final images. Initial P2s for stale images/provenance and diagnostic transcript text were resolved by fresh native captures with a content-only DEBUG fixture patch. No view/gesture/layout changes entered either the screenshot build or the public app. All images are synthetic, 1290 × 2796, and their dimensions/checksums match the packet manifest. Keyword choices are relevance hypotheses, not search-volume estimates or measured ranking gains.

Exact copy counts: name 27; subtitle 30; keyword bytes 99; promo 140; description 1041; What's New initially 375, then 370 after peer corrections. Codex's narrow recheck found no new P1/P2 content/image issue. An optional P3 notes that the Notes image repeats task text and shows the delivered Grade extraction control; it promises no training/evaluation rollout. The recheck correctly does not substitute for actual Claude review.

## Claude review and final dispositions

Actual Claude reviewed the original packet at `a396794238b7a62e7933ec574b413c139ac51cb1` and then the exact uncommitted copy corrections. [Byte-identical receipt with final addendum](2026-10-05-claude-app-store-listing-review.md). Final disposition: **pass**, no P1/P2. Codex dispositions:
- P3-1 (Notes preview repeats task wording), P3-2 (similar Today/capture images in the first three), and P3-4 (status-bar cosmetics): retained as optional future screenshot improvements; current images pass.
- P3-3: resolved. What's New now says “undo a completion” and “more reliable task swipes”; no unsupported public-version scrolling comparison. Claude's narrow recheck passes at the final packet hash above.
- P3-5: resolved by live Apple read-back: all five unaltered images reached COMPLETE.

## Remaining verification dependency

**App Review access:** on the 21:59 UTC retry, using the corrected packaged configuration and freshly read Apple review credentials, sign-in still returns HTTP 400 `email_not_confirmed`. [Content-free receipt](assets/2026-10-05-app-store/review-access.json). Mike's App Store Connect browser session is now signed in; that login is separate from the Throughline account Apple uses to review the app. Mike was asked to confirm that account's email or supply a working test account through App Review Information. No credential, account identifier or session token was printed or added to tracked evidence. No account was admin-confirmed, bypassed, reset or created. Reverify successful session issuance before submission.

The previous Mac/Claude access blocker is resolved; actual review and recheck are complete. No additional release approval is needed.

The existing iOS regression suites passed for the unchanged accepted app source in the [swipe/scroll receipt](2026-10-05-codex-swipe-scroll-review.md). They were not rerun merely for a build-number change. New checks here are isolated archive/export, source/code identity, packaged configuration (positive and negative artifacts), attempted review-account login, screenshot rendering/inspection and metadata constraints. No fresh Node/Deno/backend suite, on-device animation trace or spoken VoiceOver claim is made. Mike's actual acceptance is recorded separately from those technical limits.

Repository documentation verification, unchanged privacy-policy parity, diff whitespace checks, both packet checksum manifests and the bounded new-text secret/personal-path scan pass. The scan's only initial email matches were verified @2x/@3x image filenames; no email content was present. Signed packages and screenshots are retained separately from these text checks.

## Next action and authority

After Mike confirms or updates the in-app review account, verify sign-in and authenticated API access. Then re-read the already-applied exact listing/build, submit and verify Apple's review state. Automatic release after approval is already selected. Public availability must be verified on the storefront before calling the app shipped. The prepared private scripts are resumable; check fresh state before any retry.

No main merge, source push, backend deployment, extraction/provider/model change, pricing/limit change, policy edit, Private Evaluation activation, external TestFlight expansion or unrelated product work was performed. Signed artifacts, credentials/configuration, Apple account details and raw logs stay in the private ignored release directory. Tracked receipts contain safe build/configuration metadata and fictional screenshot content only.
