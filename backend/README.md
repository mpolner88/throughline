# Throughline Backend Stub

This is the local upload target for the v0 iOS shell.

It now has two storage modes:

- `file`: local JSON/audio files under `backend/data`.
- `supabase`: hosted persistence using Supabase Postgres and Storage.

The API shape is intentionally small so the same capture contract can run locally, behind a tunnel, or as a hosted dogfood backend.

## Commands

```bash
npm run stub:dev
```

Run with the local fake extractor for end-to-end plumbing:

```bash
npm run stub:dev:extract
```

Run with Supabase persistence:

```bash
THROUGHLINE_STORAGE=supabase npm run stub:dev:supabase
```

Default URL:

```text
http://localhost:5180
```

## Endpoints

### `GET /health`

Returns:

```json
{
  "ok": true,
  "service": "throughline-backend-stub",
  "storage": "file"
}
```

### `POST /recordings`

Creates a recording and writes metadata to the configured storage backend.

If `transcript_raw` is present and `THROUGHLINE_EXTRACTOR_COMMAND` is configured, the backend runs the extraction prompt and stores `structured_note` on the recording. If the upload is raw audio, the recording remains `needs_transcript` unless a transcriber is explicitly configured.

JSON request:

```json
{
  "duration_seconds": 42,
  "user_local_time": "2026-05-02T09:41:00-04:00",
  "timezone": "America/New_York",
  "type": "freeform",
  "transcript_raw": "Voice note text if already available",
  "audio_base64": "optional base64 audio bytes",
  "audio_mime_type": "audio/m4a"
}
```

Raw audio request:

```bash
curl -X POST http://localhost:5180/recordings \
  -H "Content-Type: application/octet-stream" \
  -H "X-Throughline-Duration-Seconds: 42" \
  -H "X-Throughline-User-Local-Time: 2026-05-02T09:41:00-04:00" \
  -H "X-Throughline-Timezone: America/New_York" \
  -H "X-Throughline-Recording-Type: freeform" \
  --data-binary @sample.m4a
```

Returns:

```json
{
  "id": "rec_...",
  "status": "uploaded",
  "processing_status": "processed",
  "has_note": true,
  "recording_url": "/recordings/rec_..."
}
```

Processing statuses:

- `needs_transcript`: raw audio is stored, but there is no transcript yet.
- `transcribed`: audio was transcribed but not yet extracted. This is usually only an intermediate state.
- `needs_extractor`: a transcript exists, but no extractor command is configured.
- `processed`: `structured_note` was generated and stored.
- `transcription_failed`: transcription failed; see `recording.transcription.error`.
- `extraction_failed`: extraction failed; see `recording.extraction.error`.

### `POST /recordings/:id/extract`

Adds or updates a transcript and reruns extraction for an existing recording.

```json
{
  "transcript_raw": "Tomorrow call Sarah before lunch and rewrite the pricing note.",
  "user_local_time": "2026-05-02T21:15:00-04:00",
  "timezone": "America/New_York",
  "type": "evening"
}
```

### `GET /recordings/:id`

Returns the stored recording metadata.

### `GET /recordings`

Returns stored recording summaries.

### `POST /recordings/:id/feedback`

Stores sparse alpha feedback against a recording. This is the start of the eval-feedback loop: feedback is captured as reviewable data first, not automatically used to change extraction behavior.

```json
{
  "agent_ready": false,
  "should_remember": true,
  "missing": "It missed that I wanted Sarah called before lunch.",
  "invented": "It added a dashboard task I did not mean.",
  "correction": "Call Sarah before lunch should be the high-priority tomorrow todo.",
  "expected": null
}
```

If `expected` contains a corrected extraction object, the feedback item is marked `eval_candidate`; otherwise it is marked `needs_review`.

### `GET /feedback`

Returns feedback summaries.

### `GET /feedback/:id`

