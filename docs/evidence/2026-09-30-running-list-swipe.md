# Running List — swipe completion repair

**Verified:** 2026-09-30. **Scope:** source review and focused local tests; simulator/package/delivery checks pending in this initial record. Mike requested this repair and a new internal device check before any App Store submission.

## Reviewed input and disposition

Claude's uncommitted RunningListView.swift proposal is based on b44f2e7945a82eed578bf0e3d8c4acc005063825, branch claude/swipe-completion; SHA-256 18cca37946f44addbbdf87173a0ece9a67d3d0927403cba10551a36e6c3355fa. Its separate worktree and authored evidence remain unchanged. Codex integrates into codex/running-list.

The source supports both reported causes: completed rows leave the open section immediately, and a State offset resets only in onEnded, which does not cover gesture cancellation. Claude adds a 600 ms visual pause and GestureState spring reset. Persistence still runs synchronously through the existing coordinator/store/outbox before the visual delay.

An independent Codex source review found four P2 issues, all corrected in the integrated implementation:

- A stale timer can end a newer complete → Undo → complete pause: every pause now has a distinct token.
- Integer-slot adjustments cross tab boundaries: presentation entries now include their originating tab.
- Undo of an already settled preceding row disturbs a second pending row: freeze original neighbour order and anchor insertion to surviving neighbours.
- Reduce Motion originally covered only the foreground: suppress animations on the entire row, including the swipe background.

No remaining P1/P2 was identified in integrated source review. One P3 remains: reopening a previously settled row absent from the captured neighbour order can momentarily put the held row on the other side of that newly reopened row, for at most the remaining pause. Task identity, state and persistence are unaffected. This does not prevent the requested internal device check.

## Initial checks

- Running List CLI suite: 12 groups passed, including new completion-presentation regressions for checked-in-place rendering, Undo, stale timers, two quick completions, preceding-row Undo, independent tabs, view replacement, removed rows and reverse-order tail completions.
- Actual swipe cancellation, visible 600 ms timing, Reduce Motion rendering and VoiceOver action remain runtime checks; source tests alone do not establish them.
- Only app presentation, its tests and the build number change. No backend deployment or hosted data fixture is needed.

## Public release hold

Fresh Apple read at 2026-10-01T05:27:03Z: public 1.0.5 is PREPARE_FOR_SUBMISSION with no build attached; neither 2026093003 nor 2026093004 exists on Apple. The draft ASO packet remains separate and unsubmitted. Build 2026093004 is reserved for internal QA after verification. Publishing waits for Mike's new device check.

**Rollback:** another compatible app-only forward build, preserving durable capture/task stores. The previous build retains the known swipe defect and is not an accepted swipe experience.
