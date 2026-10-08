# Claude runtime recheck: scroll/tap interaction repair

**Reviewed:** 2026-10-06. **Reviewer:** Claude Code (Claude Opus 5.5), at Codex's request as relayed by Mike.
**Candidate:** `64ed72ccc065377681a5659b8cd1b4cc1259c844` on `codex/running-list`.

**Disposition: pass for every case that ran, with no P1 or P2.**
- The P2-A guard fix behaves correctly at runtime.
- Two requested cases were **not run** and are not waived: Reduce Motion, and landscape reachability.
- Two P3 observations are recorded for Codex and Mike.

## Identity and scope

**Source.** Only `ios/Throughline/Views/RunningRowSwipeGesture.swift` changed in app code from `231755e`.
- Its SHA-256, `a91de792838f52f0135bdbbd3e641184ec82f383413df44d97923f5e372c5e29`, matches in the commit, the working tree and the `candidate/` snapshot.
- The other seven manifest app and project files are unchanged against `assets/2026-10-06-interaction-repair/source.json`.

**Fix as read.** At `touchesBegan` the recognizer takes the single delivered touch and walks up from `touch.view`, checking each ancestor scroll view for `isDecelerating || isDragging`.

**Binary.**
- `Throughline.debug.dylib` is `bed57acc5af129e9f8e14f5c4f8e93520835190f8cc8f5d1dc53d40f1ce4b074`, built at 07:58:35, after the 07:57:42 source.
- The installed copy in the simulator container hashes the same.
- The app is version 1.0.5 (2026100502).

**Environment.**
- iPhone 17 Pro `0DD12F5E-…` on iOS 26.3, in portrait.
- Synthetic preview only (`--throughline-preview-home --throughline-preview-running=long`, plus `today` for the cross-note boundary test), with `UICTContentSizeCategoryL` unless noted.
- No real account, note, audio, hosted feedback or recording was used. No app source was changed.

**Tools.**
- Touches came from the iOS Simulator tool (`tap`, `swipe`, `touch_path`), and every call returned delivered.
- Outcomes were judged from `simctl` screenshots and region pixel diffs.
- Motion timelines came from background JPEG screenshots every 0.25–0.35 s.
- **No debugger was attached during any time-sensitive case.** LLDB was used only for the separate accessibility check and was detached afterwards.

Evidence: `assets/2026-10-06-interaction-runtime-recheck/`, covered by `SHA256SUMS.txt`, with timelines in `timelines-and-introspection.txt`.

## Results

