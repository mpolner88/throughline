# Claude review: scroll/tap interaction repair (source, pre-delivery)

**Reviewed:** 2026-10-06. **Reviewer:** Claude Code (Claude Opus 5.5), at Codex's request as relayed by Mike. **Base:** `codex/running-list` at `6e1768b`, plus Codex's uncommitted app-only changes. The categories/search design commit was not touched.

**Scope.** This is a read-only source review. I did not build, render, use a simulator, run tests or edit source. Codex holds the machine slot. Final hashes and frames are still to come, so this receipt covers the dirty tree as read below.

| File | SHA-256 at review |
| --- | --- |
| `Views/RunningRowSwipeGesture.swift` (new) | `4db14468e6ac682f44a83c9450c6fe4057596938c14732c342a59c64634615d1` |
| `Views/HomeView.swift` | `1eae874ee5ff09147c71f663cbece8d6d8e529717748e01e102c4e5da0e84572` |
| `Views/RunningListView.swift` | `2a3e2602e60411c7293bcc7b05c54da40c00c09684232cfbf8fd54ba7586c03b` |
| `Views/CaptureTrayView.swift` | `5df60a2f33a80d3ae8b5212c2d5f62478f77cdb0734ce0dd99c5339571541b95` |
| `Views/TodoRowsEditor.swift` | `f75c51224af1e1d80bb1e519e8dbb6abd28bf082b4d28f692c64911f0490e7ca` |
| `Views/OnboardingView.swift` | `f73559c4f4db749ee58eca36aa8630c3b864b6f5b839ad7ec87012347200d76a` |
| `Models/HomeLayoutBudget.swift` (new) | `d24a73d9001058365308aa5eeb5b3967b43f7665f8929c4f84a777779d101978` |

I also read `ios/Tests/RunningRowSwipeTests.swift` and the `project.pbxproj` registration, which adds the two new files to the group and the Sources phase.

**Disposition: two P2 items must be settled before delivery.**
- **P2-1** is a runtime check that source cannot settle. It is not a confirmed defect.
- **P2-2** is a confirmed layout change on the main screen.

Everything else is P3.

## P2

**P2-1: the list's scroll now waits for every row touch. Check taps and re-flicks on a moving list before delivery.**

`RunningRowSwipeRecognizer` returns `true` from `gestureRecognizer(_:shouldBeRequiredToFailBy:)` for the enclosing scroll view's `panGestureRecognizer` (`RunningRowSwipeGesture.swift:117-123`). The scroll pan therefore cannot begin until the row recognizer fails, and that happens only after 12 pt of non-rightward movement, or at touch-up. For a list at rest this costs about 2 pt over UIScrollView's own hysteresis, which is fine. A moving list is different. My understanding of UIKit, unconfirmed here, is that UIScrollView's pan normally takes a touch on a decelerating scroll view at once. That stops the list, suppresses taps in its content, and continues a re-flick with no dead zone. Two risks follow:

1. **A tap that stops a moving list may now act on a row.** The pan is held while the row recognizer is still possible, so it cannot begin at touch-down and fail the descendant tap gestures. A tap meant to stop a fling may then complete the task (durable save; Undo exists), open the note, or open the menu.
2. **Repeated flicks may stick.** A second flick on a decelerating list may sit still for 12 pt, then catch up. That is exactly the "not buttery" feel this work targets.

Neither is proven from source. Both must be checked with injected touches against the base build `6e1768b`:
- Fling the 70-row `long` preview. While it decelerates, tap a circle, a source label and •••. Expected: the list stops and nothing toggles, opens or shows a menu.
- Fling, then flick again within about 300 ms. Expected: continuous motion, with no hold followed by a jump.

The iOS Simulator tool's `swipe` and `touch_path` actions do drive scrolls and swipes in this app (verified 2026-10-05 for the gesture matrix in `2026-10-05-claude-swipe-gesture-fix.md`), unlike desktop mouse automation. Claude can run this matrix once Codex releases the slot. If either risk is confirmed, two directions exist; keep whichever passes the full matrix:
- Fail the row recognizer at touch-down whenever the enclosing scroll view is moving (decelerating or dragging), so that UIKit's native stop and continue behavior returns.
- Invert the dependency, so the row recognizer requires the vertical pan to fail.

Also check at runtime that SwiftUI's `UIGestureRecognizerRepresentable` keeps `delegate = self` (set in `init`, `:60`) rather than replacing it. If the delegate were replaced, the failure requirement would silently disappear and a right swipe could lose to the scroll.

**P2-2: the source label's 44 pt minimum height enlarges every Running List row.**

`source` now carries `.frame(minWidth: 44, minHeight: 44, alignment: .leading)` before its content shape (`RunningListView.swift`, diff at about `:475`). A caption line is about 16 pt tall, so this is a layout change, not a hit-area change:
- The meta line becomes 44 pt tall, with the caption, and through first-baseline alignment the marker pill, centered vertically.
- That adds about 28 pt to every row, roughly 67 → 95 pt.
- About two fewer tasks fit on screen, around 5 instead of 7 on an iPhone 16 Pro.
- The gap between task text and meta line opens visibly.

