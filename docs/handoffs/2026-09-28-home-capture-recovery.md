---
handoff_id: "2026-09-28-home-capture-recovery"
backlog_id: "TL-CAP-001"
slice_brief: null
tandem_stage: "selected_pending_codex_feasibility_review"
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

**Stage note.** `selected_pending_codex_feasibility_review` is a hold, not a new canonical stage. Mike has selected; the tandem table requires a Codex feasibility review before `handoff_ready`. Claude sets `handoff_ready` only after that review is recorded below and its findings are resolved. This document is not implementation authority until then.

**Order.** Mike selected capture recovery first and the running list (`TL-TASK-001`, [PR #2](https://github.com/mpolner88/throughline/pull/2)) second. This slice is designed against the Home that ships today. The running list adopts the tray when it follows.

## Current

- What the user experiences now: a recording is written to temporary storage. When the upload fails, Home shows one line of red text above the record button and the recording cannot be replayed or retried. The record button is disabled while the upload and the processing poll run, which can take about 40 seconds. After upload the button label and a small "saved" word are the only confirmation.
- Verification date: 2026-09-28 for source; 2026-08-29 for the visual baseline.
- Evidence type: source inspection (primary) and simulator (visual baseline). No physical-device or TestFlight reproduction of a failed upload exists.
- Evidence links:
  - [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift) line 44 writes to `FileManager.default.temporaryDirectory`.
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift) lines 185–191 render the error text; line 203 disables the recorder during upload and processing; lines 381–454 drop the file reference in the failure path.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) line 666 sends one `POST /recordings` with no retry and no idempotency key.
  - [Design audit, 2026-08-29](../evidence/2026-08-29-design-direction-portfolio-audit.md) for the accepted Home and recorder screens.
  - [Repository experience audit, 2026-08-29](../evidence/2026-08-29-repository-experience-workflow-audit.md) rates this P0.
  - [Return audit, 2026-09-28](../evidence/2026-09-28-return-audit.md) confirms it is still unresolved in local source.
- Known evidence gaps: real failure frequency is unknown (the recording-failure guardrail reports 0 of 0 for the trailing week). No device test of interruption, low storage, or background behavior. Internal build 2026082801 has one reported install; Mike's acceptance of that journey is not recorded.

## User problem

- One problem: a person speaks a thought they could not stop to type, and the app can lose it without any way to recover it.
- Who experiences it: any signed-in person recording from Home whose upload fails or whose app is closed before the upload completes. The product is for capture while driving or walking, where connectivity is least reliable.
- Why it matters now: it is rung one of the outcome ladder in [PRODUCT.md](../PRODUCT.md), "capture without loss". It is the backlog's named next portfolio decision and Mike selected it on 2026-09-28.

## Evidence

- Decision-ready evidence: the source defects above are direct and reproducible by reading. The running-list build in PR #2 keeps the same failure path, so this slice is needed on either base.
- Assumptions: upload failures happen often enough to matter for people recording on the move. A person who sees their capture waiting will trust the recorder more than one who sees a transient confirmation.
- Unknowns: failure frequency; how often people record a second thought within 40 seconds of the first; how much local storage pending captures use in practice.

## Canonical fit

- Product principles: speed (capture is never blocked by saving); trustworthy structure; traceability (replay your own voice); quiet disclosure.
- Brand/design principles from [throughline-brand-decisions.md](../../throughline-brand-decisions.md): 1 voice before interface; 3 preserve the user's words; 4 quiet hierarchy; 5 one role per item; 7 let blue mean something; 8 be native where trust matters; 9 gestures additive (this slice adds none); 10 earn disclosure; 11 accessible calm. The recorder keeps its accepted full-width blue shape.
- Relevant decisions: [decision log](../../decision-log.md) 2026-08-28 (Home rollback), 2026-08-30 (handoffs are the contract), 2026-09-28 (role split with mutual review). Mike's selection on 2026-09-28 is recorded here and still needs a decision-log entry, which Codex owns during reconciliation.
- Backlog state: `TL-CAP-001` is `ready_for_mock` in [backlog.json](../../product/backlog.json), last updated 2026-08-29. It should move to `awaiting_mock_approval` or `approved_for_build` when Codex reconciles the backlog. This handoff does not edit the backlog.
- Slice phase: `selected`. No slice brief exists for this item. Codex creates the slice record at planning, as [WORKFLOW.md](../WORKFLOW.md) requires.

