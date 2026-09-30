# Running-list feasibility review — Candidate A

**Verified:** 2026-09-30. **Reviewer:** Codex, with independent read-only backend/compatibility and iOS/state reviews. **Disposition:** feasible with the resolutions below; not yet `handoff_ready`. No feature implementation, database change, deployment or release is claimed.

## Exact target and evidence

- Active checkout: `throughline-local`, branch `codex/capture-tray`, source `3d5c3acebb9f447b3bf5086283ed11715ff5ac6b`. The older iCloud checkout was not edited.
- [Claude handoff](../handoffs/2026-09-29-home-running-list.md), revision 1: SHA-256 `57ff7e1dc4ba12380b0714bd0c389baba8a3cfde95b1c57c6248c2d1fe11c881`.
- [Asset manifest](../handoffs/assets/2026-09-29-home-running-list/SHA256SUMS.txt): SHA-256 `bc7fdccaa2bbad07b92f7cb4da0421787e118b6ab79d9880c7ee606b273e43ce`. All 23 entries passed SHA-256 verification (prototype and 22 PNGs).
- These uncommitted Claude files and `mockup/running-list/` were the only initial dirty paths. They remain Claude-owned; Codex has not changed their bytes or marked their review complete.
- Current app models and mutations: [ThroughlineNote.swift](../../ios/Throughline/Models/ThroughlineNote.swift), [HomeView.swift](../../ios/Throughline/Views/HomeView.swift), [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift), [API](../../supabase/functions/api/index.ts). Extraction evidence: [inference contract](../../core/inference-contract.mjs). Capture metadata: [capture API](../../supabase/functions/api/capture.ts) and [migration](../../supabase/migrations/20260929192508_capture_recovery.sql).
- Source line references in the handoff are historical at `6fa119c`; this review uses the full source revision above. Last verified internal delivery is [1.0.5 (2026092902)](../releases/2026-09-29-ios-1.0.5-2026092902-delivery.md), app source `77192374e5f1de339047904c7ee0825e9863b96f`. Apple/backend state was not refreshed for this review.

## Findings requiring disposition

| ID | Severity | Finding and recommended resolution | Owner / status |
| --- | --- | --- | --- |
| RL1 | P1 | Full legacy write compatibility conflicts with occurrence isolation and rejection of stale task resurrection. Existing requests contain text or a replacement array, without a general task version. Preserve recording, reading and safe unique completion; return a conflict/update-required error for ambiguous selectors and unsafe versionless task-array edits. This can affect ordinary additions and renames, not only duplicates. Never silently apply just part of a rejected edit. | Mike: explicit compatibility decision requested; not assumed. |
| RL2 | P1 | The current multiline to-do editor and server normalizer deduplicate strings and transfer completion by text. Changing only Home leaves wrong-occurrence writes on cards/detail/edit. Preserve existing presentation where possible, but the editing contract must carry occurrence IDs and an expected task revision. Recommend identity-preserving task rows within the existing editor, without changing note detail presentation. A bulk text editor cannot reliably infer duplicate deletion/reordering. | Claude: resolve the minimal editor interaction against the unchanged-detail boundary before implementation. |
| RL3 | P2 | Rule 5 puts every tomorrow task in This week, including Sunday to Monday, contrary to the through-Sunday header. Tomorrow belongs in This week only if within the current Sunday boundary; on Sunday it belongs in Later until Monday. | Claude: correct rule and acceptance wording. |
| RL4 | P2 | Rules 2/6/7 conflict: never storing a tab cannot straightforwardly express a move that stays in the chosen tab indefinitely. Recommend deriving automatic placement from dates while persisting the explicit user-selected destination as an override, with its civil-date anchor for labels/order. A manual This week move therefore stays there after Sunday; no age-driven move to Today or Later. Preserve that override through completion/Undo and retain a completion placement snapshot for Done today. An explicit move promotes an earlier-note task; simple completion/Undo preserves its earlier classification. Never infer a move from age. | Claude: freeze the visible behavior, including a manual This week move after its original Sunday. |
| RL5 | P2 | F2 is settled by Mike: do not infer undated timeframes or change extraction. Empty Later copy currently promises that saying someday puts a task there. Replace that promise with dated-after-this-week or explicitly moved behavior; no marker inferred from arbitrary context text. | Claude: update exact copy and affected reference assets. |
| RL6 | P2 | Day turnover is promised at midnight but only evaluated on fetch/foreground. Recommend a foreground-only next-local-midnight timer plus foreground, fetch and significant-clock/timezone refresh; no background job. Reduce Motion says both crossfade and no fade: recommend no animation. VoiceOver says one row element plus separate circle: specify a nonduplicated focus grouping with independent accessible controls/custom actions. | Claude: reconcile these interaction/accessibility statements. |
| RL7 | P2 | First-use recorder copy must defer to shipped one-tap AI state; it cannot always be Record today's plan. Navigating away from Home currently invokes capture foreground invalidation. Keep Home and its capture lifecycle mounted while Notes content is shown. | Codex implementation constraint; Claude handoff should explicitly defer to the shipped controls. |

