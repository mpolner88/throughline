# Claude review: Running List responsiveness and older-task repair

Verified **2026-09-30**. Reviewer: Claude Code (Claude Opus 5.5). This is a read-only review of Codex's bounded repair to the delivered Running List slice (draft PR #4), requested with [Codex's repair packet](2026-09-30-running-list-responsiveness.md). Claude wrote only this receipt.

Claude did not:
- edit any product source, frozen handoff, asset, canonical file or policy;
- render, build, run tests or benchmarks, or use a simulator;
- call any backend, deploy, upload or merge.

## Verdict

**Pass for internal delivery of build 2026093002 from source `4f33feb`.** There is no blocking finding.

- The tab-stall fix is correct and safe. Cached results are cleared on every change Claude found, and none can carry across accounts.
- The older-task change follows Mike's direction.
- Two recommendations below are for Mike to decide. They are not defects, and neither blocks delivery.
- Acceptance still depends on Codex finishing the signed archive and on Mike checking responsiveness and scrolling on his phone.

## Mike's direction

As relayed in Codex's request, Mike said: "They should all be auto categorized and added directly to Today automatically." This repair carries out the "added directly to Today" part. Automatic categories are the next, separate slice.

Codex applied the direction as follows:
- every unfinished task from an older note goes to Today, even when it carries a date;
- an explicit manual move still wins;
- Today keeps the original oldest-first order, because no new order was chosen.

This replaces part of the frozen handoff, revision 2 (`df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946`, unchanged):
- the "Earlier notes" placement in "Where tasks go";
- the earlier-notes parts of list rules 6–8;
- acceptance check 10;
- the `earlier-light-390x844` reference frame.

The collapsed "from earlier notes" group, its "To-dos from notes before this update" row, and Show/Hide no longer appear. The handoff stays frozen. This receipt and Codex's decision-log entry record the change.

## Exact revisions reviewed

| Item | Identity |
| --- | --- |
| Checkout | `throughline-local`, branch `codex/running-list`, HEAD `4f33feb345781f1c0cd2362a9442ea04854229fa`. App, backend and script files in the working tree are identical to HEAD. Other uncommitted changes in the tree belong to Codex: canonical document edits, plus this packet and its assets, which are untracked. Claude did not review them. |
| Baseline | `aeeb5f6130d5a352fcd76e98199e4b85267d1c02`. Its app and API equal Claude-approved `a59d68d`, except for a content-identical rename of the migration file. |
| Diff reviewed | `aeeb5f6..4f33feb`, six files: `RunningListProjection.swift`, `TaskCoordinator.swift`, `HomeView.swift`, `TaskCoordinatorTests.swift`, the build number in `project.pbxproj` (2026093001 → 2026093002) and `scripts/test-running-list.sh`. No view file for the running list, backend, capture, recorder or AI-control file changed. |
| Handoff asset manifest | `237c804b2f0d1e0b48097ca0e33fe630e7996c20436f2bb729acb339d356a54d`, unchanged |
| Repair packet | `docs/evidence/2026-09-30-running-list-responsiveness.md` (untracked when reviewed) |
| Frame manifest | `30a01a07ca527ba81e888ead6a8bd643c802595c8782bb25277bf881ff00135c`. All six entries verify in their own directory. EXIF holds only color space and pixel size. |
| `source-hashes.json` | `45bed92dd5b8846a4f09543dccedfe88ee89a42165d57a8283d8013ceeea1a62`. All 62 listed files match their blobs at `4f33feb`. |

Frames inspected (1170 × 2532 pixels, iPhone 13, 390 points):

| Frame | SHA-256 | Result |
| --- | --- | --- |
| `today-light.png` | `d0071fc7…` | Older tasks are in Today with "from Aug 21" and their source label. Count is 7. Order is oldest first. There are no new dots or `+n`. |
| `today-dark.png` | `423ca58a…` | Same as light; dark tokens are unchanged |
| `today-largest-dark.png` | `97807a76…` | Rows wrap and the tab bar scrolls sideways, as before |
| `week-light.png` | `e78369f4…` | "Wed to Sun" is kept; rows are unchanged |
| `later-light.png` | `5ada487a…` | Dated and moved tasks only; the earlier-notes group is gone |
| `offline-light.png` | `2a46ea49…` | The offline line stays at the top, as approved in the recheck |

## Source findings