## Candidates

All three shared one lifecycle: audio is kept durably on the phone at stop, the recorder is freed at once, and every state on screen is true. They differed in where that truth lives.

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
- Reading of that record: capture recovery was shown to Mike as the tray in both presentations on 2026-09-28. This handoff treats the statement as selecting that design. Candidates A and C were shown on 2026-08-30 and are recorded as not selected. If Mike meant otherwise, this handoff is superseded before any build.
- Required revisions, made by Claude to bound the first slice:
  1. The line "Saved · readable by your agent" is removed. `AppState.hasConnectedAgent` is declared and never set, so the claim has no behavior behind it. It returns with the agent-connection work.
  2. Retry for stalled structuring is deferred. The API has no re-process route. After the upload is confirmed, a recording that stalls or fails on the server leaves the tray and appears in the list with its existing status row, as it does today.
  3. The offline header is shortened to "2 captures waiting to save" so it fits one line at 390 points.
  4. Four states were added that the August mock did not show: replay in progress, more than three captures, a first recording on the empty Home, and signing out with unsaved captures.
- Rejected alternatives and why: A, because it puts unsaved content into the plan list. C, because it adds a sheet to a flow that must stay free of ceremony while driving.

## Selected experience

Frozen target: [selected-mock.html](assets/2026-09-28-home-capture-recovery/selected-mock.html). Open it for the gallery, or add `?only=failed` for one state. Add `theme=dark` for dark appearance.

- Entry: the person taps the record button on Home, speaks, and taps to stop. Nothing about starting or stopping changes.
- Primary flow:
  1. On stop, the audio is moved into durable app storage before anything else happens. A row appears in the tray: "On your phone. Saving to your account…". The recorder returns to idle and is usable at once.
  2. When the server confirms the upload, the row reads "Saved to your account. Structuring your note…". The local audio file is deleted.
  3. When the note is processed, the row leaves the tray and the note appears in Today's plan exactly as notes appear today. When the tray is empty it is not drawn.
- Failure and waiting flows:
  - Offline: the row reads "On your phone. Waiting for connection." With two or more captures waiting, a header reads "2 captures waiting to save". Saving resumes on its own when the connection returns, oldest first.
  - Transient failure: the app retries on its own with backoff while the row still reads "Saving to your account…".
  - Failure after retries, or a failure that retrying cannot fix: the row reads "Couldn't save. Still on your phone." with three actions. **Save again** retries with the same capture ID. **Play** plays the audio and becomes **Stop** while playing. **Discard** asks for confirmation, then deletes the file.
  - App closed or crashed: on next launch every capture still in storage reappears in the tray and saving resumes.
  - Server stall or failure after upload: see revision 2.
- Exit: the tray empties and Home is exactly the accepted Home.
- One representation: a recording shown in the tray is not also shown in the list. It appears in the list only after it leaves the tray.
- More than three captures: three rows show, then a button row "+ 2 more" with "Show all". Show all expands the tray to at most half the screen height with its own scroll. The button then reads "Show less".
- Signing out with captures in the tray: a confirmation appears before sign-out. Deleting the account uses the same added sentence in its existing confirmation.
- Microphone access off: the record button explains and offers Open Settings, replacing today's raw error text.
- Navigation and gestures: none added. There is no swipe, long press, or drag in this slice.
- Non-gesture alternatives: every action is a visible button at least 44 points tall.
- Exact copy:

| Where | Copy |
| --- | --- |
| Row, kept and saving | **On your phone.** Saving to your account… |
| Row, saved and structuring | **Saved to your account.** Structuring your note… |
| Row, while the recorder is expanded for recording | **On your phone.** Saving… / **Saved.** Structuring… |
| Row, offline | **On your phone.** Waiting for connection. |
| Tray header, offline, two or more | 2 captures waiting to save |
| Row, failed | **Couldn't save.** Still on your phone. |
| Actions on a failed row | Save again · Play · Discard |
| Play while playing | Stop |
| Collapsed row | + 2 more · Show all |
| Expanded row | Show less |
| Discard dialog title | Discard this capture? |
| Discard dialog message | The audio will be deleted from your phone. It was never saved to your account. |
| Discard dialog buttons | Discard capture · Cancel |
| Sign-out dialog title | Sign out? |
| Sign-out dialog message | 2 captures aren't saved yet. Signing out deletes them from this phone. |
| Sign-out dialog buttons | Sign out and delete · Cancel |
| Sentence added to the delete-account dialog | 2 captures that aren't saved yet will also be deleted from this phone. |
| Recorder, microphone off, title | Microphone access is off |
| Recorder, microphone off, support | Turn it on in Settings to record. Your notes are unaffected. |
| Recorder, microphone off, button | Open Settings |
| VoiceOver, note arrives | Note ready in today's plan. |
| VoiceOver, tray region | Captures, 2 items |

  Durations render in the monospaced digit style as `0:42`. Counts use the singular "1 capture" where it applies. Bold marks the clause that is a durable fact; the clause after it is the current activity.
