# Claude fix request: swipe-to-complete fires the row's buttons

**Prepared:** 2026-10-05. **Author:** Claude Code (Claude Fable 5.1), at Mike's direction ("The swipe functionality isn't great and when I click on different parts to try to swipe it ends up accidentally clicking on something not swiping… Help resolve these issues."). **Status:** uncommitted one-file change for Codex to review, test and integrate. Installed on Mike's phone as a development build for his feel check.

## What is on Mike's phone

- Before this work: TestFlight **1.0.5 (2026093002)**, read from the connected device. Build 2026093004 (the settle-in-place repair) was signed but never uploaded, so Mike had not seen it.
- After this work: a development-signed **1.0.5 (2026093004)** built from this worktree's source, installed over the TestFlight build with `devicectl`. Same bundle identifier and team, so his account and data persist. TestFlight will install over it again at the next delivery.

## Root cause (reproduced, not inferred)

The running-list row contains four SwiftUI `Button`s: the 44-point circle, the source label ("note · time"), the ••• button and, on done rows, Undo. The row's swipe is `.gesture(DragGesture(minimumDistance: 18))`, the same precedence the shipped `SwipeCompleteRow` used. A SwiftUI `Button` keeps tracking the touch through a drag and fires when the finger lifts inside its bounds, and because a child's gesture outranks the parent's `.gesture`, the swipe is then cancelled.

Reproduced on the unmodified source `8c72494` in an iPhone 17 Pro simulator (iOS 26.3) with injected touches on the synthetic Today scenario:

| Gesture on the unmodified row | Result |
| --- | --- |
| 130-point swipe starting on the circle, finger lifts outside it | Completes (button failed, drag won) |
| 90-point swipe starting and ending on the source label | **Note sheet opens; task stays open** — [frame](assets/2026-10-05-swipe-gesture/baseline-swipe-on-link-opens-note.png), [after dismiss](assets/2026-10-05-swipe-gesture/baseline-task-still-open.png) |
| Hold about 0.65 s, then swipe | Completes (the press-and-hold menu did not fire within that hold) |
| Hold 1 s | Menu opens, as designed |

The old row had one 26-point circle button and plain text elsewhere, so this rarely happened. The new row's buttons cover the left edge where a right-swipe starts and the whole second line, so a thumb swipe of 76–100 points often ends inside one of them.

Separately, 2026093002 still has the two defects fixed in `957e5be` (rows vanish on completion; a cancelled drag stays offset). Mike has not had that build.

## Rejected first fix

`.highPriorityGesture(DragGesture(minimumDistance: 18))` fixed the swipe but **blocked vertical scrolling whenever the drag started on a button**: a vertical swipe from a circle did not scroll, while the unmodified source scrolled from the same spot. Not shippable; reverted.

## Change

`ios/Throughline/Views/RunningListView.swift` only, in the `throughline-swipe-fix` worktree beside this checkout, branch `claude/swipe-gesture`, based on `8c72494`. Changed file SHA-256 for this change alone: `6b1b0c931959e9cee93b0f969a87fce11b3f40070ad645ba4684fc5d5517c13a`. The same file later received the scroll change in [2026-10-05-claude-running-list-scroll.md](2026-10-05-claude-running-list-scroll.md); review the two together.

- The circle, source label, ••• and Undo are plain views with `.contentShape(Rectangle())` and `.onTapGesture` instead of `Button`s. A tap gesture gives up as soon as the finger moves, so the row's drag and the list's scroll behave exactly as on the unmodified source.
- The drag stays `.gesture(DragGesture(minimumDistance: 18))` with the existing `@GestureState` spring reset, threshold and completion logic.
- Nothing else changes: the 600 ms settle, VoiceOver (the row is one element with `children: .ignore`, so the inner buttons were never exposed), copy, the menu, Reduce Motion.

Visible difference: the inner controls no longer dim while pressed (plain-style `Button` highlight). The row itself did not highlight before either.

To read it:

```bash
git -C ../throughline-swipe-fix diff -- ios
```

## Verification (simulator, injected touches, synthetic content)

Same device and scenario, on the changed source:

| Check | Result |
| --- | --- |
| 90-point swipe starting and ending on the source label | Completes; no note — [frame](assets/2026-10-05-swipe-gesture/fix-swipe-on-link-completes.png) |
| Tap on the source label | Note opens |
| Tap on the circle | Completes, settles in place, moves to done today |
| Tap on ••• | Menu opens |
| Tap on Undo | Reopens |
| Vertical swipe starting on a circle | Scrolls — [frame](assets/2026-10-05-swipe-gesture/fix-scroll-from-circle.png) |
| Vertical swipe starting on text | Scrolls |
| 45-point swipe on text | Nothing; row springs back |
| Hold 1 s on text | Menu opens — [frame](assets/2026-10-05-swipe-gesture/fix-long-press-after-short-swipe.png) |

Both simulator builds and the phone build compiled cleanly (Debug). Claude did not run the Swift test groups; this is a view-only change with no model or coordinator edits.

## Not verified by Claude

- The feel on Mike's iPhone 16 Pro, which runs iOS 27.0; the simulators here are iOS 26.3. Mike's check is the acceptance.
- Reduce Motion and spoken VoiceOver on this build.
- A hesitation of roughly 0.6 s or more before a swipe opens the press-and-hold menu. This is the designed long press and matches iOS; it is not changed here. If Mike finds the menu appearing when he means to swipe, raising `LongPressGesture(minimumDuration:)` slightly is a one-number change.

## Requested from Codex

1. Review the one-file diff and integrate it on `codex/running-list`.
2. Run the Running List groups and the capture/AI suites as for `957e5be`.
3. Cut a new build number for internal TestFlight and the App Store candidate from the integrated source. Mike's phone currently carries a development build with number 2026093004, so the next TestFlight build must be higher.
4. Keep the App Store submission held until Mike accepts the swipe on his phone.
