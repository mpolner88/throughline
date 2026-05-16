# Throughline iOS Shell

Native SwiftUI app for the v0 foreground-only recording shell.

## Scope

Included:

- Four-screen onboarding: Hero, Record, Magic moment, Sign in.
- Home shell with `connect →` visible while disconnected.
- Foreground-only recording service using `AVAudioRecorder`.
- Upload client for the Supabase Edge Function backend.
- Configurable backend URL for Supabase dogfood or local development.
- Pull-to-refresh memory sync from the backend.

Deliberately not included in v0:

- Background audio.
- Live Activity.
- Dynamic Island.
- AirPods stem-tap stop.
- Real auth.
- App Store/TestFlight distribution.

## Local Run

The app uses the Supabase Edge Function backend by default:

```text
https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api
```

Open:

```text
ios/Throughline.xcodeproj
```

Or build from the command line:

```bash
npm run ios:build
```

Paste the dogfood API token in `connect →`, then tap `check`.

For local backend development, start the Node stub:

```bash
cd /Users/mikepolner/Documents/Throughline
npm run stub:dev
```

Then switch the backend URL to:

```text
http://127.0.0.1:5180
```

## Dogfood On iPhone

For real voice notes away from your Mac, use the Supabase backend. No Wi-Fi tunnel is needed once the Edge Function is deployed.

Local dogfood still works from a Mac. Run the backend with transcription and extraction:

```bash
cd /Users/mikepolner/Documents/Throughline
THROUGHLINE_TRANSCRIBER=groq THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs npm run stub:dev
```

In Xcode:

1. Open `ios/Throughline.xcodeproj`.
2. Select the `Throughline` scheme.
3. Select your iPhone as the run destination.
4. In Signing & Capabilities, select your team if Xcode asks.
5. Run the app.
6. Open `backend` or `connect →`, confirm the Supabase URL and token, and tap `check`.

When recording works, the flow is:

```text
iPhone recording → Supabase Edge Function → persisted Throughline memory → MCP tools
```