- Copy that is removed: the button labels "Saving your voice note…" and "Structuring your plan…", the supporting line "Saving your note and extracting to-dos", and the footer word "saved". The footer word "syncing" stays. The red error line stays for errors that are not about a capture, such as a failed task toggle or refresh.
- Motion: a row fades in when it appears. When a note is processed the row slides up and fades as the note appears in the list, in about 0.25 seconds. Text changes inside a row do not animate.
- Haptics/audio: one light impact when the capture is kept on the phone. One warning notification haptic when a capture reaches the failed state while the app is in the foreground. Play uses the normal playback route. Starting a recording stops playback. Playback stops when the app leaves the foreground.

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | Rows 1 and 2 with staged copy. The recorder is never busy because of saving or structuring. | `kept`, `saved`, `recording` screens |
| Empty | No captures in flight: no tray. Home and recorder are exactly as accepted. A first recording on the empty Home shows the tray above "Record today's plan". | `arrived`, `first` screens |
| Error/retry | Failed row with Save again, Play, Discard. Save again never creates a second note. The row persists across launches until saved or discarded. | `failed`, `playing`, `discard` screens; behavioral checks 2–4 |
| Offline/degraded | Rows read "Waiting for connection." No alarm color. Recording stays available. Saving resumes oldest first. | `offline`, `many` screens; behavioral check 1 |
| Permission denied | Recorder shows title, support line, and Open Settings, which opens this app's page in Settings. | `permission` screen |
| Long/localized content | Row text wraps to any number of lines. The longest capture, 4:58, renders like the shortest. More than three rows collapse. German-length strings must wrap, not truncate. | `many`, `ax` screens |
| Light and dark appearance | Tray uses the background and hairline tokens only. Blue appears on the live dot, the primary action, and the text buttons. | seven dark screens in the matrix |
| Dynamic Type | All tray text uses semantic text styles, not fixed sizes. At accessibility sizes the actions stack full width and the row aligns to the top. | `ax` screens at 390 × 844 and 375 × 667 |
| VoiceOver/focus order | The tray is a labeled region read before the recorder. Each row reads duration, then the durable fact, then the activity. Actions follow their row. One announcement per state change, never per poll. | VoiceOver pass on device |
| Reduce Motion | The spinner is a static glyph. Rows appear and leave with a crossfade or no animation. No sliding. | Reduce Motion pass on device |

## Production mapping

- Existing components to reuse: `RecordButton`, `Eyebrow`, `Theme` tokens, the hairline `Divider`, the native `confirmationDialog`, and `ProcessingStatusRow` for notes in the list.
- Files likely affected:
  - [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift): record into, or move into, durable storage.
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift): `bottomRecorder`, `stopAndUploadRecording`, recorder title and busy logic, the footer, and list filtering for recordings in the tray.
  - [SharedComponents.swift](../../ios/Throughline/Views/SharedComponents.swift): a microphone-off presentation for `RecordButton`; the sign-out and delete-account confirmations in `AccountSettingsView`.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift): send the capture ID; upload from a file.
  - [AppState.swift](../../ios/Throughline/AppState.swift): delete pending captures on sign-out and account deletion.
  - New, names suggested: `Services/CaptureOutbox.swift`, `Views/CaptureTrayView.swift`, and tests under `ios/Tests/`.
  - If Codex accepts blocker B1: [api/index.ts](../../supabase/functions/api/index.ts) and its tests.
- New assets/tokens: none. SF Symbols only. Suggested: `exclamationmark.circle` for failed, `play.fill` and `stop.fill`, a hollow circle for waiting.
- Data/API assumptions:
  - Each capture gets a random UUID when it is kept. The file name is that UUID. No account or session identifier appears in a file name.
  - Capture metadata holds only: capture ID, created time, duration, recording type, time zone, local time, state, attempt count, owning account ID, and the server recording ID once known. It holds no transcript or note content.
  - A capture is uploaded only under the account that recorded it.
  - Existing events keep their meaning. `recording_uploaded` fires once per capture when the server confirms, however many attempts it took.