## F1–F7 answers

### F1 — occurrence identity and old clients

Use an ordinary task identity/version system independent of Private Evaluation: server-assigned occurrence ID, owner and source recording, source order, task/note version, completion instant, explicit placement intent and deletion tombstone. Persist identity across ID-aware edits; never regenerate identity at decoding, derive it from text, reuse a deleted ID, or merge two occurrences. New mutations carry the occurrence ID, absolute requested state, expected version and a durable mutation UUID. Atomic server application updates both task state and compatible note/agent read projections. A repeated UUID replays its original result only for an identical payload.

The current model creates missing Todo IDs during decoding. Legacy completion matches all normalized text, while the editing normalizer deduplicates that text. Current revision transport exists only in the separate evaluation path, and must not be repurposed or enabled for this slice.

Counterexample proving RL1: an old app reads tasks A and B; another app deletes A; the old app sends its cached A/B list while editing the title. The server cannot distinguish that stale request from an intentional addition of a new A. Structural indices do not resolve it. Similarly, a text-only completion cannot identify which of two identical task occurrences was intended. A compatibility error is safer than inventing that intent, but changes the old-client write contract and awaits Mike's decision. Allow an unchanged task projection in an otherwise safe legacy edit; do not promise unrestricted old-client to-do editing.

The migration and API must preserve owner/account deletion ordering, capture processing, immutable extraction/evaluation history and the existing agent read shape. Tombstones and version checks reject stale edits and queued operations against removed notes/tasks. No user data is copied into analytics, tracked fixtures or this report.

### F2 — said timeframes

Resolved: only existing valid extracted `due` / `for_date` calendar dates drive automatic placement. With no such date, someday/next week/this week is undated in v1 and follows D1. No prompt, extraction schema, model or heuristic text parser changes. Define strict Gregorian date parsing and precedence for the existing date fields in implementation tests; recommend valid `due` first, then valid `for_date`. Preserve original fields rather than rewriting extraction output. Future timeframe support is a separate quality-reviewed proposal after this release.

### F3 — offline changes

Use a separate durable owner-bound task outbox. Save the command before optimistic presentation; a local write failure leaves the visible state unchanged. Serialize changes per occurrence, freeze each dispatched payload/version/UUID, replay an uncertain response identically, and use the acknowledged version for the next command. Refresh overlays pending local intent on the newest authoritative snapshot. A conflict or deletion removes only the failed overlay, refreshes that occurrence and explains the failure quietly; it must not restore an entire stale note.

Authenticate both the request and each response against the captured owner/session generation. Sign-out suspends and hides that owner's commands; another account never sees or sends them. Account deletion invalidates the generation before cleanup. Reuse the capture transport's owner-check pattern without modifying capture files. Retry transient/offline failures; an expired session waits for sign-in; permanent rejection is not retried forever. Complete, reopen, move, refresh, relaunch and ambiguous-response tests must exercise actual persistence.

### F4 — tomorrow duplicates

Use `todos` as the sole occurrence source. The existing extraction contract already requires every `tomorrow_todos` string to have a corresponding dated `todos` entry. The string array is an old projection, never another set of occurrences. Two separate entries inside `todos` remain two tasks even when their text matches. Malformed historical tomorrow-only strings stay visible in their source note; do not silently manufacture or match a task from them. No extraction change is required.

### F5 — earlier-notes cutover

Recommend one immutable server-side cutover instant per account when the new list is first initialized, shared across devices and reinstalls. Classify by original capture creation instant, not eventual processing completion, so delayed uploads do not become new tasks. Persist earlier provenance; editing an old note does not silently promote it. A deliberate move promotes only the selected occurrence; a newly created task in an old note needs an explicit creation identity/time rather than being mistaken for an extracted historical task.

Existing capture metadata retains capture instant, local time and timezone. Use that provenance for D1's original civil day; do not reinterpret its date on every trip. A fresh offline installation without the account cutover must not invent an authoritative cutover. Unknown legacy completion time is never presented as Done today. Claude must confirm the visible earlier-group promotion/Undo behavior in RL4.

### F6 — midnight, timezone and daylight saving

Inject time/calendar/timezone into a pure placement projection. Use civil-date comparisons and calendar next-day/week-boundary operations, never fixed 86,400-second arithmetic. A resolved date stays that date across travel; the viewer's current local date determines due/overdue labels. Undated tasks retain their capture-local day. Completed instants belong to the current local day's actual interval, which can span 23 or 25 hours. Recompute on foreground, successful fetch, local midnight while foregrounded, and clock/timezone changes. No age-driven move to Later, background recording or background job.

