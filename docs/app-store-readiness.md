# Throughline App Store Readiness

Last updated: August 28, 2026

## Current Release State

- Bundle ID: `app.throughline.ios`
- Category: Productivity
- Current approved train: `1.0.4` / `2026081602`; newest internal-only iteration: `1.0.5` / `2026082801`
- Backend: Supabase Edge Functions
- Auth: Throughline email/password through Supabase Auth
- Agent access: user-created MCP tokens
- App Store Connect: Apple's upload validation on August 24 reported version `1.0.4` as previously approved and its prerelease train closed. On August 28, fresh App Store Connect API reads showed internal-only version `1.0.5`, build `2026082801`, as `VALID`, not expired, and present in the one-tester `Internal QA` group. This build restores the preceding Home presentation after owner rejection of build `2026082601`. No App Store submission or public release followed.

## Completed In Repo

- App icon asset catalog: `ios/Throughline/Assets.xcassets/AppIcon.appiconset`; generated icons are RGB PNGs with no alpha channel.
- Accent color asset: `ios/Throughline/Assets.xcassets/AccentColor.colorset`
- Privacy manifest: `ios/Throughline/PrivacyInfo.xcprivacy`
- Public privacy URL: `https://mpolner88.github.io/throughline/privacy/`
- Public support URL: `https://mpolner88.github.io/throughline/support/`
- App Store screenshot set: `app-store/screenshots/iphone-6.9/`; generated with `npm run appstore:screenshots` at the recorded `1284 x 2778` target. See the [tracked-asset manifest](../app-store/screenshots/iphone-6.9/README.md). These are marketing compositions, not running-app captures; re-verify Apple's accepted sizes before upload.
- Release config keeps `THROUGHLINE_API_TOKEN` empty and uses Supabase Auth for users.
- In-app account deletion exists in settings.
- Protected backend maintenance route exists for audio retention: `POST /maintenance/audio-retention`
- Onboarding leads with the voice-to-structured-note value and keeps the full privacy policy available from the account screen.
- Account setup offers native Sign in with Apple, Google sign-in, and email account creation/sign-in.
- Email account creation explains confirmation after submission and offers an in-app resend action.
- Settings includes a general product-feedback channel with optional permission for email follow-up.
- First-party product events measure the activation funnel without attaching recordings, transcripts, note content, names, email addresses, or persistent device identifiers. Supabase remains the canonical store; a server-side, pseudonymous copy is sent to PostHog for analysis.
- Product feedback and events are removed with account deletion.
- Local source now includes contextual private-quality grading, an inspectable 14-field agent-readiness preview, default-off revision-bound acceptance, and note-level contribution removal. The unsigned Release simulator build passed on August 23, 2026.
- Local Markdown/HTML privacy sources and the release privacy manifest declare evaluation-linked audio analytics, the retention exception, removal, and no-training boundary. These sources are not published and App Store Connect answers are not changed by this repository update.

## What's New for 1.0.4

A clearer first-time experience for turning voice notes into structured to-dos. This update adds a guided demo, streamlined Apple and Google sign-in, a more helpful empty Home state, and the branded Throughline recorder. It also improves to-do extraction so tasks are concise, directly actionable, and ready for an AI agent.

## Rejection Resolution Status

### Privacy information — current experience

The onboarding flow keeps the value proposition concise. The privacy policy remains available from the account screen and Settings, and the iOS microphone permission appears when the user chooses to record.

The updated privacy policy source is in `docs/privacy-policy.md` and `docs/privacy/index.html`. GitHub Pages publishes the `/docs` directory from `main`; verify the updated processor wording is live before resubmission.
### Evaluation-linked audio — local source ready, release actions pending

- The release-source manifest lists Audio Data for app functionality and analytics because explicitly contributed audio can support private quality evaluation.
- The local privacy sources distinguish ordinary 30-day audio retention from the explicit evaluation-contribution exception and its removal controls.
- Production evaluation behavior remains disabled until its separately gated rollout; this local iOS build does not prove the production feature is reachable.
- Mike approved feedback iterations to advance automatically to the existing internal TestFlight group after verification. Rollback build `2026082801` most recently completed that path on August 28. Publishing the policy, changing App Store privacy answers, App Store submission, and public release remain separately gated.

Ordinary third-party-AI inference permission remains an unresolved App Store readiness risk. The current app has no separate first-recording AI permission modal or AI-processing preference in Settings, and this slice does not invent one. Reconcile the App Store disclosure/consent requirement before any submission decision.


### Confirmation email — resolved and externally verified

Production Supabase Auth now uses Resend through the verified
`throughline.igneouslabs.ai` sending domain:

- Provider: Resend custom SMTP
- Sender: the configured Throughline support sender (account details retained privately).
- Email confirmation: enabled
- Auth email rate limit: 30 messages per hour, Supabase's documented custom-SMTP default
- App Review account: configured; exact sign-in details retained privately.

Production verification on August 2, 2026:

1. A brand-new external reviewer account was created successfully.
2. Gmail received its confirmation email at `2026-08-02 23:23:47 UTC`.
3. Supabase recorded the account as confirmed at `2026-08-02 23:24:15 UTC`.
4. The exact username and password saved in App Store Connect returned a production access token and refresh token.
5. A separate unconfirmed external test account received its first email at `2026-08-02 23:32:50 UTC`.
6. After Supabase's 60-second safety interval, the same `POST /auth/v1/resend` request used by the iOS app returned `200` and Gmail received a distinct second message at `2026-08-02 23:34:05 UTC`.
7. The disposable resend-test account was deleted after verification; the confirmed App Review account remains active.

