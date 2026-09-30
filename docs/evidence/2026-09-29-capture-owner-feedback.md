# Capture TestFlight feedback and follow-up — September 29

**Current:** Mike reports that the capture TestFlight looks good and requests a device test list, simpler AI controls, investigation of carryover/learning, and the running list next. This is initial owner feedback, not completion of the recovery matrix. The installed build number was not re-read on his phone; the delivered build is [1.0.5 (2026092901)](../releases/2026-09-29-ios-1.0.5-2026092901-delivery.md).

**Evidence:** source baseline `9878718aca01429891a2ca5d597f633ca57d56e8`, source review, focused executable tests, isolated iOS build, and aggregate-only hosted SQL on 2026-09-29. No private content was retrieved.

**Next gate:** Claude reviews the small AI-control follow-up and refreshes the running-list handoff against the capture base. Mike exercises the device checks below. Claude CLI reported an expired OAuth session; desktop automation also timed out. No Claude review is claimed.

**Authority:** Mike explicitly requests the simpler AI experience and Settings control and names running list next. No policy document edit, evaluation activation, provider/model change, main merge, PR comment, public release or App Store submission is included. The existing capture handoff/assets remain unchanged.

## Device checks for the delivered capture build

Use short disposable recordings so discard/sign-out checks cannot remove anything valuable.

| Check | Steps | Expected |
| --- | --- | --- |
| Normal capture | Record a short thought with two tasks; stop; open the resulting note. | On-phone/saving, then saved/structuring, then one note. Tasks preserve what was said; successful upload alone is not a completed note. |
| Offline recovery | Enable airplane mode and explicitly disable Wi-Fi. Record and stop. Close and reopen the app while offline; optionally restart the phone. Restore connectivity and leave the app open. | The capture stays on the phone, then saves once. No missing audio, duplicate note or false saved claim. Offline waiting rows do not necessarily show Play/Discard; those actions appear in the failed state. |
| Interrupted recording | Separately try locking the phone and leaving the app during a disposable recording; try a phone call when convenient. Return. | Recording stops and usable audio is kept, then saves. Background recording is intentionally unsupported. The stopped-early message may be brief if reconnection/save finishes quickly. |
| More than one capture | Make four short recordings offline; inspect Show all/Show less, then reconnect. | Every capture stays represented and each produces one note. A pending capture must not prevent starting another. |
| Uncertain/failed save | If a failed row appears naturally, test Play/Stop, then Save again. Separately discard a disposable failed capture, cancel once, then confirm. | Playback matches the capture; retry does not duplicate it. Cancel keeps audio; confirmed discard removes local audio. An already-dispatched capture can still appear in the account, as the confirmation explains. Do not deliberately break backend service to create this state. |
| Readability | Repeat the tray checks in dark mode and with larger text; try VoiceOver if available. | Recorder and recovery controls remain reachable and labels distinguish on-phone from saved. |

Optional account check: with disposable unsaved captures, open sign-out and **cancel**. The warning must explain local removal and cancellation must keep the captures. Confirming sign-out deletes local unsaved captures by design. Do not use account deletion as a casual device test. Another-account isolation needs dedicated test accounts and a separately prepared scenario.

For any failure, report the action, connectivity, what appeared and whether the note was missing/duplicated. Actual private audio or note text is unnecessary.

## Small AI-control adjustment

Mike requested removal of the large permission experience, with subtle acceptance only if necessary and a Settings off switch. [Apple 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing), checked 2026-09-29, expressly requires permission before sharing personal data with third-party AI. The implementation uses the minimal first-use acceptance allowed by Mike's request; it does not silently convert unset or false choices to true.

- First recording: brief explanation naming recordings/text, Groq and Supabase; **Agree and record** proceeds after dismissal and microphone permission. No second recorder tap. Optional How it works disclosure.
- Demo promotion: **Agree and save note** resumes that action only under the same owner and account generation.
- Not now, swipe dismissal, leaving the screen/app, or account change never starts a recording or promotion.
- Existing true acceptance remains on; false/unset remains off until an affirmative action. Settings uses a native **AI voice notes** switch with concise on/off explanation and optional detail. Existing notes remain readable when off. Enabling also resumes pending captures; disabling preserves the dispatch boundary and interrupts an active recording if present.
- No ordinary-AI choice enables private evaluation or changes providers, models, retention or policy text.