Returns the stored feedback item, including the recording snapshot and optional corrected extraction.

## Agent memory tools

The backend exposes the v1 read-only MCP tool surface as plain JSON endpoints first. This keeps the behavior testable before adding the MCP transport.

### `GET /agent/tools`

Returns the available read-only tool names:

- `get_today`
- `get_daily_loop`
- `get_recordings`
- `get_recording`
- `search`
- `list_open_todos`
- `get_recent_reflections`
- `get_energy_patterns`
- `get_balance_snapshot`

### `POST /agent/tools/:tool_name`

Runs one tool with JSON input and returns `{ "tool", "output" }`.

Examples:

```bash
curl -X POST http://localhost:5180/agent/tools/search \
  -H "Content-Type: application/json" \
  --data '{"query":"pricing Sarah","limit":5}'
```

```bash
curl -X POST http://localhost:5180/agent/tools/list_open_todos \
  -H "Content-Type: application/json" \
  --data '{"priority":"high"}'
```

These endpoints are local development scaffolding. Production should expose the same behavior through the authenticated per-user MCP endpoint.

Run the memory tool smoke check:

```bash
npm run agent:smoke
```

Run the local stdio MCP adapter:

```bash
npm run mcp:stdio
```

Smoke-test the MCP handshake, `tools/list`, and `tools/call`:

```bash
npm run mcp:smoke
```

The adapter reads recordings from `backend/data/recordings` by default. Use `THROUGHLINE_STUB_DATA_DIR=/path/to/data` or `THROUGHLINE_RECORDINGS_DIR=/path/to/recordings` to point it at another local store.

For Supabase-backed MCP reads, set the same Supabase environment variables and `THROUGHLINE_STORAGE=supabase`.

## Storage configuration

Local file storage is the default:

```bash
THROUGHLINE_STORAGE=file npm run stub:dev:extract
```

Supabase storage requires:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AUDIO_BUCKET` optional, defaults to `throughline-audio`
- `THROUGHLINE_USER_ID` optional, defaults to `dev-user`
- `THROUGHLINE_API_TOKEN` optional locally, required for deployed public backends

First run the schema in:

```text
supabase/migrations/0001_throughline_memory.sql
```

Then start the backend:

```bash
THROUGHLINE_STORAGE=supabase \
SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
THROUGHLINE_API_TOKEN=YOUR_BACKEND_API_TOKEN \
THROUGHLINE_TRANSCRIBER=groq \
THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs \
npm run stub:dev
```

Keep the service-role key server-side only. Never put it in the iOS app or browser mockup.

## Extraction configuration

Environment variables:

- `THROUGHLINE_TRANSCRIBER`: optional. Set to `groq` to transcribe raw audio before extraction.
- `GROQ_TRANSCRIPTION_MODEL`: optional. Defaults to `whisper-large-v3-turbo`.
- `THROUGHLINE_EXTRACTOR_COMMAND`: executable command that receives `{ id, metadata, transcript, prompt }` on stdin and returns strict JSON.
- `THROUGHLINE_EXTRACTION_PROMPT`: prompt path. Defaults to `evals/prompts/extract-note-v0.md`.

Use Groq for extraction locally:

```bash
THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs npm run stub:dev
```

Use Groq for transcription and extraction locally:

```bash
THROUGHLINE_TRANSCRIBER=groq \
THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs \
npm run stub:dev
```

Use the fake local extractor:

```bash
npm run stub:dev:extract
```

The fake extractor is only for plumbing tests. It does not represent production extraction quality.

## Feedback loop posture

The backend captures feedback as reviewable eval candidates. It does not auto-train, auto-change prompts, or auto-deploy extraction behavior. The intended loop is:

1. Capture sparse feedback on selected notes.
2. Review feedback into labeled fixtures.
3. Run eval profiles.
4. Let an agent propose prompt or post-processing changes.
5. Promote changes only after evals improve without regressions.