**Responsiveness: confirmed.**
- `TaskCoordinator.snapshot` now keeps one projection, keyed by local day, time zone and locale, and `publish()` clears it.
- Claude traced every change to stored task data and to the account: each goes through a store transaction or a state change followed by `publish()`. This includes:
  - completing and moving;
  - edits;
  - outbox results;
  - refresh;
  - account setup and switching;
  - sign-out, account deletion and recording deletion;
  - clock and time-zone changes.
- No other code writes the task store.
- During an account-deletion hold or with no account, the cache is never consulted, so it cannot show another account's rows.
- Within one local day the projection depends only on the date, so the view's one-minute clock updates reuse the cache correctly.
- Each projection now parses timestamps once and builds its sort keys once. It uses the same two ISO 8601 formats and the same fallback as before, so ordering and the "done today" decision are unchanged.

**Older tasks in Today: confirmed against Mike's direction.**
- `placement()` sends older-note tasks to Today after checking for a manual move, so a move still wins.
- Markers stay truthful. Past or undated tasks show "from {date}". A rare older task with a future date shows its blue date pill, for example "Jan 1", in Today.
- Completion and Undo keep the task in Today.
- Completed historical tasks with no known completion time stay hidden.
- Identities are unchanged, so these tasks get no new dots and no `+n`.
- An older task an old app completed earlier today now shows under Today's "done today", not Later's. This makes the original P3-13 consistent.

**Home: confirmed.**
- Notes hidden by the capture tray are now found from the raw notes, which have the same identifiers.
- The removed second decoration was redundant, because `latestNotes` already decorates each note. Note cards keep their task circles.

**Tests and benchmark (Codex-run; Claude read them but did not run them).**
- An eleventh test group covers:
  - an older task with an old or future date landing in Today;
  - manual moves and historical completion staying intact;
  - same-day cache stability;
  - cache clearing on a time-zone or day change, completion, moves, a deletion hold, account replacement, sign-out, account switch and recording deletion.
- The benchmark checks that 15 warm reads stay under 100 ms at 52, 250 and 1,000 tasks. That limit catches the earlier seconds-long stall; it is not a phone frame-rate claim.

## Recommendations for Mike (not defects)

**R1. Order in Today.**
- Oldest first places your roughly 20 open older-note tasks above everything you said today. On most phones today's own tasks then start below the fold.
- Claude recommends today's own tasks first, then older-note tasks with the newest note first.
- This repair keeps oldest first on purpose; change it only if you choose to after using it.

**R2. Older tasks with future dates.**
- Following "all … directly to Today", an older task dated in the future sits in Today with its date pill.
- Claude had recommended placing these by date instead. The label is truthful and such tasks are probably rare, so no change is needed unless Mike prefers dates first.

## Observations (P3, not blocking)

1. **Unreachable earlier-notes code.** The earlier-notes code is now unreachable: the `.earlier` placement, `earlierSection` with its copy and Show/Hide, and the earlier-row menu condition. Remove it in a later cleanup so a future change cannot quietly bring the hidden group back.
2. **Remaining per-tap work.** The selected tab lives in `HomeView`, so each tab tap still re-evaluates Home's body. That includes `isFirstUse` (`HomeView.swift:310`), which decorates and sorts every note once through `latestNotes`. This is small at 21 notes; revisit it only if the phone still feels slow.
   - Codex's own residuals also stand: Notes refresh fetches sequentially, and outbox writes run on the main actor.
3. **Earlier follow-ups.** P3-2 to P3-12 from the [implementation review](2026-09-30-claude-running-list-implementation-review.md) remain follow-ups. P3-3's earlier-notes Show/Hide part no longer applies.

## Not verified by Claude

- **Device:**
  - real tap latency on an iPhone. Codex's Mac benchmark timings are the only measurements, and Claude did not run them;
  - physical scrolling, which automation could not exercise;
  - spoken VoiceOver.
- **Build and tests:** the signed archive and export (still building at review time); the test suites, simulator build and Codex's automated tab and completion checks.
- **Layout evidence:** no new 375- or 430-point frames. The running-list view file did not change in this diff, so earlier layout evidence still applies.

## Next

1. Codex finishes and verifies the signed 2026093002 package and delivers it to Internal QA under its standing authority.
2. Mike checks on his phone:
   - tab switching feels immediate;
   - older unfinished tasks are in Today;
   - scrolling works.
3. Mike decides R1 and R2 whenever convenient. Categories and search come next; Private Evaluation stays deferred.