This changes the frozen Running List layout and no longer matches the 1.0.5 screenshots just submitted. Two options keep the layout:
- Enlarge only the hit area, as the circle and ••• already do with negative padding. For example, pad vertically, apply `.contentShape(Rectangle())`, then add matching negative padding. Choose the hit area deliberately, because it will overlap the task text above.
- Keep the caption-sized target. Opening the note is also available as "Open the note" in the row menu and in the VoiceOver actions.

A visible row-height change needs Mike's design judgment rather than a tap-target rationale.

## P3

**P3-1: other new 44 pt frames grow the layout too.** These frames come after the visible styling, so the borders stay the same size while spacing grows. None of them is a defect; each is a visible change to confirm in the frames:
- note cards: "Read full note", the five grade buttons (spacing cut from 6 to 4, but each slot is now 44 × 44) and discard;
- note detail: discard label and issue chips;
- onboarding: the sign-in options go from fixed 36/38/48 pt to a minimum of 44/48 pt.

**Authority note:** `AGENTS.md` lists onboarding changes as approval-bound. Copy and actions are unchanged, and this is plausibly within Mike's tap-bug approval, but confirm that the onboarding surface is in scope before delivery.

**P3-2: crossing the short-window threshold destroys the list's and the tray's state.**
- `HomeView.body` renders `homeLayout` in two structurally different branches: plain, or inside a `ScrollView`.
- Crossing `minimumHeight` recreates `RunningListView` and `CaptureTrayView`. That loses scroll position, the settle and in-flight swipe, and the tray's `pendingDiscard` confirmation and retry flags.
- The threshold includes `recorderControlsHeight`, which changes whenever the transient "syncing" label or a notice appears. At accessibility text sizes on smaller phones, the layout could flip on every refresh.
- Suggestions:
  - add hysteresis to the threshold, for example leaving the fallback only at `minimumHeight + 32`;
  - keep "syncing" out of the measured height, by reserving or overlaying it;
  - derive `footerSpacing = 43` from the shared padding constants instead of duplicating the numbers.
- The budget arithmetic itself is right: the tray is at least 44 pt, the normal list keeps `min(280, 40%)`, and the fallback keeps 180.

**P3-3: the swipe now has a narrower, one-shot direction decision.**
- The intent decides once, at 12 pt, using `width > |height| × 1.2`, a cone of about 40° (`:17`).
- The previous drag re-checked `width > |height|` (45°) on every update.
- A thumb swipe that arcs up or down past the cone at 12 pt is now rejected for the whole touch, so the user must lift and retry.
- This is the right trade against scroll theft, but consider a ratio of 1.0, and include arcing swipes in the device check.

## Verified sound from source

- **Intent logic.** It makes one decision per touch sequence. Vertical, leftward and ambiguous diagonal starts can never complete. The 76 pt completion threshold and the 94 pt offset cap are kept. Reversing or finishing vertically cancels completion. Cancellation stays terminal until a fresh sequence. These points are also covered by the eight pure test groups.
- **Recognizer lifecycle.**
  - A second touch fails or cancels the recognizer.
  - Ending in `.possible` fails, which keeps taps working.
  - `touchesCancelled` cancels, and `reset()` clears the intent, touch and origin.
  - Measuring in window coordinates keeps the row's own offset out of the measured translation.
  - UIKit sends no action on `.failed`, which is harmless here because no offset exists before `.began`.
- **Row wiring.**
  - Every terminal path calls `onEnd`, which resets the offset with the existing spring, or with no animation under Reduce Motion (the `.transaction` is still in place).
  - `.onDisappear` resets a recycled row.
  - A completion still goes `onToggle` → the shared actions object → durable save → 600 ms settle → Undo.
  - Press-and-hold (`simultaneousGesture(LongPressGesture)`), the per-row dialog, the VoiceOver actions, the Equatable row, the refreshed actions and the label cache are unchanged.
  - The closures in the gesture capture the row's `@State` storage, so they stay valid when `.equatable()` skips a body.
- **Other.**
  - The tab, Sign in, Notes, Settings and editor buttons gain `contentShape`, with no layout change where a frame already existed.
  - Notes stacks Back above the title only at accessibility sizes.
  - `CaptureTrayView` has a single call site, which passes the computed budget.

## Not verified by Claude

- All runtime behavior: the P2-1 checks, the gesture matrix on the integrated build, the delegate ownership under SwiftUI, and the feel on Mike's iPhone.
- The before/after frames in `docs/evidence/assets/2026-10-06-interaction-repair/`. I listed them by name only and did not inspect them.
- The test groups and the build, which I did not run.
