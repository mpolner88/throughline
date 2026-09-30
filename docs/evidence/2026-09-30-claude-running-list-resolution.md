# Claude resolution: Running List — Today, This Week, Later

Verified **2026-09-30**. Author: Claude Code (Claude Opus 5.5). This receipt records how Claude resolved Codex's feasibility findings in the running-list design handoff, the corrections from Codex's re-review, the asset changes, and the readiness decision. It is design work only: no production code, canonical file, commit, push, merge, release, policy or Private Evaluation change was made.

## Where

- Checkout: the local, non-synced `throughline-local` checkout, on the shared branch `codex/running-list` at `f6983ed`. The branch was `codex/capture-tray` at `e821382` when this pass began; Codex's intervening change was plain-language canonical documentation.
- Claude-owned files: [the handoff](../handoffs/2026-09-29-home-running-list.md), its [assets](../handoffs/assets/2026-09-29-home-running-list/SHA256SUMS.txt), `mockup/running-list/`, and this receipt. All are uncommitted for Codex to integrate.

## Decisions carried in

Mike, 2026-09-29 to 2026-09-30:
- selected Candidate A;
- D1: tasks with no time said go to today;
- approved build entry, with internal TestFlight next;
- applied Continue to Codex's recommended old-app compatibility approach.

Categories and search come after internal delivery, then Private Evaluation.

## Findings resolved

From [Codex's feasibility review](2026-09-30-running-list-feasibility.md) of handoff revision 1 (`57ff7e1dc4ba12380b0714bd0c389baba8a3cfde95b1c57c6248c2d1fe11c881`):

| Item | Resolution in revision 2 |
| --- | --- |
| RL1 P1, old apps | Old apps keep recording and reading. Completing works only for a to-do whose text is unambiguous now and in the note's history, and edits work only when the submitted to-do list exactly matches the current one. Everything else returns "Update Throughline to change to-dos in this note. Nothing was saved." and changes nothing. No partial applies. |
| RL2 P1, editor | Smallest change: in the existing editor, only the to-dos field changes, from one text box to one row per to-do. Each row keeps its task's identity, and rows can be renamed, removed with ⊖ or added with "+ Add a to-do". There is no reordering. Save applies all or nothing, and a conflict shows one line and saves nothing. Note detail is unchanged. |
| RL3 P2, Sunday | Tomorrow is this week only through Sunday. On Sunday it waits in later, labeled "tomorrow", until Monday. The this-week Sunday header and empty line were added. |
| RL4 P2, moves | Automatic placement comes from dates. A move is stored and wins indefinitely, including after the week ends, with a "moved Tue" label once the move day has passed. Done today keeps the tab a task was completed from, and Undo restores it. Moving an earlier-notes task promotes it; completing and undoing does not. |
| RL5 P2, timeframes | Nothing infers "someday" or "next week". Later holds tasks dated after this week, and moved tasks. The empty-later copy and the markers were corrected, and the prototype data now matches. |
| RL6 P2, midnight, Reduce Motion, VoiceOver | The day turns at midnight while the app is open, and otherwise on foreground, fetch, and clock or timezone change; there is no background job. Reduce Motion means no animation. VoiceOver reads one element per row: the default action completes or reopens, and custom actions move or open the note, with no duplicate focus stops. |
| RL7 P2, recorder and Notes | The recorder title follows the shipped AI control ("Agree and record" while off). The Notes screen is shown within Home, so the capture tray keeps running. |

Re-review corrections, from Codex's check of text `eb38d0b8…`, all applied:
- the history-aware completion condition;
- the exact-match condition for title edits sent with a to-do list;
- the branch record;
- the order, with Private Evaluation after categories and search.

## Assets

- The interactive prototype was updated for RL3–RL5 and RL2. It adds the note editor, Next morning through to the following Monday, and states for Sunday, moved, empty-later, editor and editor conflict. Its frozen copy, `selected-prototype.html`, is byte-identical to `mockup/running-list/candidate-a-interactive.html`. The three-candidate page is marked historical.
- Twelve images are new or re-rendered from the updated prototype:
  - `landed`, `later`, `earlier`, `sunday`, `sunday-week`, `moved`, `empty-later`, `editor` (light and dark), `editor-conflict`, and `today` at 375 × 667 and 430 × 932;
  - plus `source-light-390x844.png`, corrected after Codex's final check because the note sheet now shows the Edit button. Its SHA-256 changed from `cec2a70f…` to `0167c8ab75dd42ef7a1a7482128453e3d34e4a5ea8042b7692ddcf7d118a8fa4`.
- The remaining images were not changed. All 18 unchanged states were re-rendered from the final prototype as controls, and all came out byte-identical to the stored files.
- Claude inspected every new and changed image as an image.
- The manifest has 32 entries (the prototype plus 31 PNGs), and all verify. PNGs carry no metadata beyond resolution.

## Final identities

| File | SHA-256 |
| --- | --- |
| Handoff, revision 2, `handoff_ready` | `df675d539121ff12b98e3207c9466d5d18dcccf55f1a12244558c7f7d5ce7946` |
| Handoff text Codex approved, before readiness metadata | `85260ecfc0670d9d…` |
| Asset manifest `SHA256SUMS.txt` | `237c804b2f0d1e0b48097ca0e33fe630e7996c20436f2bb729acb339d356a54d` |

The handoff's only change after Codex's approval is the readiness metadata and the note about the corrected image.

## Checks

- `npm run docs:verify` passed: 19 backlog items, 49 checked Markdown files.
- All relative links and anchors in the handoff resolve, and every referenced image exists.
- The privacy screen of Claude's files found nothing: no emails, personal paths, tokens, identifiers or real content.
- There is no trailing whitespace.
- Interactive behavior was exercised in the browser with no console errors:
  - tap, swipe, press-and-hold and moves;
  - completion and Undo inside a moved tab;
  - Sunday and Monday rollover;
  - editor rename, remove and add;
  - earlier-notes promotion.

## Readiness and limits

- `handoff_ready` is set on Codex's passing re-review. One item remains for Codex: re-verify the single corrected image entry.
- Not verified: the implementation, which does not exist yet; any device behavior; VoiceOver speech; and real timezone or daylight-saving behavior. These belong to Codex's build verification and Mike's device checks.
- Claude's browser-rendering slot is released with this receipt.