| # | Case | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Ordinary vertical scroll: slow drags starting on task text, a circle, a source label and ••• | **Pass**: the list moved each time with no completion, menu or note. The header region was unchanged except for the list's own date heading scrolling under the tabs. | Pixel diffs; frame 01 |
| 2 | Intentional 120 pt rightward swipe | **Pass**: completed, with Today going from 70 to 69 and the row settling out. | Frame 02 |
| 3 | Fling, then tap a **circle** while the list is still moving | **Pass**: the list stopped about 0.4 s after the fling began, where the control kept moving for about 2.8 s. Today stayed at 70, with no menu or note. | Timelines `control` and `tapcircle`; frame 03 |
| 4 | Fling, then tap a **source label** | **Pass**: stopped early, no note opened, and Today stayed at 70. | Timeline `tapsource` |
| 5 | Fling, then tap **•••** | **Pass**: stopped early, no menu, and Today stayed at 70. | Timeline `tapmenu` |
| 6 | Three quick flicks in succession | **Pass (coarse)**: continuous motion from 0.8 to 3.9 s with no stalled frame, the list travelled about 40 rows, and there was no mutation. A sub-frame hold of about 12 pt cannot be resolved at this capture rate. | Timeline `reflick`; frame 04 |
| 7 | Vertical-first curve, down then about 145 pt right | **Pass**: no completion. | Frame 05 (Today at 70) |
| 8 | Ambiguous diagonal of about 115 × 102 pt | **Pass**: no completion. | Frame 05 |
| 9 | Upward-first curve, then about 140 pt right | **Pass**: no completion. | Frame 05 |
| 10 | Short swipe of 45 pt | **Pass**: no completion, and the row returned exactly to its place (zero pixel difference). | Diff; frame 05 |
| 11 | Reversed swipe: right 100 pt, then back to +30 | **Pass**: no completion, and the row returned to its place. | Diff |
| 12 | Swipe that finishes vertically: right 100 pt, then down 148 pt | **Pass**: no completion. | Diff |
| 13 | Circle tap | **Pass**: completed (Today 69). | Run before Undo |
| 14 | Undo inside the 600 ms settle | **Pass in 2 of 2 captured runs**: Undo appeared about 1.0–1.6 s into the capture, the row was open again within about 0.3–0.5 s, and Today ended at 70. A first, uncaptured run ended completed with no visible effect from the second tap; its arrival time is unknown, so it is counted as neither a pass nor a fail. | Frame 11 montage |
| 15 | Three rapid circle completions | **Pass**: Today went from 70 to 67 and the list settled correctly. | Screenshot |
| 16 | After Notes and Back: source label, •••, and a 1 s hold | **Pass**: Home returned unchanged (zero diff), the source label opened the note, ••• opened the menu, and the hold opened the menu. | Screenshots |
| 17 | Named accessible **Complete** | **Pass (in-process)**: the row's `AccessibilityNode` exposes the actions "Open the note", "Move to later", "Move to this week" and "Complete". Invoking Complete's `actionHandler` returned true and Today went from 70 to 69. This is the custom-action entry point, not spoken VoiceOver. | Introspection lines; frame 10 |
| 18 | Edges of the new targets | **Pass**: all of the following behaved as expected. | Diffs and screenshots |
|  |  | Source label, 16 pt above its line: opens the note. |  |
|  |  | Source label, 6 pt below: opens the note. |  |
|  |  | Source label region, left of its horizontal span: inert. |  |
|  |  | "notes", 18 pt above: opens Notes. |  |
|  |  | Back, 17 pt below: returns Home. |  |
|  |  | Settings gear, 18 pt below: opens Settings. |  |
|  |  | Cross-note boundary (`today` preview), 4 pt above the divider: opens the upper row's note (Aug 21 errands). |  |
|  |  | Cross-note boundary, 3 pt below the divider: opens the lower row's note (Sep 28 drive home). No row captures another row's note. |  |
| 19 | Compact rows at L text | **Pass**: the pitch is about 66 pt, with five rows visible above the first-use footer. | Frame 01 |
| 20 | Full capture tray (`--throughline-preview-capture=failed`, `-many` and `-mixed`) | **Pass**: the list keeps its header and two rows. A list drag moves only the list, and a tray drag moves only the tray, revealing Save again, Play, Discard, "+2 more" and Show all. The recorder stays visible. | Region diffs; frame 06 |
| 21 | Largest text (`AccessibilityXXXL`), Home | **Pass for reachability, with a P3**: the list scrolls (date, then OPEN, then the first row). Without overflow, the outer container stays put. See P3-1. | Frame 07 |
| 22 | Largest text, Notes | **Pass**: Back is stacked above the title with no overlap. The stacked header pushes the recorder past the bottom edge, and an outer drag scrolls the whole screen to reveal the full record button. Back works after scrolling back. | Frames 08 and 09 |
| 23 | Apparent blank screen on launch | **Not a defect**: the blank frames are the cold-launch screen. The same pattern appears with and without the tray, and a frame captured inside the window shows full content. Content shows about 0.6 s after launch otherwise. | Sampling runs |
| 24 | **Reduce Motion** | **Not run.** `simctl ui` has no Reduce Motion option, and I did not change simulator accessibility defaults. The absence of animation also cannot be resolved at a 0.25 s frame interval. The source path is unchanged from the reviewed version: `withAnimation(reduceMotion ? nil : spring)` plus the row's `.transaction`. | — |
| 25 | **Landscape** nested-scroll reachability | **Not run.** Rotating needs Simulator's toolbar. Full-screen control was approved earlier in the session, but this time the screen-takeover prompt timed out and background window capture failed, so the screen may have locked. Landscape was observed only before the guard fix: one row visible, with the footer. | — |

## P3 observations (not blockers)

**P3-1: at the largest text, in the first-use consent state, the list's scroll viewport is only about 158 pt.**
- At that size a single task row is taller than the viewport, though rows remain reachable by scrolling.
- The budget's 180 pt list minimum is computed without the tab bar, which sits inside `RunningListView` and is about 50 pt tall at this size.
- Because the content fits, the layout does not reach the overflow fallback.
- Counting the tab bar inside `header` in `HomeLayoutBudget` would let the threshold engage the fallback here.
- Post-consent users do not see the large disclosure, so the practical impact is limited.

**P3-2: tapping a task title now opens its note where the title sits above the source label's span.**
- The label's upward extension covers the title and the row's top padding, but only within the label's horizontal span. The far-left part of the title, above the marker pill, stays inert.
- The boundary between rows is respected.
- The behavior is consistent but new. Before this change the title was inert. Mike should judge it on device.

## Not verified

- Feel on Mike's iPhone at 120 Hz.
- Spoken VoiceOver.
- Reduce Motion.
- Landscape.
- Any hold of about 12 pt before the list catches up at the start of a re-flick.
- Tests and builds, which Codex ran and I did not.

## Slot

The simulator slot is returned to Codex. No debugger is attached. The simulator was left in portrait, running the candidate app on the synthetic `long` preview at L text. Simulator app access through screen control is released; no setting was changed.
