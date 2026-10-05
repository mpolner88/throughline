# Running List — public App Store release preparation

**Verified:** 2026-10-05. **Owner:** Codex. **Source:** `d7f26769a7c28e0bcfed50b8ae0ba61fb4fd6044` on `codex/running-list` in the active nonsynced checkout. **Public candidate:** 1.0.5 (2026100502). Mike accepted internal 2026100501 and explicitly authorized ASO, upload and public release. This supersedes the swipe/scroll owner-acceptance hold; no new release approval is requested.

## Current

Apple has accepted the upload, processed it to VALID, marked it APP_STORE_ELIGIBLE and selected it for version 1.0.5. The version remains PREPARE_FOR_SUBMISSION, with AFTER_APPROVAL release behavior. **Not submitted, approved or publicly available.** [Processed-build receipt](assets/2026-10-05-app-store/apple-build.json), [selected-build receipt](assets/2026-10-05-app-store/apple-selected.json).

The exact [ASO and screenshot packet](../../app-store/releases/1.0.5/README.md) is prepared. This turn did not apply its new keyword/What's New changes or upload the five new screenshots. Fresh Apple inspection found the earlier September draft description/subtitle already saved on the pending version; its presence is not publication. The public listing still showed 1.0.4 on the October 5 read.

## Package verification and corrected finding

All 64 tracked iOS files match the frozen revision. Against accepted source `7887d39cabbadd9ee796db3e875cef1a792cf55d`, the sole tracked iOS difference is CURRENT_PROJECT_VERSION 2026100501 → 2026100502. **Compiled machine-code SHA-256 is identical to the accepted TestFlight build.** Isolated signed Release archive, public export, both signatures and archive/export UUID/code identity pass. DEBUG previews are absent, get-task-allow=false, internal-testing-only=false, and the service API token is empty. [Source comparison](assets/2026-10-05-app-store/accepted-source-comparison.json), [source hashes](assets/2026-10-05-app-store/source-hashes.json), [package receipt](assets/2026-10-05-app-store/package-verification.json).

**P1 packaging issue, resolved for the public candidate:** copying tracked source alone omitted ignored LocalRelease.xcconfig. The first attempted public archive and the preceding internal 2026100501 archive therefore lacked the anon client key used by fresh sign-in. Existing signed-in sessions can mask this, so Mike's accepted list experience did not establish fresh-sign-in readiness. The first archive/export were quarantined privately before any upload. The corrected public archive includes the same existing anon key as delivered build 2026093002; the key's role and project were verified in memory. No key was created/rotated, no service-role credential was embedded and no new secret was added to Git. [Configuration receipt](assets/2026-10-05-app-store/release-configuration.json).

New [packaged-configuration verifier](../../scripts/verify-ios-release-config.mjs) checks the actual packaged app, expected build and endpoint, existing anon scope/project and absence of a service token. It passes the corrected archive and exported app and rejects the quarantined missing-key archive. Run it on both archive and export before future uploads; never assume a source-only copy includes ignored release settings.

## Content review

The read-only Codex ASO reviewer checked official Apple field/search/screenshot guidance, the copy's delivered-feature claims and all five final images. Initial P2s for stale images/provenance and diagnostic transcript text were resolved by fresh native captures with a content-only DEBUG fixture patch. No view/gesture/layout changes entered either the screenshot build or the public app. All images are synthetic, 1290 × 2796, and their dimensions/checksums match the packet manifest. Keyword choices are relevance hypotheses, not search-volume estimates or measured ranking gains.

Exact copy counts: name 27; subtitle 30; keyword bytes 99; promo 140; description 1041; What's New 375. Codex's narrow recheck found no new P1/P2 content/image issue. An optional P3 notes that the Notes image repeats task text and shows the delivered Grade extraction control; it promises no training/evaluation rollout. The recheck correctly does not substitute for actual Claude review.

## Remaining verification dependencies

1. **App Review access:** with the corrected packaged configuration, Apple's saved demo credentials return HTTP 400 `email_not_confirmed`. [Content-free receipt](assets/2026-10-05-app-store/review-access.json). No credentials or raw account identifiers were printed, tracked or newly persisted. Mike was asked to confirm the review account's email or update Apple with an already-confirmed reviewer account, without sending the password in chat. Reverify session issuance before submission; never submit a known unusable review account.
2. **Claude listing/image review:** the desktop control tool reports the Mac locked; Claude CLI reports signed out. Mike was asked to unlock the Mac. The exact packet is ready for a bounded read-only Claude review. No peer-review pass is fabricated, and no login credential or machine unlock is bypassed.

The existing iOS regression suites passed for the unchanged accepted app source in the [swipe/scroll receipt](2026-10-05-codex-swipe-scroll-review.md). They were not rerun merely for a build-number change. New checks here are isolated archive/export, source/code identity, packaged configuration (positive and negative artifacts), attempted review-account login, screenshot rendering/inspection and metadata constraints. No fresh Node/Deno/backend suite, on-device animation trace or spoken VoiceOver claim is made. Mike's actual acceptance is recorded separately from those technical limits.

Repository documentation verification, unchanged privacy-policy parity, diff whitespace checks, both packet checksum manifests and the bounded new-text secret/personal-path scan pass. The scan's only initial email matches were verified @2x/@3x image filenames; no email content was present. Signed packages and screenshots are retained separately from these text checks.

## Next action and authority

After the Mac is unlocked, obtain Claude's exact packet review and resolve material findings. After the review account is confirmed, verify sign-in. Then apply and read back the approved listing/screenshots, keep only current screenshots on the new version, submit this exact selected build and verify Apple's review state. Automatic release after approval is already selected. Public availability must be verified on the storefront before calling the app shipped. The prepared private scripts are resumable; check fresh state before any retry.

No main merge, source push, backend deployment, extraction/provider/model change, pricing/limit change, policy edit, Private Evaluation activation, external TestFlight expansion or unrelated product work was performed. Signed artifacts, credentials/configuration, Apple account details and raw logs stay in the private ignored release directory. Tracked receipts contain safe build/configuration metadata and fictional screenshot content only.
