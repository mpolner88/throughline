# Running List — ready to build

**Verified:** 2026-09-30. **Reviewer:** Codex. **Disposition:** pass for the selected design contract; all RL1–RL7 findings are resolved. This is design readiness, not implementation or release verification.

## Exact reviewed files

- Active nonsynced checkout: `throughline-local`, branch `codex/running-list`, pre-integration source `f6983ed01cd41355cc950dd9bd1226cb9da85294`.
- [Claude handoff](../handoffs/2026-09-29-home-running-list.md), revision 2, marked `handoff_ready` by the actual Claude Code session: SHA-256 `df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946`.
- [Asset manifest](../handoffs/assets/2026-09-29-home-running-list/SHA256SUMS.txt): SHA-256 `237c804b2f0d1e0b48097ca0e33fe630e7996c20436f2bb729acb339d356a54d`. All 32 entries pass SHA-256 verification: one prototype and 31 PNGs.
- Prototype SHA-256 `5257512d2f4b91b0d2e489bb2b8edd8b607798de42e26e3ead2066d0e515e694`; identical to the interactive working prototype.
- [Claude resolution receipt](2026-09-30-claude-running-list-resolution.md) records authored corrections, rendering checks and release of the rendering slot. Codex independently rechecked the final source-sheet image (`0167c8ab75dd42ef7a1a7482128453e3d34e4a5ea8042b7692ddcf7d118a8fa4`) as an image and reran the entire manifest after that last correction.

## Re-review and disposition

| Finding | Severity at first review | Final disposition |
| --- | --- | --- |
| RL1 older apps | P1 | Resolved under Mike's continuation: recording/reading remain; completion must be currently and historically unambiguous; an edit carrying a stale or changed task array fails in full. No partial apply or resurrected task. |
| RL2 task editor | P1 | Resolved: stable identity rows, rename/remove/add, expected ordinary note version, atomic save. Keep evaluation revisions separate. |
| RL3 Sunday | P2 | Resolved: Monday waits in Later on Sunday, then Today on Monday. |
| RL4 moves and Undo | P2 | Resolved: persistent destination overrides, move-local date, completion tab snapshot, Undo preserves placement. Only explicit moving promotes an earlier task. |
| RL5 said timeframes | P2 | Resolved: only valid existing dates; undated words follow D1. No extraction/schema/prompt change. |
| RL6 calendar and accessibility | P2 | Resolved: foreground midnight/clock/timezone refresh; no animation with Reduce Motion; one VoiceOver row with named actions. Device validation remains required. |
| RL7 recorder and Notes | P2 | Resolved: shipped recorder title/AI behavior; Notes within mounted Home preserves capture lifecycle. |

Codex read revision 2's full behavior and contract, including ordering and counts, and inspected the editor light/dark/conflict, Sunday placement, persistent move, largest-text and corrected note-sheet images. Earlier Today/Notes references were also inspected. Prototype images are design targets, not app evidence. No new material design finding remains. Claude's final readiness changes only record the passing review and the corrected source-sheet reference.

Implementation must preserve identity through cards/detail/edit as well as Home, persist offline commands before optimism, protect owner/session generations around every await, and refuse stale or ambiguous writes. The pending editor request must retain the same UUID/payload after an unknown response; any additional retry presentation receives Claude implementation review. Replayed receipts must not overwrite newer snapshots.

## Baseline checks and limits

- Passed: all 32 asset checksums, prototype equality, supplied final hashes, text/image review, and content screening of newly integrated design files. No credential/email/personal-path pattern matches were found; synthetic content is explicitly labeled. The rendered PNG metadata is resolution-only according to Claude's receipt.
- Passed on the unchanged product baseline: 178 Node tests; 99 Deno tests; capture-store/queue, auth-refresh and AI-permission Swift harnesses. Logs remain temporary. Documentation verification and diff whitespace checks are rerun at integration.
- Not yet run for this feature: database migration replay/concurrency tests, new projection/store tests, isolated app build, simulator matrix, hosted task verification, Claude implementation review or TestFlight delivery. No running-list production implementation existed at this review.

## Next action and ownership

Codex builds **Running List — Today, This Week, Later** under Mike's existing approval. Backend and Swift-state workers have exclusive named production/test paths; root integrates Home/screens, canonical records, verification, the named draft PR and delivery. Claude's design files remain byte-identical after integration. The review PR discloses the already-delivered capture/AI prerequisites and remains unmerged. Actual Claude implementation review precedes internal TestFlight. Categories/search follow delivery; Private Evaluation follows them. No main merge, PR comment, policy/model/provider change or public release is included.
