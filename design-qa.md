<!-- Publication note: historical local image paths are withheld; the observations below retain their original dates and verification limits. -->

# Throughline onboarding — consumer Google sign-in correction

## Evidence

- Source visual truth: Google's official light iOS sign-in asset at private reference evidence (not included in this public repository), plus the existing Throughline provider screen at private reference evidence (not included in this public repository).
- Rendered implementation: private reference evidence (not included in this public repository).
- Combined full-view comparison: private reference evidence (not included in this public repository).
- Viewport: iPhone 17 Pro Max Simulator, iOS 26.3, portrait, onboarding step 4 with social providers visible.
- Source and implementation pixels: 1320 × 2868 each. Both captures use the same simulator, viewport, scale, state, and density; no normalization was required.
- Official asset pixels: 564 × 132 at 3x.

## Comparison history

### Iteration 1 — blocked

- [P1] The stock Google SDK control looked like a generic developer component.
  - Evidence: the before capture showed a shadowed rectangular control, gray left-aligned label, and `Sign in with Google`; it did not share the visual weight or geometry of the Apple and email options.
  - Impact: the most recognizable consumer identity option looked less trustworthy and less intentional than the rest of the onboarding flow.
  - Fix: replace the SDK-rendered visual with a Google-compliant custom button using Google's official multicolor G asset, Google Sans Medium at 14/20, approved `Continue with Google` copy, white fill, #747775 outline, 12-point logo-to-label spacing, 52-point height, and Throughline's existing corner radius. Keep the existing Supabase OAuth action unchanged.

### Iteration 2 — passed

- Post-fix evidence: private reference evidence (not included in this public repository) and private reference evidence (not included in this public repository).
- The Google control now has the same width, height, alignment, and overall prominence as the Apple and email controls.
- The drop shadow and gray SDK label are gone. The official multicolor G is sharp and correctly isolated on white.
- `Continue with Google` is centered and immediately recognizable as a consumer sign-in option.
- No app-owned `backend` control is visible.

## Required fidelity surfaces

- Fonts and typography: the label uses the official Google Sans Medium at 14/20; weight, line height, legibility, and centering match Google's current specification. The Apple control retains Apple's native typography.
- Spacing and layout rhythm: 52-point control height, centered icon-label group, Google-specified 12-point space after the logo, full-width frame, existing vertical stack spacing, existing screen margins, and existing corner radius all align with the current Throughline system.
- Colors and visual tokens: official multicolor Google G, white fill, Google-specified #747775 outline, and #1F1F1F foreground. Contrast is clear in enabled state.
- Image quality and asset fidelity: the visible mark is Google's official raster brand asset at ample source resolution, aspect-fitted at 20 points; there is no approximate glyph, emoji, CSS art, or handcrafted logo.
- Copy and content: `Continue with Google` uses Google's approved provider copy and matches Apple's consumer-oriented `Continue with Apple` intent. Existing Throughline value copy remains unchanged.

## Focused-region review

The provider-button stack was reviewed at original capture density in addition to the full-view composite. Logo sharpness, label centering, border geometry, button heights, and inter-control spacing are clearly readable; no additional crop was needed.

## Interaction and accessibility

- The visual replacement is still a native SwiftUI `Button` wired to the existing `startGoogleSignIn()` flow.
- The disabled state dims the full control.
- Accessibility label: `Continue with Google`; the decorative logo is hidden from VoiceOver to avoid duplicate announcement.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3 follow-up: consider title-casing `Continue with email` in a future broader copy-consistency pass; it is intentionally out of scope for this correction.

## Implementation checklist

- [x] Replace the generic SDK visual.
- [x] Use Google's official G asset and approved copy.
- [x] Match Apple/email control width and height.
- [x] Preserve the existing OAuth action.
- [x] Remove the now-unused GoogleSignInSwift package dependency.
- [x] Build and render on the target iPhone Simulator.
- [x] Compare before and after at the same viewport and state.

## Throughline onboarding — email provider consistency correction

### Evidence

- Source visual truth: private reference evidence (not included in this public repository).
- Rendered implementation: private reference evidence (not included in this public repository).
- Combined full-view comparison: private reference evidence (not included in this public repository).
- Viewport: iPhone 17 Pro Max Simulator, iOS 26.3, portrait, onboarding step 4 with social providers visible.
- Source and implementation pixels: 1320 × 2868 each. Both captures use the same simulator, viewport, scale, app state, and density; no normalization was required.
- The `Slope` return indicator in the implementation capture is system-owned launch chrome and does not alter app-owned layout.

### Comparison history

#### Iteration 1 — blocked

