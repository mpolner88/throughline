# Claude final review: scroll/tap interaction repair (P3-1 layout fix, landscape, Reduce Motion)

**Reviewed:** 2026-10-08, 08:31–09:34 PDT. **Reviewer:** Claude Code (Claude Opus 5.5), at Codex's request as relayed by Mike.
**Candidate:** app source `cfa757890eb268a90e13b1f02a451a7bb80fdb08` on `codex/running-list`. Branch HEAD `6b0cbbe64bb3816f2ac45650a649e7236308c85b` is docs-only on top of it, and `ios/` is unchanged.

**Disposition: pass, with no P1, no P2 and no blocker.**
- The P3-1 fix gives the list at least 180 pt of real scrolling space at the largest text size. It caused no layout regression in portrait or landscape, with or without the full capture tray.
- Landscape nested-scroll reachability and Reduce Motion were the two items left open on Oct 6. Both have now run and pass.
- One new P3 is recorded (P3-3): under Reduce Motion, a fast, short swipe shows no drag feedback in the simulator. It never completes a task falsely. It needs a device check.
- P3-2 is preserved as intended.

## Identity and scope

All checks below were verified at 09:21:39 and again at 09:32:19.

**Source.** The working-tree SHA-256 values match `.throughline/releases/2026-10-08-interaction-repair/review-source.json`:

| File | SHA-256 |
| --- | --- |
| `HomeView.swift` | `21099ca5930d22f2ef91c2eb413326193ef3b2fc39c294478c9b28d21038ae65` |
| `RunningListView.swift` | `e8e931bd3a5c0dcc83efa4e9dc3764e9d4bf3a94d9f1394804ce6beefe9751e0` |
| `HomeLayoutBudget.swift` | `65feb79e5592faff69060f08a11eebedc958c089fdae3183713d287a030a0585` |
| `RunningRowSwipeGesture.swift` | `a91de792838f52f0135bdbbd3e641184ec82f383413df44d97923f5e372c5e29` (unchanged since `64ed72c`) |

- `git diff cfa7578 HEAD -- ios/` is empty, and so is `git diff HEAD -- ios/`.
- The `candidate/` snapshot matched these files.

**Binary.** `/private/tmp/throughline-interactions-20261006/DerivedData/Build/Products/Debug-iphonesimulator/Throughline.app`, version 1.0.5 (2026100502):

| File | SHA-256 |
| --- | --- |
| `Throughline.debug.dylib` | `4e0b3d16903996a70929e680cafd068da98e7c0fd97b4d7dbdcdd9df2e4cc9a3` |
| `Throughline` | `fef0f97f1e68c85cf8d83dbf59b51bba184bdfedeea6b0630c7ac0a7a1e08e10` |

The copy installed in the simulator's app container has the same hashes.

**Environment.**
- iPhone 17 Pro simulator `0DD12F5E-4A6F-48BF-A642-DEF0D2229513` on iOS 26.3.
- Synthetic previews only:
  - `--throughline-preview-home --throughline-preview-running=long`
  - `--throughline-preview-capture=failed` for the full tray
  - `UICTContentSizeCategoryL` or `UICTContentSizeCategoryAccessibilityXXXL`
- No real account, note, audio, recording or hosted data was used.
- I made no change to app source, ran no build, and changed no Mac setting, permission or credential.
- The separate dirty categories/search files were not touched.

## Method

**Touches.** Injected with the iOS Simulator tool (`tap` and `swipe`). Landscape used the side panel's Rotate right control.

**Geometry.** Read with a short LLDB attach that printed each scroll view's window frame, content height and offset, then detached. It ran only on a static screen, never during a gesture.

**Motion.**
- Captured with `simctl io recordVideo`, with frames extracted at 1 px per pt. It writes frames only when the screen changes.
- For tap sequences, back-to-back screenshots were taken about every 0.2–0.25 s.

**Reduce Motion.**
- Set in the simulator's own Settings app (Accessibility > Motion), because `simctl ui` has no Reduce Motion option.
- Every change was read back with `simctl spawn … defaults read com.apple.Accessibility ReduceMotionEnabled` and a pixel check of the toggle.
- Inside the app, it was confirmed by evaluating `UIAccessibility.isReduceMotionEnabled` during a brief LLDB attach, detaching before any gesture.

**Evidence.** 35 synthetic frames are in [`assets/2026-10-08-interaction-final-review/`](assets/2026-10-08-interaction-final-review/), with the numbers in [`geometry-and-timelines.txt`](assets/2026-10-08-interaction-final-review/geometry-and-timelines.txt) and checksums in `SHA256SUMS.txt`.

