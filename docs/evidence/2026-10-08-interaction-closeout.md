# Scroll and tap repair — final verification and internal candidate

**Verified:** 2026-10-08. **Owner:** Codex. **App source:** `cfa757890eb268a90e13b1f02a451a7bb80fdb08`, local `codex/running-list`. **Status:** final narrow simulator review underway; no new internal delivery yet.

## Review disposition

The [October 6 behavioral recheck](2026-10-06-claude-interaction-runtime-recheck.md) passed every exercised case with no P1/P2. This includes vertical scrolling from text and controls, intentional swipe, moving-list stop taps without mutation/navigation, repeated flicks, curved/diagonal/short/reversed swipes, two captured early-Undo runs, rapid completions, post-navigation actions, target edges and row boundaries, independent tray/list scrolling, and largest-text Notes reachability. The custom accessible Complete action was invoked in-process; it is not a spoken VoiceOver test. Evidence checksums pass for all 12 files.

- **P2-A / P2-1:** the corrected touch ancestry guard passes observed stop-tap and re-flick behavior. The screenshot cadence does not prove frame-rate smoothness or exclude a brief sub-frame hold; phone feel remains a device check.
- **P3-1:** fixed in `cfa7578`. Home measures the actual fixed tab height and includes it in both height budgets. The minimum now reserves 180 points for the scrolling task viewport below the tabs. Notes does not reserve tabs. The stable outer container and recorder lifecycle are preserved. Eight focused test groups and an isolated Debug build pass; narrow runtime review remains pending.
- **P3-2:** accepted within the tap-target repair: the enlarged source-note label reaches upward into otherwise inert title text, bounded by the same row and the label's horizontal span. It opens that row's note and performs no task mutation. Cross-row boundaries passed. Mike can judge this behavior during the internal phone check.
- **Reduce Motion and landscape:** not waived. Claude has the simulator slot for these remaining cases plus the large-text correction and a short gesture smoke check.

## Scope and safeguards

This continues Mike's approved investigation and repair. Canonical guidance and unrelated dirty categories/search work remain unchanged. Existing suites and compile evidence are in the [original report](2026-10-06-interaction-repair.md); unchanged backend suites are not rerun for this app-only correction. The latest focused suite, repository verifier, privacy parity and whitespace checks pass.

Apple build preflight on October 8 confirms latest uploaded build 2026100502. Build 2026100801 is prepared for the existing internal-only Internal QA group under standing authority; no package or upload has run. Packaged sign-in configuration must be checked in both the signed archive and exported app. The source snapshot must include the existing ignored release configuration privately, and no private configuration or signed package enters Git.

No public release/submission change, main merge, source push, policy edit, backend deployment, provider/data-use change or evaluation activation. The release heartbeat remains paused. Final device smoothness and spoken VoiceOver remain separate from simulator evidence.

**Next:** complete Claude's narrow recheck, resolve blockers, then package and verify the internal-only repair build.

## Interim October 8 runtime observations

Claude verified the exact new source and installed binary, then reported: normal landscape has a 223-point task viewport below the tabs; intentional swipe completes; the outer screen, list and tray scroll independently; full-tray Save again, Play, Discard, +2 more and Show all are reachable; outer scrolling reveals the recorder. At largest text in landscape the recorder remains reachable and the tray scrolls independently, though its minimum 44-point viewport is narrow. These are interim observed results; Claude's final receipt has not yet been delivered.

The Mac locked again after the simulator was returned to portrait for the remaining Reduce Motion check. Codex requested an unlock. Do not infer a Reduce Motion pass or complete review from the landscape observations. Claude retains the simulator slot until explicit handback. No signed archive, export or upload has run.

Codex additionally compared all 53 tracked app, project and configuration files: the working tree, committed `cfa7578` and isolated simulator source snapshot are byte-identical. Existing ignored release configuration remains private and is reserved for the eventual signed package.
