# Running List — swipe and scroll integration review

**Verified:** 2026-10-05. **Reviewer/integration owner:** Codex, with independent read-only Codex review. **Base:** 8c72494c005fc0e5150219ab6f848b42f8d90884 on codex/running-list. **Scope:** app-only gesture/row-rendering repair, focused tests and a new internal candidate. App Store submission is held until Mike accepts swipe and scroll on his phone.

## Reviewed input

Claude's uncommitted claude/swipe-gesture proposal shares the same base. Its two reports are preserved byte-identical: [gesture report](2026-10-05-claude-swipe-gesture-fix.md) and [scroll report](2026-10-05-claude-running-list-scroll.md). All five synthetic image hashes in the supplied manifest pass, and the images were inspected as synthetic. Claude's worktree remains unchanged.

- RunningListView.swift SHA-256: `3545f3f5d261af65de4d8094ef052ead903637995bd19e962384755c2be1cbbf`.
- RunningListPreview.swift SHA-256: `e5e5253e26d7395170725457b9a4ad5249630a4cf882fec188b1ab68a957bd40`.

## Findings and disposition

**S1 — P2, resolved:** stored row-action closures captured the enclosing list, whose State retained the same actions object. Ordinary Notes navigation removes the list and could retain that cycle. The integrated change refreshes handlers on appearance and row updates, clears all three on disappearance, and narrows the open-note callback to its standalone dependency. The independent recheck found no remaining blocker. A regression harness reproduces the cycle using the actual extracted production classes and verifies release, callback replacement and reuse after clear. The runtime Notes-to-list return remains a distinct check.

No further P1/P2 was found. Row equality compares the full row, source label, arrival marker and actions identity; changed rows still update, and unchanged rows invoke current handlers. Timestamp labels are cached by source timestamp and invalidated for day/timezone/locale changes. Original formatting is preserved. Row-level accessible completion, reopen, move and source-note actions remain. The long preview is synthetic and DEBUG-only. Captures, recorder, AI controls, durable writes, extraction and backend are untouched.

The earlier 600 ms settle/timer safeguards remain in place. The previously documented transient ordering P3 during unusual Undo combinations remains a follow-up; no data/state loss is implicated.

## Initial verification

- Running List: 12 groups passed.
- New row-support harness: four groups passed using extracted production support classes (current callbacks, captured-owner release, reappearance, cached date labels through midnight and clock reversal).
- Capture store: six groups, plus streamed-file identity and permission checks, passed.
- Capture queue: six groups, plus offline/rejected/stale-auth response isolation, passed.
- AI controls: nine groups passed.
- Claude reports simulator touch checks and a Release-development device install; these are attributed evidence, not a fresh Codex device trace or Mike acceptance.

Build 1.0.5 (2026100501) is reserved above the development build 2026093004. A fresh Apple read at 2026-10-05T20:51:36Z confirms it is unused and public 1.0.5 remains PREPARE_FOR_SUBMISSION with no build attached. Isolated build/package and current simulator verification follow this source review; no new delivery is claimed by this initial record.

**Rollback:** compatible app-only forward build preserving task/capture stores. The preceding 2026093002 has known gesture defects and is not accepted swipe/scroll behavior. Public release, main merge, backend, policy, provider/model, evaluation and tester expansion remain out of scope.


## Integrated review and verification

**Verified:** 2026-10-05. Exact source `7887d39cabbadd9ee796db3e875cef1a792cf55d`, build **1.0.5 (2026100501)**. Integrated RunningListView SHA-256 `8c55c4938aa271b8a1f7ca88ed6107d38562c0ed2ba1868ace3a35eff3789022`.

[Claude's source recheck](2026-10-05-claude-swipe-scroll-integration-recheck.md) passes with no P1/P2. Preserved report SHA-256 `7a890f3c4d3ff76612bba1bc10262871188eef83294ab19a4069fda9b2178719`. The previously expired CLI login was bypassed by using the already-active desktop session; no authentication changes were made. Independent Codex review also found no remaining blocker after S1. Claude's S3 is a nonblocking lifecycle follow-up if Home later gains a navigation-push path; no such path exists today.

The five focused suites above passed, as did docs verification, policy parity and whitespace checks. Isolated Debug simulator build, signed Release archive, internal-only export and strict package verification passed. All 64 tracked iOS files match the exact source. Release excludes DEBUG previews and has get-task-allow=false. Archive and export retain the same Mach-O UUID and machine code. [Package receipt](assets/2026-10-05-running-list-scroll/package-verification.json), [source manifest](assets/2026-10-05-running-list-scroll/source-hashes.json), [candidate](../releases/2026-10-05-ios-1.0.5-2026100501-candidate.md).

### Current simulator observations

Synthetic content only, iPhone 15 Pro Max simulator, iOS 26.3, exact Debug source above. These are functional observations, not phone smoothness measurements.

| Check | Result |
| --- | --- |
| Circle completion after Notes → Home | Passed; open count 68 → 67. |
| Source link opens its note, dismiss sheet, then complete | Passed; correct source sheet, open count 67 → 66. |
| Dismiss Settings sheet, then complete | Passed; open count 66 → 65. Resolves Claude S2's requested lifecycle checks. |
| Full horizontal swipe in short weekly list | Passed; 3 → 2 open, correct task in Done today, no note opened. |
| Undo after settling | Passed; 2 → 3 open and original task returned. |
| Subthreshold horizontal release | No completion and row observed back at its origin. This does not prove OS-interrupted gesture cancellation. |
| Named accessible Complete action | Passed; correct task in Done today with Reopen exposed. Spoken VoiceOver was not exercised. |
| Reduce Motion | Settings confirmed enabled during the checks above; completion/Undo work. Restored OFF afterward. No frame-by-frame animation assertion. |
| Long-list vertical scrolling | Inconclusive. The desktop controller repeatedly failed to move the list; unchanged Notes scrolling also did not move. Some calls returned AXError.cannotComplete. Horizontal swipe and taps later worked. Neither a scrolling pass nor an app scrolling failure is established. |
| Undo inside the 600 ms pause; two rapid completions; externally interrupted drag | Not verified in this runtime pass. Production logic tests cover timer cancellation/order; those do not replace device interaction checks. |

[Completed weekly list frame](assets/2026-10-05-running-list-scroll/week-completed.png) is synthetic. Claude's earlier gesture matrix and scroll counts remain attributed to his report. No on-device Animation Hitches trace, FPS result, smoothness acceptance or public metric improvement is claimed. Node/Deno/backend suites were not rerun: this change is isolated to iOS presentation/support tests and the DEBUG fixture. Capture and AI regression suites were rerun.

The internal build is for Mike's swipe/scroll acceptance under the approved internal-only scope, with the unresolved runtime checks disclosed. App Store submission remains held. No extraction, durable store, backend, policy, provider/model or evaluation changes were introduced.

**Delivery follow-through:** Apple confirmed VALID, INTERNAL_ONLY, IN_BETA_TESTING and existing Internal QA assignment at 21:13:19 UTC. Public 1.0.5 remains PREPARE_FOR_SUBMISSION with no attached build. [Delivery receipt](../releases/2026-10-05-ios-1.0.5-2026100501-delivery.md). Mike’s phone acceptance remains next.
