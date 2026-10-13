# Throughline Scroll and Tap Repair — internal delivery

**Verified:** 2026-10-12 (Pacific). **Owner:** Codex. **Repository revision at start:** `a4dfd00d01464443fbdfc488bd623decd4f76636`. **App package source:** `c4685b8945ba781c67618daca522d05415b3d899`. **Candidate:** 1.0.6 (2026101201). **Current:** delivered internally. Apple confirms VALID, not expired, INTERNAL_ONLY and IN_BETA_TESTING, assigned to existing Internal QA. Verified October 12 at 19:04 Pacific (October 13 02:04 UTC).

## Signing recovered without credential changes

Earlier archive and standalone signing attempts failed with `errSecInternalComponent`; stored-key access also returned authentication failure. The Terminal-context retry also failed. The exact cause was never established.

October 12 checks found the same certificate still listed by Apple and unexpired. A synthetic in-memory RSA key signed and verified successfully. The subsequent fresh probe using the **existing Apple signing identity** also signed a disposable executable and verified its signature successfully at 18:53 Pacific (October 13 01:53 UTC). No new certificate was created, no existing one was revoked, and no keychain, trust setting, ACL, password or account role was changed. A proposed additional-certificate plan was therefore unnecessary and was not executed. The reason the existing identity began working is unconfirmed. [Sanitized probe receipt](assets/2026-10-12-interaction-delivery/signing-recovery.json).

App Store Connect was checked before packaging and returned no build 2026101001. The 1.0.5 archive and export then passed all package checks, but Apple rejected the upload because 1.0.5 was already approved and closed to new builds. The pipeline had already reached upload before its attempted interruption; no successful upload is claimed for that candidate. Detailed signing logs, secrets and signed artifacts remain private and ignored.

The replacement candidate is 1.0.6 (2026101201), with another duplicate check before archive/export/upload. Only project version/build values changed; the reviewed app code is preserved.

## Reviewed app and package

Reviewed app code is `cfa757890eb268a90e13b1f02a451a7bb80fdb08`; `c4685b8` differs only in project version/build values. Intervening commits outside iOS are documentation/design records. The [readiness receipt](2026-10-10-interaction-delivery-readiness.md) owns the exact behavioral review and remaining phone checks. The isolated signed archive and internal export passed verification: all 67 tracked iOS files match the frozen source, strict signatures are valid, Release preview code is absent, `get-task-allow` is false, internal-testing-only is true, version/build management is disabled, packaged sign-in configuration is valid in both artifacts, and archive/export machine code and UUID match. [Source hashes](assets/2026-10-12-interaction-delivery/source-hashes.json), [package verification](assets/2026-10-12-interaction-delivery/package-verification.json).

The machine-code hash also matches the successfully verified but rejected 1.0.5 package; only version/build packaging values changed. Xcode reports upload success. [Upload receipt](assets/2026-10-12-interaction-delivery/upload-receipt.json). Apple processing completed successfully. The valid internal-only build was assigned to the existing Internal QA group, followed by a fresh read confirming IN_BETA_TESTING and assignment. [Apple delivery read-back](assets/2026-10-12-interaction-delivery/apple-delivery.json).

The previously recorded focused gesture/layout, Running List, row support, capture store/queue and AI-control results still apply to unchanged code. They were not rerun for version/build values. This session passed package verification, repository documentation verification, privacy-policy parity and whitespace checks. No new simulator or physical-device result is implied.

## Existing public version

Apple reports 1.0.5 as READY_FOR_SALE / READY_FOR_DISTRIBUTION. The independent public US storefront lookup confirms version **1.0.5**, with release date October 6 at 20:34 UTC. [Public verification](assets/2026-10-12-interaction-delivery/public-storefront.json), [App Store listing](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241). This is the previously approved public release, not the new interaction repair. The paused release monitor was not resumed.

## Product sequence and scope

**Next action: Mike installs 1.0.6 (2026101201) from TestFlight and checks the repair on his phone.** Check scrolling, swipe cancellation, completion and Undo, tap targets, the five unverified curved/diagonal/reversed gestures, fast short swipes with Reduce Motion on/off and spoken VoiceOver. The simulator's minor RM feedback issue has not been established as simulator-only.

Categories/search Candidate B revision 4 is `handoff_ready`, with [Codex confirmation](2026-10-10-categories-search-rev4-confirmation.md), but requires Mike's build-entry decision. Private Evaluation follows that slice and retains its separate repair/activation gate.

Rollback, if needed, is a compatible forward internal build preserving task/capture stores; this release changes no schema or storage format. Do not return to an older package with known missing sign-in configuration.

Only the existing Internal QA delivery is authorized here. No public submission, main merge, source push, policy edit, backend/provider change, credential replacement or automation resumption occurred.
