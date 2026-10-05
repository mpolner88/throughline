# Claude recheck: swipe and scroll integration lifecycle correction

**Reviewed:** 2026-10-05.
**Reviewer:** Claude Code (Claude Opus 5.5), as relayed by Mike from Codex's request.
**Revision:** `codex/running-list` at `7887d39cabbadd9ee796db3e875cef1a792cf55d`, candidate 1.0.5 (2026100501).
**Disposition:** **pass.** The P2 correction matches the behavior I intended. No new P1 or P2 issues. Two P3 notes follow; neither blocks.

## Scope and limits

The review covered source only. I did not build, render, use a simulator, run tests, or spawn agents. Codex owns runtime verification. I read:
- `docs/evidence/2026-10-05-codex-swipe-scroll-review.md`
- the integrated `ios/Throughline/Views/RunningListView.swift` (SHA-256 `8c55c4938aa271b8a1f7ca88ed6107d38562c0ed2ba1868ace3a35eff3789022`)
- `ios/Tests/RunningListRowSupportTests.swift` (`f9e374710f88a8344de968c02b296ee9ca9b0ba4f054ff84183a99e409fdaaf8`)
- its runner `scripts/test-running-list-row-support.sh` (`4872d30c45c767d0bc3edfb51c3950a9708ae83838578bf0037f65e5af4821d0`)
- the hosting branch in `HomeView.swift:36-55`

Differences from my proposal (worktree `RunningListView.swift` `3545f3f5…cbbf`) were checked with a full-file diff:
- The integrated file differs only in the lifecycle lines below.
- `RunningListPreview.swift` is byte-identical.
- The project diff changes only `CURRENT_PROJECT_VERSION`.
- Both of my reports in the checkout are byte-identical to the worktree copies.

## Findings

**S1 (P2): my proposal had a retain cycle. I confirm it, and the correction is right.**
- The handlers I stored in `RunningRowActions` captured the `RunningListView` value. That value's `@State` storage holds the same actions object, so actions → closure → list value → state storage → actions formed a cycle.
- `HomeView` removes the list whenever Notes is shown (`if showingNotes { notesContent } else { RunningListView(...) }`). Each trip to Notes and back could therefore strand one list's state, the actions object and everything those closures captured.
- I missed this in my report. Codex's correction:
  - `configureRowActions()` runs at the top of `.onAppear` and on every `rows(_:)` call, so rows still call the latest list's handlers. That was my intent: the latest `hiddenRecordingIDs` and `reduceMotion`, and no stale closures behind `.equatable()`.
  - `.onDisappear` now runs `rowActions.clear()` beside the existing `settling.clear()`. That breaks the cycle when the list leaves Home.
  - The open handler captures only the `onOpenNote` value instead of the whole list. It calls the same callback from the same pass as before, so behavior doesn't change.
- Re-running the configuration in `.onAppear` covers a return without a fresh body pass. Rows then never keep the no-op handlers that `clear()` installs.
- Nothing else changed: no gesture, layout, label-formatting, accessibility or settle changes.

**S2 (P3, runtime check, not a defect):** Codex's Notes-to-list return check covers the path that destroys the list. Please also include, in the same runtime pass, completing a row after dismissing the note sheet and the settings sheet.
- Those sheets keep the list alive. If a platform version fires `onDisappear` on the presenter, the matching `onAppear` (or the next body pass) restores the handlers.
- Source alone cannot prove the pairing. The harness asserts the wiring strings but cannot exercise SwiftUI's appearance callbacks.

**S3 (P3, residual, no action needed):** the cycle exists by design while the list is on screen, and breaks only through `onDisappear`.
- A body pass after `onDisappear` would rebuild it. One case is a list kept alive behind a push while it is "disappeared" and later destroyed without a second `onDisappear`.
- Home has no such path today. The Notes swap is unanimated and destroys the list (`HomeView.swift:149,156`), and no `navigationDestination` or `fullScreenCover` covers the list.
- If a push is ever added above Home, a fully cycle-free design is the fix: a weak owner box, or callbacks that take the needed values as arguments.

## Harness review

`RunningListRowSupportTests.swift` compiles against the production `RunningRowActions` and `RunningSourceTimes` text, extracted by the runner. The runner also asserts the three wiring sites in the integrated source. The four groups check what matters:
1. A row holding the cached reference invokes replaced handlers.
2. An owner captured in the handlers is retained until `clear()` and released after it. The `ActionOwner` fixture models the State-storage cycle with a class: it is faithful in shape, but it is not the SwiftUI path itself.
3. Re-configured handlers work after a clear.
4. Labels follow same day, yesterday, the past week and older, and are invalidated when the clock moves back.

All content is synthetic. I did not run it.

## Still open

The submission stays held until Mike accepts swipe and scroll on his phone. Codex's runtime verification of 2026100501 and Mike's feel check are separate from this source recheck.
