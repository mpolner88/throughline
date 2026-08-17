# Hosted backend runbook

**Last verified:** 2026-08-17 by local source and runbook inspection; this is not a live deployment verification.
**Current architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) is the factual runtime and data-flow map. [CURRENT_STATE.md](CURRENT_STATE.md) records the date-stamped live-fact boundary and release caveats.

This document contains operating procedures: configuration, deployment, health/canary checks, and retention. It does not establish that a provider configuration, function deployment, App Store state, or scheduled retention job is current.

Throughline uses Supabase as the hosted backend.

```text
iPhone app -> Supabase Edge Function -> Supabase Postgres/Storage -> Groq
                                           |
                                           -> MCP memory endpoint
```

The deployed Edge Function sources are in `supabase/functions`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the component boundaries and data flow.

## What Supabase Owns

- Postgres tables for recordings and feedback.
- Private Storage bucket for audio.
- Edge Function `api` for app uploads, transcription, extraction, feedback, and note reads.
- Edge Function `mcp` for read-only agent memory tools.
- Project secrets for private keys such as `GROQ_API_KEY`.

## Prepare Database

Confirm that the local checkout is linked to the intended Supabase project before applying migrations. The production project reference used by the current app configuration is `ywsenspsfyrdhgyxgcrv`.

Apply local migrations:

```bash
supabase db push
```

The migrations create:

- `public.throughline_recordings`
- `public.throughline_feedback`
- private Storage bucket `throughline-audio`
- RLS enabled on the Throughline tables, with direct `anon` and `authenticated` table access revoked

The app does not put the Supabase service role key or Groq key on-device. The Edge Functions keep those private.

## Configure Secrets

Supabase Edge Functions already receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. Set only the app-specific secrets:

```bash
supabase secrets set \
  GROQ_API_KEY=... \
  THROUGHLINE_API_TOKEN=... \
  THROUGHLINE_AUDIO_BUCKET=throughline-audio \
  THROUGHLINE_AUDIO_RETENTION_DAYS=30 \
  THROUGHLINE_USER_ID=dev-user
```

`THROUGHLINE_API_TOKEN` is a backend service token for maintenance and dogfood scripts. Release iOS builds do not include it.

Optional MCP-specific token:

```bash
supabase secrets set THROUGHLINE_MCP_TOKEN=...
```

If `THROUGHLINE_MCP_TOKEN` is absent, the MCP endpoint uses `THROUGHLINE_API_TOKEN`.

## Deploy Functions

The iOS client sends a Supabase Auth JWT after sign-in. We still deploy with Supabase JWT verification disabled because the function validates the JWT itself and also accepts the separate service token for maintenance scripts.

```bash
supabase functions deploy api --no-verify-jwt --use-api --project-ref ywsenspsfyrdhgyxgcrv
supabase functions deploy mcp --no-verify-jwt --use-api --project-ref ywsenspsfyrdhgyxgcrv
```

App backend URL:

```text
https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api
```

MCP endpoint:

```text
https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/mcp
```

## Health and canary checks

Run these checks after deployment and record the result in the relevant slice evidence or release manifest. A documented command and expected response do not prove a current production deployment.

```bash
curl https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "throughline-supabase-edge-api",
  "storage": "supabase",
  "auth_required": true,
  "authenticated": false,
  "transcription": "groq"
}
```

Authenticated check:

```bash
curl \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/recordings
```

## iPhone Setup

Open Throughline:

1. Sign up or sign in.
2. Record a short note.
3. Wait for the transcript and note preview.
4. Open settings only when you want to connect an agent or manage the account.

## MCP Setup

The deployed `mcp` Edge Function exposes the same read-only memory tools as the local stdio MCP server:

- `get_today`
- `get_daily_loop`
- `get_recordings`
- `get_recording`
- `search`
- `list_open_todos`
- `get_recent_reflections`
- `get_energy_patterns`
- `get_balance_snapshot`

It accepts MCP-style JSON-RPC over HTTP. Agents that support remote MCP with custom bearer headers can use the deployed endpoint. The iOS app exposes this as `settings -> connect an agent`, where the user can mint a read-only MCP token and copy a Claude Code or Codex CLI setup command.

See [agent-connect.md](agent-connect.md) for copy-paste setup commands and the starter agent prompt.

Agents that do not yet support authenticated remote MCP can still use:

```bash
npm run mcp:stdio
```

That local MCP server reads the same Supabase data when `.env.local` points at Supabase.

## Audio Retention

Audio objects are retained separately from transcripts and structured notes. To enforce the 30-day audio retention posture before App Store submission, schedule the protected maintenance endpoint:

```bash
curl -X POST \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/maintenance/audio-retention
```

The endpoint deletes stored audio objects older than `THROUGHLINE_AUDIO_RETENTION_DAYS` and marks their recording audio metadata as expired. Transcripts and structured notes remain available to the app and MCP tools.

## App Store Direction

The Release iOS config leaves `THROUGHLINE_API_TOKEN` empty. Users authenticate with Supabase Auth, and the Edge Function derives the user id from the Supabase JWT. Keep the service token only for backend maintenance and dogfood scripts.
