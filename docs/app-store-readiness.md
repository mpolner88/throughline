# Throughline App Store Readiness

Last updated: May 24, 2026

## Current Release State

- Bundle ID: `app.throughline.ios`
- Category: Productivity
- Version/build: `1.0` / `1`
- Backend: Supabase Edge Functions
- Auth: Throughline email/password through Supabase Auth
- Agent access: user-created MCP tokens

## Completed In Repo

- App icon asset catalog: `ios/Throughline/Assets.xcassets/AppIcon.appiconset`; generated icons are RGB PNGs with no alpha channel.
- Accent color asset: `ios/Throughline/Assets.xcassets/AccentColor.colorset`
- Privacy manifest: `ios/Throughline/PrivacyInfo.xcprivacy`
- Public privacy URL: `https://mpolner88.github.io/throughline/privacy/`
- Public support URL: `https://mpolner88.github.io/throughline/support/`
- App Store screenshot set: `app-store/screenshots/iphone-6.9/`; generated with `npm run appstore:screenshots`
- Release config keeps `THROUGHLINE_API_TOKEN` empty and uses Supabase Auth for users.
- In-app account deletion exists in settings.
- Protected backend maintenance route exists for audio retention: `POST /maintenance/audio-retention`

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
Email: [create reviewer email before submission]
Password: [create reviewer password before submission]

Suggested review path:
1. Sign in with the test account.
2. Record a short voice note.
3. Wait for the transcript/note preview to appear.
4. Open the note to review the transcript and important items.
5. Open settings to see agent token management and account deletion.
```

## Required Before Public Submission

- Enter `https://mpolner88.github.io/throughline/privacy/` as the Privacy Policy URL in App Store Connect.
- Enter `https://mpolner88.github.io/throughline/support/` as the Support URL in App Store Connect.
- Create an App Store Connect app record for `app.throughline.ios`.
- Create a reviewer account and include credentials in review notes.
- Configure production email sending in Supabase Auth so review sign-in is not blocked by rate limits.
- Deploy the latest Supabase functions before uploading the release archive.
- Schedule `POST /maintenance/audio-retention` with a service token, or remove the 30-day audio-retention claim from the published policy.
- Archive and upload a signed Release build from Xcode.
- Add screenshots, description, keywords, support URL, age rating, and export-compliance answers in App Store Connect.

## Screenshot Upload Order

Upload the generated 6.9" iPhone screenshots in this order:

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
