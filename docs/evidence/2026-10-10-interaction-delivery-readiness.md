# Scroll and Tap Repair — internal delivery readiness

> **October 12 follow-up:** existing signing recovered without credential changes. Apple closed the approved 1.0.5 version, so the same reviewed app is packaged as 1.0.6 (2026101201). See the [current delivery receipt](2026-10-12-interaction-delivery.md).

**Verified:** 2026-10-10. **Owner:** Codex. **Reviewed app code:** `cfa757890eb268a90e13b1f02a451a7bb80fdb08`. **Package source:** `bba98bb8fd01e28a3f3c73027932f1dfa66016b6`, local `codex/running-list`; the only iOS delta is the build number, 2026101001. **Current:** Release compilation completed, but macOS code signing failed. No signed archive, export or upload is confirmed.

## Final review and evidence correction

[Claude's final review](2026-10-08-claude-interaction-final-review.md) was received and verified October 10. All 36 asset/text checksums match. Landscape, full-tray reachability, the tab-aware largest-text correction, completion and Undo with Reduce Motion now have actual runtime evidence. Reduce Motion was restored to its initial off value and the simulator slot returned. No P1/P2 blocker was reported.

**This receipt supersedes the blanket runtime-pass claims in the October 6 and 8 summaries.** Claude discovered that `touch_path` was inert in the later session. October 6 cases 7–9 and 11–12 therefore remain **runtime-unverified**: downward/upward vertical-first curves, ambiguous diagonal, reversed swipe, and a swipe finishing vertically. The short-swipe behavior was re-covered using a working `swipe` tool; that does not validate the old exact 45-point injection. Original Claude receipts remain byte-identical, including their caveats.

An independent Codex read-only engineering review agreed with internal-only delivery with these explicit gaps. Source locks vertical/left/ambiguous intent out for the rest of a touch sequence, and a completion needs a qualifying rightward final translation. The focused intent/layout suite covers 1,681 combinations, curved/reversed input samples and height budgets. It compiles the pure model on macOS, excluding UIKit; it does not prove delivered touches, native arbitration or rendering. Separate actual runtime checks cover ordinary vertical scrolling from controls, intentional completion, moving-list stop taps, re-flicks, early Undo and nested-scroll reachability. These collectively support a bounded internal phone candidate, not complete interaction or public-release acceptance.

## Remaining observations

- **P3-1:** corrected. Measured tabs are reserved outside the 180-point minimum task viewport. Actual largest-text layout passes. A full tray can still have a narrow 44-point viewport at extreme sizes; actions remain reachable by scrolling.
- **P3-2:** enlarged source-label hit region reaches upward into otherwise inert task text. It stays within the same row and opens only that row's note. Retain for phone judgment.
- **P3-3:** unresolved simulator feedback defect. Three fast short swipes under Reduce Motion showed no drag feedback; the matched normal-motion control did. No false completion occurred. Long swipes, slower short swipes, circle completion and Undo worked with Reduce Motion. Its cause is undetermined, and it is not established as simulator-only. Source updates `dragOffset` without an RM condition; the transaction only suppresses animation. Removing that override speculatively is not justified. Check quick short flicks and completion timing on the phone with RM on and off.

## Verification and scope

The focused eight groups, Running List, row support, capture store/queue and AI-control suites, and isolated builds recorded in the [repair report](2026-10-06-interaction-repair.md) remain applicable to unchanged code. The October 8 layout delta passed its focused suite and exact-source Debug build; all 53 tracked app/project/configuration files matched the isolated snapshot. No unchanged backend suites are rerun. New signed archive/export verification will be recorded separately, including the packaged sign-in configuration in both artifacts, source hashes, signatures and code identity.

Fresh Apple read-only preflight confirms 2026100502 as the latest upload and the existing Internal QA group as internal with public links disabled. The new internal candidate is 1.0.5 (2026101001). Private release configuration, credentials, detailed signing logs and signed artifacts stay in the ignored private release directory. No public submission/metadata or account action, source push, main merge, backend/provider/data-use/policy/evaluation change or automation resumption. Separate categories/search work is preserved.

## Signing blocker and next step

The isolated source snapshot contains 67 tracked iOS files from the package revision and the existing private Release configuration. The archive compiled, then failed at CodeSign with `errSecInternalComponent` (exit 65). Read-only diagnostics found the default keychain unlocked and one valid signing identity, matching the selected signing certificate. Signing an independent disposable executable with that identity failed with the same error. This establishes a signing-environment failure independent of the Throughline bundle; it does not establish the underlying cause or an invalid certificate.

[Apple's signing guidance](https://developer.apple.com/forums/thread/712005) recommends reproducing from Terminal in the GUI login context. A private one-time helper is prepared for Mike to run there, since the computer-control tool denies Terminal access. It checks whether Apple already received this build, archives, exports, verifies source hashes, signatures, internal-only settings and packaged sign-in configuration, and uploads only if all checks pass. Mike handles any macOS password prompt himself. No keychain ACL, trust setting, certificate, credential or account was changed.

Mike ran the helper from Terminal; the archive again reached CodeSign and failed with the same error, with no password prompt. Further read-only checks found the signing identity in the unlocked keychain and no user/admin trust overrides. A direct RSA signing test against synthetic data found the existing private-key reference but failed with authentication status `-25293`; no signature was created. This narrows the failure to use of the signing key, without proving key corruption or a certificate defect. Mike was asked to authenticate the existing keychain explicitly in Terminal before a small signing probe is retried. No further full build retry is useful until that probe succeeds.

After signing is resolved, Codex verifies Apple's processing result and the existing Internal QA assignment. Package verification, export, upload, processing and Internal QA availability remain unverified until their own successful receipts exist. This is a bounded internal phone candidate, not approval to change the public submission.

**Phone acceptance:** scroll, stop and re-flick a long list; try the five unverified curved/diagonal/reversed gestures; test quick short swipes with Reduce Motion on/off; complete and Undo during the pause; check source-label targets and spoken VoiceOver. Tray actions were reached in the layout review, not exercised. Phone feel at 120 Hz is not established by simulator footage.
