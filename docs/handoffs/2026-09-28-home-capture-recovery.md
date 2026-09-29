---
handoff_id: "2026-09-28-home-capture-recovery"
backlog_id: "TL-CAP-001"
slice_brief: null
tandem_stage: "selected_revised_pending_codex_rereview"
handoff_revision: 2
prior_revision_sha256: "0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c"
base_revision: "372178b2b68d81691e8228443dacfebeec989e00"
created_on: "2026-09-28"
verified_on: "2026-09-28"
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

**Stage note.** This is revision 2. Revision 1 (SHA-256 `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c`, committed at `bda1058947397b7bf1b908a0a682eb3966868a54` and unchanged at `372178b`) received Codex's feasibility review on 2026-09-28 with the verdict "feasible with required revisions; not yet handoff_ready". This revision resolves those findings in the design. `selected_revised_pending_codex_rereview` is a hold, not a new canonical stage. Claude sets `handoff_ready` only after two things happen: Codex re-reviews this exact revision, and Mike answers the two product choices under [Open product choices](#open-product-choices-for-mike). This document is not implementation authority until then.

**Order.** Mike selected capture recovery first and the running list (`TL-TASK-001`) second. This slice is designed against the Home that ships today. The running list adopts the tray when it follows. [PR #2](https://github.com/mpolner88/throughline/pull/2) is deferred implementation material for that later work. It does not have to be merged before the tray is built.

**Base.** Prepared against `codex/reconcile-september-base` at `372178b2b68d81691e8228443dacfebeec989e00`, the head of draft [PR #3](https://github.com/mpolner88/throughline/pull/3). Claude's independent review of that base is recorded in [the reconciliation and capture review receipt](../evidence/2026-09-28-claude-reconciliation-capture-review.md). The shared-base review and the exact main-merge action are separate gates from this handoff.

## Revision 2 changes

| Area | Revision 1 | Revision 2 |
| --- | --- | --- |
| Durability start | Audio moved into durable storage on stop | Capture record and file exist in durable storage before recording starts; "On your phone" appears only after the stopped file is checked |
| Retry identity | "Save again retries with the same capture ID" | Owner-scoped reservation, immutable payload identity, replayable receipt and a single processing claim (see [Data and API contract](#data-and-api-contract)) |
| Local deletion | After the server confirms the upload | After a validated receipt is stored on the phone |
| Lost response | Not distinguished | New "Checking with your account…" and "Couldn't confirm the save." states |
| Discard copy | "It was never saved to your account." | Two messages: one for never sent, one for result unknown. Discard is local only. |
| Leaving the app | Open question | Foreground queue; leaving the app is never promised to finish the save. Leaving while recording ends the recording and keeps it. |
| Sign-in | Not specified | Sign-in-required state, same-account recovery, and another-account isolation |
| Interruption and storage | "Partial audio kept as a normal capture" | Stopped early, Interrupted and Not enough space states that tell the truth |
| Sign-out and account deletion | Counted every tray row | Counts only captures not confirmed as saved; covers active recording, in-flight uploads, deletion failure and stale callbacks |
| Processing | Stall leaves the tray | Unchanged, and made explicit: slow processing is not an upload failure and never triggers a re-upload |
| Measurement | `recording_failed` kept for terminal outcomes | Attempt failures, unknown results, discards and terminal outcomes are kept separate. Codex finalizes the canonical metrics before any recovery rate is reported. |

States 1–7 and 9–12 of the frozen mock and their reference images are unchanged; a control render of state 6 at this revision is byte-identical to its stored image. State 8 changed its copy. States 13–21 are new.

## Current

- What the user experiences now: a recording is written to temporary storage and exists only in memory until the upload succeeds. When the upload fails, Home shows one line of red text above the record button, and the recording cannot be replayed or retried. The record button is disabled while the upload and the processing poll run, which can take about 40 seconds. A phone call, locking the phone, or leaving the app during a recording is not handled. If a session refresh fails for any reason, including no connection, the stored sign-in is erased.
- Verification date: 2026-09-28, source inspected at `372178b`. The visual baseline is from 2026-08-29.
- Evidence type: source inspection (primary); simulator for the visual baseline. There is no physical-device, TestFlight, or public-listing reproduction of a failed upload, interruption, or sign-in loss.
- Evidence links (line numbers at `372178b`):
  - [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift) lines 44–46 write to `FileManager.default.temporaryDirectory`; there is no interruption or background handling; metadata lives only in memory (line 60).
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift) lines 185–191 render the error text; line 203 disables the recorder during upload and processing; lines 381–454 drop the file reference on failure and emit `recording_failed` with `stage: "pre_record"` for upload failures; lines 473–503 poll ten times and then stop without an outcome.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) lines 666–685 send one `POST /recordings` with no retry and no capture identity; the local-time header is taken at send time. Lines 904–916 fall back to a bundled API token when there is no session (Debug builds only).
  - [AuthClient.swift](../../ios/Throughline/Services/AuthClient.swift) lines 144–152 erase the stored session on any refresh error, including a network error; [AppState.swift](../../ios/Throughline/AppState.swift) keeps its in-memory session, and lines 79–86 show sign-out clearing notes and routing to onboarding.
  - [api/index.ts](../../supabase/functions/api/index.ts) line 1361 allocates a new recording ID per request; line 2199 stores no audio for an empty body; line 2207 overwrites stored audio (`x-upsert`); lines 2222–2239 and 2991–3002 merge-upsert the row; line 1457 writes the row again after asynchronous processing, which can re-create a row deleted during processing.
  - [Info.plist](../../ios/Throughline/Info.plist) declares no background audio mode.
  - [Design audit, 2026-08-29](../evidence/2026-08-29-design-direction-portfolio-audit.md), [repository experience audit, 2026-08-29](../evidence/2026-08-29-repository-experience-workflow-audit.md) (rates this P0), and [return audit, 2026-09-28](../evidence/2026-09-28-return-audit.md).
- Known evidence gaps: real failure frequency is unknown. The recording-failure guardrail reported 0 of 0 for the trailing week, and the current event cannot tell upload failures from processing failures. There is no device test of interruption, low storage, background behavior, or sign-in loss.

## User problem

- One problem: a person speaks a thought they could not stop to type, and the app can lose it without any way to recover it.
- Who experiences it: any signed-in person recording from Home whose upload fails, whose connection drops, whose recording is interrupted, or whose sign-in lapses before the upload completes. The product is for capture while driving or walking, where connectivity is least reliable.
- Why it matters now: it is rung one of the outcome ladder in [PRODUCT.md](../PRODUCT.md), "capture without loss". Mike selected it first on 2026-09-28.

## Evidence

- Decision-ready evidence: the source defects above are direct and reproducible by reading. Codex's feasibility review confirmed them independently at `bda1058`.
- Assumptions: upload failures and interruptions happen often enough to matter for people recording on the move. A person who sees their capture waiting will trust the recorder more than one who sees a transient confirmation.
- Unknowns: failure and interruption frequency; how often people record a second thought within 40 seconds of the first; how much local storage pending captures use in practice; how often a sign-in is rejected (as opposed to failing offline).

## Canonical fit

- Product principles: speed (capture is never blocked by saving); trustworthy structure; traceability (replay your own voice); quiet disclosure (every row states only what is known).
- Brand/design principles from [throughline-brand-decisions.md](../../throughline-brand-decisions.md): 1 voice before interface; 3 preserve the user's words; 4 quiet hierarchy; 5 one role per item; 7 let blue mean something; 8 be native where trust matters; 9 gestures additive (this slice adds none); 10 earn disclosure; 11 accessible calm. The recorder keeps its accepted full-width blue shape.
- Relevant decisions: [decision log](../../decision-log.md) 2026-08-28 (Home rollback), 2026-08-30 (handoffs are the contract), 2026-09-28 (role split with mutual review; capture-first order and Candidate B recorded; privacy policy text approved).
- Backlog state: `TL-CAP-001` is `awaiting_mock_approval` in [backlog.json](../../product/backlog.json) as of 2026-09-28. Codex owns backlog updates. This handoff does not edit the backlog.
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
- Reading of that record: capture recovery was shown to Mike as the tray in both presentations on 2026-09-28. This handoff treats the statement as selecting that design, which the [decision log](../../decision-log.md) and backlog also record. Candidates A and C were shown on 2026-08-30 and are recorded as not selected. Revision 2 does not reopen the selection.
- Required revisions made by Claude in revision 1 to bound the first slice:
  1. The line "Saved · readable by your agent" is removed. `AppState.hasConnectedAgent` is declared and never set, so the claim has no behavior behind it. It returns with the agent-connection work.
  2. Retry for stalled structuring is deferred. The API has no re-process route. After a receipt, a recording that stalls or fails on the server leaves the tray and appears in the list with its existing status row, as it does today.
  3. The offline header is shortened to "2 captures waiting to save" so it fits one line at 390 points.
  4. States added that the August mock did not show: replay in progress, more than three captures, a first recording on the empty Home, and signing out with unsaved captures.
- Revisions made by Claude in revision 2 in response to Codex's feasibility review: listed in [Revision 2 changes](#revision-2-changes) and dispositioned finding by finding under [Feasibility findings and resolution](#feasibility-findings-and-resolution).
- Rejected alternatives and why: A, because it puts unsaved content into the plan list. C, because it adds a sheet to a flow that must stay free of ceremony while driving.

## Selected experience

Frozen target: [selected-mock.html](assets/2026-09-28-home-capture-recovery/selected-mock.html). Open it for the gallery of 21 states, or add `?only=<state>` for one state (for example `?only=unconfirmed`). Add `theme=dark` for dark appearance.

### Words used below

- **Capture**: one recording on this phone, from the moment recording starts until it has a stored receipt, is discarded, or is deleted by an account action.
- **Owner**: the account that was signed in, or shown on Home, when the capture was started. It never changes.
- **Receipt**: the server's answer that binds this owner and this capture to one saved recording with confirmed audio. The phone checks it and stores it before acting on it.
- **Never sent**: no request for this capture has left the phone, or the owner's account has confirmed it holds nothing for it.
- **Result unknown**: a request left the phone and no valid receipt came back. The account may or may not hold the recording.

### Primary flow

- Entry: the person taps the record button on Home, speaks, and taps to stop. Nothing about starting or stopping looks different.
1. Before recording starts, the app creates the capture's record (owner, capture time, time zone, local time, type) and its audio file in durable app storage. If it cannot, recording does not start. See [Storage](#storage).
2. While recording, the recorder is unchanged.
3. On stop, the file is closed and checked. Only after that succeeds does a row appear in the tray: "**On your phone.** Saving to your account…", with one light haptic. The recorder returns to idle and is usable at once.
4. The app sends the capture under its owner's own sign-in and with its fixed identity. It retries on its own with backoff while the row keeps the same text.
5. When a valid receipt arrives and has been stored on the phone, the row reads "**Saved to your account.** Structuring your note…". Only then is the local audio deleted.
6. When the note is processed, the row leaves the tray and the note appears in Today's plan exactly as notes appear today. When the tray is empty it is not drawn.

- Exit: the tray empties and Home is exactly the accepted Home.
- One representation: a recording shown in the tray is not also shown in the list. It appears in the list only after it leaves the tray. A list refresh that reveals a recording bound to a capture still in the tray does not show it twice. The phone adopts that recording as the capture's receipt (after the same checks) and the capture leaves the tray. Captures and recordings are matched only by that binding, never by time, duration, or note text.

### Waiting, failure and uncertainty

- **Offline:** "**On your phone.** Waiting for connection." With two or more captures waiting, a header reads "2 captures waiting to save". Saving resumes on its own when the connection returns, oldest first. A sign-in that cannot be refreshed because there is no connection is treated as offline. The sign-in is kept, and no sign-in prompt appears.
- **Transient failure:** the app retries on its own with backoff while the row still reads "Saving to your account…".
- **Sent, answer lost:** when a request left the phone and no valid receipt came back, the row reads "**On your phone.** Checking with your account…" while the app asks again with the same capture identity. If the account already holds it, the same receipt comes back and the row moves to Saved. Nothing is ever uploaded twice as a second note.
- **Couldn't save:** after the automatic retries are used up, a capture that was never sent, or that the account refused without saving, reads "**Couldn't save.** Still on your phone." It has three actions. **Save again** retries with the same capture identity. **Play** plays the audio and becomes **Stop** while playing. **Discard** asks for confirmation, then deletes the phone's copy.
- **Couldn't confirm the save:** after the retries are used up, a capture whose result is unknown reads "**Couldn't confirm the save.** Still on your phone." It has the same three actions. Save again is safe: it can only return the same note or save it once.
- **App closed or crashed:** on next launch every capture that still has audio on the phone reappears in the tray and saving resumes. A capture that had a stored receipt but no final note appears in the list with its existing status row, not in the tray.
- **Slow or failed processing after a receipt:** see revision 1, item 2. When the ten polls end without a final status, that is not a failure. The row leaves the tray and the note shows its existing unfinished status row in the list; later refreshes update it. The app never re-uploads audio to restart processing. Reprocessing is outside this slice.
- **A note the owner deleted:** if a capture's result was unknown and the owner has since deleted the matching note from the list, asking again must not bring the note back. The capture leaves the tray quietly and its audio is deleted.

### Leaving the app

Saving runs while Throughline is open. The queue resumes on launch, on returning to the foreground, when the connection returns, and on Save again.

- Leaving the app during an upload: the system may let the request finish or may stop it. Nothing on screen or in copy promises that saving continues in the background. There is no notification. On return, the row shows the current truth. A request that may have been cut off is treated as result unknown and resolved with the same capture identity.
- Leaving the app, locking the phone, or taking a call while recording: the recording ends at that moment and what was recorded is kept. The row reads "**On your phone.** Stopped early. Saving to your account…". Recording does not continue in the background and does not resume by itself. Background recording is a separate product decision (open choice D2).

### Stopped early and interrupted

- **Stopped early:** a call, leaving the app, reaching full storage, or a relaunch after a crash can end a recording before the person tapped stop. If the file is playable, it becomes a normal capture with the row "**On your phone.** Stopped early. Saving to your account…". When it is saved, it reads like any other saved capture.
- **Interrupted, nothing recoverable:** if the file cannot be played, the row reads "**Recording interrupted.** The audio couldn't be recovered." with one action, **Dismiss**. Dismiss removes the leftover record and file without a confirmation, because nothing usable remains. The duration shows the last known length, or is blank when it is not known. The row stays until dismissed and is never uploaded.
- The design does not promise that every interrupted recording is intact. Device checks decide which interruptions leave playable audio.

### Storage

- Before recording starts, the app checks that it can create the file and hold a full five-minute recording. The margin is Codex's choice.
- Not enough space: recording does not start. The recorder shows "Not enough space to record" and "Free up storage on this phone, then try again. Your notes are unaffected." Tapping it checks again. No "On your phone" text or haptic appears.
- Any other storage failure before recording: the recorder shows "Couldn't start recording" and "Tap to try again. Your notes are unaffected."
- Storage running out during a recording ends it as Stopped early (if the file is playable) or Interrupted (if not).

### Sign-in required

- Trigger: the owner's account rejects the phone's sign-in. A refresh that fails for lack of connection is not this state; it is offline.
- Home stays on screen with the notes it already shows. The tray header reads "2 captures waiting to save" (or "1 capture…") with a **Sign in** action on the right, shown even for one capture. Each row reads "**On your phone.** Waiting for sign-in." Rows have no per-row actions in this state.
- **Sign in** opens the existing sign-in screen, the one reached from the onboarding hero's Sign in, without changing it. Codex chooses how to present it from Home. Onboarding itself does not change.
- The recorder stays available. New captures belong to the account shown on Home and wait for its sign-in.
- The red refresh-error line is not shown for this condition; the tray header is the one explanation. If the tray is empty when a sign-in is rejected, behavior is unchanged from today.
- A rejected sign-in never deletes captures. Only a confirmed Discard, a confirmed sign-out, or a successful account deletion does.
- At the next launch after a rejected sign-in, the app opens onboarding as it does today. Signing in to the same account returns to Home, and saving resumes.
- Signing in to a different account: see [Another account](#another-account).

### Another account

This is the recommended default and needs Mike's confirmation (open choice D1).

- Captures belong to their owner. While a different account is signed in, those captures are never uploaded, played, listed as the current account's, or counted in its sign-out.
- The tray shows one neutral row: "**2 captures from another account.** Sign in to that account to save them." with one action, **Discard from phone**. It asks "Discard 2 captures from another account?" with "They'll be deleted from this phone. Any that already reached that account stay there." and the buttons Discard from phone and Cancel.
- If the owner signs in again later, the captures resume as normal.

### Discard is local

- Discard deletes the phone's copy of one capture. It never deletes anything from the account and never sends a request.
- Never sent: "The audio will be deleted from this phone. It hasn't been saved to your account."
- Result unknown: "This deletes the audio from this phone only. If it already reached your account, the note will still appear in your list." If it did, the note arrives in the list after a refresh, where the existing note deletion applies.
- Which message appears depends on the capture's history, not on its current row text. A capture that shows "Waiting for connection" after a request left the phone uses the result-unknown message.

### Sign-out, account deletion and account isolation

- **Unsaved captures** means the signed-in account's captures that still have audio on this phone and no stored receipt. That includes waiting, saving, checking, couldn't save, couldn't confirm, and stopped early. It excludes saved and structuring rows (the account already holds them), interrupted rows with no audio, and another account's captures.
- **Sign-out with no unsaved captures:** unchanged from today.
- **Sign-out with unsaved captures:** a confirmation appears first: "Sign out?" / "2 captures haven't been confirmed as saved to your account. Signing out deletes them from this phone." / Sign out and delete · Cancel. Cancel changes nothing. Confirming cancels this account's in-flight requests and timers, deletes those captures' audio and records, and then signs out as today. Another account's captures are kept.
- **Recording in progress** when the person taps Sign out or Delete account: the recording is stopped and kept first, then counted in the dialog. If they cancel, it stays in the tray as a normal capture.
- **In-flight uploads at sign-out:** a response that arrives after sign-out is ignored. It cannot re-create a deleted capture, attach it to another account, or change the tray. The server may still have saved the recording; the dialog wording covers that.
- **Local deletion failure:** if a file cannot be deleted, its capture is marked for deletion, never shown or uploaded again under any account, and deletion is retried at next launch.
- **Account deletion:** the existing "Delete account?" confirmation adds, when any are unsaved, "2 captures that haven't been confirmed as saved will also be deleted from this phone." On confirm, this account's queue is paused and the existing deletion request is sent. Only after it succeeds are all of this account's local captures and receipts deleted, and sign-out happens as today. If the deletion request fails, nothing local is deleted, the queue resumes, and the existing error appears.
- **Isolation:** a capture is sent only with its owner's own sign-in. It is never sent with a shared or service credential, or with another account's sign-in. Requests, responses, retries and timers started under one account are discarded when the signed-in account changes or signs out. None of them can move, re-create, upload or delete a capture of a different account.

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
| Row, sent and checking | **On your phone.** Checking with your account… |
| Row, saved and structuring | **Saved to your account.** Structuring your note… |
| Row, offline | **On your phone.** Waiting for connection. |
| Row, sign-in required | **On your phone.** Waiting for sign-in. |
| Rows while the recorder is expanded for recording | **On your phone.** Saving… / **On your phone.** Checking… / **On your phone.** Waiting. / **Saved.** Structuring… |
| Tray header, two or more waiting, or any waiting for sign-in | 2 captures waiting to save |
| Tray header action, sign-in required | Sign in |
| Row, failed, never confirmed | **Couldn't save.** Still on your phone. |
| Row, failed, result unknown | **Couldn't confirm the save.** Still on your phone. |
| Actions on a failed row | Save again · Play · Discard |
| Play while playing | Stop |
| Row, interrupted with no usable audio | **Recording interrupted.** The audio couldn't be recovered. |
| Action on an interrupted row | Dismiss |
| Row, another account's captures | **2 captures from another account.** Sign in to that account to save them. |
| Action on that row | Discard from phone |
| Collapsed row | + 2 more · Show all |
| Expanded row | Show less |
| Discard dialog title | Discard this capture? |
| Discard dialog message, never sent | The audio will be deleted from this phone. It hasn't been saved to your account. |
| Discard dialog message, result unknown | This deletes the audio from this phone only. If it already reached your account, the note will still appear in your list. |
| Discard dialog buttons | Discard from phone · Cancel |
| Another-account discard title | Discard 2 captures from another account? |
| Another-account discard message | They'll be deleted from this phone. Any that already reached that account stay there. |
| Another-account discard buttons | Discard from phone · Cancel |
| Sign-out dialog title | Sign out? |
| Sign-out dialog message | 2 captures haven't been confirmed as saved to your account. Signing out deletes them from this phone. |
| Sign-out dialog buttons | Sign out and delete · Cancel |
| Sentence added to the delete-account dialog | 2 captures that haven't been confirmed as saved will also be deleted from this phone. |
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
| VoiceOver, interrupted | Recording interrupted. The audio couldn't be recovered. |
| VoiceOver, sign-in required | Sign in to save 2 captures. |

  Durations render in the monospaced digit style as `0:42`. Counts use the singular "1 capture" where it applies. Bold marks the clause that is a durable fact; the clause after it is the current activity. No copy says or implies that saving continues after the person leaves the app.
- Copy that is removed: the button labels "Saving your voice note…" and "Structuring your plan…", the supporting line "Saving your note and extracting to-dos", and the footer word "saved". The footer word "syncing" stays. The red error line stays for errors that are not about a capture, such as a failed task toggle or refresh, except while sign-in is required.
- Motion: a row fades in when it appears. When a note is processed the row slides up and fades as the note appears in the list, in about 0.25 seconds. Text changes inside a row do not animate.
- Haptics/audio: one light impact when a capture is kept, only after the stopped file is checked. One warning notification haptic when a capture reaches a failed or interrupted state while the app is in the foreground. Play uses the normal playback route. Starting a recording stops playback. Playback stops when the app leaves the foreground.

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | Saving, checking and structuring rows with staged copy. The recorder is never busy because of saving or structuring. | `kept`, `checking`, `saved`, `recording` screens |
| Empty | No captures in flight: no tray. Home and recorder are exactly as accepted. A first recording on the empty Home shows the tray above "Record today's plan". | `arrived`, `first` screens |
| Error/retry | Couldn't save and Couldn't confirm rows with Save again, Play, Discard. Save again never creates a second note. Rows persist across launches until saved or discarded. Interrupted rows offer Dismiss only. | `failed`, `unconfirmed`, `playing`, `discard`, `discard-unconfirmed`, `interrupted` screens; behavioral checks 2–4, 16–18 |
| Offline/degraded | Rows read "Waiting for connection." No alarm color. Recording stays available. Saving resumes oldest first. An offline refresh never signs the person out. | `offline`, `many` screens; behavioral checks 1, 11 |
| Sign-in and account | Sign-in rows with one header action; another account's captures as one neutral row. | `signin`, `ax-signin`, `other` screens; behavioral checks 12–15 |
| Permission denied | Recorder shows title, support line, and Open Settings, which opens this app's page in Settings. | `permission` screen |
| Storage | Recorder shows Not enough space or Couldn't start recording; tapping re-checks. | `storage` screens; behavioral check 19 |
| Long/localized content | Row text wraps to any number of lines. The longest capture, 4:58, renders like the shortest. More than three rows collapse. German-length strings must wrap, not truncate. | `many`, `ax`, `ax-signin` screens |
| Light and dark appearance | Tray uses the background and hairline tokens only. Blue appears on the live dot, the primary action, and the text buttons, including Sign in. | dark screens in the matrix |
| Dynamic Type | All tray text uses semantic text styles, not fixed sizes. At accessibility sizes the actions stack full width, the row aligns to the top, and the header action drops below its label. | `ax` and `ax-signin` screens at 390 × 844 and 375 × 667 |
| VoiceOver/focus order | The tray is a labeled region read before the recorder. Each row reads duration, then the durable fact, then the activity. Actions follow their row; the Sign in header action is read before the rows. One announcement per state change, never per poll or retry. | VoiceOver pass on device |
| Reduce Motion | The spinner is a static glyph. Rows appear and leave with a crossfade or no animation. No sliding. | Reduce Motion pass on device |

## Production mapping

- Existing components to reuse: `RecordButton`, `Eyebrow`, `Theme` tokens, the hairline `Divider`, the native `confirmationDialog`, the existing sign-in screen, and `ProcessingStatusRow` for notes in the list.
- Files likely affected (Codex owns the final list):
  - [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift): record directly into durable storage; storage pre-check; interruption and background handling that ends and keeps the recording; finalize and validate on stop.
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift): `bottomRecorder`, `stopAndUploadRecording`, recorder title and busy logic, the footer, list filtering by capture binding, and events.
  - [SharedComponents.swift](../../ios/Throughline/Views/SharedComponents.swift): microphone-off and storage presentations for `RecordButton`; the sign-out and delete-account confirmations in `AccountSettingsView`.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift): upload from file with the capture identity and capture-time headers from the stored record; require the owner's session for captures, with no API-token fallback; validate the receipt.
  - [AuthClient.swift](../../ios/Throughline/Services/AuthClient.swift) and [AppState.swift](../../ios/Throughline/AppState.swift): separate a network refresh failure (keep the session) from a rejected sign-in (sign-in required, without calling `signOut()`); owner-bound lifecycle; cancel and invalidate work on sign-out or account change; account-deletion ordering.
  - New, names suggested: `Services/CaptureStore.swift`, `Services/CaptureQueue.swift`, `Views/CaptureTrayView.swift`, and tests under `ios/Tests/`.
  - Server, narrowly scoped (see [Data and API contract](#data-and-api-contract)): [api/index.ts](../../supabase/functions/api/index.ts) and its Deno tests; one forward migration under `supabase/migrations/` with pgTAP tests under `supabase/tests/`.
- New assets/tokens: none. SF Symbols only. Suggested: `exclamationmark.circle` for failed and interrupted, `play.fill` and `stop.fill`, a hollow circle for waiting.

### Data and API contract

Codex owns the mechanics; these are the properties the design depends on. Merely reusing an ID with the current overwrite and merge-upsert behavior is unsafe and does not meet them.

1. **Owner-scoped atomic reservation.** The first request for a capture reserves the pair of authenticated owner and capture ID atomically. A request without a user session (service or API-token context) cannot create or replay a capture.
2. **Immutable payload identity.** The reservation binds a digest and byte length of the exact audio, plus the capture-time metadata that defines the recording. The capture time, time zone and local time are the ones stored when recording started, not the retry time. A later request with the same owner and capture ID but a different payload is rejected without changing anything. A zero-byte body is rejected and never produces a receipt.
3. **Replayable durable receipt.** A replay with the same owner, capture and payload returns the same receipt without storing audio again and without starting processing again. The receipt binds owner, capture ID, recording ID, and confirmed audio byte length and digest. It stays valid after the 30-day audio retention window. Audio is written without overwrite.
4. **Single processing claim.** Processing starts at most once per recording, whichever request wins. The final processing write must not re-create a row the owner deleted while processing ran. Today's merge-upsert at line 1457 can do exactly that.
5. **Cross-account safety.** The same capture ID from a different owner never reads, reveals, or changes the first owner's recording.
6. **Deleted notes stay deleted.** A replay for a capture whose recording the owner deleted does not re-create it. How that is remembered is Codex's choice. It may hold no audio-derived data and must be deleted with the account.
7. **Reconciliation by binding.** The owner's own list and detail responses expose the capture binding for recordings created from a capture, so a lost response can be reconciled without heuristics.
8. **Compatibility.** Requests without capture identity keep today's behavior. That covers the public 1.0.4 app, the JSON demo-save path, and the demo route. Existing response fields keep their meaning; new fields are additive.
9. **Privacy.** Capture IDs and digests never go to analytics, logs, file names, or tracked evidence. Reservation data lives only in service-role-only tables with RLS enabled and no client grants, and is removed with the recording or the account.

Likely scope: one forward migration and RPC for the reservation, payload binding, receipt and processing claim, with pgTAP tests. Also changes to `handlePostRecording`, `createRecordingFromRaw`, `storeAudio`, `persistRecording` and the processing write for the capture path only, with Deno tests. The base's CI replays only the measurement migrations, and the evaluation schedule migration fails a fresh replay unless its Vault secrets exist (see the [base review](../evidence/2026-09-28-claude-reconciliation-capture-review.md)). Codex therefore needs a working local replay for the new migration. Deploying the migration and the API remains separately gated and is not authorized by this document.

### Capture record on the phone

- Each capture gets a random UUID before recording starts. The file name is that UUID. No account, session or recording identifier appears in a file name.
- The capture record holds only: capture ID, owner account ID, capture time, time zone, local time, duration, recording type, audio digest and byte length once finalized, state, whether any request has left the phone, attempt count, the stored receipt once known, and whether `recording_uploaded` has been sent. It holds no transcript or note content.
- Storage: Application Support, deliberate file protection (suggested `completeUntilFirstUserAuthentication`), excluded from device backups.
- Pending captures survive app updates and must survive any rollback build (see Rollback).

### Invariants Codex must preserve

1. The capture record and its file exist in durable storage before recording starts. The "On your phone" row and its haptic appear only after the stopped file is checked.
2. Local audio is deleted only after a valid receipt is stored on the phone, or after a confirmed Discard, a confirmed sign-out, a successful account deletion, or Dismiss of an unrecoverable capture.
3. The recorder is enabled whenever it is not preparing, recording, or finishing, and storage allows it.
4. No retry, relaunch, or replay ever creates a second recording, a second audio object, or a second processing start for the same capture.
5. A recording has one representation at a time: tray or list.
6. A capture is uploaded only with its owner's own session. Stale callbacks after sign-out or an account change can never move, re-create, upload or delete a capture.
7. Upload retry never restarts processing; a processing timeout is not an upload failure.
8. Copy never claims more than is known: "Saved" only after a stored receipt, "hasn't been saved" only when never sent.
9. The accepted Home hierarchy, note cards, recorder shape, onboarding and the existing sign-in screen are unchanged.
10. No capture content or identifier reaches analytics, logs or tracked files.

- Deliberately open implementation choices: storage directory and record format; backoff schedule (suggested: immediately, then 2, 10 and 30 seconds, then wait for the next trigger); how connectivity is observed; the digest algorithm (SHA-256 suggested); whether recordings are written in segments or a container that survives a crash; the storage margin; how the existing sign-in screen is presented from Home; the number of automatic attempts before the failed row.

## Acceptance

- Behavioral checks:
  1. Turn on Airplane Mode, record 20 seconds, stop. The tray shows the offline row and the recorder is usable at once. Force-quit and reopen: the row is still there. Turn off Airplane Mode: the row moves through saved and structuring, and one note arrives.
  2. Force an upload failure that never reaches the server. The Couldn't save row appears with three actions. Play plays the audio. Save again succeeds and one note arrives.
  3. Force a lost response after the server accepted the upload. The row reads Checking with your account, then Saved; one note arrives. Repeat with a force-quit while checking: still one note.
  4. Discard a never-sent capture: no request is sent, the file is gone, the row is gone. Discard a result-unknown capture whose upload the server accepted: the file is gone, no deletion request is sent, and the note appears in the list after a refresh.
  5. Record a second capture while the first is saving. Both arrive, oldest first.
  6. Deny microphone access. The recorder shows the microphone-off state and Open Settings opens the app's Settings page.
  7. Queue five captures offline. Three rows and "+ 2 more" show. Show all and Show less work.
  8. Sign out with two unsaved captures and one structuring. The confirmation says 2. After confirming, the two files are deleted and the structuring note remains in the account.
  9. A recording shown in the tray does not also appear in the list after a pull to refresh. That includes a capture whose response was lost and which the list reveals first.
  10. After a server-side processing failure, the row leaves the tray and the note shows its existing status row. After poll exhaustion without a final status, the same happens with the unfinished status. No re-upload and no duplicate outcome event.
  11. With an expired access token and no connection, rows read Waiting for connection, the sign-in is kept, and saving resumes on reconnect without a sign-in prompt.
  12. With a rejected sign-in, the sign-in rows and header appear, audio is kept, and signing in to the same account resumes saving.
  13. Sign in to a different account while another account's captures are pending. The neutral row appears; nothing is uploaded to the new account; Discard from phone deletes them after confirmation.
  14. Sign out while an upload is in flight. A late response changes nothing and re-creates nothing.
  15. Make account deletion fail: captures are kept and saving resumes. Make it succeed: this account's captures are deleted.
  16. Receive a call while recording: a Stopped early row appears and plays up to the interruption.
  17. Lock the phone or leave the app while recording: a Stopped early row appears on return.
  18. Force-quit during a recording: on relaunch a Stopped early row (if playable) or an Interrupted row (if not) appears.
  19. With storage nearly full, the Not enough space state appears and recording does not start. Filling storage during a recording ends it as Stopped early or Interrupted.
  20. Leave the app during an upload and return: the row shows the current truth and one note arrives.
  21. Server contract (Codex): concurrent identical replays produce one recording, one audio object and one processing claim. A conflicting payload and a cross-account replay are rejected without change. A zero-byte body is rejected. A request without capture identity behaves as today. A replay after the owner deleted the note does not re-create it. Inject failures before and after reservation, audio write, row write, response, receipt storage, local deletion and tray/list reconciliation; relaunch recovers the right state each time.
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
| Discard, never sent (revised copy) | [image](assets/2026-09-28-home-capture-recovery/screens/discard-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/discard-dark-390x844.png) | |
| More than three | [image](assets/2026-09-28-home-capture-recovery/screens/many-light-390x844.png) | | |
| First recording | [image](assets/2026-09-28-home-capture-recovery/screens/first-light-390x844.png) | | |
| Microphone off | [image](assets/2026-09-28-home-capture-recovery/screens/permission-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/permission-dark-390x844.png) | |
| Accessibility text size | [image](assets/2026-09-28-home-capture-recovery/screens/ax-light-390x844.png) | | [375 × 667](assets/2026-09-28-home-capture-recovery/screens/ax-light-375x667.png) |
| Sent, checking (new) | [image](assets/2026-09-28-home-capture-recovery/screens/checking-light-390x844.png) | | |
| Couldn't confirm (new) | [image](assets/2026-09-28-home-capture-recovery/screens/unconfirmed-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/unconfirmed-dark-390x844.png) | |
| Discard, result unknown (new) | [image](assets/2026-09-28-home-capture-recovery/screens/discard-unconfirmed-light-390x844.png) | | |
| Sign in to save (new) | [image](assets/2026-09-28-home-capture-recovery/screens/signin-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/signin-dark-390x844.png) | |
| Sign in, accessibility size (new) | [image](assets/2026-09-28-home-capture-recovery/screens/ax-signin-light-390x844.png) | | [375 × 667](assets/2026-09-28-home-capture-recovery/screens/ax-signin-light-375x667.png) |
| Another account (new) | [image](assets/2026-09-28-home-capture-recovery/screens/other-light-390x844.png) | | |
| Stopped early (new) | [image](assets/2026-09-28-home-capture-recovery/screens/early-light-390x844.png) | | |
| Interrupted (new) | [image](assets/2026-09-28-home-capture-recovery/screens/interrupted-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/interrupted-dark-390x844.png) | |
| Not enough space (new) | [image](assets/2026-09-28-home-capture-recovery/screens/storage-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/storage-dark-390x844.png) | |

  The images are browser renders of the mock. The status bar glyphs, the system font rendering, and the native dialogs will differ on device. The sign-out dialog, the delete-account sentence, the another-account discard dialog, the Couldn't start recording state and the expanded tray have no image; their copy and behavior above are the target.
- Automated tests: capture store state transitions, including crash points between every step; persistence across relaunch; retry and backoff; receipt validation and storage before local deletion; the one-representation filter by capture binding; owner isolation and stale-callback invalidation; deletion on Discard, sign-out and account deletion, plus the account-deletion failure path; refresh error classification; copy strings. Server: the Deno and pgTAP cases in check 21. The existing suites must still pass: `npm run extraction:test`, `npm run privacy:check`, `npm run docs:verify`, the Node and Deno suites named in the [reconciliation plan](../evidence/2026-09-28-reconciliation-plan.md#verification-gates), and the Swift contract tests in `ios/Tests/`.
- Build commands: `npm run ios:build` for the simulator and `npm run ios:build:device` for the device, from an isolated copy of the tree as in earlier releases.
- Physical-device checks: checks 1–3, 5, 6, 11, 12 and 16–20; low storage; VoiceOver; Reduce Motion; the largest accessibility text size. A build alone does not prove recovery.

## Measurement and safety

- Primary metric: the backlog names "`recording_started` sessions that reach `recording_uploaded`". That is a per-session funnel. A capture recovered after a relaunch uploads in a later app session, so the funnel cannot measure recovery across relaunches and will undercount it. Codex must finalize a per-capture definition in [metrics.md](../../product/metrics.md) before any recovery rate is reported, preserving cohort, reconciliation and privacy rules. An example is captures kept that reach a stored receipt, split into saved, discarded, lost and still pending. Claude does not change metrics. Until then, report counts only.
- Guardrails: local storage used by pending captures (bucketed); recordings per capture (target exactly one, measured from the server contract); recording failure rate as defined in metrics.md, now restricted to terminal processing outcomes; sign-in-required occurrences; captures deleted by sign-out.
- Event separation, suggested for Codex and Mike to accept or change. All are content-free, and any new event is defined in metrics.md before it is reported:
  - Attempt failures: `capture_upload_attempt_failed` with a reason category (for example offline, timeout, server, rejected, sign_in_required) and an attempt bucket, and `capture_upload_retried` with `auto`, `manual` or `resume`. Neither is ever `recording_failed`.
  - Unknown result: `capture_upload_unconfirmed` when a request's result is unknown.
  - Kept and lost: `capture_kept` with `complete` or `stopped_early`; `capture_interrupted` when nothing is recoverable; `capture_storage_unavailable` with `insufficient_space` or `other`.
  - Discard and account actions: `capture_discarded` with `never_sent` or `result_unknown`; captures deleted by sign-out, account deletion or another-account discard as a bucketed count.
  - `recording_uploaded`: sent exactly once per capture, when its receipt is stored, across retries and relaunches. It carries the recording reference as today.
  - `recording_processed` and `recording_failed`: only for terminal processing outcomes after a receipt. Poll exhaustion sends no terminal event. If a later refresh reveals the terminal status, Codex decides whether the client sends it once.
- Dependency from the base review: the base now rejects a whole event batch with 403 when one event references a recording the caller no longer owns, and the client keeps retrying that batch. Capture events queued before a sign-out or deletion would stall analytics. Codex resolves this before capture events ship. See the [base review](../evidence/2026-09-28-claude-reconciliation-capture-review.md).
- Privacy/data boundary: audio stays on the phone until the existing upload path sends it to the existing processors. There is no new processor, provider, or destination. No audio, transcript, note text, capture ID, digest or identifier goes into analytics, logs, file names, or tracked files. Pending audio is excluded from backups and deleted on Discard, sign-out and account deletion. This handoff does not change the approved privacy policy bytes. The [base review](../evidence/2026-09-28-claude-reconciliation-capture-review.md) records one disclosure check for Codex and Mike (addition A1). App Store privacy answers remain reserved for the next approved build.
- Non-goals: any change to the Home hierarchy or note cards; the running list; retry or reprocessing for stalled structuring; background recording; background upload completion; the agent-readable line; onboarding, the sign-in screen and the demo recording; recording limits; providers or models; pricing; notifications; per-row actions on waiting or sign-in rows; App Store or TestFlight state; Private Evaluation.
- Authority class: product and design direction, selected by Mike. No approval-bound class is touched by the design. The server contract needs a migration and an API deployment, which follow the existing deployment approval rules and are not authorized by this document.
- Rollback target and procedure: the Home presentation in internal build 2026082801. That build has no capture store or queue, so a plain revert would strand pending audio on the phone. Any rollback build keeps the capture store and a queue that can drain it. The server contract is additive and leaves requests without capture identity unchanged; it stays deployed while any capture-capable build is installed.

## Open product choices for Mike

- **D1, another account's captures.** Recommended: the neutral row and Discard from phone described under [Another account](#another-account). Alternatives: keep them hidden until the owner signs in (quiet, but invisible audio stays on the phone), or ask at sign-in whether to delete them (touches the sign-in flow). The build needs one answer.
- **D2, recording when the app leaves the foreground.** Recommended for this slice: a call, locking the phone, or leaving the app ends the recording and keeps it as Stopped early. The app has no background audio mode today. Recording through a locked screen would be a new capability with its own privacy indicator, review and disclosure questions, and belongs in a separate decision.

## Feasibility findings and resolution

Codex's review of revision 1 (`0aab1100…`, at `bda1058`), with Claude's disposition in this revision. Codex re-reviews each disposition.

| Finding | Disposition in revision 2 |
| --- | --- |
| B1, duplicate-safe upload | Accepted. The ID-reuse assumption is replaced by the [Data and API contract](#data-and-api-contract): reservation, payload binding, replayable receipt and a single processing claim, plus cross-account safety, the deleted-note rule, compatibility and privacy. Narrow SQL and API work is in the implementation map. No implementation is written here. |
| B2, reviewed base | Accepted. The stale "awaiting reconciliation" wording is replaced with the exact base `372178b` on PR #3. PR #2 follows capture recovery and is not a prerequisite merge. The shared-base review and main merge remain separate gates. |
| B3, foreground or background | Accepted with Codex's recommendation: a durable foreground queue that resumes on launch, foreground, connectivity and Save again. [Leaving the app](#leaving-the-app) makes no background promise. Background transfer is out of scope. |
| B4, expired sign-in | Accepted. Offline refresh failure keeps the session and reads as offline. A rejected sign-in gets the [sign-in-required state](#sign-in-required) with same-account recovery through the existing sign-in screen. Audio is retained. Onboarding is unchanged. The another-account default is D1. |
| B5, interruption | Accepted. Durable record and file before recording starts. Stopped early, Interrupted and Not enough space are specified honestly, with no promise that every file is intact. Device checks remain required. Leaving the app while recording is D2. |
| B6, failure measurement | Accepted. Attempt failures, unknown results, discards and terminal outcomes are separated. The session-funnel limitation is stated. Codex finalizes canonical metrics before any recovery rate is reported. |
| P1, unknown result and discard copy | Accepted. "It was never saved" is replaced by two history-based messages. Discard is local only and never implies server deletion. Reconciliation is by capture binding only. |
| P1, receipt before local deletion | Accepted. Invariant 2 requires a validated, stored receipt. A zero-byte body never produces a receipt. JSON and demo compatibility is preserved (contract item 8). |
| P1, account switching and deletion races | Accepted. Only unsaved captures are counted. Active recording, in-flight uploads, stale callbacks, local deletion failure and account-deletion failure are specified. There is no service-token fallback. |
| P2, processing distinct from saving | Accepted. Poll exhaustion is not failure. No re-upload to restart processing. The processing write must not re-create deleted rows. |

## Codex handoff

- Exact handoff revision: revision 2 is uncommitted in the local, non-synced `throughline-local` checkout on `codex/reconcile-september-base`, prepared against `372178b2b68d81691e8228443dacfebeec989e00`. Identity before commit: the asset hashes in [SHA256SUMS.txt](assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt) and the SHA-256 of this document, which is recorded in the [review receipt](../evidence/2026-09-28-claude-reconciliation-capture-review.md) because a file cannot contain its own hash. Codex integrates and commits it; the committed revision then becomes the contract.
- Codex-owned paths: the production files listed under Production mapping, the new Swift files and tests, the server migration and tests, and the slice record. Claude owns this document and its assets.
- Required evidence manifest: source revision; test results; simulator captures for every row of the visual matrix; device results for the physical checks; server contract test results; the review receipts below; rollback target.
- Unresolved before `handoff_ready`: Codex's exact-revision re-review of revision 2; Mike's answers to D1 and D2.
- Next gate: Codex re-reviews this exact revision and records the result below. Mike answers D1 and D2. Claude then resolves anything raised and sets `handoff_ready`. Build entry remains Mike's decision.

## Mutual review receipts

- Codex feasibility reviewer and date: Codex, 2026-09-28.
- Exact selected handoff revision reviewed: revision 1, SHA-256 `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c`, at commit `bda1058947397b7bf1b908a0a682eb3966868a54`. The review is kept outside the repository as a local Codex artifact.
- Technical findings and resolution: verdict "feasible with required revisions; not yet handoff_ready". The findings are B1–B6 and four additional items; each disposition is under [Feasibility findings and resolution](#feasibility-findings-and-resolution) and revision 2 is the response.
- Codex re-review of revision 2: `peer_review_pending`.
- Claude review of the shared base: recorded separately in [the reconciliation and capture review receipt](../evidence/2026-09-28-claude-reconciliation-capture-review.md). It is not an implementation review.
- Claude implementation reviewer and date: pending; follows implementation.
- Exact implementation revision and visual/behavior evidence reviewed: pending.
- Design, interaction, accessibility, and failure-state findings and resolution: pending.
- Remaining unverified checks or `peer_review_pending`: Codex's re-review of revision 2; every physical-device check; the server contract, which does not exist yet.
- Next owner and one next action: Codex re-reviews revision 2 against `372178b` and records its findings here.

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
