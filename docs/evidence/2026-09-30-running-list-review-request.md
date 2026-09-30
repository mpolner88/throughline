# Claude review request: Running List — Today, This Week, Later

**Review received:** Claude completed the [implementation review](2026-09-30-claude-running-list-implementation-review.md). The [corrections and narrow recheck packet](2026-09-30-running-list-recheck.md) now supersede this initial request.

**Prepared:** September 30, 2026. **Owner:** Codex. **Review:** [draft PR #4](https://github.com/mpolner88/throughline/pull/4). **Status:** ready for Claude to inspect; no Claude implementation approval is claimed.

## Assignment

Review the selected Running List implementation before internal TestFlight. Work in the active nonsynced `throughline-local` checkout on `codex/running-list`. App source is `f86d04af6d46a784d3498d20e4b99cad80928804`; integration source `1311d02f0ddfc7fa3a60d8537cfc0413e21a6435` has identical iOS files. Later packet-only commits do not change that app source. Verify the current app tree before reviewing.

Read `AGENTS.md` and the canonical sources in order: current state, product, brand, running-list slice, workflow, metrics, backlog and relevant component documentation. Then read the [frozen revision-2 handoff](../handoffs/2026-09-29-home-running-list.md), your [presentation clarifications](2026-09-30-running-list-presentation-clarifications.md), [implementation evidence](2026-09-30-running-list-implementation.md), [native image packet](assets/2026-09-30-running-list/README.md) and [signed local candidate](../releases/2026-09-30-ios-1.0.5-2026093001-candidate.md). Verify the image manifest in its own directory.

Inspect every handoff visual-matrix row against the corresponding native image, including light/dark, 375/390/430-point screens, largest text, earlier-note promotion, source/Notes behavior, pending Save and conflict. Inspect source for behavior that still images cannot establish. Native system controls and actual Dynamic Type differ from the browser prototype; report product-significant differences with evidence.

## Ownership and receipt

Write only `docs/evidence/2026-09-30-claude-running-list-implementation-review.md`. Record reviewer, exact app and handoff/asset hashes, scope, inspected frames, each finding and severity, concrete required corrections, unverified checks, and an explicit pass or blockers for internal delivery. Do not claim a test you did not run. Codex owns corrections and integration. Do not edit the frozen handoff/assets, app/backend code, canonical files or policy.

Root holds the simulator/rendering lane while preparing this packet. Do not run a simulator, headless browser, build, migration, deployment or release without coordinating that lane. No main merge, PR comments, public release, provider/model/data-use change or evaluation work. Synthetic content only in tracked evidence.

## Known limits to assess

Engineering suites and the signed isolated candidate passed; the exact source and package were independently rechecked. The image packet contains all 31 required views plus pending Save. The local screenshot preview intermittently omits text that on-device OCR reads from the saved dark image pixels. No source workaround was introduced.

Vertical touch automation failed both the app and standard iOS Settings, while Settings' accessibility scroll action worked. Physical scrolling of long rows and maximum text, spoken VoiceOver and real-device offline/capture flows remain acceptance checks. Earlier successful simulator circle/Undo, horizontal threshold, menu moves, source navigation and editor actions are listed separately in the implementation receipt. Evaluate the evidence honestly; lack of a finding is not approval by omission.

No Running List backend or internal build has been delivered. After your review passes and material findings are resolved, Codex performs hosted compatibility checks and internal-only delivery to the existing Internal QA group. Categories/search follow; Private Evaluation remains deferred.