## Source review of the P3-1 fix (`cfa7578`)

The change:
- `HomeView` now passes `fixedHeaderHeight` to both `HomeLayoutBudget.minimumHeight` and `captureTrayHeight`.
- `fixedHeaderHeight` is `headerHeight` plus the measured list-tabs height. The tabs height is not added while Notes is showing.
- `RunningListView` reports its tabs height with `onGeometryChange`.

**No regression found.**
- The tabs are a fixed-height horizontal strip, so their height does not depend on the space available and cannot set up a layout feedback loop.
- The tabs are always rendered while `RunningListView` is shown, so the measured value is never stale on Home.
- Notes excludes the tabs, and returning from Notes re-measured them correctly at runtime (frame 23: tabs 84, list 180, tray 44).
- At normal sizes the extra 44 pt only shrinks the tray budget; the portrait full-tray layout still gives the list its intended 280 pt.

**Gestures.** `RunningRowSwipeGesture.swift` and the row gesture code are byte-identical to the Oct 6 review.

**Tests.** I did not run them. Codex reports that the eight focused groups pass, including tab heights of 0, 44 and 78 pt.

## Results

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Portrait, L, no tray: regression baseline | **Pass**. Same geometry as Oct 6: list 430 pt, outer 874 pt with 778 pt of content and no overflow. | Frame 01 |
| 2 | Portrait, L, full tray | **Pass**. List 280 pt, the intended viewport; tray 150 pt. A tray drag reached Couldn't save, Save again, Play, Discard, "+2 more" and Show all. A list drag moved only the list. The recorder stayed visible. | Frames 12–14 |
| 3 | Largest text, first-use Home: **P3-1** | **Pass, fixed**. The list viewport is 223 pt, up from about 158 pt on Oct 6, with the 84 pt tabs counted. The outer container now overflows and scrolls to show "Agree and record". A list drag moves only the list. | Frames 15–17 |
| 4 | Largest text, Home, full tray | **Pass for reachability**. List 180 pt. The tray is 44 pt and scrolls through to Save again (offset 971); Save again was seen, not tapped. The outer scrolls to the recorder while the tray keeps its offset. | Frames 18–20 |
| 5 | Largest text, Notes | **Pass**. The outer scrolls to the recorder, and Back returns to Home with the layout intact. | Frames 21–23 |
| 6 | Landscape, L, no tray | **Pass**. The outer (553 pt of content in a 402 pt window) scrolls to its maximum of 171 with the recorder fully visible. The list (223 pt) scrolls on its own while the outer holds its position, and the reverse also holds. A right swipe completed a row (Today 70 → 69). | Frames 02–05 |
| 7 | Landscape, L, full tray | **Pass**. The list, tray and outer each scroll on their own without disturbing the others' offsets. The tray reached every action, and the recorder was fully visible at an outer offset of 150. | Frames 06–08 |
| 8 | Landscape, largest text, full tray | **Pass**. The outer reaches its maximum of 368 and the recorder is visible. The tray scrolls (offset 230) while the outer holds at 129. | Frames 09–11 |
| 9 | Smoke check, RM off: vertical drag over rows | **Pass**. Only the list moved, with no row action. | Frame 33 |
| 10 | Smoke check, RM off: 130 pt swipe completion | **Pass**. The row tracks the finger up to the +94 clamp, then animates a crossfade and spring, then animates its removal. Today 70 → 69. | Frame 31 |
| 11 | Smoke check, RM off: short swipes (55 pt at 0.6 s, and at 0.3 s) | **Pass**. Peaks of +53 and +55, a spring back to rest, and no completion. | Timelines; frame 34 |
| 12 | Smoke check, RM off: circle tap then Undo | **Pass**. Checked at 674.427 and reopening at 674.674. Today went back to its value before the tap. | Frame 32 |
| 13 | Reduce Motion: set and restore | **Done**. Initial value 0. On from 08:47:26 to 09:06:03 and from 09:25:41 to 09:30:35, with the app confirming `RM=true` both times. Restored to 0; Settings and `defaults` agree. | Frames 24, 25, 35 |
| 14 | RM: 130 pt swipe completion | **Pass**. The row tracks to +94, then switches to the completed state (checked, Undo, Today 69) in a single frame and is removed in a single frame, with no spring or slide. | Frame 26 |
| 15 | RM: circle tap then Undo | **Pass**. Open (Today 68), then checked with Undo 0.25 s later (67), then reopened 0.24 s after that (68), and stable afterwards. | Frame 27 |
| 16 | RM: short swipe at 0.6 s | **Pass**. The row tracks the finger (+28 to +56) with the blue reveal, then snaps to rest in one frame with no spring. No completion. | Frame 28 |
| 17 | RM: fast short swipes at 0.3 s (50, 55 and 55 pt; three runs) | **Pass on safety; P3-3 on feedback**. None completed and Today was unchanged. With the same gesture the RM-off control moved the row +55, but no RM run showed any row movement. | Frame 34; timelines |

