# Running List: corrections for Claude's narrow recheck

**Verified:** 2026-09-30. **Owner:** Codex. **Status:** requested corrections implemented and candidate rebuilt; Claude's narrow recheck pending. [Running List — Today, This Week, Later, PR #4](https://github.com/mpolner88/throughline/pull/4).

## Exact source and scope

- Reviewed starting HEAD: `7d41c6a2e34c9923b741f58f2a0efd0e42e88163`; its app/backend matched Claude's reviewed `f86d04af6d46a784d3498d20e4b99cad80928804`.
- Corrected app/API source: `a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068`, branch `codex/running-list`, active nonsynced `throughline-local`.
- [Source diff](https://github.com/mpolner88/throughline/commit/a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068) contains only six app/API/test files plus Claude's original review receipt. The receipt was integrated byte-identical at SHA-256 `4468fa525a32442e90e007aa674797e7544a4a8608af3e0c151c6afcbef645b4`.
- Frozen handoff and all 32 design-manifest entries remain unchanged and verify. Capture, recorder, AI, extraction, policy and migration source are unchanged from the implementation Claude reviewed.

## Findings addressed

| Finding | Change | Evidence |
| --- | --- | --- |
| F1 | This week starts at tomorrow using calendar day addition in the current zone. Saturday says **Sun**; Sunday remains **Sunday**. | `RunningListProjection.swift`, `RunningListView.swift`; all seven weekdays, zone boundary and spring/fall DST-adjacent Saturday checks; new week, moved and Saturday frames. |
| F2 | Status is the first item in the list's scroll content, below tabs and above the date header. Existing sign-in, message, offline priority and copy/style are preserved. | `RunningListView.swift`; new offline frame. |
| F3 | Old apps receive exactly **Update Throughline to change to-dos in this note. Nothing was saved.** | `api/tasks.ts`; route regression checks HTTP 409, stable `error_code=update_required`, exact text and the original atomic RPC gate. |
| P3-1 | VoiceOver tab labels say **open task** or **open tasks**, keeping the new-item count. | `RunningListView.swift`; source inspection and successful simulator/Release compilation. Spoken VoiceOver remains a device check. |

`RunningListPreview.swift` adds only a DEBUG Saturday scenario. The other changed files are `ios/Tests/TaskCoordinatorTests.swift` and `supabase/functions/api/tasks_routes_test.ts`. **P3-2 through P3-13 remain follow-ups** in [Claude's receipt](2026-09-30-claude-running-list-implementation-review.md); none was silently included in this correction pass.

## Checks and artifacts

- Passed: ten focused Swift running-list test groups, including the added calendar heading checks; all **111 Deno tests** across API, shared contracts and private artifact deletion. The first added API assertion used `code` instead of the existing `error_code`; the assertion was corrected and the complete Deno suite passed. Production response shape did not change.
- Passed: isolated Debug simulator build, signed Release archive, local internal-only export and strict archive/IPA verification; all 62 isolated iOS source files match the corrected revision. [Rebuilt candidate and package hashes](../releases/2026-09-30-ios-1.0.5-2026093001-recheck.md).
- Passed: `npm run docs:verify` (19 backlog items, 49 checked Markdown files), `npm run privacy:check`, `git diff --check`, unchanged 32-entry design manifest and new four-entry screenshot manifest.
- Re-captured and inspected: week, moved, offline and Saturday at 390 points, light appearance. [Four frames and source hashes](assets/2026-09-30-running-list-recheck/README.md). PNG manifest SHA-256 `b0ecfd10808ef784265b29335c5ddeece205fd1a21995c635edd03d576e68de4`.
- Not rerun: the unchanged full Node, database/pgTAP, capture and AI suites; their prior results remain in the [implementation receipt](2026-09-30-running-list-implementation.md). No hosted migration, API deployment, Apple upload, physical-device interaction or full 32-frame visual rerun occurred in this pass.
- Physical scrolling, spoken VoiceOver, real offline/reconnect and midnight/time-zone travel retain Claude's recorded device-check limits.

## Narrow return to Claude

Read this packet and the [original findings](2026-09-30-claude-running-list-implementation-review.md). Inspect `git diff 7d41c6a2e34c9923b741f58f2a0efd0e42e88163 a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068 -- ios supabase` and verify the four-frame manifest in its own directory. Review F1–F3 and P3-1 only, against the frozen handoff and your accepted corrections. No full re-review is needed.

Append your recheck to **only** `docs/evidence/2026-09-30-claude-running-list-implementation-review.md`, recording exact source/manifest hashes, inspected frames, disposition and any remaining blocker. Do not edit app/backend code, handoff, assets, canonical files or policy. Codex owns implementation/integration and has finished using the simulator; no new rendering or build is needed for this review. No migration, deployment, upload, main merge or PR comment belongs to your review.

**Next action:** Claude rechecks these corrections; Codex then integrates the receipt and performs the separately recorded hosted/internal delivery checks under existing authority. Categories/search follow internal delivery; Private Evaluation stays deferred.