- [P2] The email option did not belong to the same provider-button family.
  - Evidence: the source capture showed lowercase `continue with email` and a lighter 0.5-point border than the Google control.
  - Impact: adjacent account options looked like unrelated component styles.
  - Fix: capitalize the label as `Continue with Email` and give Google and Email one shared provider-button chrome implementation.

#### Iteration 2 — passed

- Post-fix evidence: private reference evidence (not included in this public repository) and private reference evidence (not included in this public repository).
- Google and Email now share the same 52-point height, white fill, #747775 one-point outline, corner radius, enabled/disabled opacity, and centered alignment.
- Email retains Throughline's native 16-point semibold typography while Google retains its required Google Sans treatment.

### Required fidelity surfaces

- Fonts and typography: capitalization is correct; Email retains the existing Throughline type weight and remains optically centered.
- Spacing and layout rhythm: button height, width, radius, stack spacing, and margins match the Google control.
- Colors and visual tokens: Email now uses the same white fill, #747775 outline, and #1F1F1F foreground as Google.
- Image quality and asset fidelity: no new image asset was required; the existing official Google asset is unchanged.
- Copy and content: `Continue with Email` exactly matches the requested capitalization.

### Focused-region review

The provider stack is legible in the full-view side-by-side comparison, including border weight, capitalization, radii, and inter-control spacing, so a separate crop was not required.

### Interaction and accessibility

- The Email control remains a native SwiftUI `Button` opening the existing email account flow.
- Accessibility label is `Continue with Email`.
- The shared disabled treatment applies consistently to both Google and Email.

### Findings

- No actionable P0, P1, or P2 differences remain.

## Throughline 1.0.3 — remove redundant account-mode copy

### Evidence

- Source visual truth: `product/audits/2026-08-08-auth-hotfix/07-target-remove-account-toggle.png`.
- Rendered implementation: `product/audits/2026-08-08-auth-hotfix/08-final-account.png`.
- Viewport: iPhone 17 Pro Simulator, iOS 26.3, portrait, onboarding step 4 with social providers visible.
- Source pixels: 654 × 1372. Implementation pixels: 1206 × 2622. Both are portrait iPhone captures of the same account-provider state; density differs, so comparison used the full screen at each image's native aspect ratio rather than pixel-for-pixel overlay.
- State: captured demo note is ready to save; Apple, Google, and Email options are enabled.

### Comparison history

#### Iteration 1 — blocked

- [P2] The provider screen included redundant account-mode copy below the Email option.
  - Evidence: the source showed `Already have an account? Sign in`; the equivalent sign-in state used `New to Throughline? Create an account`.
  - Impact: social authentication works for both new and returning users, so the extra mode switch added conceptual overhead without changing the provider action.
  - Fix: remove the account-mode button from the provider-choice screen while retaining the mode switch inside the Email form, where create versus sign-in behavior actually differs.

#### Iteration 2 — passed

- Post-fix evidence: `product/audits/2026-08-08-auth-hotfix/08-final-account.png`.
- Apple, Google, and Email remain the only account actions.
- The privacy link and page indicator move into the released space without crowding or misalignment.
- The Email form still allows a user to switch between create-account and sign-in intent.

### Required fidelity surfaces

- Fonts and typography: existing Throughline hierarchy and provider typography are unchanged; removed copy leaves no orphaned baseline or inconsistent text weight.
- Spacing and layout rhythm: provider stack, privacy link, and indicator remain evenly separated; no overflow, clipping, or compressed control spacing is visible.
- Colors and visual tokens: white background, black Apple button, outlined Google/Email buttons, gray secondary copy, and blue progress treatment remain unchanged.
- Image quality and asset fidelity: the official Apple treatment and Google G asset remain sharp at simulator capture density; no asset substitutions were introduced.
- Copy and content: both provider-screen account-mode variants are removed. Value copy, provider labels, and privacy copy are unchanged.

### Focused-region review

The provider stack and footer were legible in the combined source/implementation comparison. The removed line, privacy placement, button borders, and page indicator were clear without a separate crop.

### Interaction and accessibility

- Apple, Google, and Email remain native interactive controls with their existing accessibility labels.
- Removing the redundant button shortens the VoiceOver traversal order by one element.
- Physical-device provider completion and full VoiceOver reading order remain release smoke checks rather than visual-QA claims.

### Findings

- No actionable P0, P1, or P2 visual differences remain.

### Implementation checklist

- [x] Remove both account-mode variants from the provider screen.
- [x] Preserve all three authentication providers.
- [x] Preserve Email create/sign-in switching inside the Email flow.
- [x] Compile and render the final 1.0.3 screen on the target Simulator.
- [x] Compare the source and implementation in the same review input.

