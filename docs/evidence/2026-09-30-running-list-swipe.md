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

## Build and verification progress

Source 957e5be40451c5d36ccf2706b222ffc8760505ae is committed on codex/running-list. All 63 tracked iOS files were copied into an isolated build workspace and hashed. The simulator build of 1.0.5 (2026093004) succeeded. Repository foundation (19 backlog items, 49 checked Markdown files), policy parity and whitespace checks passed.

Desktop controls repeatedly timed out, then returned a stale Window menu and unavailable window images. The app itself launches and renders the synthetic weekly list in simctl screenshots. This does not verify a gesture. A fallback read-only Claude CLI review could not authenticate because its OAuth session expired; it did not produce a review. An independent Codex review of integrated source found no remaining P1/P2. No runtime interaction, spoken VoiceOver, package or delivery claim follows from these checks.

## Signed candidate and partial runtime checks

Verified later September 30 (Apple read 2026-10-01T06:03:14Z): isolated signed Release archive and internal-only export succeeded. All 63 tracked iOS files match source 957e5be40451c5d36ccf2706b222ffc8760505ae and the isolated copy. Both signatures verify; archive/export machine code and UUID match, release preview code is absent, and the distribution profile has get-task-allow=false. [Candidate and exact package identity](../releases/2026-09-30-ios-1.0.5-2026093004-candidate.md).

| Requested interaction | Evidence and disposition |
| --- | --- |
| Swipe completion | Source reviewed and built; actual drag still unverified. Pointer input returned noWindowsAvailable. |
| Circle completion | Shared completion handler covered; physical circle tap still unverified because pointer input failed. |
| Checked-row pause and move | Exercised via the exposed accessibility Complete action. Recorded frames show the same checked/struck-through row at its open position, then once under done today. No claim of pointer swipe or precise device timing. |
| Undo during pause | Focused state regression passed; actual timed interaction remains unverified. Accessible Reopen after settling restored the task and weekly count. |
| Two quick completions | Independent timers/order covered by focused tests; actual overlapping simulator interactions remain unverified. |
| Cancelled drag | GestureState reset reviewed; actual short/cancelled drag remains unverified. |
| Reduce Motion | Enabled in real simulator Settings and verified on; runtime completion/drag under that setting remains unverified. Leave on for the next check, then restore its original off setting. |
| VoiceOver Complete | Exposed named Complete and Reopen actions exercised successfully. Spoken VoiceOver focus/announcement and physical gestures were not tested. |

[Before](assets/2026-09-30-running-list-swipe/before-complete.png), [checked in place](assets/2026-09-30-running-list-swipe/checked-in-place.png), [done today](assets/2026-09-30-running-list-swipe/done-today.png), [Reduce Motion setting](assets/2026-09-30-running-list-swipe/reduce-motion-enabled.png), [hashes and scope](assets/2026-09-30-running-list-swipe/manifest.json). The synthetic video holds the checked frame at 8.1 through the 8.5-second sample, and shows settled done today by 8.763 seconds; source specifies a 600 ms delay. These frame observations do not establish a precise real-device timing measurement.

The computer-control tool ultimately reported that the Mac is locked and automatic unlock could not unlock it. Mike was asked to unlock manually. This is a concrete verification blocker, not an app failure. Desktop Claude review also remains pending; the expired CLI session did not produce a review. The archived candidate and diagnostic video/logs are retained in ignored, owner-only local release storage. No upload or delivery occurred; no simulator checks above are silently waived.

**Other checks:** capture-store six groups plus streamed-byte/permission checks, capture-queue six groups plus authentication isolation, AI controls nine groups, repository docs, policy parity and whitespace checks passed. Node/Deno/hosted suites were not rerun for this presentation-only repair; their implementation and API contracts are unchanged.

**Release read-back:** [Apple receipt](assets/2026-09-30-running-list-swipe/apple-hold-check.json) confirms public version 1.0.5 remains PREPARE_FOR_SUBMISSION with no attached build, and 2026093004 is absent. App Store submission stays held for Mike's new device acceptance. Internal upload also waits for the remaining verification and narrow Claude recheck.

**Resume:** unlock the Mac, finish the matrix above on the installed candidate, return the exact source/frames for Claude's narrow review, upload the existing signed internal-only archive if no code changes are needed, verify Apple processing and existing Internal QA membership, then Mike checks the new build on his phone.
