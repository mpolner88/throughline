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

### `PATCH /recordings/:id`

Edits a recording's transcript and structured note in place. Any subset of `transcript` (or `transcript_raw`), `title`, `summary`, `type`, `most_important`, `todos`, and `tomorrow_todos` may be sent. `todos` accepts strings or objects with `text`, `status`, `priority`, `due`, `for_date`, `timeframe`, and `context`; sending `todos` without `tomorrow_todos` clears `tomorrow_todos`. Editing `most_important` or `todos` rebuilds `action_items` while keeping the ids and completion state of items that were already there.

```json
{
  "title": "Launch checklist",
  "todos": [
    { "text": "Call Sam about the beta", "due": null, "timeframe": "today", "priority": "high" },
    { "text": "Update the launch checklist", "due": "2026-05-03", "timeframe": null, "priority": null }
  ]
}
```

Returns `{ "recording" }`. Every edit is also captured as an extraction correction: the server writes a feedback item with `source: "note_edit"` and `status: "eval_candidate"` (see the feedback section below). If that write fails, the edit still succeeds and the response carries `feedback_error` with the message.

### `PATCH /recordings/:id/action-items`

Toggles or moves one task in a recording. The body carries `text` plus exactly one of:

- `{ "text": "Call Sam about the beta", "completed": true }` marks the matching action item and its todo twin completed (or open again with `false`). When nothing in the note matches, a manual action item is added.
- `{ "text": "Call Sam about the beta", "timeframe": "later", "local_date": "2026-05-02" }` moves the task to another tab by rewriting the todo's `timeframe`. `timeframe` is `today`, `this_week`, or `later`; `local_date` is the caller's local date as `YYYY-MM-DD` and is required. Moving to `today` pins `due` to `local_date` so the task stays in today across day boundaries; the other buckets clear `due` and `for_date` and rely on `timeframe` alone. Returns 404 when the recording has no todo or manual action item with that text.

Pass `?tz=Area/City` so the rebuilt list uses the caller's zone (defaults to `UTC`). Both forms answer `{ "recording", "tasks" }`, where `tasks` is the same shape as `GET /tasks` for `local_date` (or today in `tz`), so the client can redraw the list without a second request.

Completion toggles do not write feedback. A move does: it writes a feedback item with `source: "task_move"` and `status: "eval_candidate"`, and a failed write adds `feedback_error` to the response instead of failing the move.

### `GET /tasks`

Returns the running task list merged across every processed recording. Query parameters:

- `date`: the client's local date as `YYYY-MM-DD`. Defaults to today in `tz`. Pass it so the server never guesses the client's day.
- `tz`: IANA time zone used to resolve today and completion dates, for example `America/New_York`. Defaults to `UTC`. An unrecognised zone falls back to `UTC` rather than failing the request.

The list is a derived view built by `buildTaskList` in `core/task-list.mjs`; nothing about buckets is stored. The rules:

- Tasks match by normalized text (lowercase, punctuation stripped, whitespace collapsed), the same key `action_items` uses. Each text appears once across all recordings.
- The newest recording that mentions a task owns its text, dates, `timeframe`, `priority`, and provenance, so a restatement re-buckets the task instead of duplicating it. Older mentions only contribute completion and `first_seen_local_date`.
- Completion never reopens: a task completed in any note stays completed. Done tasks stay in `done` until the next local day, then leave the list (they remain in the note's `action_items`).
- The bucket comes from `deriveBucket`: `due` (or `for_date`) on or before `date` is `today`, on or before the Sunday ending the Monday to Sunday week is `this_week`, later dates are `later`; with no date, `timeframe` decides and `null` falls to `later`.
- An open task whose date is before `date` is `carried: true`. After more than 7 days it drops from today to later and keeps the marker.
- Sort: today is carried first, then `priority: "high"`, then newest recording and spoken order; this week is `due` ascending (undated last), then priority, then newest; later is newest recording first; done is most recently completed first.

Example, generated from `buildTaskList` for a morning note and the previous evening's note on `2026-09-09` in `America/New_York`:

```json
{
  "date": "2026-09-09",
  "week_end": "2026-09-13",
  "today": [
    {
      "id": "act_reply-to-omar-about-the-venue",
      "text": "Reply to Omar about the venue",
      "status": "open",
      "bucket": "today",
      "timeframe": "today",
      "due": "2026-09-08",
      "priority": null,
      "recording_id": "rec_last_night",
      "recording_title": "Evening wrap-up",
      "recording_created_at": "2026-09-09T01:10:00.000Z",
      "spoken_index": 0,
      "first_seen_local_date": "2026-09-08",
      "carried": true,
      "completed_at": null,
      "context": null,
      "source": "todo"
    },
    {
      "id": "act_call-marcus-about-the-contract",
      "text": "Call Marcus about the contract",
      "status": "open",
      "bucket": "today",
      "timeframe": "today",
      "due": "2026-09-09",
      "priority": "high",
      "recording_id": "rec_morning",
      "recording_title": "Morning walk",
      "recording_created_at": "2026-09-09T11:42:00.000Z",
      "spoken_index": 0,
      "first_seen_local_date": "2026-09-08",
      "carried": false,
      "completed_at": null,
      "context": null,
      "source": "todo"
    }
  ],
  "this_week": [
    {
      "id": "act_send-the-deck",
      "text": "Send the deck",
      "status": "open",
      "bucket": "this_week",
      "timeframe": null,
      "due": "2026-09-11",
      "priority": null,
      "recording_id": "rec_morning",
      "recording_title": "Morning walk",
      "recording_created_at": "2026-09-09T11:42:00.000Z",
      "spoken_index": 1,
      "first_seen_local_date": "2026-09-09",
      "carried": false,
      "completed_at": null,
      "context": null,
      "source": "todo"
    }
  ],
  "later": [
    {
      "id": "act_book-the-dentist",
      "text": "Book the dentist",
      "status": "open",
      "bucket": "later",
      "timeframe": "later",
      "due": null,
      "priority": null,
      "recording_id": "rec_morning",
      "recording_title": "Morning walk",
      "recording_created_at": "2026-09-09T11:42:00.000Z",
      "spoken_index": 2,
      "first_seen_local_date": "2026-09-09",
      "carried": false,
      "completed_at": null,
      "context": null,
      "source": "todo"
    }
  ],
  "done": [],
  "counts": {
    "today": 2,
    "this_week": 1,
    "later": 1
  }
}
```

"Call Marcus about the contract" was in both notes; the morning restatement owns it (`recording_id`, `due`, `priority`) while `first_seen_local_date` comes from the evening note. `source` is `todo` for extracted tasks and `manual` for action items added through the completion endpoint. `counts` covers the three open buckets only.

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

If `expected` contains a corrected extraction object, the feedback item is marked `eval_candidate`; otherwise it is marked `needs_review`. Items from this endpoint carry `source: "alpha_feedback"`.

Edits and moves write feedback items of the same shape without any user grading, so the correction the user already made becomes an eval candidate on its own:

- `PATCH /recordings/:id` writes `source: "note_edit"`.
- `PATCH /recordings/:id/action-items` with `timeframe` writes `source: "task_move"`. Completion toggles write nothing.

Both use `status: "eval_candidate"`, `expected` set to a copy of `structured_note` after the change, and `recording_snapshot` holding `id`, `user_local_time`, `timezone`, `type`, `transcript_raw`, and a copy of `structured_note` before the change. `answers` is `{ "rubric_version": "note_edit_v1", "quality_score": null, "issue_types": [], "correction": null, "agent_ready": null, "should_remember": true, "missing": null, "invented": null }`. A failed feedback write never fails the edit; the response gains `feedback_error` instead. `npm run eval:import-feedback` reads these files from `backend/data/feedback` and turns them into private fixtures (see `evals/README.md`).

### `GET /feedback`

Returns feedback summaries, including `source` and `status`, for every item: graded, edited, and moved.

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

`get_today` accepts `date` (`YYYY-MM-DD`), `tz` (IANA zone, defaults to `UTC`), and `type`. Besides `recordings` and `count`, its output has `tasks`: the today bucket of the running list for that date, merged across every note, so "what is on my plate" is one call.

`list_open_todos` accepts the date filters, `date`, `tz`, `bucket` (`today`, `this_week`, or `later`), `priority`, `include_completed`, and `limit`. It returns `{ "date", "todos" }` where each open task appears once across all recordings with `bucket`, `timeframe`, `due`, `priority`, `carried`, and `first_seen_local_date`, ordered today, then this week, then later. With `include_completed: true`, every cleared task follows the open ones with `status: completed`, on any date, even though the app's `done` group only holds tasks cleared that day. With no `bucket` or `priority` filter, open most-important action items follow the tasks with `bucket: null`, as agents have always seen them here. `priority` only matches `high`; tasks never carry `medium` or `low`.

Examples:

```bash
curl -X POST http://localhost:5180/agent/tools/search \
  -H "Content-Type: application/json" \
  --data '{"query":"pricing Sarah","limit":5}'
```

```bash
curl -X POST http://localhost:5180/agent/tools/list_open_todos \
  -H "Content-Type: application/json" \
  --data '{"date":"2026-09-09","tz":"America/New_York","bucket":"today"}'
```

These endpoints are local development scaffolding. Production should expose the same behavior through the authenticated per-user MCP endpoint.

Run the memory tool smoke check:

```bash
npm run agent:smoke
```

Run the note edit smoke check (`PATCH /recordings/:id` against a temporary stub with the dev extractor):

```bash
npm run note:edit:smoke
```

Run the task list smoke check. It boots the same temporary stub, posts two notes that share a task plus two older notes with dateless "today" todos, and asserts one row for the shared task, correct buckets for yesterday, today, this week, a dated later item and a spoken later item, the carried marker on the dateless todos (the ten-day-old one dropped to later), carried-then-priority ordering in today, matching `counts`, completion without a feedback row, a `task_move` and a `note_edit` `eval_candidate` row, no row for a repeated move or an empty edit, a manual completion that survives a later move, the `bucket` and `include_completed` inputs on `list_open_todos`, and `tasks` on `get_today`:

```bash
npm run task:smoke
```

`npm run check` runs both smokes along with the contract check, `eval:check`, `agent:smoke`, and `mcp:smoke`.

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