final result: passed

## 2026-08-16 TestFlight recorder-brand correction

### Evidence

- Rejected TestFlight state: private reference evidence (not included in this public repository), captured from version 1.0.4 build 2026081601.
- Approved implementation state: private reference evidence (not included in this public repository), rendered from the current source shipped in version 1.0.4 build 2026081602.
- Combined full-view comparison: `tmp/throughline-recorder-1601-vs-1602.png` (2026081601 on the left; 2026081602 on the right).
- Both captures are 1206 × 2622 pixels and show the same signed-in empty-Home recording state.

### Decision correction

The earlier active-recorder waveform approval is superseded by direct TestFlight feedback on 2026-08-16. The authoritative active state is the Throughline branded broken-ring mark, animated as a spinner while recording. The generic SF Symbol waveform is not approved for this surface.

### Comparison result

- [P1 resolved] Build 2026081601 conditionally replaced `ThroughlineRecordMark` with `Image(systemName: "waveform")` while recording.
- Build 2026081602 removes that override, so `ThroughlineRecordMark` remains visible and animates throughout recording.
- Typography, layout, colors, copy, task placeholders, timing, and recorder sizing are unchanged between the two captures.
- No additional implementation change is required; installing build 2026081602 is the acceptance step.

### Verification checklist

- [x] Confirm the reported screenshot's build number using aggregate release telemetry.
- [x] Diff the 2026081601 source snapshot against the current recorder implementation.
- [x] Render the current active recording state at the same 1206 × 2622 pixel dimensions.
- [x] Compare the rejected and approved states in one normalized review input.
- [x] Confirm the Throughline branded spinner replaces the generic waveform.

final result: passed

## Throughline FTUX and signed-in empty Home

### Evidence

- FTUX source visual truth: private reference evidence (not included in this public repository) (1604 × 980).
- Empty Home source visual truth: private reference evidence (not included in this public repository) (1604 × 981).
- Rendered FTUX states: private reference evidence (not included in this public repository), private reference evidence (not included in this public repository), private reference evidence (not included in this public repository), and private reference evidence (not included in this public repository).
- Rendered Home states: private reference evidence (not included in this public repository), private reference evidence (not included in this public repository), private reference evidence (not included in this public repository), and private reference evidence (not included in this public repository).
- Combined full-view comparisons: private reference evidence (not included in this public repository) and private reference evidence (not included in this public repository).
- Viewport: iPhone 17 Pro Max Simulator at 440 × 956 points; screenshots are 1320 × 2868 pixels at 3× scale.
- State coverage: first-open hero, 30-second demo, structured demo result, create-account provider screen, signed-in empty Home, recording, processing, and populated Home.

### Comparison history

#### Iteration 1 — blocked

- [P2] The active Home recorder used a circular progress treatment where the approved state called for an audio waveform.
  - Evidence: private reference evidence (not included in this public repository) compared with the second state in the Home source board.
  - Impact: the state read as processing instead of live capture, weakening the user's confidence that Throughline was listening.
  - Fix: use the native `waveform` SF Symbol for the active recording state while preserving the spinner for processing.

#### Iteration 2 — passed

- Post-fix evidence: private reference evidence (not included in this public repository) and private reference evidence (not included in this public repository).
- The active recorder now reads as listening; the processing state remains visually distinct.
- FTUX wording, provider order, task preview, Home empty-state hierarchy, and recorder transitions align with the approved boards.

### Required fidelity surfaces

- Fonts and typography: the native implementation preserves the approved bold headline, restrained uppercase eyebrow, readable supporting copy, and monospaced countdown hierarchy. Platform-native metrics cause minor line-wrap differences without changing hierarchy.
- Spacing and layout rhythm: the content and primary action remain anchored to the same broad top/bottom regions as the source, with native safe-area accommodations and no clipping or overflow.
- Colors and visual tokens: Throughline blue, ink, neutral gray, white, outlined cards, and black Apple provider treatment match the approved direction.
- Image quality and asset fidelity: Google and Apple provider marks and all SF Symbols render sharply at 3×; no low-resolution replacement assets were introduced.
- Copy and content: approved FTUX and Home copy is present, including `Say it. Get a plan.`, `Let's Get Started. For Free.`, `Say today's to-dos.`, and the MCP-readability explanation.
- Icons and states: microphone, waveform, spinner, check circles, settings, lock, and provider treatments are visually distinct and state-appropriate.
- Accessibility: text retains strong contrast, primary controls are at least 52 points tall, and the implementation uses native buttons and symbols with existing labels and disabled states.

