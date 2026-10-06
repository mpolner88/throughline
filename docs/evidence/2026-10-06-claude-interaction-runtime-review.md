# Claude runtime review: scroll/tap interaction repair (diagnostic stage)

**Reviewed:** 2026-10-06. **Reviewer:** Claude Code (Claude Opus 5.5), at Codex's request as relayed by Mike.
**Candidate:** `231755e593781786afc72637e195d15c5966eac9` on `codex/running-list` (HEAD `f055df3`). The separate dirty categories/search files were not touched.

**Disposition: P2 open. Do not package.**
- The moving-list safeguard added for P2-1 cannot fire, because it searches from a view that has no scroll view above it.
- Delegate retention passes.
- At Codex's direction, the behavioral matrix was stopped after this diagnostic and returned for the guard fix. Everything below that is marked **not run** is deferred to the narrow rerun. None of it is waived.

## App identity

- **Binary:** `/private/tmp/throughline-interactions-20261006/DerivedData/Build/Products/Debug-iphonesimulator/Throughline.app`, version 1.0.5 (2026100502).
  - `Throughline.debug.dylib` SHA-256 `2e23b13034a3d6b34b8284c3513866cdffa1ece9792a3bb2e4e32ffa8e211313`
  - `Throughline` SHA-256 `fef0f97f1e68c85cf8d83dbf59b51bba184bdfedeea6b0630c7ac0a7a1e08e10`
- **Build provenance:** the binary was built at 07:42 on October 6, after the candidate sources (22:35–22:37 on October 5). Its build log compiles from `candidate/`, and it contains the final-delta symbol `enclosingScrollIsMoving`.
- **Source snapshot:** all eight app and project files in `candidate/` match the SHA-256 values in `assets/2026-10-06-interaction-repair/source.json`. The three Views files are also byte-identical to commit `231755e` and to the working tree. The test files are not part of the app snapshot.
- **Simulator:** iPhone 17 Pro `0DD12F5E-4A6F-48BF-A642-DEF0D2229513`, iOS 26.3. Synthetic preview only: `--throughline-preview-home --throughline-preview-running=long -UIPreferredContentSizeCategoryName UICTContentSizeCategoryL`.
  - It was found in landscape. I rotated it to portrait with the Simulator toolbar Rotate button and **left it in portrait**.
  - No real account, note, audio, hosted feedback or recording was used, and no app source was changed.

## Method

Touches were injected with the iOS Simulator tool (`tap`, `swipe`). Recognizer state was read with LLDB:
- breakpoints auto-continued on `RunningRowSwipeRecognizer.touchesBegan(_:with:)` and on `gestureRecognizer(_:shouldBeRequiredToFailBy:)`;
- each logged a Swift expression;
- the process was detached after every run, and nothing was left attached.

Verbatim output is in [recognizer-runtime-log.txt](assets/2026-10-06-interaction-runtime/recognizer-runtime-log.txt). All logged touches were neutral taps on task text, which has no action.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Delegate retained under `UIGestureRecognizerRepresentable` | **Pass** | `delegate === self` is true at touch-down. UIKit calls the recognizer's own `shouldBeRequiredToFailBy`, and it returns the requirement for `UIScrollViewPanGestureRecognizer` on `HostingScrollView`. It is called twice per touch, once for each of the two scroll views in the chain; other system recognizers are not matched. Log [1], [2]. |
| Moving-list guard (`enclosingScrollIsMoving`) can detect the list | **Fail: P2** | See P2-A below. Log [2], [3]. |
| Row height preserved (P2-2 fix) | **Pass (visual)** | Portrait, L text, `long`: the row pitch is about 66 pt and five rows are visible above the first-use footer. This matches the 66 pt pitch measured on the pre-repair build on 2026-10-05. Hit-area edges were not tapped. [Frame](assets/2026-10-06-interaction-runtime/portrait-long-today-L.jpg). |
| Outer Home container, portrait at L text | **Observed** | The outer `HostingScrollView` is 874 pt tall with 778 pt of content, `alwaysBounceVertical=false`, so nothing overflows. The inner list is 430 pt tall with 4,971 pt of content. Log [3]. |
| A fling with a logging breakpoint at touch-down | **Discarded** | The breakpoint paused the main thread at touch-down and turned the fling into a press-and-hold: the menu opened and the list did not move. This says nothing about the app. The behavioral tests must run with no debugger attached. |

## P2-A: the moving-list safeguard can never fire

`RunningRowSwipeRecognizer.enclosingScrollIsMoving` (`RunningRowSwipeGesture.swift`) walks up from `self.view`. At runtime, SwiftUI attaches this representable recognizer to the **root hosting view**, not to the row:

```text
recognizer.view ancestors: _UIHostingView<…> > UIDropShadowView > UITransitionView > UIWindow
```

No `UIScrollView` is in that chain, so `guardMoving=false` on every touch. The safeguard Codex added for P2-1 is therefore a no-op. Any risk P2-1 describes (a tap that stops a moving list acting on a row, or a re-flick that sticks) is exactly as it would be without the guard.

The touch's own hit view does sit inside the list. This is the logged `UITouch.view` chain for an ordinary row-text tap:

```text
PlatformGroupContainer
 > HostingScrollView [list: frame 430, content 4971, bounces]
 > PlatformContainer > PlatformGroupContainer
 > HostingScrollView [outer Home: frame 874, content 778, no bounce]
 > PlatformContainer
 > _UIHostingView [recognizer's view] > UIDropShadowView > UITransitionView > UIWindow
```

**For Codex (direction only, not a prescription):**
1. Derive "moving" from the tracked touch's `view` ancestry at `touchesBegan`. The nearest `UIScrollView` is the list. Checking every scroll ancestor whose pan this recognizer gates would cover both the list and the outer container.
2. Then rerun this narrow review without a debugger, to confirm two things that source and logging cannot:
   - that `isDecelerating` (or `isDragging`) is still true when a recognizer's `touchesBegan` runs for a touch that stops a fling;
   - that failing at that moment leaves no row action on release.

## Not run (deferred to the narrow rerun; none waived)

These items were stopped at Codex's direction after the diagnostic.

**P2-1 behavior**
- Fling, then tap a circle, a source label and •••, expecting no mutation or navigation.
- Quick repeated flicks.

**Direction and completion**
- Vertical-first curved and diagonal starts must not complete.
- An intentional 76 pt swipe.
- Short, reversed and cancelled swipes.
- Circle completion.
- Undo during the 600 ms settle.
- Rapid completions.
- Source label, menu and press-and-hold after Notes navigation.

**Accessibility and layout**
- The named accessible Complete action.
- Reduce Motion.
- Full capture tray, the largest text size, and nested-scroll reachability in landscape.
- Edge taps on the new targets.

Long-list vertical scrolling itself was not exercised without the debugger in this stage.

For timing evidence in the rerun, the background JPEG capture used here manages about 0.35 s per frame. That is enough to show whether a tap landed on a moving list. It cannot resolve a 12 pt hold before a jump.

## Slot

The simulator slot is returned to Codex. No debugger is attached, and the candidate app is still running in the synthetic preview. Evidence assets with checksums: `assets/2026-10-06-interaction-runtime/SHA256SUMS.txt`.