- Invariants Codex must preserve:
  1. Audio is durable on the phone before any network call starts.
  2. The local file is deleted only after the server confirms the upload, or after a confirmed Discard, sign-out, or account deletion.
  3. The recorder is enabled whenever it is not preparing, recording, or finishing.
  4. A retry never creates a second note for the same capture.
  5. A recording has one representation at a time: tray or list.
  6. The accepted Home hierarchy, note cards, recorder shape, and onboarding are unchanged.
  7. No capture content or identifier reaches analytics.
- Deliberately open implementation choices: the storage directory and metadata format; foreground upload versus a background `URLSession`; the backoff schedule (suggested 2, 10, and 30 seconds); how connectivity is observed; file protection class (suggested `completeUntilFirstUserAuthentication`); whether pending audio is excluded from device backups (suggested yes).

## Acceptance

- Behavioral checks:
  1. Turn on Airplane Mode, record 20 seconds, stop. The tray shows the offline row and the recorder is usable at once. Force-quit and reopen: the row is still there. Turn off Airplane Mode: the row moves through saved and structuring, and one note arrives.
  2. Force an upload failure. The failed row appears with three actions. Play plays the audio. Save again succeeds and one note arrives.
  3. Force a lost response after the server accepted the upload. Save again produces no duplicate note.
  4. Discard, confirm. The file is gone from storage, the row is gone, and no request is sent.
  5. Record a second capture while the first is saving. Both arrive, oldest first.
  6. Deny microphone access. The recorder shows the microphone-off state and Open Settings opens the app's Settings page.
  7. Queue five captures offline. Three rows and "+ 2 more" show. Show all and Show less work.
  8. Sign out with two captures waiting. The confirmation names the count. After confirming, the files are deleted.
  9. A recording shown in the tray does not also appear in the list after a pull to refresh.
  10. After a server-side processing failure, the row leaves the tray and the note shows its existing status row.
- Visual comparison views and sizes: compare simulator captures with the reference images below. All are synthetic. The manifest of hashes is [SHA256SUMS.txt](assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt).

| State | Light, 390 × 844 | Dark, 390 × 844 | Other sizes |
| --- | --- | --- | --- |
| Kept, saving | [image](assets/2026-09-28-home-capture-recovery/screens/kept-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/kept-dark-390x844.png) | |
| Saved, structuring | [image](assets/2026-09-28-home-capture-recovery/screens/saved-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/saved-dark-390x844.png) | |
| Recording again | [image](assets/2026-09-28-home-capture-recovery/screens/recording-light-390x844.png) | | |
| Arrived, tray gone | [image](assets/2026-09-28-home-capture-recovery/screens/arrived-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/arrived-dark-390x844.png) | |
| Offline | [image](assets/2026-09-28-home-capture-recovery/screens/offline-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/offline-dark-390x844.png) | [430 × 932](assets/2026-09-28-home-capture-recovery/screens/offline-light-430x932.png) |
| Failed | [image](assets/2026-09-28-home-capture-recovery/screens/failed-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/failed-dark-390x844.png) | [430 × 932](assets/2026-09-28-home-capture-recovery/screens/failed-light-430x932.png), [375 × 667](assets/2026-09-28-home-capture-recovery/screens/failed-light-375x667.png) |
| Replaying | [image](assets/2026-09-28-home-capture-recovery/screens/playing-light-390x844.png) | | |
| Discard confirmation | [image](assets/2026-09-28-home-capture-recovery/screens/discard-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/discard-dark-390x844.png) | |
| More than three | [image](assets/2026-09-28-home-capture-recovery/screens/many-light-390x844.png) | | |
| First recording | [image](assets/2026-09-28-home-capture-recovery/screens/first-light-390x844.png) | | |
| Microphone off | [image](assets/2026-09-28-home-capture-recovery/screens/permission-light-390x844.png) | [image](assets/2026-09-28-home-capture-recovery/screens/permission-dark-390x844.png) | |
| Accessibility text size | [image](assets/2026-09-28-home-capture-recovery/screens/ax-light-390x844.png) | | [375 × 667](assets/2026-09-28-home-capture-recovery/screens/ax-light-375x667.png) |

  The images are browser renders of the mock. The status bar glyphs, the system font rendering, and the native dialog will differ on device. The sign-out dialog and the expanded tray have no image; their copy and behavior above are the target.
