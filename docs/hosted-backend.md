# Supabase Backend

Throughline uses Supabase as the hosted backend.

```text
iPhone app -> Supabase Edge Function -> Supabase Postgres/Storage -> Groq
                                           |
                                           -> MCP memory endpoint
```

This replaces the separate Google Cloud / Docker deployment path. The only server code we need for dogfood is in `supabase/functions`.

## What Supabase Owns

- Postgres tables for recordings and feedback.
- Private Storage bucket for audio.
- Edge Function `api` for app uploads, transcription, extraction, feedback, and note reads.
- Edge Function `mcp` for read-only agent memory tools.
- Project secrets for private keys such as `GROQ_API_KEY`.

## Prepare Database

The project is already linked to Supabase project `ywsenspsfyrdhgyxgcrv`.

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
  THROUGHLINE_USER_ID=dev-user
```

Optional MCP-specific token:

```bash
supabase secrets set THROUGHLINE_MCP_TOKEN=...
```

If `THROUGHLINE_MCP_TOKEN` is absent, the MCP endpoint uses `THROUGHLINE_API_TOKEN`.

## Deploy Functions

The current iOS client sends a Throughline bearer token, not a Supabase Auth JWT, so deploy with Supabase JWT verification disabled and let the function check `THROUGHLINE_API_TOKEN`.

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

## Check Health

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

1. Tap `connect ->`.
2. Use `https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api`.
3. Paste the `THROUGHLINE_API_TOKEN`.
4. Tap `check`.
5. Record a short note.

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

## App Store Direction

`THROUGHLINE_API_TOKEN` is a dogfood shortcut. Before App Store release, replace it with Supabase Auth so each user signs in and the Edge Function derives the user id from the Supabase JWT. The backend stays Supabase either way.