### Focused-region review

The source boards and all four rendered states were combined into the same two comparison inputs. Headline wrapping, provider ordering, recorder iconography, task rows, and bottom-action placement were legible in the combined views, so no separate crop was required.

### Interaction and accessibility

- Hero `Sign in` routes directly to provider authentication; `Try a 30-second note` enters the demo recorder.
- `Save this plan` enters account creation with Google, Apple, and Email actions in the approved order.
- Signed-in empty Home keeps the education visible while recording and processing, dims it to emphasize recorder status, and transitions to populated Home after processing.
- Existing 30-second demo and five-minute Home recording limits remain intact.
- Swift type checking covers the complete native source set. Visual preview launch states covered all eight screenshots; live microphone capture and provider completion were not re-run as part of this visual QA pass.
- The simulator's `Slope` return indicator and status bar are system-owned chrome, not app-owned deviations.

### Findings

- No actionable P0, P1, or P2 visual differences remain.
- P3: the populated Home intentionally retains Throughline's richer existing note cards instead of the simplified final card in the concept board; the approved implementation scope was the empty state and its transition.
- P3: the source boards use August 15 while the live simulator reflects August 16; this is expected dynamic date behavior.

### Implementation checklist

- [x] Build the four-state first-time experience.
- [x] Build the signed-in empty Home and recorder transitions.
- [x] Instrument first open, account-state attribution, and Home-state attribution.
- [x] Render all required states on the target Simulator.
- [x] Compare each source and implementation set in the same review input.
- [x] Resolve the active-recorder waveform mismatch.

final result: passed

## Throughline App Store screenshots — larger, higher device composition

### Evidence

- Source visual truth: `tmp/aso-phone-size-reference/01-voice-to-agent.png`, `02-capture-voice.png`, and `03-voice-to-memory.png`.
- Rendered implementation: `app-store/screenshots/iphone-6.9/01-voice-to-agent.png`, `02-capture-voice.png`, and `03-voice-to-memory.png`.
- Combined full-view comparison: `tmp/aso-phone-size-comparison.png`.
- Viewport: App Store iPhone screenshot canvas at 1284 × 2778 pixels.
- Source and implementation dimensions: 1284 × 2778 pixels each; the comparison contact sheet normalizes both columns to the same 400-pixel width.
- State: identical screenshot copy and product UI before and after the device-composition change.

### Comparison history

#### Iteration 1 — blocked

- [P2] The phone was too small and sat too low in the composition.
  - Evidence: the source column leaves a large empty gap between the value proposition and the phone, while the product UI occupies a minority of the frame width.
  - Impact: the actual app experience is hard to read at App Store browsing size and the screenshots spend too much space on empty background.
  - Fix: increase the phone scale from 1.15 to 1.34, align the phone wrapper to the start of its grid area, and reduce its top padding from 86 to 46 pixels.

#### Iteration 2 — passed

- Post-fix evidence: `tmp/aso-phone-size-comparison.png` and all six regenerated files in `app-store/screenshots/iphone-6.9/`.
- The phone is visibly larger, starts directly beneath the explanatory copy, and remains centered.
- The longer MCP and privacy frames retain clear separation between copy and device; no headline, subtitle, bezel, or product content is clipped.

### Required fidelity surfaces

- Fonts and typography: unchanged; all headline, supporting copy, and in-phone typography retain their existing family, weight, line height, wrapping, and hierarchy.
- Spacing and layout rhythm: the excessive copy-to-phone gap is removed; the phone now has a consistent 46-pixel wrapper gap and stronger visual weight across all six frames.
- Colors and visual tokens: unchanged; blue, ink, gray, white, gradients, borders, and shadows retain the established screenshot system.
- Image quality and asset fidelity: all six screenshots were regenerated directly in headless Chrome at 1284 × 2778; scaling remains vector/CSS-rendered and sharp, with no stretched raster phone capture.
- Copy and content: unchanged from the approved ASO direction.

### Focused-region review

The full-resolution renders were inspected individually in addition to the normalized comparison. Phone bezels, status areas, headlines, body copy, task rows, and MCP command content remain sharp and unclipped, so no additional crop was necessary.

### Findings

- No actionable P0, P1, or P2 issues remain.
- P3 follow-up: App Store thumbnail legibility should still be validated after upload because Apple's storefront may apply additional scaling.

### Implementation checklist

- [x] Increase device scale across all screenshots.
- [x] Move the device upward without overlapping copy.
- [x] Regenerate all six 1284 × 2778 screenshots.
- [x] Inspect all six full-resolution outputs.
- [x] Compare the first three before and after in one normalized review input.

final result: passed