App Store Connect is saved with the confirmed reviewer email and updated review notes describing the current onboarding, recording, and sign-in path.

Official setup reference: https://supabase.com/docs/guides/auth/auth-smtp

## App Privacy Labels To Enter

Use these as the initial App Store Connect privacy answers. Re-check them whenever data collection changes.

| Data type | Linked to user | Used for tracking | Purpose |
| --- | --- | --- | --- |
| Email address | Yes | No | App functionality |
| User ID | Yes | No | App functionality, analytics |
| Audio data | Yes | No | App functionality, analytics |
| Other user content | Yes | No | App functionality, analytics |
| Product interaction | Yes | No | Analytics |

Other user content includes transcripts, summaries, tasks, important items, note edits, extraction feedback, and product feedback. Product interaction includes first-party events such as app launches, onboarding steps, screen and feature use, and recording-processing outcomes. These events never include recordings, transcripts, or note content. Analytics means Throughline's own product and extraction-quality improvement, using Supabase as the source of truth and PostHog as a server-side analysis processor—not third-party advertising or cross-app tracking.

## Review Notes

Use review notes like this:

```text
Throughline lets a user record voice notes, transcribe them, save them as notes, and optionally create an MCP agent token so their own agent can read saved notes.

Test account:
Email: [retrieve the App Review account from private release configuration]
Password: [paste the current App Review password from the private handoff]

Important: choose "sign in", not "create", then enter both the email address and password before tapping sign in. The reviewer account is already confirmed and does not require opening an email confirmation link.

Suggested review path:
1. On the first screen, tap Try a 30-second note.
2. On Talk through today or the week, tap Start demo recording, record a short plan, and stop the recording.
3. Wait for Your voice note became to-dos, then tap Save these to-do's.
4. On Let’s Get Started. For Free., tap Continue with email. In the email form, choose sign in and enter the supplied credentials.
5. On the signed-in Home screen, tap the branded blue recorder, allow microphone access when iOS asks, and record a short daily plan.
6. Wait for the structured to-dos, then open the saved note and Settings to review privacy, agent token management, feedback, and account deletion.
```

## Required Before Public Submission

- Enter `https://mpolner88.github.io/throughline/privacy/` as the Privacy Policy URL in App Store Connect.
- Enter `https://mpolner88.github.io/throughline/support/` as the Support URL in App Store Connect.
- Create an App Store Connect app record for `app.throughline.ios`.
- Reviewer account and credentials are saved in App Store Connect and production sign-in is verified.
- Production email sending and the in-app resend path are externally verified.
- Updated privacy policy is live at `https://mpolner88.github.io/throughline/privacy/`.
- Deploy the latest Supabase functions before uploading the release archive.
- Schedule `POST /maintenance/audio-retention` with a service token, or remove the 30-day audio-retention claim from the published policy.
- Previous signed Release build `2026071901` was archived, uploaded, processed, and released as version 1.0.
- Signed Release build `2026080601` was archived, uploaded, processed, and released as version 1.0.1.
- Signed Release build `2026080801` was archived, uploaded, processed, selected, and submitted for App Review as version 1.0.2 on August 8, 2026.
- Signed Release build `2026080802` was archived, uploaded, processed, selected, approved, and released as version 1.0.3.
- Signed Release build `2026081602` was archived, uploaded, processed, production-tested, selected, and submitted for App Review as version 1.0.4 on August 16, 2026. Apple's August 24 upload validation reported version 1.0.4 as previously approved and its prerelease train closed; public availability was not separately rechecked.
- Internal-only version `1.0.5`, build `2026082401`, was archived and uploaded successfully on August 24, 2026, and was freshly verified `VALID` in `Internal QA` on August 25.
- Internal-only version `1.0.5`, build `2026082501`, was archived, uploaded, processed to `VALID`, and assigned to the one-tester `Internal QA` group on August 25, 2026. No App Store submission or public release followed.
- Internal-only version `1.0.5`, build `2026082601`, was archived, uploaded, processed to **Ready to Test**, and verified **Testing** in the one-tester `Internal QA` group on August 27, 2026. No App Store submission or public release followed.
- Internal-only version `1.0.5`, build `2026082801`, restored the preceding Home presentation, was archived and uploaded with the internal-testing-only control, processed to `VALID`, and freshly verified in the one-tester `Internal QA` group on August 28, 2026. No backend deployment, App Store submission, or public release followed.
- Add screenshots, description, keywords, support URL, age rating, and export-compliance answers in App Store Connect.

## Screenshot Upload Order

Upload the generated iPhone screenshots in this order:

1. `app-store/screenshots/iphone-6.9/01-voice-to-agent.png`
2. `app-store/screenshots/iphone-6.9/02-capture-voice.png`
3. `app-store/screenshots/iphone-6.9/03-voice-to-memory.png`
4. `app-store/screenshots/iphone-6.9/04-most-important.png`
5. `app-store/screenshots/iphone-6.9/05-agent-ready.png`
6. `app-store/screenshots/iphone-6.9/06-private-control.png`

Regenerate with:

```bash
npm run appstore:screenshots
```

## Retention Endpoint

The backend retention endpoint is service-token only:

```bash
curl -X POST \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/maintenance/audio-retention
```

It deletes Supabase Storage audio objects older than the configured retention window and marks the recording audio metadata as expired while preserving transcripts and structured notes.
