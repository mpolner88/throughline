---
handoff_id: "2026-09-28-home-capture-recovery"
backlog_id: "TL-CAP-001"
slice_brief: null
tandem_stage: "handoff_ready"
handoff_revision: 3
prior_revision_sha256: "75eda71e6606374145eb6f2b9fbdea807ad50f9cbd6fa2274f0908e27432c3b9"
base_revision: "3faf0f2f430b4e075c7c2367809c6d6d4837064b"
created_on: "2026-09-28"
verified_on: "2026-09-29"
design_agent: "Claude Code"
implementation_agent: "Codex"
decision_owner: "Mike"
authority: "design_only"
selected_candidate: "B — The recorder holds it (capture tray)"
selection_record: "Mike, 2026-09-28, Claude Code session 'Throughline design phase A': \"For #2 - let's do capture recovery then the running list. I like both.\""
owned_paths:
  - "docs/handoffs/2026-09-28-home-capture-recovery.md"
  - "docs/handoffs/assets/2026-09-28-home-capture-recovery/"
---

# UI Design Handoff: Home capture recovery — never lose a spoken thought

Follow [the Claude Code + Codex tandem workflow](../AGENT_TANDEM.md).

**Stage note.** This is revision 3.
- Revision 1 (`0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c`) received Codex's feasibility review at `bda1058`.
- Revision 2 (`75eda71e6606374145eb6f2b9fbdea807ad50f9cbd6fa2274f0908e27432c3b9`, committed at `602b75d`) received [Codex's re-review](../evidence/2026-09-28-codex-capture-rereview.md) at base `372178b`. Its verdict was "feasible, changes requested", with six grouped contract corrections, C1–C6.
- This revision resolves C1–C6 and records Mike's decisions D1 and D2.
- Codex's exact-draft review of the first revision-3 draft (`9b35dd2df3a02429406cd3280c251b91f5859605d832448035967a9b2a75a43e`) found it feasible, with six small contract corrections, F1–F6. This corrected draft resolves them (see [Feasibility findings and resolution](#feasibility-findings-and-resolution)).

- Codex re-reviewed the corrected draft (`69b94cad3a074ea851dbd7a4f11d03954d31149a42344c994fe382a5019328a5`) on 2026-09-29: PASS for design handoff readiness, with no remaining material contract finding ([receipt](../evidence/2026-09-29-capture-handoff-ready.md)).

The tandem stage is `handoff_ready`. This is design and source readiness only, not approval to build. Build entry is Mike's decision. Implementation, its tests and every device check remain future obligations. The substantive contract is the one Codex reviewed at `69b94cad…`; this file adds only the readiness metadata.

**Order.** Mike selected capture recovery first and the running list (`TL-TASK-001`) second. This slice is designed against the Home that ships today. The running list adopts the tray when it follows. [PR #2](https://github.com/mpolner88/throughline/pull/2) is deferred implementation material for that later work. It does not have to be merged before the tray is built.

**Base.** Prepared against `codex/reconcile-september-base` at `3faf0f2f430b4e075c7c2367809c6d6d4837064b`, on draft [PR #3](https://github.com/mpolner88/throughline/pull/3).
- The backend source is unchanged since the reviewed base `372178b`.
- The iOS app changed only through the AI-processing permission safeguard at `bac44c1`. This slice leaves that safeguard exactly as it is (see [Existing safeguard](#existing-safeguard)).
- Claude's review of the base is in [the reconciliation and capture review receipt](../evidence/2026-09-28-claude-reconciliation-capture-review.md). Codex's disposition of it is in [the re-review](../evidence/2026-09-28-codex-capture-rereview.md).
- The main merge remains a separate gate.

## Revision 3 changes

| Finding | Revision 2 | Revision 3 |
| --- | --- | --- |
| C1, acceptance outcomes | Every replay returned the same receipt; deleted-note memory conflicted with deleting reservation data with the recording | Four outcomes the phone can tell apart: accepted, incomplete (resumed by the same request), owner-deleted, and conflict. A minimal tombstone with no digest or content lasts until account deletion. Invariant 2 allows cleanup after a validated owner-deleted outcome. |
| C2, discard lifecycle | Discard deleted the phone's copy | A terminal intent is stored and that capture's retries, timers and responses are invalidated before any file is touched. If the intent cannot be stored, nothing is deleted and the person is told. |
| C3, uncertain account deletion | Paused, then resumed on any failure | A deletion hold is stored before the request is sent, and work is quiesced. A lost or partial answer holds every capture, sends nothing, and shows "Account deletion not confirmed" with Try again. Saving resumes only after a definite refusal with a still-valid account. The server refuses new acceptance once deletion starts. |
| C4, file names | File named by the capture ID | Independent random file token, mapped privately in the capture record |
| C5, unreadable audio | Unplayable meant Interrupted | Three results: valid, confirmed unreadable, or not readable yet. Not readable yet keeps everything and shows "Checking the recording…". Only confirmed unreadable audio can be dismissed. Checks 16–18 allow each outcome. |
| C6, ordering and delivery | "Oldest first"; a sent-once bit | Oldest first is upload order only. Processing starts at most once and may never finish. Milestone events are enqueued durably with the state change, with stable private identities and deduplicated ingestion. |
| D1, D2 | Open questions | Recorded as Mike's decisions of 2026-09-28 |
| References | Base `372178b`, review pending | Base `3faf0f2`, Codex re-review of revision 2 recorded, dependencies R7, R10 and R11 named |

Mock states 1–21 are unchanged. Their 37 reference images were left untouched and match the committed revision-2 manifest byte for byte. Eight of them were also re-rendered from the revised mock as a control and came out identical; the other 29 were not re-rendered. States 22 and 23 are new, with three new images. The mock file itself changed (two new states and updated annotations), so its hash and manifest line changed too.

<details>
<summary>Revision 2 changes (history)</summary>

Revision 2 responded to Codex's review of revision 1. It moved durability before recording and replaced ID reuse with a reservation contract. It made local deletion wait for a stored receipt and added the lost-response, sign-in, another-account, interruption and storage states. It split discard copy by history and counted only unsaved captures at sign-out. It also separated processing from saving and split failure measurement.

</details>

## Current

- What the user experiences now:
  - A recording is written to temporary storage and exists only in memory until the upload succeeds.
  - When the upload fails, Home shows one line of red text above the record button. The recording cannot be replayed or retried.
  - The record button is disabled while the upload and processing poll run, which can take about 40 seconds.
  - A phone call, locking the phone, or leaving the app during a recording is not handled.
  - If a session refresh fails for any reason, including no connection, the stored sign-in is erased.
  - Recording starts only when the device-wide AI-processing permission is on, and AI sends are refused before dispatch when it is off.
- Verification date: 2026-09-29, source inspected at `3faf0f2`. The visual baseline is from 2026-08-29.
- Evidence type: source inspection (primary); simulator for the visual baseline. There is no physical-device, TestFlight, or public-listing reproduction of a failed upload, interruption, or sign-in loss.
- Evidence links (line numbers at `3faf0f2`):
  - [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift) lines 44–46 write to `FileManager.default.temporaryDirectory`. It has no interruption or background handling, and its metadata lives only in memory (line 60).
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift):
    - lines 193–199 render the error text; line 211 disables the recorder during upload and processing;
    - line 231 applies the AI-permission check before recording;
    - lines 396–473 drop the file reference on failure, and line 465 labels upload failures `stage: "pre_record"`;
    - lines 492–522 poll ten times and then stop without an outcome.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) lines 672–691 send one `POST /recordings` with no retry and no capture identity. The local-time header is taken at send time. Line 688 routes the send through the AI-permission safeguard. Lines 910–922 fall back to a bundled API token when there is no session (Debug builds only).
  - [AuthClient.swift](../../ios/Throughline/Services/AuthClient.swift) lines 144–152 erase the stored session on any refresh error. [AppState.swift](../../ios/Throughline/AppState.swift) keeps its in-memory session; lines 79–86 show sign-out clearing notes and routing to onboarding.
  - [api/index.ts](../../supabase/functions/api/index.ts):
    - line 1361 allocates a new recording ID per request;
    - line 2199 stores no audio for an empty body;
    - line 2207 overwrites stored audio (`x-upsert`);
    - lines 2222–2239 and 2991–3002 merge-upsert the row;
    - line 1457 writes the row again after asynchronous processing, which can re-create a row deleted during processing.
  - [Info.plist](../../ios/Throughline/Info.plist) declares no background audio mode.
  - [Design audit, 2026-08-29](../evidence/2026-08-29-design-direction-portfolio-audit.md), [repository experience audit, 2026-08-29](../evidence/2026-08-29-repository-experience-workflow-audit.md) (rates this P0), and [return audit, 2026-09-28](../evidence/2026-09-28-return-audit.md).
- Known evidence gaps:
  - Real failure frequency is unknown. The recording-failure guardrail reported 0 of 0 for the trailing week, and the current event cannot tell upload failures from processing failures.
  - There is no device test of interruption, low storage, background behavior, or sign-in loss.

## User problem

- One problem: a person speaks a thought they could not stop to type, and the app can lose it without any way to recover it.
- Who experiences it: any signed-in person recording from Home whose upload fails, whose connection drops, whose recording is interrupted, or whose sign-in lapses before the upload completes. The product is for capture while driving or walking, where connectivity is least reliable.
- Why it matters now: it is rung one of the outcome ladder in [PRODUCT.md](../PRODUCT.md), "capture without loss". Mike selected it first on 2026-09-28.

## Evidence

- Decision-ready evidence: the source defects above are direct and reproducible by reading. Codex's reviews confirmed them independently at `bda1058` and `372178b`.
- Assumptions: upload failures and interruptions happen often enough to matter for people recording on the move. A person who sees their capture waiting will trust the recorder more than one who sees a transient confirmation.
- Unknowns: failure and interruption frequency; how often people record a second thought within 40 seconds of the first; how much local storage pending captures use in practice; how often a sign-in is rejected (as opposed to failing offline).

## Canonical fit

- Product principles: speed (capture is never blocked by saving); trustworthy structure; traceability (replay your own voice); quiet disclosure (every row states only what is known).
- Brand/design principles from [throughline-brand-decisions.md](../../throughline-brand-decisions.md): 1 voice before interface; 3 preserve the user's words; 4 quiet hierarchy; 5 one role per item; 7 let blue mean something; 8 be native where trust matters; 9 gestures additive (this slice adds none); 10 earn disclosure; 11 accessible calm. The recorder keeps its accepted full-width blue shape.
- Relevant decisions, in the [decision log](../../decision-log.md):
  - 2026-08-28: Home rollback.
  - 2026-08-30: handoffs are the contract.
  - 2026-09-28: the role split with mutual review; capture-first order and Candidate B; the D1 and D2 defaults; restoring AI permission before inference.
- Backlog state: `TL-CAP-001` is `awaiting_mock_approval`, slice phase `selected`, in [backlog.json](../../product/backlog.json). Codex owns backlog updates, including its tandem-stage projection. This handoff does not edit the backlog.
- Slice phase: `selected`. No slice brief exists yet. Codex creates the slice record at planning, as [WORKFLOW.md](../WORKFLOW.md) requires.

## Candidates

All three shared one lifecycle: audio is kept durably on the phone, the recorder is freed at once, and every state on screen is true. They differed in where that truth lives.

### Candidate A — Born in place

- Core idea: the capture appears as a card at the top of the notes list, where the finished note will live, and ages into it. A dashed border means not yet safe.
- Mock source: [candidate-a.html](../../mockup/capture-durability/candidate-a.html)
- Inspected screenshot: inspected in the browser in light and dark on 2026-08-30. No image was retained.
- Strengths: smallest change; no new surface.
- Risks: puts a fragile item inside the plan list that Mike had restored two days earlier.

### Candidate B — The recorder holds it

- Core idea: captures dock in a one-line tray above the record button and enter the plan only as finished notes.
- Mock source: [candidate-b.html](../../mockup/capture-durability/candidate-b.html); frozen target below.
- Inspected screenshot: [failed, light, 390 × 844](assets/2026-09-28-home-capture-recovery/screens/failed-light-390x844.png) and the full set in the visual matrix.
- Strengths: the plan never holds anything fragile; recovery sits at thumb height; no ceremony per capture.
- Risks: the bottom area grows; a structuring capture sits in the tray just before its note appears above.

### Candidate C — The save receipt

- Core idea: a sheet rises from the recorder and draws the journey as a vertical line of four stages.
- Mock source: [candidate-c.html](../../mockup/capture-durability/candidate-c.html)
- Inspected screenshot: inspected in the browser in light and dark on 2026-08-30. No image was retained.
- Strengths: strongest expression of the brand's line; shows the transformation.
- Risks: adds a sheet to every capture.

## Selection

- Selected candidate: B, the capture tray.
- Mike's exact selection record: 2026-09-28, replying to "Pick the first slice: capture recovery or the running list": "For #2 - let's do capture recovery then the running list. I like both."
- Reading of that record: capture recovery was shown to Mike as the tray in both presentations on 2026-09-28. This handoff treats the statement as selecting that design, which the [decision log](../../decision-log.md) and backlog also record. Candidates A and C were shown on 2026-08-30 and are recorded as not selected. Revision 3 does not reopen the selection.
- Required revisions made by Claude in revision 1 to bound the first slice:
  1. The line "Saved · readable by your agent" is removed. `AppState.hasConnectedAgent` is declared and never set, so the claim has no behavior behind it. It returns with the agent-connection work.
  2. Retry for stalled structuring is deferred. The API has no re-process route. After a receipt, a recording that stalls or fails on the server leaves the tray and appears in the list with its existing status row, as it does today.
  3. The offline header is shortened to "2 captures waiting to save" so it fits one line at 390 points.
  4. States added that the August mock did not show: replay in progress, more than three captures, a first recording on the empty Home, and signing out with unsaved captures.
- Later revisions: revision 2 responded to Codex's review of revision 1; revision 3 responds to Codex's re-review of revision 2 and records [D1 and D2](#decisions-recorded). Both are dispositioned finding by finding under [Feasibility findings and resolution](#feasibility-findings-and-resolution).
- Rejected alternatives and why: A, because it puts unsaved content into the plan list. C, because it adds a sheet to a flow that must stay free of ceremony while driving.

## Selected experience

Frozen target: [selected-mock.html](assets/2026-09-28-home-capture-recovery/selected-mock.html). Open it for the gallery of 23 states, or add `?only=<state>` for one state (for example `?only=deletion-pending`). Add `theme=dark` for dark appearance.

### Words used below

- **Capture**: one recording on this phone, from the moment recording starts until it has a stored receipt, is discarded, or is deleted by an account action.
- **Owner**: the account that was signed in, or shown on Home, when the capture was started. It never changes.
- **Accepted receipt**: the server's answer that the owner's recording for this capture is completely stored. It binds owner, capture, recording, and confirmed audio byte length and digest. The phone checks it and stores it before acting on it.
- **Never sent**: no request for this capture has ever left the phone, or the owner's account has given an authoritative answer for the whole capture that it holds nothing for it. A refusal of only the latest request does not qualify.
- **Result unknown**: a request left the phone and no definitive answer came back. The account may or may not hold the recording. Once a capture is result unknown, it stays result unknown until an authoritative answer for the whole capture arrives (accepted, owner-deleted, or nothing held). Later requests that fail, and attempts refused on the phone before sending, never make it never sent again.
- **Terminal intent**: a stored, final local decision to remove a capture (Discard, sign-out, account deletion, owner-deleted cleanup, or Dismiss). Once stored, the capture is never shown or sent again, even if file removal has to be retried.
- **Receipt cleanup**: a stored record that a capture's accepted receipt is safely on the phone, so its audio can be deleted. It is not terminal. The capture keeps its receipt and event identities in a slim record and stays visible as Saved and structuring until its note arrives or polling ends. Upload retries stop; watching for the processing result continues.

### Primary flow

- Entry: the person taps the record button on Home, speaks, and taps to stop. Nothing about starting or stopping looks different.
1. Before recording starts, the app creates the capture's record in durable app storage: owner, capture time, time zone, local time, type, and an independent random file token. It also creates the audio file named by that token. If it cannot, recording does not start. See [Storage](#storage).
2. While recording, the recorder is unchanged.
3. On stop, the file is closed and checked.
   - When the check passes, the row reads "**On your phone.** Saving to your account…", with one light haptic, and sending begins.
   - If the file cannot be read yet, the row reads "**On your phone.** Checking the recording…" and nothing is sent. See [Stopped early, interrupted and unreadable](#stopped-early-interrupted-and-unreadable).
   - Either way, the recorder returns to idle and is usable at once.
4. The app sends the capture under its owner's own sign-in and with its fixed identity. It retries on its own with backoff while the row keeps the same text.
5. When a valid accepted receipt arrives and has been stored on the phone, the row reads "**Saved to your account.** Structuring your note…". Only then is the local audio deleted, after its receipt cleanup is recorded. Upload retries for it stop; the app keeps watching for the processing result.
6. When the note is processed, the row leaves the tray and the note appears in Today's plan exactly as notes appear today. When the tray is empty it is not drawn.

- Exit: the tray empties and Home is exactly the accepted Home.
- One representation: a recording shown in the tray is not also shown in the list. It appears in the list only after it leaves the tray.
  - If a list refresh reveals a recording bound to a capture still in the tray, it is not shown twice. The phone adopts that recording as the capture's accepted receipt, after the same checks, and the capture leaves the tray.
  - Captures and recordings are matched only by that binding, never by time, duration, or note text.
- Order: captures are sent oldest first. Notes may finish processing, and appear, in any order. Each note shows its capture time, not the time it was sent.

### What the account can answer

The phone treats each answer to a capture request differently. The mechanics are in the [Data and API contract](#data-and-api-contract).

| Answer | Meaning | What the person sees |
| --- | --- | --- |
| Accepted | The recording is completely stored; an immutable receipt comes back, identical on every replay | Saved, then the note |
| Incomplete | An earlier request reserved this capture but did not finish storing it | Nothing new. The same request finishes the job and returns Accepted. If it cannot finish now, the capture stays result unknown ("Checking with your account…", then "Couldn't confirm the save.") and is never shown as Saved. |
| Owner-deleted | The owner already saved this capture and later deleted the note | The capture leaves the tray quietly after its terminal intent is stored; its audio is deleted. The note does not come back. |
| Conflict | The account holds this capture with different audio, which should never happen | "**Couldn't confirm the save.** Still on your phone." Audio kept. Codex records a content-free category. |
| Nothing held for this capture | An authoritative answer covering the whole capture: the account holds no reservation or recording for it | Counts as never sent; "**Couldn't save.** Still on your phone." |
| Refusal of one request only | This request was refused (for example, a zero-byte body or a server error); it says nothing about earlier requests | History unchanged. A never-sent capture shows "**Couldn't save.**"; a capture with an earlier unknown result stays "**Couldn't confirm the save.**" |

### Waiting, failure and uncertainty

- **Offline:** "**On your phone.** Waiting for connection." With two or more captures waiting, a header reads "2 captures waiting to save". Saving resumes on its own when the connection returns. A sign-in that cannot be refreshed because there is no connection is treated as offline: the sign-in is kept, and no sign-in prompt appears.
- **Transient failure:** the app retries on its own with backoff while the row still reads "Saving to your account…".
- **Sent, answer lost:** when a request left the phone and no definitive answer came back, the row reads "**On your phone.** Checking with your account…" while the app asks again with the same capture identity.
- **Couldn't save:** after the automatic retries are used up, a capture that was never sent reads "**Couldn't save.** Still on your phone." It has three actions:
  - **Save again** retries with the same capture identity.
  - **Play** plays the audio and becomes **Stop** while playing.
  - **Discard** asks for confirmation (see [Discard is local](#discard-is-local)).
- **Couldn't confirm the save:** after the retries are used up, a capture whose result is unknown reads "**Couldn't confirm the save.** Still on your phone." It has the same three actions. Save again is safe: it can only return the same note, finish an incomplete save, or save it once.
- **Retry triggers:** failed rows are tried again once on each launch, each return to the foreground, and each time the connection returns, and on Save again.
- **App closed or crashed:** on next launch, every capture that still has audio on the phone and no terminal intent reappears in the tray, and saving resumes. A capture with a stored receipt but no final note appears in the list with its existing status row, not in the tray.
- **Slow or failed processing after a receipt** (see revision 1, item 2):
  - When the ten polls end without a final status, that is not a failure. The row leaves the tray and the note shows its existing unfinished status row in the list; later refreshes update it.
  - Processing starts at most once. If the server stops after claiming processing and before finishing, the recording stays saved but unfinished, and that list row is the whole outcome. This slice does not promise eventual processing, does not reprocess, and never re-uploads audio to restart processing.

### Existing safeguard

The AI-processing permission safeguard at `bac44c1` stays exactly as it is: its check, its sheet, its copy, and its Settings row. The tray adds no permission copy, control, or state.

- Recording starts only when permission is on, as today.
- If permission is off when a capture would be sent, the safeguard refuses before anything leaves the phone. That attempt sends nothing, spends no further backoff, and does not change the capture's history:
  - A capture that was never sent keeps its audio and shows "**Couldn't save.** Still on your phone.", with the never-sent Discard message.
  - A capture with an earlier unknown result stays result unknown and shows "**Couldn't confirm the save.** Still on your phone.", with the result-unknown Discard message.
- Save again and the retry triggers go back through the same safeguard; when permission is on again, each capture is sent once.
- The row is the explanation for a refused capture. The tray does not add the Home error line for it.

### Leaving the app

Saving runs while Throughline is open. The queue resumes on launch, on returning to the foreground, when the connection returns, and on Save again.

- **Leaving the app during an upload:** the system may let the request finish or may stop it. Nothing on screen or in copy promises that saving continues in the background, and there is no notification. On return, the row shows the current truth. A request that may have been cut off is treated as result unknown and resolved with the same capture identity.
- **Leaving the app, locking the phone, or taking a call while recording** (decision D2): the recording ends at that moment and what was recorded is kept.
  - If the file is playable, the row reads "**On your phone.** Stopped early. Saving to your account…".
  - If the file is confirmed unreadable, it becomes an Interrupted row.
  - Recording does not continue in the background and does not resume by itself.

### Stopped early, interrupted and unreadable

Every stopped or recovered file gets one of three results:

- **Valid:** the file plays. It is a normal capture. If it ended before the person tapped stop (a call, the lock button, leaving the app, full storage, or a relaunch after a crash), the row reads "**On your phone.** Stopped early. Saving to your account…". When saved, it reads like any other saved capture.
- **Not readable yet:** the file could not be opened or checked because of file protection or a transient read error.
  - This is not proof of damage. The row reads "**On your phone.** Checking the recording…" with no actions.
  - Nothing is sent or dismissed, and unreadability never causes deletion. Only an explicit, confirmed sign-out or account deletion can remove it, under the terminal-intent rules. The check runs again on the next launch and each return to the foreground.
  - The light haptic waits until the check passes.
- **Confirmed unreadable:** the file was read and is empty or cannot be decoded.
  - The row reads "**Recording interrupted.** The audio couldn't be recovered." with one action, **Dismiss**.
  - Dismiss stores the terminal intent and then removes the leftover record and file without a confirmation, because nothing usable remains.
  - The duration shows the last known length, or is blank when it is not known. The row stays until dismissed and is never uploaded.

The design does not promise that every interrupted recording is intact. Device checks decide which interruptions leave playable audio.

### Storage

- Before recording starts, the app checks that it can create the record and file and hold a full five-minute recording. The margin is Codex's choice.
- Not enough space: recording does not start. The recorder shows "Not enough space to record" and "Free up storage on this phone, then try again. Your notes are unaffected." Tapping it checks again. No "On your phone" text or haptic appears.
- Any other storage failure before recording: the recorder shows "Couldn't start recording" and "Tap to try again. Your notes are unaffected."
- Storage running out during a recording ends it. It is then handled by the three results above.

### Sign-in required

- **Trigger:** the owner's account rejects the phone's sign-in. A refresh that fails for lack of connection is not this state; it is offline.
- **What the person sees:**
  - Home stays on screen with the notes it already shows.
  - The tray header reads "2 captures waiting to save" (or "1 capture…") with a **Sign in** action on the right, shown even for one capture.
  - Each row reads "**On your phone.** Waiting for sign-in." Rows have no per-row actions in this state.
- **Sign in** opens the existing sign-in screen, the one reached from the onboarding hero's Sign in, without changing it.
  - After signing in from Home, the person returns to Home. Onboarding does not run again.
  - Codex chooses how to present the screen and must make its completion return to Home.
- The recorder stays available. New captures belong to the account shown on Home and wait for its sign-in.
- The red refresh-error line is not shown for this condition; the tray header is the one explanation. If the tray is empty when a sign-in is rejected, behavior is unchanged from today.
- A rejected sign-in never deletes captures. Only a terminal intent does.
- At the next launch after a rejected sign-in, the app opens onboarding as it does today. Signing in to the same account returns to Home, and saving resumes.
- Refresh results, sign-in completion, requests and timers all carry the account generation they started under. A stale refresh can never restore, replace or clear the session of the account signed in now.

### Another account

Decision D1, recorded in the [decision log](../../decision-log.md) on 2026-09-28.

- Captures belong to their owner. While a different account is signed in, those captures are never uploaded, played, individually listed, or counted under the current account, including in its sign-out.
- The previous account's cached notes are not shown to the account signed in now.
- The tray shows one neutral row: "**2 captures from another account.** Sign in to that account to save them.", with one action, **Discard from phone**.
  - It asks "Discard 2 captures from another account?" with "They'll be deleted from this phone. Any that already reached that account stay there." and the buttons Discard from phone and Cancel.
  - Confirming follows the same terminal-intent order as Discard.
- If the owner signs in again later, the captures resume as normal.

### Discard is local

Discard removes the phone's copy of one capture. It never deletes anything from the account and never sends a request.

1. The person confirms in the dialog.
2. The terminal intent is stored. That capture's scheduled retries, timers and in-flight responses are invalidated, and any in-flight request is cancelled where possible.
3. The row leaves the tray.
4. The file is removed, then the record.

What can go wrong:

- **A request already sent still finishes on the server.** The phone ignores the late answer, and nothing local changes. If the account now holds the recording, the note appears in the list after a refresh, where the existing note deletion applies.
- **The intent cannot be stored** (for example, the phone is full):
  - Nothing is deleted and the row stays.
  - A native alert says "Couldn't discard this capture" / "It's still on your phone. Try again in a moment." / OK.
  - The capture is not sent again for the rest of this app session. After a relaunch it behaves as it did before the attempt, because no intent was stored.
- **File removal fails after the intent is stored:** the capture is never shown or sent again. Removal is retried on each launch and each return to the foreground. No copy claims instant erasure.

Messages:

- Never sent: "The audio will be deleted from this phone. It hasn't been saved to your account."
- Result unknown: "This deletes the audio from this phone only. If it already reached your account, the note will still appear in your list."
- Which message appears depends on the capture's history, not on its current row text. A capture that shows "Waiting for connection" after a request left the phone uses the result-unknown message.

### Sign-out, account deletion and account isolation

- **Unsaved captures** means the signed-in account's captures that still have audio on this phone, no stored receipt, and no terminal intent.
  - Included: waiting, saving, checking, couldn't save, couldn't confirm, stopped early, and not readable yet.
  - Excluded: saved and structuring rows (the account already holds them), confirmed-unreadable rows, and another account's captures.
- **Sign-out with no unsaved captures:** unchanged from today.
- **Sign-out with unsaved captures:**
  - A confirmation appears first: "Sign out?" / "2 captures haven't been confirmed as saved to your account. Signing out deletes them from this phone." / Sign out and delete · Cancel.
  - Cancel changes nothing.
  - Confirming stores terminal intents for those captures and invalidates this account's requests, timers and responses. It then removes the captures' files and records, and signs out as today. This account's slim records, which hold no audio, are removed too. Another account's captures are kept.
- **Recording in progress** when the person taps Sign out or Delete account: the recording is stopped and kept first, then counted in the dialog. If they cancel, it stays in the tray as a normal capture.
- **In-flight uploads at sign-out:** a response that arrives after sign-out is ignored. It cannot re-create a deleted capture, attach it to another account, or change the tray. The server may still have saved the recording; the dialog wording covers that.
- **Account deletion.** The existing "Delete account?" confirmation adds, when any are unsaved, "2 captures that haven't been confirmed as saved will also be deleted from this phone." On confirm:
  1. A deletion hold for this account is stored first. If it cannot be stored, the deletion request is not sent and nothing changes. A native alert says "Couldn't delete your account" / "Nothing was deleted. Try again in a moment." / OK.
  2. This account's capture work is quiesced. Scheduling stops, in-flight capture requests are cancelled, and their responses are invalidated. Nothing new is sent while the hold exists.
  3. The existing deletion request is sent.
  4. **Confirmed deleted:** terminal intents are stored for all of this account's local captures and receipts, which are then removed. Sign-out happens as today, and the hold ends with it.
  5. **Definite refusal while the account and sign-in are still valid:** the hold is cleared, nothing local is deleted, saving resumes, and the existing error appears.
  6. **Not confirmed** (the answer was lost, timed out, or reported only partial cleanup):
     - Nothing local is deleted, and nothing is sent.
     - A native alert says "Account deletion not confirmed" / "Throughline couldn't confirm that your account was deleted. Captures on this phone are kept and won't be sent. Try again when you're connected." / Try again · OK.
     - On Home, the tray header reads "Account deletion not confirmed" with a **Try again** action, and each row reads "**On your phone.** Held, not sent." The recorder stays available, and new captures are held the same way.
     - The hold survives relaunch and is restored before the queue schedules anything. A crash right after the request is sent, before any answer, therefore relaunches into this not-confirmed state with nothing sent.
     - On each launch, and on Try again, the app checks again. A confirmed deletion leads to step 4. A definite refusal with a still-valid account and sign-in leads to step 5. Anything else stays not confirmed.
     - Signing out remains available and follows the sign-out rules above.
- **Isolation:**
  - A capture is sent only with its owner's own sign-in, never with a shared or service credential or another account's sign-in.
  - Requests, responses, retries and timers started under one account generation are discarded when the signed-in account changes, signs out, or begins account deletion. None of them can move, re-create, upload or delete a capture of a different account.

### Unchanged from revision 1

- More than three captures: three rows show, then a button row "+ 2 more" with "Show all". Show all expands the tray to at most half the screen height with its own scroll. The button then reads "Show less".
- Microphone access off: the record button explains and offers Open Settings, replacing today's raw error text.
- Navigation and gestures: none added. There is no swipe, long press, or drag in this slice.
- Non-gesture alternatives: every action is a visible button at least 44 points tall.

### Exact copy

| Where | Copy |
| --- | --- |
| Row, kept and saving | **On your phone.** Saving to your account… |
| Row, stopped early and saving | **On your phone.** Stopped early. Saving to your account… |
| Row, kept but not readable yet | **On your phone.** Checking the recording… |
| Row, sent and checking | **On your phone.** Checking with your account… |
| Row, saved and structuring | **Saved to your account.** Structuring your note… |
| Row, offline | **On your phone.** Waiting for connection. |
| Row, sign-in required | **On your phone.** Waiting for sign-in. |
| Row, held during unconfirmed account deletion | **On your phone.** Held, not sent. |
| Rows while the recorder is expanded for recording | **On your phone.** Saving… / **On your phone.** Checking… / **On your phone.** Waiting. / **On your phone.** Held. / **Saved.** Structuring… |
| Tray header, two or more waiting, or any waiting for sign-in | 2 captures waiting to save |
| Tray header action, sign-in required | Sign in |
| Tray header, unconfirmed account deletion | Account deletion not confirmed |
| Tray header action, unconfirmed account deletion | Try again |
| Row, failed, never sent | **Couldn't save.** Still on your phone. |
| Row, failed, result unknown or conflict | **Couldn't confirm the save.** Still on your phone. |
| Actions on a failed row | Save again · Play · Discard |
| Play while playing | Stop |
| Row, confirmed unreadable | **Recording interrupted.** The audio couldn't be recovered. |
| Action on an interrupted row | Dismiss |
| Row, another account's captures | **2 captures from another account.** Sign in to that account to save them. |
| Action on that row | Discard from phone |
| Collapsed row | + 2 more · Show all |
| Expanded row | Show less |
| Discard dialog title | Discard this capture? |
| Discard dialog message, never sent | The audio will be deleted from this phone. It hasn't been saved to your account. |
| Discard dialog message, result unknown | This deletes the audio from this phone only. If it already reached your account, the note will still appear in your list. |
| Discard dialog buttons | Discard from phone · Cancel |
| Alert when a discard cannot be recorded | Couldn't discard this capture / It's still on your phone. Try again in a moment. / OK |
| Another-account discard title | Discard 2 captures from another account? |
| Another-account discard message | They'll be deleted from this phone. Any that already reached that account stay there. |
| Another-account discard buttons | Discard from phone · Cancel |
| Sign-out dialog title | Sign out? |
| Sign-out dialog message | 2 captures haven't been confirmed as saved to your account. Signing out deletes them from this phone. |
| Sign-out dialog buttons | Sign out and delete · Cancel |
| Sentence added to the delete-account dialog | 2 captures that haven't been confirmed as saved will also be deleted from this phone. |
| Alert when the deletion hold cannot be stored | Couldn't delete your account / Nothing was deleted. Try again in a moment. / OK |
| Alert when account deletion is not confirmed | Account deletion not confirmed / Throughline couldn't confirm that your account was deleted. Captures on this phone are kept and won't be sent. Try again when you're connected. / Try again · OK |
| Recorder, microphone off, title | Microphone access is off |
| Recorder, microphone off, support | Turn it on in Settings to record. Your notes are unaffected. |
| Recorder, microphone off, button | Open Settings |
| Recorder, not enough space, title | Not enough space to record |
| Recorder, not enough space, support | Free up storage on this phone, then try again. Your notes are unaffected. |
| Recorder, storage unavailable, title | Couldn't start recording |
| Recorder, storage unavailable, support | Tap to try again. Your notes are unaffected. |
| VoiceOver, note arrives | Note ready in today's plan. |
| VoiceOver, tray region | Captures, 2 items |
| VoiceOver, stopped early | Recording stopped early. Kept on your phone. |
| VoiceOver, not readable yet | Recording kept on your phone. Checking it. |
| VoiceOver, interrupted | Recording interrupted. The audio couldn't be recovered. |
| VoiceOver, sign-in required | Sign in to save 2 captures. |
| VoiceOver, account deletion not confirmed | Account deletion not confirmed. 2 captures held on this phone. |

- Formatting:
  - Durations render in the monospaced digit style as `0:42`.
  - Counts use the singular "1 capture" where it applies.
  - Bold marks the clause that is a durable fact; the clause after it is the current activity.
  - No copy says or implies that saving continues after the person leaves the app, or that a discard erased anything instantly.
- Copy that is removed:
  - The button labels "Saving your voice note…" and "Structuring your plan…", the supporting line "Saving your note and extracting to-dos", and the footer word "saved".
  - The footer word "syncing" stays.
  - The red error line stays for errors that are not about a capture, such as a failed task toggle or refresh. It is not shown while sign-in is required or while account deletion is not confirmed.
- Motion: a row fades in when it appears. When a note is processed the row slides up and fades as the note appears in the list, in about 0.25 seconds. Text changes inside a row do not animate.
- Haptics/audio:
  - One light impact when a capture is kept, only after the stopped file passes its check.
  - One warning notification haptic when a capture reaches a failed or interrupted state while the app is in the foreground.
  - Play uses the normal playback route. Starting a recording stops playback. Playback stops when the app leaves the foreground.

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | Saving, checking and structuring rows with staged copy. The recorder is never busy because of saving or structuring. | `kept`, `checking`, `saved`, `recording`, `audio-check` screens |
| Empty | No captures in flight: no tray. Home and recorder are exactly as accepted. A first recording on the empty Home shows the tray above "Record today's plan". | `arrived`, `first` screens |
| Error/retry | Couldn't save and Couldn't confirm rows with Save again, Play, Discard. Save again never creates a second note. Rows persist across launches until saved, discarded, or removed by an account action. Confirmed-unreadable rows offer Dismiss only. | `failed`, `unconfirmed`, `playing`, `discard`, `discard-unconfirmed`, `interrupted` screens; behavioral checks 2–4, 16–18, 22–24 |
| Offline/degraded | Rows read "Waiting for connection." No alarm color. Recording stays available. An offline refresh never signs the person out. | `offline`, `many` screens; behavioral checks 1, 11 |
| Sign-in and account | Sign-in rows with one header action; another account's captures as one neutral row; held rows under an unconfirmed deletion. | `signin`, `ax-signin`, `other`, `deletion-pending` screens; behavioral checks 12–15 |
| Permission denied | Recorder shows title, support line, and Open Settings, which opens this app's page in Settings. The AI-processing safeguard behaves as it does today. | `permission` screen; behavioral check 28 |
| Storage | Recorder shows Not enough space or Couldn't start recording; tapping re-checks. | `storage` screens; behavioral check 19 |
| Long/localized content | Row text wraps to any number of lines. The longest capture, 4:58, renders like the shortest. More than three rows collapse. German-length strings must wrap, not truncate. | `many`, `ax`, `ax-signin` screens |
| Light and dark appearance | Tray uses the background and hairline tokens only. Blue appears on the live dot, the primary action, and the text buttons (Sign in, Try again). | dark screens in the matrix |
| Dynamic Type | All tray text uses semantic text styles, not fixed sizes. At accessibility sizes the actions stack full width, the row aligns to the top, and a header action drops below its label. | `ax` and `ax-signin` screens at 390 × 844 and 375 × 667 |
| VoiceOver/focus order | The tray is a labeled region read before the recorder. Each row reads duration, then the durable fact, then the activity. Actions follow their row; a header action is read before the rows. One announcement per state change, never per poll or retry. | VoiceOver pass on device |
| Reduce Motion | The spinner is a static glyph. Rows appear and leave with a crossfade or no animation. No sliding. | Reduce Motion pass on device |

## Production mapping

- Existing components to reuse: `RecordButton`, `Eyebrow`, `Theme` tokens, the hairline `Divider`, the native `confirmationDialog` and alerts, the existing sign-in screen, and `ProcessingStatusRow` for notes in the list.
- Files likely affected (Codex owns the final list):
  - [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift): record directly into durable storage under the file token; storage pre-check; interruption and background handling that ends and keeps the recording; finalize and validate on stop, with the three validation results.
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift): `bottomRecorder`, `stopAndUploadRecording`, recorder title and busy logic, the footer, list filtering by capture binding, the deletion-unconfirmed header, and events. The AI-permission check at line 231 stays as is.
  - [SharedComponents.swift](../../ios/Throughline/Views/SharedComponents.swift): microphone-off and storage presentations for `RecordButton`; the sign-out and delete-account confirmations and the unconfirmed-deletion alert in `AccountSettingsView`. The AI-processing sheet and Settings row stay as they are.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift): upload from file with the capture identity and capture-time headers from the stored record. The existing AI-permission dispatch boundary stays in place. Captures require the owner's session, with no API-token fallback. Receipt and outcome validation, and the account-deletion result classification.
  - [AuthClient.swift](../../ios/Throughline/Services/AuthClient.swift) and [AppState.swift](../../ios/Throughline/AppState.swift):
    - separate a network refresh failure (keep the session) from a rejected sign-in (sign-in required, without calling `signOut()`);
    - account generations for refresh success and error, sign-in completion, requests and timers;
    - per-account cached notes;
    - quiescing and the persisted unconfirmed-deletion state.
  - New, names suggested: `Services/CaptureStore.swift`, `Services/CaptureQueue.swift`, `Views/CaptureTrayView.swift`, and tests under `ios/Tests/`.
  - Server, narrowly scoped (see [Data and API contract](#data-and-api-contract)): [api/index.ts](../../supabase/functions/api/index.ts) and its Deno tests; one forward migration under `supabase/migrations/` with pgTAP tests under `supabase/tests/`.
- New assets/tokens: none. SF Symbols only. Suggested: `exclamationmark.circle` for failed and interrupted, `play.fill` and `stop.fill`, a hollow circle for waiting, checking and held.

### Data and API contract

Codex owns the mechanics; these are the properties the design depends on. Merely reusing an ID with the current overwrite and merge-upsert behavior is unsafe and does not meet them.

1. **Owner-scoped atomic reservation.** The first request for a capture reserves the pair of authenticated owner and capture ID atomically. A request without a user session (service or API-token context) cannot create, resume, or replay a capture.
2. **Immutable payload identity.** The reservation binds a digest and byte length of the exact audio, plus the capture-time metadata that defines the recording.
   - The capture time, time zone and local time are the ones stored when recording started, not the retry time. The note displays the capture time.
   - A later request with the same owner and capture ID but a different payload is refused as a conflict, without changing anything.
   - A zero-byte body is refused before reservation and never produces a receipt.
3. **Incomplete versus accepted.**
   - A reservation whose audio or row is not yet complete is **incomplete**. A replay with the same owner, capture and payload resumes it. The replay stores audio only if it is missing, or verifies its digest if present, then finalizes the row and takes the processing claim if nobody has.
   - An **accepted receipt** is issued only when acceptance is complete. It is immutable: every later replay returns the same receipt without storing audio or starting processing again. It stays valid after the 30-day audio retention window.
   - Audio is written without overwrite.
4. **Single processing claim; guarded finalization.** Processing starts at most once per recording, whichever request wins the claim. Completion is not guaranteed: a crash after the claim leaves a saved, unfinished recording, which the existing list row presents. The final processing write must not re-create a row the owner deleted while processing ran. Today's merge-upsert at line 1457 can do exactly that (dependency R11).
5. **Cross-account safety.** The same capture ID from a different owner is a separate namespace. It never reads, reveals, or changes the first owner's recording, and errors do not disclose whether another owner used that ID.
6. **Owner-deleted outcome.** When the owner deletes a recording created from a capture, the server keeps a minimal tombstone until account deletion. The tombstone holds only the owner, the capture ID and the deletion time: no digest, no audio metadata, no content. A replay then returns an authoritative owner-deleted outcome bound to that owner and capture, and never re-creates the recording.
7. **Reconciliation by binding.** The owner's own list and detail responses expose the capture binding for recordings created from a capture, so a lost response can be reconciled without heuristics.
8. **Account deletion is serialized with acceptance.** Once deletion of an account begins, the server refuses new reservations, resumptions and finalizations for that owner. The deletion response distinguishes three results: confirmed deleted; refused with nothing deleted; and anything partial or uncertain. The phone can then apply the account-deletion rules without guessing.
9. **Compatibility.** Requests without capture identity keep today's behavior. That covers the public 1.0.4 app, the JSON demo-save path, and the demo route. Existing response fields keep their meaning; new fields are additive.
10. **Privacy.**
    - File names are only the independent, opaque local file tokens. Capture, account, session and recording identifiers and digests never appear in file names.
    - File tokens, capture IDs and digests never go to analytics, logs, or tracked evidence.
    - Reservation data lives only in service-role-only tables with RLS enabled and no client grants.
    - Reservation data and receipts are removed with the recording, except the tombstone in item 6, which is removed with the account.
    - The phone's receipt copy is removed with the local record.

Likely scope: one forward migration and RPC for the reservation, payload binding, incomplete/accepted/owner-deleted outcomes, tombstone, processing claim and deletion serialization, with pgTAP tests. Also changes to `handlePostRecording`, `createRecordingFromRaw`, `storeAudio`, `persistRecording`, the processing write, note deletion and account deletion for the capture path, with Deno tests. Deploying the migration and the API remains separately gated and is not authorized by this document.

### Capture record on the phone

- Each capture gets a random capture ID and a separate random file token before recording starts. The audio file is named by the token only. No capture, account, session or recording identifier appears in a file name. The mapping from token to capture lives only in the record.
- The capture record holds only:
  - identity and ownership: capture ID, file token, owner account ID, account generation;
  - capture metadata: capture time, time zone, local time, duration, recording type;
  - audio identity once finalized: digest and byte length;
  - progress: validation result, state, whether any request has left the phone, attempt count, the stored receipt or owner-deleted outcome once known, and any terminal intent;
  - event identities: a stable private identity for each milestone event it has produced.
  It holds no transcript or note content.
- After the audio is deleted, a slim record without audio or file token can remain. It keeps the capture ID, receipt and event identities until the milestone events are enqueued and the terminal outcome is observed, or a bounded window passes (Codex sets it).
- Storage: Application Support, deliberate file protection (suggested `completeUntilFirstUserAuthentication`), excluded from device backups.
- Pending captures survive app updates and must survive any rollback build (see Rollback).

### Invariants Codex must preserve

1. Before recording starts, the capture record (with its file token) and its file exist in durable storage. The "On your phone" row appears only once the stopped file is durably closed. The light haptic and sending begin only after it passes its check.
2. Local audio is deleted only in these two ways:
   - **Receipt cleanup:** after a validated accepted receipt is stored and its cleanup is recorded. The capture stays visible as Saved and structuring with its slim record. Upload retries stop, and processing observation continues.
   - **Terminal intent:** after a terminal intent is stored and that capture's retries, timers and responses are invalidated. That covers a validated owner-deleted outcome, a confirmed Discard, a confirmed sign-out, a confirmed account deletion, and Dismiss on confirmed-unreadable audio.
3. The recorder is enabled whenever it is not preparing, recording, or finishing, and storage and the existing AI-permission safeguard allow it.
4. No retry, relaunch, replay or resumed reservation ever creates a second recording, a second audio object, or a second processing start for the same capture. Processing starts at most once; completion is not guaranteed.
5. A recording has one representation at a time: tray or list.
6. A capture is uploaded only with its owner's own session.
   - Work from a stale account generation can never move, re-create, upload or delete a capture.
   - An account-deletion hold is stored before the deletion request is sent and restored before any sending at launch. While it exists, nothing of that account is sent, and an unconfirmed deletion never resumes sending.
7. Upload retry never restarts processing; a processing timeout is not an upload failure.
8. Copy never claims more than is known:
   - "Saved" only after a stored accepted receipt;
   - "hasn't been saved" only when never sent;
   - no claim of instant erasure.
9. Being unreadable alone never authorizes deleting, dismissing or sending audio, and audio that cannot be read yet is never treated as damaged. An explicit, confirmed Discard, sign-out or account deletion still removes a capture under the terminal-intent rules.
10. The accepted Home hierarchy, note cards, recorder shape, onboarding, the existing sign-in screen, and the existing AI-permission safeguard are unchanged.
11. No capture content or identifier reaches analytics, logs or tracked files, and file names are only the opaque local file tokens. Milestone events carry stable private identities, never capture IDs.

- Deliberately open implementation choices:
  - the storage directory and record format;
  - the backoff schedule (suggested: immediately, then 2, 10 and 30 seconds, then wait for the next trigger), and the number of automatic attempts before the failed row;
  - how connectivity is observed;
  - the digest algorithm (SHA-256 suggested);
  - whether recordings are written in segments or a container that survives a crash;
  - the storage margin;
  - how the existing sign-in screen is presented from Home;
  - the slim-record retention window;
  - how account generations are represented.

### Dependencies

From the [base review](../evidence/2026-09-28-claude-reconciliation-capture-review.md), as dispositioned in [Codex's re-review](../evidence/2026-09-28-codex-capture-rereview.md):

- **R7, before capture events ship.** The event route rejects a whole batch with 403 when one event references a recording the caller no longer owns, and the client keeps retrying that batch. Capture events queued before a sign-out, account change or deletion would stall analytics. Codex partitions events by owner and handles permanent rejection first.
- **R10, before the capture migration is called verified.** A fresh replay fails at the evaluation schedule migration unless its Vault prerequisites exist, and CI does not replay the evaluation migrations. Codex needs a deterministic isolated replay, with safe local prerequisites and the relevant pgTAP, and never imports production secrets.
- **R11, with the capture contract.** The post-processing merge-upsert re-creates rows deleted during processing. Guarded finalization under contract item 4, with deletion-during-processing tests.

## Acceptance

- Behavioral checks:
  1. Turn on Airplane Mode, record 20 seconds, stop. The tray shows the offline row and the recorder is usable at once. Force-quit and reopen: the row is still there. Turn off Airplane Mode: the row moves through saved and structuring, and one note arrives.
  2. Force an upload failure that never reaches the server. The Couldn't save row appears with three actions. Play plays the audio. Save again succeeds and one note arrives.
  3. Force a lost response after the server accepted the upload. The row reads Checking with your account, then Saved; one note arrives. Repeat with a force-quit while checking: still one note.
  4. Discard, three cases:
     - A never-sent capture: no request is sent, and the file and row are gone.
     - A result-unknown capture whose upload the server accepted: the file is gone, no deletion request is sent, and the note appears in the list after a refresh.
     - A relaunch between the stored intent and file removal: no row returns, and the file is removed at launch.
  5. Record a second capture while the first is saving. Both are sent, oldest first. The notes may finish in either order, and each shows its capture time.
  6. Deny microphone access. The recorder shows the microphone-off state and Open Settings opens the app's Settings page.
  7. Queue five captures offline. Three rows and "+ 2 more" show. Show all and Show less work.
  8. Sign out with two unsaved captures and one structuring. The confirmation says 2. After confirming, the two files are deleted and the structuring note remains in the account.
  9. A recording shown in the tray does not also appear in the list after a pull to refresh. That includes a capture whose response was lost and which the list reveals first.
  10. Processing outcomes after a receipt:
      - After a server-side processing failure, the row leaves the tray and the note shows its existing status row.
      - After poll exhaustion without a final status, the same happens with the unfinished status.
      - Stop the server after the processing claim and before processing: the note stays saved and unfinished.
      - In every case there is no re-upload, no reprocessing, and no duplicate outcome event.
  11. With an expired access token and no connection, rows read Waiting for connection, the sign-in is kept, and saving resumes on reconnect without a sign-in prompt.
  12. With a rejected sign-in, the sign-in rows and header appear and audio is kept. Signing in from Home to the same account returns to Home without onboarding, and saving resumes.
  13. Sign in to a different account while another account's captures are pending. The neutral row appears, and the previous account's cached notes are not shown. Nothing is uploaded to the new account. Discard from phone deletes them after confirmation.
  14. Sign out while an upload is in flight. A late response changes nothing and re-creates nothing.
  15. Account deletion:
      - A definite refusal while the account is valid: captures are kept and saving resumes.
      - Success: this account's captures are deleted.
      - A lost response: "Account deletion not confirmed" appears and captures are held with nothing sent, including across a relaunch. Try again resolves it.
      - Partial remote cleanup: it is treated as not confirmed.
      - An upload in flight when deletion starts is cancelled or refused by the server and never re-creates data.
      - If the hold cannot be stored, the deletion request is not sent and nothing changes.
      - A crash immediately after the request is sent, before an answer: the relaunch shows Account deletion not confirmed with captures held before anything is sent, then checks again.
  16. Receive a call while recording. The result is a Stopped early row that plays up to the interruption, a Checking the recording row if the file cannot be read yet, or an Interrupted row if the audio is confirmed unreadable.
  17. Lock the phone or leave the app while recording. On return, the result is a Stopped early row, a Checking the recording row if the file cannot be read yet, or an Interrupted row if the audio is confirmed unreadable.
  18. Force-quit during a recording. On relaunch, the result is a Stopped early row (playable), a Checking the recording row (not readable yet), or an Interrupted row (confirmed unreadable).
  19. With storage nearly full, the Not enough space state appears and recording does not start. Filling storage during a recording ends it and applies the three validation results.
  20. Leave the app during an upload and return: the row shows the current truth and one note arrives.
  21. Server contract (Codex):
      - concurrent identical replays produce one recording, one audio object and one processing claim;
      - a conflicting payload is refused without change;
      - a second owner sending the same capture ID cannot read, change or learn anything about the first owner's capture (reusing the ID alone need not be refused);
      - a zero-byte body is refused;
      - a request without capture identity behaves as today;
      - a crash after reservation, after the audio write, or before row finalization is resumed by a replay into exactly one recording;
      - a replay after the owner deleted the note returns owner-deleted and re-creates nothing;
      - the tombstone holds no digest or content and is removed with the account;
      - a receipt replay after audio retention still returns accepted;
      - reservations and finalizations are refused once account deletion starts;
      - with failures injected before and after reservation, audio write, row write, response, receipt storage, local deletion and tray/list reconciliation, a relaunch recovers the right state each time.
  22. Confirm Discard just as a retry trigger fires: nothing is sent.
  23. Discard, then let a late accepted receipt for an earlier request arrive: nothing local changes, and the note appears in the list after a refresh.
  24. Discard with storage full so the intent cannot be stored: the Couldn't discard alert appears, nothing is deleted, and nothing is sent for the rest of the session.
  25. Inspect the capture storage directory: each file is named only by its opaque token, and no file name contains a capture, owner, session or recording identifier or a digest.
  26. Make a stopped file temporarily unreadable: the Checking the recording row appears, and nothing is sent, deleted, or dismissible. When the file becomes readable on the next foreground, saving proceeds.
  27. Crash between a capture's state change and its event flush, then relaunch: the capture's `recording_uploaded`, and its later terminal outcome, are each ingested once.
  28. Turn AI processing off in Settings while captures wait offline, then reconnect. Nothing is sent. A capture that was never sent reads Couldn't save, and its Discard shows the never-sent message. A capture whose earlier request had an unknown result reads Couldn't confirm the save, and its Discard shows the result-unknown message. Turn AI processing back on: the next trigger or Save again sends each capture once, and the earlier-unknown capture resolves to exactly one note.
- Visual comparison views and sizes: compare simulator captures with the reference images below. All are synthetic browser renders of the mock. The manifest of hashes is [SHA256SUMS.txt](assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt).

| State | Light, 390 × 844 | Dark, 390 × 844 | Other sizes |
| --- | --- | --- | --- |
| Kept, saving | [image](assets/2026-09-28-home-capture-recovery/screens/kept-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/kept-dark-390x844.png) | |
| Saved, structuring | [image](assets/2026-09-28-home-capture-recovery/screens/saved-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/saved-dark-390x844.png) | |
| Recording again | [image](assets/2026-09-28-home-capture-recovery/screens/recording-light-390x844.png) | | |
| Arrived, tray gone | [image](assets/2026-09-28-home-capture-recovery/screens/arrived-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/arrived-dark-390x844.png) | |
| Offline | [image](assets/2026-09-28-home-capture-recovery/screens/offline-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/offline-dark-390x844.png) | [430 × 932](assets/2026-09-28-home-capture-recovery/screens/offline-light-430x932.png) |
| Couldn't save | [image](assets/2026-09-28-home-capture-recovery/screens/failed-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/failed-dark-390x844.png) | [430 × 932](assets/2026-09-28-home-capture-recovery/screens/failed-light-430x932.png), [375 × 667](assets/2026-09-28-home-capture-recovery/screens/failed-light-375x667.png) |
| Replaying | [image](assets/2026-09-28-home-capture-recovery/screens/playing-light-390x844.png) | | |
| Discard, never sent | [image](assets/2026-09-28-home-capture-recovery/screens/discard-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/discard-dark-390x844.png) | |
| More than three | [image](assets/2026-09-28-home-capture-recovery/screens/many-light-390x844.png) | | |
| First recording | [image](assets/2026-09-28-home-capture-recovery/screens/first-light-390x844.png) | | |
| Microphone off | [image](assets/2026-09-28-home-capture-recovery/screens/permission-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/permission-dark-390x844.png) | |
| Accessibility text size | [image](assets/2026-09-28-home-capture-recovery/screens/ax-light-390x844.png) | | [375 × 667](assets/2026-09-28-home-capture-recovery/screens/ax-light-375x667.png) |
| Sent, checking | [image](assets/2026-09-28-home-capture-recovery/screens/checking-light-390x844.png) | | |
| Couldn't confirm | [image](assets/2026-09-28-home-capture-recovery/screens/unconfirmed-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/unconfirmed-dark-390x844.png) | |
| Discard, result unknown | [image](assets/2026-09-28-home-capture-recovery/screens/discard-unconfirmed-light-390x844.png) | | |
| Sign in to save | [image](assets/2026-09-28-home-capture-recovery/screens/signin-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/signin-dark-390x844.png) | |
| Sign in, accessibility size | [image](assets/2026-09-28-home-capture-recovery/screens/ax-signin-light-390x844.png) | | [375 × 667](assets/2026-09-28-home-capture-recovery/screens/ax-signin-light-375x667.png) |
| Another account | [image](assets/2026-09-28-home-capture-recovery/screens/other-light-390x844.png) | | |
| Stopped early | [image](assets/2026-09-28-home-capture-recovery/screens/early-light-390x844.png) | | |
| Interrupted, confirmed unreadable | [image](assets/2026-09-28-home-capture-recovery/screens/interrupted-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/interrupted-dark-390x844.png) | |
| Not enough space | [image](assets/2026-09-28-home-capture-recovery/screens/storage-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/storage-dark-390x844.png) | |
| Recording not readable yet (revision 3) | [image](assets/2026-09-28-home-capture-recovery/screens/audio-check-light-390x844.png) | | |
| Account deletion not confirmed (revision 3) | [image](assets/2026-09-28-home-capture-recovery/screens/deletion-pending-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/deletion-pending-dark-390x844.png) | |

  The images are browser renders of the mock. The status bar glyphs, the system font rendering, and the native dialogs and alerts will differ on device. These have no image; their copy and behavior above are the target:
  - the sign-out dialog and the delete-account sentence;
  - the another-account discard dialog;
  - the Couldn't discard, Couldn't delete your account and Account deletion not confirmed alerts;
  - the Couldn't start recording state;
  - the expanded tray.
- Automated tests:
  - Capture store: state transitions, including crash points between every step; persistence across relaunch; retry and backoff.
  - Receipts and deletion: outcome classification for accepted, incomplete, owner-deleted, conflict, nothing held, and single-request refusal, including history that never reverts from result unknown; receipt validation and storage before receipt cleanup, with the saved row still shown; terminal-intent ordering, including intent-write failure and removal retry; the account-deletion hold written before dispatch and restored before scheduling.
  - Representation and accounts: the one-representation filter by capture binding; owner isolation and stale-callback invalidation across account generations, for refresh success and error, sign-in completion, requests and timers; per-account cached notes; account-deletion quiescing and the three result classes; sign-out.
  - Files and events: file-token naming; validation results (valid, not readable yet, confirmed unreadable); durable event enqueue with stable identities and deduplication across crashes.
  - Also: refresh error classification; interaction with the existing AI-permission safeguard; copy strings.
  - Server: the Deno and pgTAP cases in check 21, plus non-disclosing cross-owner errors and receipt validity after audio retention.
  - The existing suites must still pass: `npm run extraction:test`, `npm run privacy:check`, `npm run docs:verify`, the Node and Deno suites named in the [reconciliation plan](../evidence/2026-09-28-reconciliation-plan.md#verification-gates), and the Swift contract and AI-permission tests in `ios/Tests/`.
- Build commands: `npm run ios:build` for the simulator and `npm run ios:build:device` for the device, from an isolated copy of the tree as in earlier releases.
- Physical-device checks: checks 1–3, 5, 6, 11, 12, 16–20 and 26; low storage; VoiceOver; Reduce Motion; the largest accessibility text size. A build alone does not prove recovery.

## Measurement and safety

- Primary metric: the backlog names "`recording_started` sessions that reach `recording_uploaded`". That is a per-session funnel. A capture recovered after a relaunch uploads in a later app session, so the funnel cannot measure recovery across relaunches and will undercount it. Codex must finalize a per-capture definition in [metrics.md](../../product/metrics.md) before any recovery rate is reported, preserving cohort, reconciliation and privacy rules. That definition needs saved, discarded, lost and pending denominators, an observation window, coverage and private deduplication. Claude does not change metrics. Until then, report counts only.
- Guardrails: local storage used by pending captures (bucketed); recordings per capture (target exactly one, measured from the server contract); recording failure rate as defined in metrics.md, now restricted to terminal processing outcomes; sign-in-required and deletion-not-confirmed occurrences; captures deleted by sign-out.
- Event separation, suggested for Codex and Mike to accept or change. All are content-free, and any new event is defined in metrics.md before it is reported:
  - Attempt failures: `capture_upload_attempt_failed` with a reason category (for example offline, timeout, server, rejected, sign_in_required, not_allowed) and an attempt bucket, and `capture_upload_retried` with `auto`, `manual` or `resume`. Neither is ever `recording_failed`.
  - Unknown result: `capture_upload_unconfirmed` when a request's result is unknown.
  - Kept and lost: `capture_kept` with `complete` or `stopped_early`; `capture_interrupted` when audio is confirmed unreadable; `capture_storage_unavailable` with `insufficient_space` or `other`.
  - Discard and account actions: `capture_discarded` with `never_sent` or `result_unknown`; captures deleted by sign-out, account deletion or another-account discard, as a bucketed count.
  - `recording_uploaded`: once per capture, when its accepted receipt is stored. It carries the recording reference as today.
  - `recording_processed` and `recording_failed`: only for terminal processing outcomes after a receipt, including outcomes first observed by a later refresh. Poll exhaustion sends no terminal event.
- Delivery guarantees:
  - Each milestone event is written to the existing durable first-party event queue in the same local step that records the state change that causes it. If the event cannot be enqueued, the state change is not complete.
  - Each event carries a stable private identity stored in the capture record, so a crash and replay re-enqueue the same identity, and ingestion deduplicates on it. The same rule applies to terminal outcomes observed later.
  - The identity is random. It is never the capture ID, file token, digest or recording path, and it never reaches PostHog.
  - This requires R7 first.
- Privacy/data boundary:
  - Audio stays on the phone until the existing upload path sends it to the existing processors. There is no new processor, provider, or destination.
  - No audio, transcript, note text, capture ID, file token, digest or identifier goes into analytics, logs, or tracked files. File names are only the opaque local file tokens; no other identifier or digest appears in a file name.
  - Pending audio is excluded from backups and deleted only through a terminal intent.
  - The server keeps a minimal tombstone (owner, capture ID, deletion time) after a note is deleted, until account deletion.
  - This handoff proposes no policy change. The base review's addition A1 remains a behavior-to-policy and manifest comparison for Codex before release, and now also covers the tombstone and local file token. App Store privacy answers remain reserved for the next approved build.
- Non-goals: any change to the Home hierarchy or note cards; the running list; retry or reprocessing for stalled structuring; background recording; background upload completion; the agent-readable line; onboarding, the sign-in screen and the demo recording; any change to the AI-processing permission safeguard, its sheet, its copy or its Settings row; recording limits; providers or models; pricing; notifications; per-row actions on waiting, sign-in or held rows; App Store or TestFlight state; Private Evaluation.
- Authority class: product and design direction, selected by Mike. No approval-bound class is touched by the design. The server contract needs a migration and an API deployment, which follow the existing deployment approval rules and are not authorized by this document.
- Rollback target and procedure:
  - The presentation target is the Home in internal build 2026082801. That build has no capture store or queue, so a plain reinstall would strand pending audio on the phone.
  - The rollback target must be a newly verified, compatible build that keeps the capture store and a queue that can drain it, while reverting the tray's presentation.
  - The server contract is additive and leaves requests without capture identity unchanged. Acceptance, receipts and tombstones stay deployed while any capture-capable build may be installed.

## Decisions recorded

Mike accepted both defaults on 2026-09-28; the [decision log](../../decision-log.md) records them. They are no longer open.

- **D1, another account's captures:** one neutral row with Discard from phone after confirmation; never uploaded, played, individually listed or counted under the signed-in account. See [Another account](#another-account).
- **D2, leaving while recording:** a call, locking the phone or leaving the app ends the recording and keeps playable audio as Stopped early; background recording is outside this slice. See [Leaving the app](#leaving-the-app).

## Feasibility findings and resolution

### Revision 1, reviewed by Codex at `bda1058`

| Finding | Disposition in revision 2 |
| --- | --- |
| B1, duplicate-safe upload | Accepted. The ID-reuse assumption is replaced by the [Data and API contract](#data-and-api-contract): reservation, payload binding, receipt, single processing claim, cross-account safety, deleted-note rule, compatibility and privacy. |
| B2, reviewed base | Accepted. Base named; PR #2 follows capture recovery and is not a prerequisite merge. |
| B3, foreground or background | Accepted: durable foreground queue with four triggers; no background promise. |
| B4, expired sign-in | Accepted: offline keeps the session; rejected sign-in gets the sign-in-required state with same-account recovery; audio retained; onboarding unchanged. |
| B5, interruption | Accepted: durable record and file before recording; truthful Stopped early, Interrupted and storage states. |
| B6, failure measurement | Accepted: attempt failures, unknown results, discards and terminal outcomes separated; Codex finalizes metrics. |
| Unknown result and discard copy | Accepted: two history-based messages; Discard is local only. |
| Receipt before local deletion | Accepted: invariant 2. |
| Account switching and deletion races | Accepted: only unsaved captures counted; races specified. |
| Processing distinct from saving | Accepted: poll exhaustion is not failure; no re-upload. |

### Revision 2, re-reviewed by Codex at `372178b`

| Finding | Disposition in revision 3 |
| --- | --- |
| C1 P1, acceptance, incomplete reservation and deleted-note replay | Accepted. Contract items 3 and 6 define incomplete, accepted and owner-deleted outcomes. The tombstone holds owner, capture ID and deletion time only, until account deletion. Contract item 10 reconciles privacy with it. Invariant 2 allows cleanup after a validated owner-deleted outcome. Codex owns the transactional mechanics. |
| C2 P1, discard must finish the local lifecycle first | Accepted. [Discard is local](#discard-is-local) orders intent, invalidation, row, file and record. If the intent cannot be stored, discard fails closed with a truthful alert. After removal failure, the capture stays terminal and removal is retried. No copy claims instant erasure. Checks 4 and 22–24 cover it. |
| C3 P1, a failed account-deletion response does not prove survival | Accepted. Work is quiesced before deletion. A lost or partial answer holds every capture and resumes nothing, shows the not-confirmed alert and tray header, and survives relaunch. Only a definite refusal with a valid account resumes. Contract item 8 serializes server acceptance with deletion. Check 15 covers it. |
| C4 P2, file names | Accepted. Independent random file token; no identifier in file names; checked in check 25. |
| C5 P2, temporary unreadability | Accepted. Three validation results; not readable yet keeps everything and shows "Checking the recording…"; Dismiss only for confirmed unreadable audio. Checks 16–18 allow each outcome, and check 26 covers the not-readable-yet case. |
| C6 P2, processing, ordering and event delivery | Accepted. Oldest first is upload order only, and notes show capture time. Processing is at most once with the unfinished list row as the bounded outcome. Events are enqueued durably with stable private identities and deduplicated ingestion, including later-observed outcomes, and no capture IDs reach analytics. Checks 5, 10 and 27 cover it. |

### Revision 3 draft `9b35dd2d…`, reviewed by Codex

| Finding | Disposition in this corrected draft |
| --- | --- |
| F1 P1, a local refusal after an unknown result is not never sent | Accepted. Never sent now requires an authoritative capture-wide answer. Result unknown never reverts. The answer table separates "nothing held for this capture" from "refusal of one request only". The safeguard interplay keeps the earlier-unknown history and its discard wording. Check 28 adds the earlier-unknown case. The existing safeguard is unchanged. |
| F2 P1, receipt cleanup is not terminal | Accepted. Receipt cleanup is separate from terminal intent. It deletes audio after a stored receipt and keeps the slim record and the Saved/structuring row. It stops upload retries and keeps processing observation. Invariant 2 names both paths. |
| F3 P1, persist the deletion hold before sending | Accepted. Step 1 stores the hold before dispatch. If it cannot be stored, the request is not sent and a truthful alert appears. The hold is restored before any scheduling at launch. Check 15 covers hold failure and a crash right after dispatch. |
| F4 P2, file tokens in file names | Accepted. Only opaque local tokens may name files. Identifiers and digests never appear in file names, and tokens never reach analytics, logs or tracked evidence (contract item 10, invariant 11, privacy boundary, check 25). |
| F5 P2, owner-scoped namespace in check 21 | Accepted. Check 21 now requires that a second owner cannot access, change or learn anything about the first owner's capture; ID reuse alone need not be refused. |
| F6 P2, unreadable audio and explicit deletion | Accepted. Invariant 9 says unreadability alone never authorizes destruction, while confirmed Discard, sign-out or account deletion follows the terminal-intent rules. Checks 16 and 17 add the Checking the recording branch. |
| Evidence wording | Corrected. The 37 original images are byte-identical to the committed revision-2 manifest; only 8 were re-rendered as a control. The mock's hash changed along with the three new image lines. |

## Codex handoff

- Exact handoff revision: revision 3, uncommitted in the local, non-synced `throughline-local` checkout on `codex/reconcile-september-base`, prepared against `3faf0f2f430b4e075c7c2367809c6d6d4837064b`. Identity before commit: the asset hashes in [SHA256SUMS.txt](assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt), and the SHA-256 of this document given in the message that accompanies it, since a file cannot contain its own hash. Codex integrates and commits it; the committed revision then becomes the contract.
- Codex-owned paths: the production files listed under Production mapping, the new Swift files and tests, the server migration and tests, the slice record, and all canonical documents. Claude owns this document and its assets.
- Required evidence manifest: source revision; test results; simulator captures for every row of the visual matrix; device results for the physical checks; server contract test results; the review receipts below; rollback target.
- Readiness: `handoff_ready` since Codex's PASS on 2026-09-29 of the substantive draft `69b94cad…`. No design findings are unresolved.
- Next gate: Mike decides build entry. After that, Codex implements and verifies within the approved scope, and Claude reviews the exact implementation revision and its visual and behavior evidence before internal release.

## Mutual review receipts

- Codex feasibility review of revision 1: Codex, 2026-09-28. Handoff `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c` at `bda1058947397b7bf1b908a0a682eb3966868a54`. Verdict "feasible with required revisions"; findings B1–B6 and four additional items, resolved in revision 2. The review is kept outside the repository as a local Codex artifact.
- Codex re-review of revision 2: Codex, 2026-09-28. Handoff `75eda71e6606374145eb6f2b9fbdea807ad50f9cbd6fa2274f0908e27432c3b9`, mock `01567883ae0ff2e56beefc92f5ad43fac9b738c7b6e9daacbe4c3ddf7dd18cea`, manifest `568d552a1543269553dbdcc06e4cf98fe0092a3517db09c299b12a8b84f183cf`, base `372178b`. Verdict "feasible, changes requested"; findings C1–C6, resolved in revision 3. Receipt: [Codex re-review](../evidence/2026-09-28-codex-capture-rereview.md).
- Codex exact-draft review of revision 3 draft `9b35dd2df3a02429406cd3280c251b91f5859605d832448035967a9b2a75a43e`: Codex, 2026-09-29. Verdict "feasible, but six small contract corrections before ready"; findings F1–F6 and an evidence-wording correction, resolved in this corrected draft. Codex records its receipt in `docs/evidence/2026-09-29-capture-handoff-ready.md`.
- Codex re-review of the corrected revision 3: Codex, 2026-09-29, exact substantive draft `69b94cad3a074ea851dbd7a4f11d03954d31149a42344c994fe382a5019328a5`. Verdict PASS for design handoff readiness. F1–F6 and the evidence wording were verified resolved. All 41 manifest entries, the 37 original image identities and the 3 added images were verified. Receipt: [capture handoff ready](../evidence/2026-09-29-capture-handoff-ready.md). This covers design and source readiness only.
- Claude review of the shared base: [the reconciliation and capture review receipt](../evidence/2026-09-28-claude-reconciliation-capture-review.md) at `372178b`. It is not an implementation review.
- Claude implementation reviewer and date: pending; follows implementation.
- Exact implementation revision and visual/behavior evidence reviewed: pending.
- Design, interaction, accessibility, and failure-state findings and resolution: pending.
- Remaining unverified checks: every physical-device check, the implementation tests, and the server contract, which does not exist yet. All are future implementation obligations.
- Next owner and one next action: Mike decides build entry. Then Codex implements and verifies, and Claude reviews the implementation revision.

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