Codex-owned source: `AIProcessingPermission.swift`, `UploadClient.swift`, `HomeView.swift`, `OnboardingView.swift`, `SharedComponents.swift`, and `AIProcessingPermissionTests.swift`. Source is committed at `bd9c4df3b87b25443c1e69f198334df8cf08d47b` on local `codex/capture-tray`; it is not in build 2026092901.

Engineering peer review found and resolved two races: promotion could bind to a switched account during auth; microphone permission could resume after same-account sign-out/re-entry. Demo saves now require the expected owner, check generation before/after auth and before dispatch, and suppress stale completion; microphone continuation checks generation. The review found no remaining material issue in its bounded source recheck. This is not Claude presentation review.

Verification: ten mocked permission/continuation groups passed, including zero dispatch during changed-owner and same-owner-generation auth waits. Isolated unsigned Release simulator build passed. Initial sandboxed build could not access CoreSimulator services; the permitted isolated retry passed. Capture storage/queue regression results and final documentation checks are appended at closeout. No actual UI interaction, VoiceOver, signed archive, upload or new TestFlight delivery is claimed for this adjustment. Claude review remains pending because its local login expired and desktop connection timed out.

## Carryover and running-list finding

`HomeView.visibleCarryForwardItems` flattens `tomorrowTodos` from all visible notes; `CarryForwardView` calls them unfinished from last night. There is no date or completion filter. Task mutations use text and leave `tomorrow_todos` unchanged; repeated wording can also collide as row identity. The old fix was part of the August presentation rollback. This bug remains in the delivered app and is part of the [running-list brief](../slices/running-list.md), not claimed fixed by these AI controls.

## Learning-loop reality

Fresh hosted aggregates on 2026-09-29: 14 legacy feedback rows across 10 recordings; zero complete expected answers/eval candidates in those rows. Zero immutable processing operations, inference attempts, note revisions, owner evaluations, contributions, corpus cases or accepted full outputs. Root independently rechecked feedback/operations/revisions/evaluations/corpus counts. API v31 is active.

Ratings reach the legacy feedback table. There is no automated consumer that turns them into tested changes, and no model-training or automatic improvement path. Private Evaluation is a foundation for comparing transcription/extraction changes, not a live learning loop. Capture durability improves through engineering and tests, not by ratings automatically tuning the recorder.

Current default-off source plus the same-day rollout receipt record unchanged evaluation configuration; runtime secret values were not read or independently attested in this audit. Zero live lineage/evaluation rows corroborate inactivity; counts alone are not a direct flag-value inspection.

Before activation, resolve the existing R1–R6/R16 findings: edit/evaluation coupling and correction shape; recording-wide withdrawal/artifact cleanup; missing-audio/no-op deletion receipts; repeated materialization cleanup; action-state eligibility; benchmark sealing/sample floors and eligibility revalidation in the scorer. Rebuild the source-bound owner-canary package. Actual benchmarking then needs independent predictions and sufficient owner-reviewed truth under [canonical metrics](../../product/metrics.md). Merely flipping flags does not complete this work. Seventeen focused Deno tests and thirteen Node materializer/scorer tests passed in the read-only audit; these do not prove a live quality improvement.

## Final local checks

Capture store: six persistence groups passed. File-stream bytes/digest and denial/withdrawal checks passed. Capture queue: six source-derived control-flow groups passed; refresh offline/rejection/stale-callback checks passed. These mocked checks do not replace the physical-device matrix above. No backend code or migrations changed, so full API/database replay was not repeated for this client-only adjustment.

Documentation foundation, privacy-policy parity and whitespace checks passed. The original capture handoff SHA-256 remains `eb4456ecda2912a9be3ef59797eb5be7a70584689dfba780e1bc98f70729dd50`; policy files have no diff. Source and documents are local only; no push, backend change or Apple mutation occurred.


## Superseding internal follow-up

Verified 2026-09-29: the earlier local-only and Claude-access limitations above are resolved for this slice. [Build 2026092902](../releases/2026-09-29-ios-1.0.5-2026092902-delivery.md) is available in existing Internal QA at exact app source `7719237`. [Claude presentation review](2026-09-29-claude-ai-controls-review.md) passed after the link correction. The device checklist and learning-loop limits above remain applicable.