## P3 observations (not blockers)

**P3-1 is fixed.** See results 3 to 5. At the largest text size the tray is now the part that gives way: it sits at its 44 pt minimum when full, but stays scrollable to every action. That was already true before `cfa7578` and is not a regression. Mike may still want to weigh it as a taste question.

**P3-2 is preserved and intentional.** The source label's upward hit extension is unchanged, within Mike's tap-target repair request. It needs Mike's taste check on his phone; I did not re-tap its edges.

**P3-3 (new): under Reduce Motion, a fast short swipe gives no visible drag feedback in the simulator.** I did not determine the cause.
- **Reproduction:** run the `long` preview at L text with RM on, then swipe on the first row from x 120 to x 175 at y 398 over 0.3 s.
- **Result:** across three runs the row never moved. The recording's only later frame, at 1,027 ms, is pixel-identical to the frame at rest.
- **Control:** the same gesture with RM off moved the row +55 and sprang back within about 830 ms.
- **Related evidence:**
  - With RM on, a 0.6 s short swipe tracks the finger normally.
  - A fast 130 pt swipe still completes, but it rendered only at the +94 clamp, and its release-to-completed time was about 550 ms against about 260 ms with RM off.
- **Impact:** no false completion and no data effect. The user simply sees no drag feedback for a fast, short flick.
- **Source:** the drag-tracking path has no Reduce Motion branch. RM is applied in only two places:
  - the release animation, `withAnimation(reduceMotion ? nil : .spring…)`;
  - the row's `.transaction { if reduceMotion { $0.animation = nil } }`.
- **Possible cause:** a simulator injection or rendering artifact cannot be ruled out.
- **Ask:** Mike should try a quick short flick with Reduce Motion on, on his phone (iOS 27 beta). Codex should look at whether the `.transaction` override or the RM release path drops the brief `dragOffset` updates in a fast gesture.

## Other observations

- **The ••• menu under RM** fades in over about 200 ms with no slide, which complies with Reduce Motion. This was seen only during a tool race that is not counted.
- **Notes card text at the largest size** does not scale like the rest of Home. This is pre-existing and outside this slice; it is recorded only so it is not lost.
- **A slow 2.5 s swipe** opened the long-press menu, which is the designed behavior.

## Tool caveats and attempts not counted

- **`touch_path` was inert this session.** The calls reported as delivered, but nothing happened on screen. On Oct 6, cases 7–12 (vertical-first, diagonal and curved swipes, the 45 pt short swipe, the reversed swipe, and the swipe that finished vertically) were sent with `touch_path`.
  - Their "no completion" passes in `2026-10-06-claude-interaction-runtime-recheck.md` may therefore be vacuous.
  - Only the short swipe was re-covered here, using `swipe`. The other five are **not re-verified** and should be redone with `swipe`, or on the device, if Codex needs them.
- **Parallel tool calls can overlap.** Three Undo attempts are not counted: `rm-undo`, where the menu opened, and `rm-undo2` and `cap-rmu3`, where there was no effect. The `rm-short` attempt used `touch_path` and is not counted either. All counted Undo runs used a single tap, screenshot, tap sequence.
- **`recordVideo` is sparse.** It writes frames only on screen change, so "no intermediate frame" is evidence that nothing animated, but the exact timings are only approximate.
- **Toggle taps in Settings sometimes did not register.** Every Reduce Motion change was therefore read back from `defaults` and the pixels, never assumed.

## Not verified

- Feel at 120 Hz on Mike's iPhone, including P3-2 and P3-3.
- Spoken VoiceOver.
- Oct 6 cases 7–9, 11 and 12 with a working touch tool (see above).
- Tests and builds; Codex ran them and I did not.
- Save again, Play and Discard were reached but not tapped.

## Settings and slot

- Reduce Motion is back to its initial value, 0, verified at 09:30:35 in Settings and `defaults`, and by the relaunched app at 09:34:15 (`RM=false`, read during a static attach that was then detached).
- No other simulator or Mac setting was changed.
- No debugger or debugserver is attached.
- The simulator is in portrait, running the candidate app on the synthetic `long` preview at L text (Today 70).
- **The simulator slot is returned to Codex.**
