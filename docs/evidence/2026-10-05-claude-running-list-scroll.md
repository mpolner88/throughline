# Claude fix request: Running List scrolling

**Prepared:** 2026-10-05. **Author:** Claude Code (Claude Opus 5.5), at Mike's direction ("WAY better, but scrolling isn't incredibly smooth and buttery yet. Please make it so."). **Status:** uncommitted change for Codex to review, test and integrate. It sits on top of the swipe-gesture change in [2026-10-05-claude-swipe-gesture-fix.md](2026-10-05-claude-swipe-gesture-fix.md), in the same worktree (`../throughline-swipe-fix`, branch `claude/swipe-gesture`, base `8c72494`). Installed on Mike's phone as a Release-configuration development build for his feel check.

## What Mike judged

Mike judged a **Debug** build. The swipe-gesture build on his phone was `-configuration Debug`, and `project.pbxproj:320` sets `SWIFT_OPTIMIZATION_LEVEL = "-Onone"` for Debug. TestFlight and the App Store ship Release (`-O`, `:374`). Debug also runs preview-only code in every row (`RunningListPreview.currentDate`, which re-reads the launch arguments and parses a date).

Simulator Time Profiler (iPhone 17 Pro, iOS 26.3, 70 synthetic Today rows, eight injected flings over 25 s):
- Swift runtime conformance lookups were the top main-thread leaf in both the unoptimized and the `-O` variant.
- The main thread was busy only about 0.2–0.4 s in total, because a Mac runs the simulator far faster than the phone's 8.3 ms frame budget at 120 Hz.

So the simulator can count work but can't show the phone's hitches. The phone now has a Release-configuration build of this source, signed for development, so Mike judges what TestFlight would ship.

## Root cause in the code (measured)

1. **Every row re-rendered on every list update.** `RunningTaskRow` received three closures created fresh in each pass (`onToggle`, `onMove`, `onOpen`) plus `now`. Closures never compare equal, so SwiftUI could never skip a row. Every list update re-ran the body of every row already built. Triggers:
   - the list's own clock, which sets `now` every 60 s (`RunningListView.swift` `.task(id: scenePhase)`);
   - each sync or poll result;
   - each completion.
2. **Each row body parsed its note timestamp three to four times.** `sourceTime` ran once for the VoiceOver label, twice through `source` (`ViewThatFits` builds both layouts) and possibly once for the dialog message. Each call went through `row.sourceCreatedAt` → `TaskOccurrence.sourceDate` → `TaskDates.instant`, which allocates a new `ISO8601DateFormatter`, then built a Calendar and formatted the date.

## Change

`ios/Throughline/Views/RunningListView.swift`:
- **`RunningRowActions`** is one main-actor object held in `@State`. Rows call `actions.toggle(row)`, `actions.move(row, tab)` and `actions.open(row)`. `rows(_:)` reassigns the three closures on every list update.
- **`RunningSourceTimes`** is a main-actor cache in `@State` that holds the "note · time" label per stored source timestamp. It parses and formats a timestamp only on a cache miss, and clears itself when the day, time zone or locale changes. The formatting logic is the old `sourceTime`, unchanged.
- **`RunningTaskRow` takes `sourceTime: String` instead of `now: Date`, and is `Equatable`.**
  - `==` compares `row`, `sourceTime`, `isNew` and the identity of `actions`.
  - The use site applies `.equatable()`.
  - Gestures, layout, copy, the dialog, accessibility and the settle are untouched.
- **Why the closures can't go stale.** A row skipped by `==` holds no closures of its own. It reads `actions.toggle` when the tap happens, and every list body pass refreshes that property. So a completion always uses the latest list's `hiddenRecordingIDs` and `reduceMotion`, exactly as before when each row was rebuilt with fresh closures. This answers the hazard the synthesizer raised for a plain `.equatable()`.
- **Internal changes still re-render a row.** Its own `@State` and `@GestureState`, plus environment changes such as Dynamic Type, color scheme and Reduce Motion, re-run its body regardless of `==`.

`ios/Throughline/Models/RunningListPreview.swift` (inside `#if DEBUG`): a `long` scenario with about 70 synthetic Today rows, for scroll measurement. Launch with `--throughline-preview-home --throughline-preview-running=long`.

