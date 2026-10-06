# Scrolling and tap targets — repair review

**Verified:** 2026-10-06 (October 5 local time). **Owner:** Codex. **Baseline:** `6e1768b` on `codex/running-list`, active nonsynced checkout. **Candidate source:** `231755e593781786afc72637e195d15c5966eac9` — Repair scroll intent, tap targets, and crowded Home layouts. **Status:** implementation and focused checks complete; final runtime/Claude recheck pending. No new release is claimed.

Mike requested a thorough investigation and repair of scroll and tap-target bugs. The submitted public build remains separate. The release heartbeat is paused at Mike's request; do not resume it. Claude's separate categories/search design commit and feasibility draft are preserved.

## Findings and repairs

| Finding | Severity | Repair and evidence |
| --- | --- | --- |
| The row's SwiftUI drag recognizes before its callback checks direction. Ignoring a vertical sample does not fail the recognizer, and a vertical-first curve can later cross the completion threshold. | P2 | A UIKit recognizer now rejects vertical, leftward and ambiguous starts before taking ownership. Direction locks per touch sequence. Touches on an already moving enclosing scroll view fail immediately, leaving native stop/re-flick behavior in charge; this safeguard still needs runtime verification. Completion still requires a rightward release at 76 points; reversal and cancellation clear the offset. Source and policy tests support this; integrated touch arbitration remains to be checked. |
| Several card/detail/source and sign-in targets are text-sized or 30–38 points tall. Outer padding on a Button does not reliably enlarge its label's hit region. | P2 | At least 44 points inside labels, with rectangular hit shapes. Home/Notes navigation, source labels, note discard/open/grade/issue controls, editor controls, and secondary sign-in buttons are covered. The source-note label uses matched positive/negative padding to preserve visible row height, with its lower hit edge inside row padding. Existing copy, actions, auth/AI decisions and flow are unchanged. |
| A full capture tray can crowd all task rows offscreen above the active recorder. | P2 | Budget tray height using actual available height, header and recorder measurements. Keep the tray scrollable. A stable outer scroll container, with overflow only in short windows, reserves at least 180 points for the list; final nested-scroll reachability remains to be checked. [Before](assets/2026-10-06-interaction-repair/crowded-before.jpg), [after](assets/2026-10-06-interaction-repair/crowded-after.jpg). |
| Largest accessibility text overlaps Notes and Back. | P2 | Stack those two controls at accessibility text sizes; normal presentation is preserved. [Before](assets/2026-10-06-interaction-repair/notes-largest-before.jpg), [after](assets/2026-10-06-interaction-repair/notes-largest-after.jpg). |

Named accessibility containers expose scrolling for Tasks, Notes and Home, preserving their child controls. Tap feedback, immediate durable completion, 600 ms settling, Undo, menu/long-press, source-note navigation and named accessibility actions remain wired to the existing handlers. No persistence, API, extraction, capture queue or recorder lifecycle change.

## Verification

[Exact source identities](assets/2026-10-06-interaction-repair/source.json), [check results](assets/2026-10-06-interaction-repair/verification.json).

- New direction/layout suite: 8 groups, including 1,681 direction combinations and constrained heights.
- Existing Running List 12, row support 4, capture store 6 plus stream checks, capture queue 6 plus auth isolation, AI controls 9: passed.
- Isolated Debug simulator build: passed before the final source-label/moving-scroll guard delta; the final exact candidate also passes an unsigned Release iPhone compile. Source equality with the isolated Release tree passed for every changed app/project file. Unit tests use production code; capture queue/auth tests retain their mocked-platform limits.
- The before/after images predate the final stable outer-container/accessibility-label adjustment; final touch/render checks remain pending. Actual synthetic simulator observations: full-tray before/after; tray Scroll Down reaches lower actions; largest-text Notes overlap resolved. Landscape fallback rendered, but reachability through touch remains pending.
- A temporary hand-driven UIKit fixture was rejected as evidence because manually calling recognizer methods does not register real UIKit touch sequences. It is not included as a passing test.
- Simulator mouse drags did not scroll the unchanged Notes screen either, so those attempts establish neither an app failure nor a pass. The Mac subsequently locked. User was asked to unlock it for final interaction checks.
- Still needed: integrated vertical/rightward/diagonal touch arbitration, short/reversed/cancelled swipe, circle completion, early Undo and rapid completions, post-navigation actions, final accessibility container behavior, and Claude's exact-source presentation review. Spoken VoiceOver and phone smoothness require device acceptance.
- Backend/Node/Deno suites not rerun: app-only changes. No FPS, live-user improvement or complete runtime-matrix claim.

## Review and authority

Independent Codex source reviews found the direction/lifecycle risks above, identified undersized controls, and found no further proven blocker in ordinary layout. A short-height budget limitation was addressed with scrollable overflow and a focused test. A final P2 review found conditional fallback branches could reset tray/list presentation on rotation or recorder-height changes; the final source keeps one stable scroll-container identity. No inherited scroll-disable environment is applied to nested lists. [Actual Claude source review](2026-10-06-claude-interaction-review.md) received; preserved without editing. Disposition:

- P2-1: open runtime gate. Stop a moving list by tapping circle/source/menu, re-flick while decelerating, confirm native delegate retention and nested-scroll arbitration. An immediate moving-scroll failure safeguard was added, but source review is not a pass.
- P2-2: corrected in source. Source hit area expands with matched negative padding, preserving caption and row layout height. Final frame/hit recheck remains.
- P3-1: expanded card/detail and secondary sign-in targets are within Mike's tap-bug repair request; no onboarding/authentication decision, copy or flow changed. Final frames remain for Claude.
- P3-2: corrected by stable outer-container identity, also rechecked independently by Codex.
- P3-3: retain the conservative initial direction cone; verify arcing swipes on device rather than weakening scroll protection without evidence.

Independent final source recheck found no new concrete blocker. Actual Claude's final exact-source/frame recheck remains pending. Codex owns simulator/build load until explicitly released.

No main merge, source push, App Store submission/cancellation, metadata/policy changes, backend deployment, evaluation activation, account change, automation resumption or categories/search implementation. Secondary sign-in changes enlarge hit areas only; no onboarding decision or permission behavior changes.

**Rollback:** a compatible forward app build restoring presentation files, while retaining durable task/capture data and identity. The old drag arbitration has known risks and is not a smoothness baseline.

**Next owner/action:** After Mike unlocks the Mac, Codex sends Claude this exact candidate and releases the simulator slot for his supported swipe/touch-path checks, resolves findings, then prepares an internal-only candidate under standing authority. No public submission change is authorized by this repair.
