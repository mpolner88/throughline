# DISC-03 production plan

**Status:** `planned`; capture is blocked pending Mike's creative approval.
**Core rule:** real UI means an inspected current-build capture. No generated image, video, composite, or local mockup may impersonate Throughline UI.

## Synthetic demo dataset

This fictional plan contains no real name, company, address, account, event, contact detail, or private material.

| Field | Capture value |
| --- | --- |
| Spoken setup | "When I get back to my desk, I need to outline the release note, check the final app screens, and write the launch checklist." |
| Expected title | `Return-to-desk plan` |
| Expected summary | `A short plan for preparing a release and launch checklist after returning to a desk.` |
| Expected to-dos | `Outline the release note`; `Check the final app screens`; `Write the launch checklist` |
| Agent question | `What are the three tasks in my return-to-desk plan?` |
| Allowed agent answer | The same three synthetic to-dos only, without claims, interpretation, user name, date, or additional context. |

The capture operator must compare the processed result against this continuity table. Variation or extraction error means recapture or accurately labeled edit; it never authorizes a fabricated UI state.

## Source shot list

| Shot | Device / build | Orientation / duration | App state and action | Expected UI | Safe crop / redaction | Audio | Acceptance condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 record | Current signed build selected for production; build identifier logged in private capture worksheet | 9:16 / 7s | Start a new controlled synthetic recording. | Recorder in active state. | Crop all status-bar notifications; no account name, device ID, location, or live notification. | Re-recorded narration using the synthetic setup, or muted capture with approved caption. No cloned voice. | Direct inspection confirms current UI and no private material. |
| S-02 processing | Same current build | 9:16 / 5s | Submit synthetic recording and wait. | Genuine processing state, if displayed. | Same crop; do not fabricate elapsed time or a success state. | Muted or generic non-speech product sound only if rights cleared. | Current UI state directly observed. |
| S-03 structured note | Same current build | 9:16 / 10s | Open processed synthetic note. | Title, summary, and three to-dos matching the dataset. | Do not show transcript, note history, profile, notifications, identifiers, or unrelated notes. | Muted with burned-in approved caption. | Values match the synthetic table exactly and are legible. |
| S-04 retrieval | Controlled local agent client connected to a dedicated synthetic-note account; exact environment logged privately | 16:9 master crop adapted to 9:16 / 13s | Ask the allowed question and inspect retrieval. | Agent response lists only the three permitted synthetic to-dos. | Redact/crop token, endpoint, user identity, chat history, tool details, terminal command, timestamp, and notifications before export. | Muted with approved caption. | A reviewer sees an actual retrieval, confirms it is read-only, and confirms no secret or private history remains. |
| S-05 boundary | Local composition only, not UI | 9:16 / 5s | Display one boundary sentence. | `Read-only access to saved notes.` | No simulated product controls. | Muted. | Copy maps to CLM-03 and local artifact is labeled `diagram`, not UI. |
| S-06 triptych | Inspected frames S-01, S-03, S-04 | 1:1 and 4:5 / static | Assemble three source frames in order. | Record / structured note / read-only retrieval. | Preserve frame labels and redact each source before composition. | N/A. | Each panel traces to a reviewed source capture and has no clipping. |

## Capture sequence and editor handoff

1. Mike approves this production plan and the exact selected hook.
2. Use a dedicated controlled account and only the synthetic dataset above. Do not capture the token creation or reveal screen.
3. Record S-01 through S-04 independently; log the actual build and proof date in an untracked capture worksheet.
4. Apply redaction before any shared review export. A second reviewer verifies each frame and the retrieval boundary.
5. Make the master from inspected sources; derive every cut from that master. Do not create `assets/source`, `assets/generated`, or `assets/exports` until the appropriate approved and inspected phase.

## Release checklist for source media

- Current build is recorded in the private worksheet and the capture is dated.
- Synthetic data matches this plan; no raw audio, transcript, note text beyond the declared synthetic dataset, token, credential, notification, email, contact detail, raw ID, or private message survives.
- Source UI is not retouched into a behavior the build did not show.
- Read-only retrieval is directly inspected rather than inferred from a static image.
- Captions, readable text, color contrast, and crop-safe areas pass final visual QA.