Tests must cover Sunday/Monday, month/year/leap-day boundaries, both DST transitions, east/west timezone travel, delayed processing, invalid dates, explicit moves through rollover and Done/Undo retaining the prior placement. Freeze RL3/RL4/RL6 before relying on snapshots.

### F7 — metric

The exact proposed measure and coverage requirements are now defined in [product/metrics.md](../../product/metrics.md#seven-day-extracted-task-value). Existing note-open/text-toggle events cannot prove it. Definition is not instrumentation or a measured result. Report unavailable until occurrence validation and cohort reconciliation exist; internal TestFlight cannot establish public lift. No raw task IDs or content may enter analytics.

## List rules 1–12 disposition

| Rule | Assessment |
| --- | --- |
| 1 identity | Feasible with ordinary stable IDs; blocked on RL1/RL2 compatibility/edit resolution. |
| 2 derived placement | Feasible for automatic dates; clarify that an explicit user move can persist its destination override (RL4). |
| 3 undated Today | Accepted D1; preserve original capture-local day and age label. |
| 4 undated timeframes | Settled by Mike: no extraction change; correct misleading copy via RL5. |
| 5 tomorrow | Use only todos; fix Sunday exception via RL3. |
| 6 done/Undo | Persist per occurrence and real completion instant; resolve retained placement and earlier-group behavior. |
| 7 moves | Durable owner-bound state; resolve survival across Undo/week boundary via RL4. |
| 8 earlier notes | Account cutover, original capture provenance; no automatic migration into today's open list. |
| 9 edits | Must update card/detail/editor mutation bindings too; RL1/RL2 block a safe implementation. |
| 10 append | New note adds its own occurrences only; reconcile with capture delivery before revealing new tasks. |
| 11 order | Stable tie-break by capture time, source order and occurrence ID; calendar/date order as selected, with explicit-move ordering frozen. |
| 12 counts | Open visible tasks only; exclude Done today and collapsed/expanded earlier group; compute after pending-command overlay. |

## Bounded implementation and verification plan

1. Resolve RL1 with Mike and RL2–RL6 with Claude; Claude revises only its owned handoff/assets and sets readiness after Codex re-review. Reverify all changed hashes. Keep the approved three-tab design and shipped capture/AI behavior.
2. Commit reviewed contract/canonical decisions separately from backend identity/compatibility, iOS persistence/calendar logic, and UI integration. Stage named paths only; preserve unselected working prototypes. No main merge, PR comments or unrequested branch publication.
3. Add compatible ordinary task storage, atomic versioned mutations, idempotency and read projections. Test duplicate wording, old/new client concurrency, deletion/stale writes, note edit identity, ownership and complete migration replay with synthetic data and required test-only Vault setup. No Private Evaluation activation.
4. Add iOS projection/store/queue and occurrence-aware note bindings. Root owns Home integration and canonical files; backend and Swift-state implementation workers receive non-overlapping named files. No worker runs rendering or simulator jobs independently.
5. Run focused calendar/store/mutation tests, existing Node/Deno suites and capture store/queue contracts; build from an isolated committed-source copy. Obtain light/dark/largest-text simulator captures for every handoff matrix row, source hashes and interaction evidence. Only one party renders at a time. Keep synthetic screenshots separate from real private content.
6. Obtain actual Claude implementation review of exact source and captures, resolve findings, then prepare the compatible verified backend and an internal-only signed build for the existing Internal QA group under standing authority. Verify Apple processing/group availability; distinguish that from Mike's physical-device acceptance. No categories/search or evaluation implementation before delivery.
7. Rollback uses a compatible presentation build preserving capture storage and task identities/history; never drop task data or restore unsafe text-based mutations.

## Verification and handoff status

- Passed: physical checkout/branch/HEAD inspection, initial dirty-path inventory, supplied handoff/manifest hashes, all 23 asset checksums, source feasibility inspection and independent read-only reviews.
- Passed after canonical updates: `npm run docs:verify` (19 backlog items, 49 checked Markdown files), `npm run privacy:check`, and `git diff --check`. Approved policy files were not edited. These are documentation checks, not feature or release validation.
- Not run: feature tests, migration replay, isolated app build, simulator rendering, device tests, hosted task canary or TestFlight upload. There is no implementation to verify yet.
- Claude delivery is not yet confirmed: two desktop-control requests timed out, and the local Claude CLI reports signed out. No message or actual Claude response is claimed. This file is the repository-native return packet; handoff bytes remain unchanged until Claude resolves the findings. No rendering lock was acquired and Codex started no rendering.
- Next action: Mike resolves RL1; the active Claude session reads this packet, resolves its findings and returns revised hashes/readiness. Build approval itself is already granted.
