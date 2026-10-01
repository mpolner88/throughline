# Running List responsiveness and older-task repair

**Verified:** 2026-09-30. **Baseline:** `aeeb5f6130d5a352fcd76e98199e4b85267d1c02`, internal build 1.0.5 (2026093001). **Repair source:** `4f33feb345781f1c0cd2362a9442ea04854229fa` on `codex/running-list`; exact revision and per-file source hashes accompany the isolated candidate. **Status:** locally verified, signed and passed Claude review; internal delivery pending. No repaired build is delivered yet.

## Owner feedback and decision

Mike reports severe delays tapping This week and Later and asks why older notes are absent. He directs unfinished tasks from older notes into Today automatically. This supersedes the collapsed earlier-notes presentation in the frozen design; the Claude-owned handoff remains byte-identical. Completion, manual moves, occurrence identity and source notes remain intact. Automatic semantic categories and cross-note/task search remain the next separate design slice. No extraction, reprocessing, backend schema, provider/model, capture/recorder, AI controls, policy or evaluation change is included.

## Findings

1. **P1 responsiveness:** `RunningListView.snapshot` rebuilt the full projection at every read. One body pass evaluates at least seven full projections for `allVisibleRows`, three for tab counts and additional section reads. Sorting repeatedly constructed ISO8601 formatters and parsed source timestamps. Tab selection has no network request. This main-thread work is a concrete source defect and is reproduced by the optimized source benchmark, though Mac timings are not on-device frame timings.
2. **P2 older-task visibility:** enrollment preserves older-task provenance (`is_earlier`); the shipped projection sends it to a collapsed section in Later. Source inspection and read-only aggregate coverage establish presentation as the identified cause, not deleted records. Hosted totals: 21 recordings overall; the one enrolled account has 10 recordings, all initialized, and 52 canonical to-dos matching 52 task occurrences. Of those, 20 are open, all have earlier provenance, and none has a manual placement. Other accounts remain isolated; this is not permission to enroll them. No private content or raw identifiers were read for this diagnosis.
3. **P3 secondary work:** Home derived capture-hidden IDs by decorating and sorting every note, then decorated visible notes a second time. This is removed without changing ID/capture-ID filtering.
4. **Remaining limitation:** note refresh fetches details sequentially after its list request. That can lengthen initial Notes refresh, but is not invoked by a tab tap. Durable outbox writes still synchronize on the main actor. Neither is claimed fixed by this bounded tab-stall repair; revisit only with measured residual device evidence.

## Change and verification plan

- Cache a single snapshot by task state, local day, timezone and locale. Invalidate before each coordinator publication; never serve cache during account deletion or sign-out.
- Parse timestamps and prepare sort keys once per projection; skip historical completed rows before marker/sort work. Preserve deterministic identity ties and actual completion instants.
- Route earlier unfinished tasks to Today; explicit moves still win. Preserve old completed state and historical completion placements; no server rewrite or destructive backfill.
- Keep Home visibility checks on raw note identities and decorate visible note content once.
- Build 2026093002 from an isolated, hashed source copy. Review new Today/Later/week/offline evidence with Claude, then deliver only to existing Internal QA under standing authority. Main and public App Store remain untouched.

## Measured results

Optimized Swift source, synthetic content only, same Mac. Baseline modeled 15 projection reads from a render, not a measured number of actual render passes.

| Synthetic tasks | Baseline 15 full projections | Repaired 15 full projections | Repaired first cached snapshot | Repaired 15 warm reads |
| --- | --- | --- | --- | --- |
| 52 | 1,738 ms | 101 ms | 4.93 ms | 0.054 ms |
| 250 | 20,381 ms | 463 ms | 25.03 ms | 0.060 ms |

The committed `bash scripts/test-running-list.sh --benchmark` additionally tests 52, 250 and 1,000 tasks with ten warm batches. First run: cold 13.622/29.731/116.088 ms; worst warm batches 0.092/0.214/0.094 ms. Warm batches have a generous 100 ms host regression ceiling; this is not an iPhone frame-rate claim. Initial setup can still grow with total task volume.

**Passed:** 11 Running List groups, including day/timezone/DST, deterministic completion ordering, older tasks in Today, manual moves, completion/Undo/offline replay across relaunch, cache invalidation after mutations/deletion/owner changes, transport and store invariants; optimized benchmark; independent read-only engineering review found no blocker; `git diff --check`.

**Additional passed:** isolated iOS simulator build; capture-store six groups plus byte-stream/permission checks; capture-queue six groups plus refresh/auth isolation; AI controls nine groups; documentation and policy parity checks. CUA switched Today → This Week → Later → Today and verified the expected selection/rows. Completing a synthetic earlier task reduced Today from seven open to six and produced a Done today section. UI automation is functional verification, not precise latency measurement. Scroll automation did not move the list; physical scrolling remains unverified.

**Simulator evidence:** six synthetic frames in [the asset directory](assets/2026-09-30-running-list-responsiveness/SHA256SUMS.txt), plus [all 62 source hashes](assets/2026-09-30-running-list-responsiveness/source-hashes.json): Today light/dark/largest-text-dark, week light, Later light and offline light. One iPhone 13 simulator, 390 points, iOS 26.3. Other screen sizes retain prior source-identical layout evidence; no renewed whole-matrix claim. Claude's handoff hash remains `df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946`.

**Signed candidate:** [1.0.5 (2026093002)](../releases/2026-09-30-ios-1.0.5-2026093002-candidate.md), source/package/signature checks passed.

**Claude review:** [Passed at exact repair source](2026-09-30-claude-running-list-responsiveness-review.md), receipt SHA-256 `3abc670f592913c9ce0a69f7e3602d0415f500ed7b2b630589d354c7abe9f283`. No P1/P2 blockers. Optional Today ordering and future-date recommendations do not change Mike's requested repair.

**Pending:** internal delivery and Mike's real-device responsiveness/scrolling acceptance. Existing correctness tests and screenshots had not measured this performance path before the first delivery; that gap is now covered by the regression benchmark.

## Rollback and next owner

Rollback is a compatible follow-up app build restoring the prior projection without touching task records, completions, moves or capture storage. No database rollback is required. Restoring 2026093001 would restore the known sluggish behavior and collapsed older tasks, so prefer a forward correction.

Codex finishes the bounded verification and sends exact source/frames to Claude; Claude reviews; Codex delivers within existing Internal QA authority; Mike verifies responsiveness on his phone.
