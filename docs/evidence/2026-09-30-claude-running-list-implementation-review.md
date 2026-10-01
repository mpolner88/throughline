# Claude implementation review: Running List — Today, This Week, Later

Verified **2026-09-30**. Reviewer: Claude Code (Claude Opus 5.5). This is a read-only design and interaction review of Codex's implementation (draft PR #4), requested in [the review request](2026-09-30-running-list-review-request.md). Claude wrote only this receipt. No product code, frozen handoff, asset, canonical file or policy was edited. No simulator, browser render, build, test run, migration, deployment, hosted or production query, upload or release action was performed.

## Verdict

**Not yet passed for internal delivery. Three small corrections, F1–F3, are required.** There is no P1 finding. The selected design is otherwise faithfully built: tabs, rows, markers, done today, earlier notes, menu, Notes, the row editor, pending Save and conflict all match the frozen handoff and Claude's clarifications.

- After F1–F3 land, Claude rechecks only those diffs and the re-captured frames listed under [Next](#next). No full re-review is needed.
- The signed local candidate 1.0.5 (2026093001) was built from `f86d04a`, before these corrections. It should not be uploaded. Internal delivery uses a candidate rebuilt from the corrected source.

## Exact revisions reviewed

| Item | Identity |
| --- | --- |
| Checkout | `throughline-local`, branch `codex/running-list`, HEAD `7d41c6a2e34c9923b741f58f2a0efd0e42e88163`, clean tree |
| App source | `f86d04af6d46a784d3498d20e4b99cad80928804`. `ios/` and `supabase/` at HEAD are identical to it and to integration `1311d02f0ddfc7fa3a60d8537cfc0413e21a6435`. |
| Handoff, revision 2, `handoff_ready` | `df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946` (unchanged) |
| Handoff asset manifest | `237c804b2f0d1e0b48097ca0e33fe630e7996c20436f2bb729acb339d356a54d`; 32 of 32 entries verify |
| Presentation clarifications | `1bacb85dbe9f22310646918a102f854777ac1690f2bd794cab7c309a4fe471ae` |
| Native image manifest | `799b39679e7c44b59d7828fff73beea5460e9ce8d288194ada8e531e58f66d70`; 32 of 32 entries verify in their own directory |
| Implementation evidence | `e98329625312e8391a4dc1d7ad7a81267cdb71f8d8b18a53e293f1690e389590` |
| Review request | `f9b7efeb0116077e1c9db0bcd31e4a44afc40e857017db621d0e483876712ac1` |
| Candidate receipt | `198146280fb5ead8454b0a93dd7b127c0535d44f77fb61826926ef4af6c8b3c3` |

## Scope and method

- **Sources.** The canonical sources were read earlier in this session, for handoff revision 2. The live evaluation-lineage status in `docs/CURRENT_STATE.md` was re-read for this review. Also read: the frozen handoff, the clarifications, the implementation evidence, the native image README and the candidate receipt.
- **Images.** Each native frame was compared side by side with its handoff reference at equal height, using a local, untracked comparison sheet made from the stored PNGs. Pixel sizes match each simulator: 750 × 1334, 1170 × 2532 and 1290 × 2796.
- **Source.** Read at `f86d04a`, against `7b372b5`:
  - app views: `RunningListView.swift`, `TodoRowsEditor.swift`, and the Home, Notes, card, detail and editor parts of `HomeView.swift`;
  - app models and services: `RunningListProjection.swift`, `TaskOccurrence.swift`, `ThroughlineNote.swift`, `RunningListPreview.swift`, `TaskCoordinator.swift`, `TaskStore.swift` and `TaskTransport.swift`;
  - server: `api/tasks.ts`, the task and old-app paths of `api/index.ts`, and the migration `20260930000000_running_list_occurrences.sql`.
- **How the sweep was done.** Two read-only Claude helper agents swept the presentation and the logic source.
  - Claude re-read the cited lines for F1–F3, P3-1 to P3-4, P3-8 and every "confirmed in source" item.
  - Items marked † come from the logic sweep and were not independently re-read by Claude. Codex should confirm them.
- **Tests.** Claude ran none. Test results are Codex's, as reported in the implementation evidence.

## Frames inspected

Every row of the handoff's visual matrix, plus the pending-Save state.

| Handoff row | Native frames | Result |
| --- | --- | --- |
| Today | `today-light-390x844`, `today-dark-390x844`, `today-light-375x667`, `today-light-430x932` | Match. At 375 points the fourth row runs under the recorder, as expected for scrolling. |
| A note just landed | `landed-light-390x844` | Match: `+2` and `+1`, blue dots |
| Recording while a note structures | `recording-light-390x844` | Match; the recorder and tray are shipped components |
| This week | `week-light-390x844` | **F1**: shows "Tue to Sun" on Tuesday, but should be "Wed to Sun" |
| Later | `later-light-390x844` | Match |
| From earlier notes, expanded | `earlier-light-390x844` | Match; Hide is below the first viewport |
| Done today with Undo | `done-light-390x844`, `done-dark-390x844` | Match |
| Swipe to complete | `swipe-light-390x844` | Match. The row slides instead of rewrapping, the same as the shipped swipe row. |
| Row menu | `menu-light-390x844`, `menu-dark-390x844` | Accepted native difference (see below) |
| Source note opened | `source-light-390x844` | Match, including clarification 2: "most important" is prose, and circles appear only on to-dos |
| Notes screen | `notes-light-390x844`, `notes-dark-390x844` | Match. Cards show "to-dos" with three circles. The recorder stays visible underneath. |
| Discard a note | `discard-light-390x844` | Match (the shipped confirmation) |
| Empty today | `empty-light-390x844` | Match |
| Empty later | `empty-later-light-390x844` | Match |
| Offline | `offline-light-390x844` | **F2**: the offline line is not in the first viewport |
| Next morning | `morning-light-390x844` | Match: "from Mon", "from yesterday", "today" |
| Sunday: tomorrow in later | `sunday-light-390x844` | Match. Beyond a week the source label is a date, per the handoff. |
| Sunday: this week | `sunday-week-light-390x844` | Match |
| A moved task after the week ends | `moved-light-390x844` | "moved Tue" matches. **F1**: the header shows "Mon to Sun" on Monday. |
| Editing to-dos | `editor-light-390x844`, `editor-dark-390x844` | Match: rows, "done" tag, remove buttons, "New to-do", "+ Add a to-do" |
| Editor conflict | `editor-conflict-light-390x844` | Match: exact copy; Close only, no Save |
| Same words, two notes | `repeat-light-390x844` | Match: two separate rows, one open and one done |
| Largest text | `ax-light-390x844`, `ax-light-375x667` | Match. Rows wrap and the tab bar scrolls sideways instead of truncating. The system's largest size exceeds the HTML approximation. |
| Pending Save (clarification 1) | `editor-pending-light-390x844` | Match: exact line, dimmed read-only fields, Close, Save available |

Earlier-notes promotion cannot be shown in a still image. It is confirmed in source (below) and by Codex's recorded simulator check of the three move actions on an expanded earlier row.

## Required before internal delivery

### F1 (P2): the this-week header starts on today instead of tomorrow

- **Where:** `ios/Throughline/Views/RunningListView.swift:170` formats the current weekday.
- **Effect:** On Tuesday the header reads "Tue to Sun", but today's tasks live in the today tab. The handoff copy and the frozen prototype both start the range at tomorrow ("Wed to Sun"). Seen in `week-light` and `moved-light`.
- **Required correction:**
  - Show tomorrow's short weekday followed by " to Sun".
  - On Saturday, show "Sun" rather than "Sun to Sun". This is Claude's disposition of a case the frozen prototype rendered awkwardly.
  - Sunday stays "Sunday".
  - Use calendar day-adding in the current time zone, as elsewhere.

### F2 (P2): the offline line and quiet notes sit below the list

- **Where:** `RunningListView.swift:71-82` places the offline line, the refused-change note and the sign-in line after all rows.
- **Effect:**
  - In `offline-light` the offline line is not visible: it falls under the tray and recorder.
  - With any list longer than the screen, a person will not see that changes are waiting to send.
  - When a refused change snaps a row back, the explanation is also out of sight.
  - The reference places the line directly under the tabs.
- **Required correction:**
  - Render that one status line at the top of the list's scroll content, under the tab bar and above the date header, so it is visible without scrolling.
  - Keep the existing copy, style and priority order: sign-in, then message, then offline.

### F3 (P2): the old-app refusal text is not the selected copy

- **Where:** `supabase/functions/api/tasks.ts:194` maps `update_required` to "Update Throughline to change these tasks safely."
- **Effect:** Old apps display the server's text. Acceptance check 13 requires exactly "Update Throughline to change to-dos in this note. Nothing was saved." The new app maps `update_required` to its own copy (`TaskTransport.swift:117`), so only old apps are affected.
- **Required correction:**
  - Change that string to the exact handoff copy.
  - Update any test that asserts the old wording.

## Follow-ups (P3, not blocking)

Claude recommends fixing P3-1 in the same pass because it is one line. The rest can follow internal delivery.

**Accessibility and presentation**

1. **Tab label wording.** The VoiceOver tab label reads "{tab}, {n} tasks[, {k} new]" (`RunningListView.swift:150`). The copy is "Today, 5 open tasks[, 2 new]"; "open" is missing and the singular reads "1 tasks".
2. **No fade-in for new rows.** A newly landed row gets its dot and `+n` (`:248-269`) but does not fade in once as specified. It appears at once, which is acceptable but not the selected motion.
3. **Notes screen resets list state.** Opening Notes swaps the running list out of Home (`HomeView.swift:40-53`), which is correct for the capture lifecycle.
   - On Back, `onAppear` clears the dots, `+n` and the earlier-notes Show/Hide state (`RunningListView.swift:89-92`).
   - A note that lands while Notes is open never shows its dot or `+n`.
4. **Done rows still expose Move.** Press-and-hold (`:340`) and the VoiceOver Move actions (`:360-363`) remain on done rows, which show no •••. Limit them to open rows, or confirm that moving a done row behaves sensibly.
5. **Small target and edge dots.**
   - The source label's tap target is only its caption text (`:377-383`), below 44 points.
   - At the largest text size the ••• glyph grows past its 44-point frame and sits within about 8 points of the screen edge.
6. **Seven-day inconsistency.** The source label treats exactly seven days ago as "this week" and shows a weekday (`:391`), while the marker switches to a date (`RunningListProjection.swift:67`). Align both to six days.
7. **Done rows don't say done.** The VoiceOver label for a done row does not say it is done; only the group heading does. Consider adding "Done." or the selected trait.

**Logic and server**

8. **Evaluation-linked notes refuse task changes.**
   - Any task change on a note with an evaluation revision is refused with `evaluation_task_conflict` (migration `:225`, `:306`). The app then shows "Couldn't save your change. Try again." (`TaskOccurrence.swift:140`), and retrying cannot work.
   - `docs/CURRENT_STATE.md` (verified 2026-08-23) records that the lineage flag was rolled back and no real recording has lineage rows, so this is unreachable today.
   - Codex's hosted preflight should confirm, with a content-free count, that no recording has a current evaluation revision.
   - This must be resolved before lineage writes or Private Evaluation are enabled.
9. **Unrelated updates cause editor conflicts.** Every update to an enrolled recording increments its task revision (migration `:85`), including audio updates (`:351`). An editor open during one gets a conflict it did not cause. This is safe (nothing is saved) but annoying.
10. **Fast phone clocks.** † The server refuses a completion time more than five minutes ahead of its clock (migration `:243`), as a permanent failure. On a phone whose clock runs fast, the completion quietly reverts.
11. **Queue and message edge cases.** †
    - A repeatable server error keeps its change at the head of the queue, so later changes wait behind it.
    - A failed refresh right after a refusal replaces the refusal note (`TaskCoordinator.swift:417-427`, `:369-371`).
12. **Old-app matching is broader than exact.** † Old-app matching ignores case, punctuation and extra spaces (migration `:63`, `:308`), and seeded text keeps its padding (`:167`). Both only cause more refusals than needed, never an unsafe apply. Old apps also can no longer tick "most important" lines that are not to-dos, which is expected under the rules.
13. **Old-app completion on update day.** † A to-do an old app completed earlier on the update day has a real completion time but no stored placement, so it shows in later's "done today" until midnight (`RunningListProjection.swift:156-161`).

## Accepted native differences (no change)

- **Row menu.** On iOS 26 the row menu is the system's anchored popover. It has no visible Cancel; tapping outside dismisses it. Its title, message and buttons match. The message uses the same relative time as the source label ("yesterday 6:10 PM", the time alone for today, a date beyond a week), which is more consistent than the reference.
- **Existing components.** The note detail, editor and discard confirmation are the existing native sheets and dialogs, as the handoff intended. The conflict line appears in the editor's existing error area at the top.
- **Swipe copy.** The swipe reveal uses SF Symbols with "Done" and "Reopen" in place of "✓" and "↺", with the same threshold and spring as the shipped row.
- **Extra VoiceOver action.** The extra named "Complete"/"Reopen" action duplicates the row's default action. It is harmless.
- **Recorder title size.** At the largest text size the recorder title does not scale. This is shipped recorder behavior, outside this slice.

## Confirmed in source

**Tabs and motion**
- Tabs are tap-only buttons in a sideways-scrolling bar, and the app opens on today each launch.
- `+n` clears after about three seconds.
- Every animation is skipped under Reduce Motion.

**Rows and gestures**
- The circle is a 22-point glyph in a 44-point target.
- The swipe threshold is 76 points, with the shipped spring and the same drag pattern as the shipped row.
- Press-and-hold opens the same menu as •••.
- Earlier rows offer all three moves.

**VoiceOver**
- Each row is one element, labeled task, marker, source.
- The default action completes or reopens; the custom actions are Move and Open the note.
- "Done. Undo available." is announced after completing.

**Day boundary**
- Foreground-only midnight timers exist in both the view and the coordinator.
- The list is recomputed on return, after a fetch, and on time or time-zone change.
- Calendar day-adding is used throughout; there is no background job.

**Home, notes and capture**
- Notes is shown within Home, so capture and foreground handling stay mounted, and Back returns to the same tab.
- The recorder title logic, including "Agree and record", the AI controls, the tray and "syncing" are unchanged from `7b372b5`.
- Circles appear only on real to-dos. "Most important" is read-only prose in note detail, and cards show the first three to-dos.

**Editor**
- The row editor keeps each to-do's identity, drops empty rows, and saves all or nothing against an expected version.
- A conflict applies nothing.
- An uncertain Save freezes the draft, keeps it across Close, and retries the identical request only through Save.

**Placement and list rules**
- Placement uses `due` first, then `for_date`, and undated tasks go to their capture-local day.
- On Sunday, tomorrow goes to later.
- Stored moves win indefinitely, and "moved …" appears only after the move day.
- Completion keeps its tab, and Undo restores the move or the earlier-notes group.
- There is one cutover per account, classified by capture time. Moving promotes a task; completing does not.
- Order and counts follow list rules 11–12.

**Sync and server**
- Changes are saved on the phone before they show, and are sent one at a time per task with identical retries.
- A refusal reverts only that change.
- Old-app completion requires text that is unambiguous now and in the note's history. Edits require an exactly matching to-do list, and every refusal is all-or-nothing.
- Only `todos` seeds tasks.

**Release safety**
- All preview scenario code is inside `#if DEBUG` and cannot run in Release.

## Unverified checks

**Device and interaction**
- Vertical touch scrolling and long-row reachability at the largest text size. Automation failed, including in iOS Settings, so this is not evidence of a defect.
- Spoken VoiceOver, Reduce Motion, and all physical-device checks (acceptance checks 1–9, 11, 12 and 15).
- Real offline and reconnect behavior.
- Midnight while the app is open.

**Time zones**
- Time-zone travel and both daylight-saving nights (acceptance check 14). This should include confirming that labels follow a zone change without a relaunch. The code reads `TimeZone.current` after the change notification; if that value is cached, reset it or use the auto-updating zone.

**Server and backend**
- Old-app behavior against the deployed server (acceptance check 13).
- The migration on the hosted database, and the hosted compatibility checks.

**Not observed by Claude**
- Any test, build or signed-package result. Codex reports 178 Node, 111 Deno, ten Swift groups and 298 pgTAP assertions passing.

## Next

1. **Codex** fixes F1–F3 (and preferably P3-1), then re-captures `week-light-390x844`, `moved-light-390x844` and `offline-light-390x844`, plus a Saturday this-week frame if convenient. Codex then rebuilds the candidate from the corrected source.
2. **Claude** checks those diffs and frames, then appends the result to this receipt. No other re-review is required.
3. **Codex** then runs the hosted compatibility checks and internal-only delivery under its standing authority. The device checks above happen on that internal build. Categories and search follow; Private Evaluation remains deferred.

## Recheck of F1–F3 and P3-1

Verified **2026-09-30**. Reviewer: Claude Code (Claude Opus 5.5). This is the narrow recheck requested in [Codex's recheck packet](2026-09-30-running-list-recheck.md). It covers F1–F3 and P3-1 only. P3-2 through P3-13 remain follow-ups. Claude did not render, build, run tests or use the simulator, and edited nothing but this appended section.

### Exact revisions

| Item | Identity |
| --- | --- |
| Checkout | `throughline-local`, branch `codex/running-list`, HEAD `6d81c9ee21d880d7db2fff9a303b4721bddbf958` (packet commit), clean tree |
| Corrected app and API source | `a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068`. `ios/` and `supabase/` at HEAD are identical to it. |
| Diff inspected | `f86d04a..a59d68d -- ios supabase`, identical in app and API content to `7d41c6a..a59d68d`. Six files changed: `RunningListView.swift`, `RunningListProjection.swift`, `RunningListPreview.swift` (a DEBUG Saturday scenario only), `TaskCoordinatorTests.swift`, `api/tasks.ts` and `api/tasks_routes_test.ts`. Their SHA-256s match `source.json`. |
| This receipt before this section | `4468fa525a32442e90e007aa674797e7544a4a8608af3e0c151c6afcbef645b4`, committed byte-identical in `a59d68d` |
| Handoff and design assets | Unchanged: `df675d53…` and `237c804b…` |
| Recheck image manifest | `b0ecfd10808ef784265b29335c5ddeece205fd1a21995c635edd03d576e68de4`; four of four entries verify in their own directory. EXIF holds only color space and pixel size. |
| Recheck packet | `e216e6b696fdea352204757ff0892240984ca39217d4030b23e2ceafed51c062` |
| Rebuilt candidate receipt | `b0149127271ff57600a68b85f214d0840e739ad24c1e1a8b21efbb64df6f59fd`. It reports IPA SHA-256 `feadf35259f1357c40c4b9993c3744e4f923051aa41a140f790d90ec0aab8a71` from the corrected source. Claude did not inspect the package. |

### Frames inspected

Each fresh frame was compared with its handoff reference and the original native frame, at 390 × 844 in light appearance.

| Frame | Result |
| --- | --- |
| `week-light-390x844` | On Tuesday the range reads "Wed to Sun", matching the reference. Rows and markers are unchanged. |
| `moved-light-390x844` | On Monday the range reads "Tue to Sun". "moved Tue" is unchanged. |
| `saturday-week-light-390x844` | On Saturday the range reads "Sun". The Sunday-dated task shows "tomorrow", which is correct because Sunday is still this week on Saturday. |
| `offline-light-390x844` | "Offline. Changes save when you're connected." is the first line under the tabs, above the date header, as in the reference. The tray keeps its own offline row. |

### Dispositions

- **F1: resolved.**
  - `TaskDates.thisWeekHeader` (`RunningListProjection.swift`) returns "Sunday" on Sunday and "Sun" on Saturday. Every other day it returns tomorrow's short weekday followed by " to Sun", using calendar day-adding in the viewer's zone.
  - The view calls it for the this-week header.
  - The added Swift checks cover all seven weekdays, a zone boundary where Los Angeles is Saturday while Tokyo is Sunday, and Saturdays next to both daylight-saving changes.
- **F2: resolved.** The sign-in, message and offline status block moved unchanged to the first position in the list's scroll content, keeping its priority order, copy and style. A refused-change note now appears in the same visible place.
- **F3: resolved.**
  - `update_required` now returns exactly "Update Throughline to change to-dos in this note. Nothing was saved." with HTTP 409 and the stable error code.
  - The route test asserts the exact text.
  - The new app still maps this code to its own copy, so only old apps see this text.
- **P3-1: resolved.** Tab labels read, for example, "Today, 5 open tasks" or "This Week, 1 open task", with ", {n} new" appended while `+n` shows. The capital W in "This Week" changes nothing VoiceOver speaks.

No new finding. Nothing outside F1–F3, P3-1, their tests and the DEBUG scenario changed.

### Checks not rerun by Claude

Codex reports these results; Claude did not run them:
- the Swift running-list groups and the 111 Deno tests;
- the Debug and Release builds, and the signed export.

The original review's unverified device, time-zone, offline and hosted checks still apply.

### Verdict after recheck

**Pass for internal delivery.** Claude's design and interaction review has no remaining blocker at app and API source `a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068`. This pass covers internal delivery of a candidate built from that source, with an API bundle rebuilt from the same source.

Before rollout, Codex runs the hosted preflight it recorded, including the content-free count of evaluation-linked recordings. The expected count is zero. A nonzero count reopens P3-8 before hosted compatibility counts as clear.

This pass does not replace Mike's product acceptance, the device checks on the internal build, or any public release decision.
