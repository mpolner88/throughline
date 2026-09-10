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
- Edge Function `api` for app uploads, transcription, extraction, feedback, note reads and edits, and the running task list.
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

The usual path is the deploy script:

```bash
npm run supabase:deploy
```

It runs the extraction contract check (the same check as `npm run contract:check`) before deploying any function and stops if the generated files under `supabase/functions/_shared/` are stale. After changing `evals/prompts/extract-note-v0.md`, `core/extraction-contract.mjs`, or `core/task-list.mjs`, run `npm run contract:sync` and commit the generated files before deploying. The Edge Function reads those copies, so this is what keeps production on the same prompt and normaliser the eval scores.

To deploy by hand:

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

## Task List

The home screen is a running task list derived from every note. The `api` function serves it the same way the local stub does, from the generated copy of `core/task-list.mjs` under `supabase/functions/_shared/`, so buckets are never stored and there is no tasks table.

```bash
curl \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  "https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/tasks?date=2026-09-09&tz=America/New_York"
```

`GET /tasks?date=YYYY-MM-DD&tz=Area/City` returns `{ date, week_end, today, this_week, later, done, counts }`. The client passes its own local date and zone so the server never guesses the day boundary. Each task appears once across all recordings, keyed by normalized text; the newest note that mentions it owns its dates and provenance, completion never reopens, and done tasks leave the list at the next local day.

`PATCH /recordings/:id/action-items?tz=Area/City` takes `{ text, completed }` to toggle completion or `{ text, timeframe, local_date }` to move a task to `today`, `this_week`, or `later`. Both answer `{ recording, tasks }` with the rebuilt list. `PATCH /recordings/:id` edits the note's transcript, title, summary, type, most important, and todos (including `timeframe` and `priority`).

The request and response shapes, the bucket rules, the sort order, and a full example response are documented in `backend/README.md`; the Edge Function and the stub share the same code and answer the same shapes.

## Corrections As Eval Candidates

Every note edit and every task move is an extraction correction the user already made, so the `api` function records it as one. `PATCH /recordings/:id` and the `timeframe` form of `PATCH /recordings/:id/action-items` write a `throughline_feedback` row with `status: eval_candidate`, `source: note_edit` or `task_move`, `expected` set to the structured note after the change, and `recording_snapshot` holding the transcript and the structured note before it. Completion toggles do not write feedback. A failed feedback insert never fails the edit; the response carries `feedback_error` instead. `GET /feedback` summaries include `source` and `status` so these rows are easy to tell apart from grades.

Pull the candidates into the eval workspace with the service role key:

```bash
npm run feedback:export
```

`scripts/export-feedback.mjs` reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the environment or from `.env.local` / `.env` (same lookup as the deploy script) and exits 1 with a clear message when either is missing. It pages through `throughline_feedback` with `status = eval_candidate` ordered by `created_at`, writes each row's `feedback` object to `backend/data/feedback/<id>.json` (gitignored), skips files whose content is unchanged, and prints only counts: fetched, written, unchanged. Flags: `--status <status>` (default `eval_candidate`) and `--out <dir>` (default `backend/data/feedback`).

Then `npm run eval:import-feedback` turns each exported row into a fixture under `evals/tmp/feedback-fixtures/`, and a human promotes reviewed fixtures to `evals/fixtures/labeled/`. See `evals/README.md` for the full loop. Keep the service role key server-side and in `.env.local` only.

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

`get_today` accepts `date` and `tz` and returns `tasks` (the today bucket of the running list) alongside the day's recordings. `list_open_todos` returns each open task once across all recordings with its `bucket`, and accepts `date`, `tz`, and a `bucket` filter (`today`, `this_week`, or `later`). Both use the same `core/task-list.mjs` logic as `GET /tasks`.

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
