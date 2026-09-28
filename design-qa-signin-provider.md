<!-- Publication note: historical local image paths are withheld; the observations below retain their original dates and verification limits. -->

# Throughline Slope-style sign-in providers

## Evidence

- Source visual truth: private reference evidence (not included in this public repository).
- Pre-fix provider evidence: private reference evidence (not included in this public repository).
- Rendered implementation: private reference evidence (not included in this public repository).
- Refreshed onboarding hero: private reference evidence (not included in this public repository).
- Full-view comparison: private reference evidence (not included in this public repository).
- Focused provider comparison: private reference evidence (not included in this public repository).
- Source pixels: 608 × 1260. Implementation pixels: 1320 × 2868 from an iPhone 17 Pro Max Simulator at 440 × 956 points and 3× density.
- Normalization: the full-screen implementation was scaled to the source's 1260-pixel height; the focused provider regions were normalized to the same 608-pixel display width.
- State: returning-user provider choice with Google, Apple, Email, and legal links visible.

## Comparison history

### Iteration 1 — blocked

- [P2] Throughline's provider buttons were visually tighter and more utilitarian than the Slope reference.
  - Evidence: private reference evidence (not included in this public repository) used the same pre-fix provider component with a 52-point height, 8-point radius, dark Google border, and 14-point Google label.
  - Impact: Google and Apple did not feel like a matched, high-confidence account-action pair.
  - Fix: move both controls to a 56-point height and 14-point radius; soften the Google border; increase the Google label to 17 points; and rebalance the Google mark to 19 points.

### Iteration 2 — passed

- Post-fix evidence: private reference evidence (not included in this public repository) and both combined comparison inputs.
- The provider controls now share the Slope reference's full-width geometry, rounded silhouette, visual weight, order, and spacing.

## Required fidelity surfaces

- Fonts and typography: the Google label now has the same prominent account-action weight as the source. Apple retains the platform-owned Sign in with Apple typography, which renders slightly larger than Google's custom brand font.
- Spacing and layout rhythm: Google and Apple are equal-width 56-point controls with a 12-point gap and 14-point continuous corners. Horizontal margins and the bottom-aligned provider stack match the source proportionally.
- Colors and visual tokens: Google uses a white surface, soft `#DAE0E8` border, dark navy label, and official multicolor G. Apple remains the native black treatment with white content.
- Image quality and asset fidelity: the existing official Google G asset renders sharply at 3×; Apple remains the system-provided AuthenticationServices control.
- Copy and content: `Continue with Google` and `Continue with Apple` match the source. Throughline intentionally retains its Email fallback and Throughline-specific Terms and Privacy Policy links.

## Focused-region review

The provider controls and footer were compared in a dedicated normalized crop. Button radii, border weight, logo scale, label hierarchy, vertical spacing, and footer placement were legible at that scale.

## Interaction and accessibility

- Both provider actions retain their existing production authentication handlers and disabled state.
- Google retains its explicit accessibility label; Apple remains the native accessible control.
- Controls exceed the 44-point minimum touch target.
- The dummy preview suppresses authentication and analytics; production provider completion was not exercised in this visual pass.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: the native Apple label is slightly larger than Google's label. Keeping the official AuthenticationServices control is preferred over recreating Apple branding.
- P3: the Slope reference omits Email while Throughline retains it as an intentional reviewer and fallback path.

## Implementation checklist

- [x] Match Slope provider height and corner geometry.
- [x] Match the Google border, label weight, and mark scale.
- [x] Preserve native Apple authentication treatment.
- [x] Preserve Google, Apple, Email, Terms, and Privacy interactions.
- [x] Build an isolated unsigned simulator app.
- [x] Compare full-screen and focused provider evidence.
- [x] Reset the Simulator to onboarding step one.

final result: passed