- Automated tests: state transitions of the capture store; persistence across relaunch; retry and backoff; the one-representation filter; deletion on discard, sign-out, and account deletion; copy strings. The existing suites must still pass: `npm run extraction:test`, `npm run privacy:check`, `npm run docs:verify`, and the Swift contract tests in `ios/Tests/`.
- Build commands: `npm run ios:build` for the simulator and `npm run ios:build:device` for the device, from an isolated copy of the tree as in earlier releases.
- Physical-device checks: checks 1, 2, 5, and 6; an incoming call during recording; low storage; VoiceOver; Reduce Motion; the largest accessibility text size.

## Measurement and safety

- Primary metric: share of `recording_started` sessions that reach `recording_uploaded`, as the backlog names it. Report counts, not percentages, until the readiness floors in [metrics.md](../../product/metrics.md) are met.
- Guardrails: local storage used by pending captures; duplicate upload rate; recording failure rate as defined in metrics.md.
- Suggested content-free events for Codex and Mike to accept or change: `capture_kept`, `capture_upload_failed` with a reason category and attempt number, `capture_upload_retried` with `auto` or `manual`, `capture_replayed`, `capture_discarded`. Any new event is defined in metrics.md before it is reported.
- Privacy/data boundary: audio stays on the phone until the existing upload path sends it. No new processor, provider, or destination. No audio, transcript, note text, or identifier in analytics, logs, file names, or tracked files. Pending audio is deleted on discard, sign-out, and account deletion. This handoff proposes no change to the privacy policy; Codex checks the policy and the privacy manifest against the final behavior and stops for Mike if either needs new wording.
- Non-goals: any change to the Home hierarchy or note cards; the running list; retry for stalled structuring; the agent-readable line; onboarding and the demo recording; recording limits; providers or models; pricing; notifications; actions on offline rows; App Store or TestFlight state.
- Authority class: product and design direction, selected by Mike. No approval-bound class is touched. An additive API change for B1 follows the normal deployment rules and is not authorized by this document.
- Rollback target and procedure: the Home presentation in internal build 2026082801. Revert the files of this slice. Before rolling back, make sure no captures are waiting, or keep the uploader in the rollback build, so that audio is not stranded on the phone.

## Codex handoff

- Exact committed handoff revision: not committed. The working tree is awaiting reconciliation, and no commit was requested. Identity before commit: the hashes in [SHA256SUMS.txt](assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt) for the mock and images. The hash of this document is given in the instruction that accompanies it, since a file cannot contain its own hash.
- Codex-owned paths: the production files listed under Production mapping, the new Swift files and tests, and the slice record. Claude owns this document and its assets.
- Required evidence manifest: source revision; test results; simulator captures for every row of the visual matrix; device results for the physical checks; the review receipts below; rollback target.
- Unresolved blockers:
  - B1. No idempotency on `POST /recordings`. Invariant 4 needs the server to accept a capture ID and return the existing recording when it has seen that ID. Codex confirms the approach or proposes another.
  - B2. No reconciled base. The local checkout and PR #2 must be reconciled before this is built.
  - B3. Foreground or background upload. This changes what the person sees after leaving the app mid-upload.
  - B4. Expired session during a retry. The row copy stays the same; Codex confirms that Save again refreshes the session, and reports if a sign-in step is needed so Claude can design it.
  - B5. A recording interrupted by a call or by the app being closed. The design expects the partial audio to be kept and shown as a normal capture. Codex confirms this is possible.
  - B6. The meaning of `recording_failed` once retries exist. Suggested: keep it for terminal outcomes only.
- Next gate: Codex feasibility review of this exact revision, recorded below. Then Claude resolves findings and sets `handoff_ready`.

## Mutual review receipts

- Codex feasibility reviewer and date: `peer_review_pending`
- Exact selected handoff revision reviewed: pending
- Technical findings and resolution: pending
- Claude implementation reviewer and date: pending; follows implementation
- Exact implementation revision and visual/behavior evidence reviewed: pending
- Design, interaction, accessibility, and failure-state findings and resolution: pending
- Remaining unverified checks or `peer_review_pending`: `peer_review_pending`. No review has been performed by either tool.
- Next owner and one next action: Codex reviews feasibility of this handoff and answers B1 through B6.

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
