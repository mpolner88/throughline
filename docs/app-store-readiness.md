# Throughline App Store Readiness

Last updated: August 2, 2026

## Current Release State

- Bundle ID: `app.throughline.ios`
- Category: Productivity
- Version/build: `1.0` / `2026071901`
- Backend: Supabase Edge Functions
- Auth: Throughline email/password through Supabase Auth
- Agent access: user-created MCP tokens

## Completed In Repo

- App icon asset catalog: `ios/Throughline/Assets.xcassets/AppIcon.appiconset`; generated icons are RGB PNGs with no alpha channel.
- Accent color asset: `ios/Throughline/Assets.xcassets/AccentColor.colorset`
- Privacy manifest: `ios/Throughline/PrivacyInfo.xcprivacy`
- Public privacy URL: `https://mpolner88.github.io/throughline/privacy/`
- Public support URL: `https://mpolner88.github.io/throughline/support/`
- App Store screenshot set: `app-store/screenshots/iphone-6.9/`; generated with `npm run appstore:screenshots` at `1284 x 2778`
- Release config keeps `THROUGHLINE_API_TOKEN` empty and uses Supabase Auth for users.
- In-app account deletion exists in settings.
- Protected backend maintenance route exists for audio retention: `POST /maintenance/audio-retention`
- Before the first recording is sent, the app identifies the data being sent, names Supabase and Groq as recipients, explains the purpose, and requires an affirmative choice.
- Declining AI processing leaves recording disabled and does not request microphone access.
- AI processing permission can be reviewed or withdrawn later in Settings.
- The microphone permission text names Supabase and Groq and matches the in-app disclosure.
- Account creation explains that email confirmation is required and offers an in-app resend action.

## Rejection Resolution Status

### Privacy disclosure and consent — resolved in the new build

Verified in an isolated Release build on an iPhone 17 Pro simulator:

1. Tapping **Start recording** opens Throughline's AI processing disclosure before the iOS microphone prompt.
2. The disclosure identifies audio, transcript, and derived text; names Supabase and Groq; and explains transcription and structured-note creation.
3. Tapping **Not now** returns to the recording screen without requesting microphone access or uploading data.
4. Tapping **Allow AI processing** dismisses the disclosure, then shows the iOS microphone prompt.
5. Granting microphone access starts recording.

The updated privacy policy source is in `docs/privacy-policy.md` and `docs/privacy/index.html`. GitHub Pages publishes the `/docs` directory from `main`; verify the updated processor wording is live before resubmission.

### Confirmation email — production SMTP still required

Production Supabase Auth currently requires email confirmation, but the project does not have a custom SMTP provider configured. Supabase's built-in sender is a development-only service that refuses delivery to addresses outside the project's authorized team and has a very low rate limit. This matches the reviewer's report that a newly created account received no email.

Before resubmission:

1. Configure a production SMTP provider in Supabase Auth.
2. Keep email confirmation enabled.
3. Create a brand-new account using an external inbox that is not a Supabase team member.
4. Confirm the first email arrives, its link completes confirmation, sign-in works, and the in-app resend action delivers a second email when requested.
5. Record the provider, sender address, test inbox, and test timestamp here.

Official setup reference: https://supabase.com/docs/guides/auth/auth-smtp

## App Privacy Labels To Enter

Use these as the initial App Store Connect privacy answers. Re-check them whenever data collection changes.

| Data type | Linked to user | Used for tracking | Purpose |
| --- | --- | --- | --- |
| Email address | Yes | No | App functionality |
| User ID | Yes | No | App functionality |
| Audio data | Yes | No | App functionality |
| Other user content | Yes | No | App functionality, analytics |

Other user content includes transcripts, summaries, tasks, important items, note edits, and extraction feedback. Analytics here means first-party extraction-quality review from intentional user feedback, not third-party advertising or tracking.

## Review Notes

Use review notes like this:

```text
Throughline lets a user record voice notes, transcribe them, save them as notes, and optionally create an MCP agent token so their own agent can read saved notes.

Test account:
Email: app-review@throughline.app
Password: [paste the current App Review password from the private handoff]

Important: choose "sign in", not "create", then enter both the email address and password before tapping sign in. The reviewer account is already confirmed and does not require opening an email confirmation link.

Suggested review path:
1. Sign in with the test account.
2. Tap Start recording. Throughline first shows an AI processing disclosure that identifies the audio/transcript data, Supabase and Groq as recipients, and the transcription/note-creation purpose.
3. Tap Allow AI processing, then allow microphone access in the iOS prompt.
4. Record a short voice note and wait for the transcript/note preview to appear.
5. Open the note to review the transcript and important items.
6. Open settings to review or withdraw AI processing permission and to see agent token management and account deletion.

Declining AI processing is supported: tapping Not now returns to the recording screen without requesting microphone permission or sending a recording.
```

## Required Before Public Submission

- Enter `https://mpolner88.github.io/throughline/privacy/` as the Privacy Policy URL in App Store Connect.
- Enter `https://mpolner88.github.io/throughline/support/` as the Support URL in App Store Connect.
- Create an App Store Connect app record for `app.throughline.ios`.
- Create a reviewer account and include credentials in review notes.
- Configure and externally verify production email sending in Supabase Auth.
- Verify the updated privacy policy is live before uploading the new build.
- Deploy the latest Supabase functions before uploading the release archive.
- Schedule `POST /maintenance/audio-retention` with a service token, or remove the 30-day audio-retention claim from the published policy.
- Archive and upload a signed Release build from Xcode.
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
