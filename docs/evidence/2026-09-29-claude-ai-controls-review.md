# Claude review: inline AI acceptance and Settings control

Verified **2026-09-29**. Reviewer: Claude Code (Claude Opus 5.5), read-only presentation review requested by Mike through Codex. This is a design and presentation review of exact source and Codex-verified simulator images. It is not an engineering review, a device test, a release approval, or a policy review. Nothing was built, run, rendered, staged or committed by Claude for this review.

## What was reviewed

- **Source:** local `throughline-local` checkout, branch `codex/capture-tray`, commit `e6c2e20ca01e92955eacc96ace78791682b9d93d` ("Place AI acceptance inline with the first recording action"). The diff against its parent was read in full for these views:

| File at `e6c2e20` | SHA-256 (first 16) | Reviewed lines |
| --- | --- | --- |
| `ios/Throughline/Views/SharedComponents.swift` | `0ae45b6af6fb0cf3` | `AIProcessingDisclosure` 74–87; Settings switch, "How it works" and footer 142–162 |
| `ios/Throughline/Views/HomeView.swift` | `c0e4704cb08f29d3` | disclosure 243; acceptance on tap 291; recorder title 314 |
| `ios/Throughline/Views/OnboardingView.swift` | `0bbe4629ea3af083` | record-step disclosure and title 159–162; signed-in demo save 295–297; refusal notice 616 |

  `AppState.swift` and `RootView.swift` changes are debug preview hooks only. `AIProcessingPermission.swift` and the tests were not reviewed; engineering review is Codex's.
- **Images:** the complete seven-image set of synthetic simulator captures, supplied and visually verified by Codex, each at 1206 × 2622. All seven matched Codex's manifest.

| Image | SHA-256 |
| --- | --- |
| `onboarding-first-light.png` | `011d8b0580476dc8e91a13a547f3a17eef64792d25674bee1bf4dd7d4fdce13f` |
| `onboarding-largest-dark.png` | `ba6c75176fcfa6c46bddb9b180fc60c5e15ab3eedf6d814ba44fc4b277fa94a0` |
| `home-first-dark.png` | `f7a04c08892edadb6fe496ae4408bccf58d6fc2f35e7880735a3ccccb63627d9` |
| `home-largest-dark.png` | `ed6dfe46136988b08b4c400d282b56fa3ad97ec21d7ea9d9770efe51eefadd3d` |
| `settings-off-dark.png` | `ead0fba3b572e204e59e4afe0fa70006ce371fd24b5be8c3fc67a3ac2f6325b5` |
| `settings-off-largest-light.png` | `641ae4521c88bc855b9a7dd1f898bd9c0aec17b4af750f9dcdf96d8b02d28e73` |
| `settings-on-light.png` | `11c6491c69f65e65eab393d76552c910c30ef947ecc0d8793dea542cc1afe21b` |

## Verdict

The presentation meets Mike's direction: no sheet, one tap, and a quiet disclosure only where it is needed.

- **The first recording action is the acceptance.** On the onboarding record step and on Home, a one-line disclosure sits directly above the recorder. It names Groq and Supabase and what they receive. The recorder reads "Agree and record". One tap agrees and starts recording, and there is no second screen.
- **The signed-in demo save** uses the same pattern: "Agree and save note".
- **Settings** has a native "AI voice notes" switch with an inline "How it works" explanation. The off footer is truthful: "AI is off. New recording and processing are paused; saved notes stay readable." With the switch on, it reads "Groq processes your recordings and text. Supabase hosts your notes."
- **Accessibility:** at the largest accessibility text size, "Agree and record" stays visible on both first-use screens, and Settings wraps and scrolls.

There are no P1 findings. One P2 (A1) should be fixed before delivery; it is a one-line change. The P3s are optional.

**Final verdict for the signed candidate at `e6c2e20`:** approved for internal TestFlight delivery on presentation grounds, with one condition. A1 is present in that candidate. Codex either fixes A1 before upload, which is recommended, or Mike accepts A1 as a known issue for this internal build. It must then be fixed in the next build. Nothing in this review blocks the internal build otherwise.

## Findings

| ID | Severity | Finding | Location and evidence | Disposition |
| --- | --- | --- | --- | --- |
| A1 | P2 | The inline "How it works" link looks like body text: grey, not blue. Its 44-point frame sits outside the `Link`, so at default text size the tappable area is probably only the text. Mike asked that people who want to go deeper can do so; this link is that path. | `SharedComponents.swift:79` (link) and `:83` (secondary style on the whole stack); visible in `onboarding-first-light`, `home-first-dark` and both largest-size images | Codex: tint the link with the brand blue, and put the 44-point frame and `contentShape` inside the link's label |
| A2 | P3 | The same label, "How it works", opens the web privacy policy inline on Home and onboarding, but expands an explanation in Settings. | `SharedComponents.swift:79` vs `:152` | Optional: rename the inline link "Privacy policy", or point both at the same explanation |
| A3 | P3 | The demo-save refusal notice says "Turn on AI voice notes", a Settings control that can't be reached from onboarding. The adjacent button is the path. | `OnboardingView.swift:616` | Optional: "Your demo is still here. Tap Agree and save note to save it to your account." This path is rare. |
| A4 | P3 | Sentence-case "Agree and record" and "Agree and save note" sit among lowercase onboarding labels ("save demo note", "continue", "stop recording"). The mix was already there. | `OnboardingView.swift:162, 297` | Optional |
| A5 | P3, note | At the largest text size the Home disclosure takes much of the screen until first acceptance. It is transient and must stay readable, so no change is recommended. | `home-largest-dark` | None |

## Limitations

- Claude did not run the app, tap anything, or render images; rendering was paused at Codex's request while the simulator needed the machine.
- Not verified:
  - VoiceOver reading order and labels;
  - the actual microphone and permission sequence;
  - capture-tray rows while AI is off;
  - any physical-device behavior.
- The Settings images show a synthetic preview account; it is not reproduced here.
- Guideline fit is a presentation judgment: an explicit affirmative action next to a disclosure that names the third-party processor. It is not legal advice. The approved privacy policy bytes were not reviewed or changed.

## Next

Codex fixes A1 before upload, or Mike accepts it for this internal build. If it is fixed, Claude can confirm it from one updated image. Delivery follows Codex's existing internal-release authority.

## A1 resolution and exact-source verdict

Appended **2026-09-29**.

- **Source:** `77192374e5f1de339047904c7ee0825e9863b96f` ("Make the inline AI detail link visible and easy to tap"). Against `e6c2e20` it changes only `ios/Throughline/Views/SharedComponents.swift`, in `AIProcessingDisclosure`. The "How it works" label is now `Theme.blue`, and its 44-point frame and `contentShape` sit inside the link's label, so the whole area is tappable. No other iOS file changed.
- **Image:** `onboarding-link-fixed-light.png`, 1206 × 2622, SHA-256 `a37338ceaebdf94da88cd56bc5310322dc543d23feb5f97bdc487150a0296d02`, matching Codex's manifest. It was inspected as an image: "How it works" reads in brand blue under the disclosure, above "Agree and record".
- **A1:** resolved.

**Final verdict for `7719237`:** approved for internal TestFlight delivery on presentation grounds. No P1 or P2 findings remain open. A2–A5 are optional polish for a later build. The limitations above still apply: VoiceOver, the real tap and microphone sequence, and physical-device behavior are unverified and belong in Mike's device checks.