Final file SHA-256, gesture and scroll changes together:
- `RunningListView.swift`: `3545f3f5d261af65de4d8094ef052ead903637995bd19e962384755c2be1cbbf`
- `RunningListPreview.swift`: `e5e5253e26d7395170725457b9a4ad5249630a4cf882fec188b1ab68a957bd40`

These are the sources of the Release build on Mike's phone (1.0.5, 2026093004, Apple Development signing).

To read it:

```bash
git -C ../throughline-swipe-fix diff -- ios
```

## Measured (simulator, synthetic content)

Row body evaluations were counted with a temporary `print` in `RunningTaskRow.body`, built into separate instrumented apps. The print was removed afterwards; the diff above does not contain it.

| Scenario `long` | Before (gesture fix only) | After |
| --- | --- | --- |
| Launch to first frame | 20 row bodies (5 visible rows × 4 list updates) | 5 |
| One circle tap to settled | 11 | 3 (the tapped row's check and settle, plus the row that moved up) |
| List clock tick (every 60 s) | every built row | none: labels change only with the day, so every row compares equal |

The clock-tick row is by construction, not timed.

## Gesture matrix re-run on the changed source

Run in the Today scenario with injected touches. Everything passes:
- A 90-point swipe that starts and ends on the source label completes the task, and no note opens.
- Tapping the source label opens the note.
- Tapping ••• opens the menu, and the message carries the cached label.
- Tapping the circle completes the task, and the row moves to done today.
- Undo reopens the task.
- A vertical swipe starting on a circle scrolls.
- A 45-point swipe does nothing.
- A 1 s hold opens the menu.

Labels render as before in all three forms: same-day time, "yesterday 6:10 PM" and "Aug 21". The Debug simulator build and the Release device build compiled cleanly. Claude did not run the Swift test groups.

## Investigated and not changed

This was a six-dimension read-only investigation, with each finding put to skeptic review covering three checks: does it run during a scroll, is the cost material, is the fix safe. Refuted or held:
- **`CADisableMinimumFrameDurationOnPhone`**: Apple's ProMotion guidance says UIKit and SwiftUI scrolling already gets high frame rates; the key gates CADisplayLink and CAAnimation hints. `Info.plist` is unchanged.
- **The simultaneous long press, the drag and the tap targets**: pending only from touch-down until the finger moves, with no per-frame cost. The tap targets are the verified gesture fix.
- **The per-row `.confirmationDialog`, `ViewThatFits` and the hidden reveal layer**: small per-row cost. Changing them would touch the frozen design or the swipe just repaired.
- **Publishers during a plain scroll**: nothing publishes during a quiet scroll. The recorder's 1 Hz timer runs only while recording, and the capture poll every 4 s only while a note processes.
- **`LazyVStack` → `VStack`**: held. It would rebuild every row on each tab tap, which is the slowness fixed on 2026-09-30.
- **`HomeView.swift`**: unchanged.

## Not verified by Claude

- **The feel on Mike's iPhone 16 Pro (iOS 27.0).** Mike's check is the acceptance. A fair check needs Low Power Mode off and Settings › Accessibility › Motion › Limit Frame Rate off; either one caps the screen at 60 Hz. It also needs a quiet moment: not while recording or right after saving a note.
- **An on-device Animation Hitches trace** on the Release build. It needs a person scrolling the phone while Instruments records.
- **Reduce Motion and spoken VoiceOver** on this build.

## Requested from Codex

1. Review the diff, this change together with the gesture change, and integrate it on `codex/running-list`.
2. Run the Running List groups and the capture/AI suites as for `957e5be`.
3. Cut a new build number for internal TestFlight and the App Store candidate, higher than 2026093004 (the number on Mike's phone's development build).
4. Keep the App Store submission held until Mike accepts swipe and scroll on his phone.
5. Optional follow-ups, outside this change set:
   - make `TaskDates.instant` use static formatters (`RunningListProjection.swift:4-10`); every caller still allocates one per call;
   - have the list clock write `now` only when the day changes, which would also skip the minute's list body pass.
