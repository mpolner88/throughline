# Claude capture implementation review — 2026-09-29

**Reviewer:** Claude, existing Throughline design session. **Receipt recorded by:** Codex coordinator from the completed read-only review.
**App source:** `c9d2d5c93de44880efbbdff2162535114d797874`, `codex/capture-tray`.
**Contract:** revision 3, SHA-256 `eb4456ecda2912a9be3ef59797eb5be7a70584689dfba780e1bc98f70729dd50`, unchanged.
**Disposition:** design review passes for internal delivery; no P1/P2 design blockers. Mike retains product acceptance after trying the build. This is not a runtime or release attestation.

## Reviewed identity

| File | SHA-256 |
| --- | --- |
| `CaptureTrayView.swift` | `68e20b200ce4e3c9580b07a1339900e75c269c24abc681b7a852b8fd4747712b` |
| `HomeView.swift` | `adeab6b66ae13ed87eb6b0a612cb920d8b09d5285f896a55c446362a9e9b9fe3` |
| `SharedComponents.swift` | `1b813d3dacdd029b429b55d4a7aaaf30606fc9def4ec8d57926b9c6eac8525f9` |
| `OnboardingView.swift` | `aac0ce4e4089eda9d3f4be5b1654d8515b6f1dac0823b54a7d8080b01b444c29` |

The coordinator rechecked these exact hashes after the review. Later commits contain verification tooling and documentation; they do not change these app bytes.

## Evidence reviewed

Claude inspected the source corrections and all 15 distinct final synthetic images: failed light/dark, unconfirmed, sign-in, multiple offline captures, saved/structuring, checking audio, unreadable, deletion-held, other-account, mixed states, microphone-off, and small-screen maximum-accessibility-text failed/action/sign-in views. The earlier blank startup images were excluded. The retained private candidate receipt lists individual image hashes.

Findings resolved: sign-in-only auth controls; tap targets; blue recorder error surfaces; truthful waiting count; state glyphs; Save again/Play/Discard hierarchy; announcement strings; singular account copy; explicit held-account retry feedback. The final row stacks metadata above full-width wrapping text at accessibility sizes. Claude confirmed that action controls are reachable by scrolling and the sign-in header remains legible.

The pre-existing agent-readable line on Home was independently identified as predating this slice. The new tray does not add that claim.

## Remaining findings

| Severity | Finding | Disposition |
| --- | --- | --- |
| P3 | Held-account header wraps at default text size, unlike the single-line mock. | Legible and usable; optional future tightening. |
| P3 | Play/Discard can be below the fold at maximum text size, without a persistent scroll cue. | Reachable in the reviewed scrolled view; optional indicator improvement. |
| P3 | The top divider scrolls away, so clipped row text can meet Home content above it. | Optional fixed divider polish. |
| P3 | Account-deletion refusal appears inline as well as in its alert. | Nonblocking duplicate feedback; recorded accurately, not marked resolved. |

## Evidence limits

Not visually verified in this final matrix: the sign-in sheet; discard/sign-out/deletion dialogs and alerts; storage, account-checking, Stopped early and compact-recording states; Play-to-Stop transition; note-arrival animation; dark states beyond the failed row; standard text at both 375-by-667 and 430-by-932.

VoiceOver speech/focus, haptics, motion, sign-in tapping and physical-device recording interruption/file protection/playback remain unverified. Native tap automation failed, so source and synthetic screenshots do not stand in for those checks. Claude recorded these as evidence gaps rather than design blockers for an internal build.

## Next gate

The [signed candidate](../releases/2026-09-29-ios-1.0.5-2026092901-candidate.md) is prepared. Obtain the separately requested exact [backend deployment approval](2026-09-29-capture-backend-candidate.md), verify hosted capture behavior, then upload internally and verify Apple processing/Internal QA availability. No source edits, deployment, upload or public publication were performed by Claude's review.
