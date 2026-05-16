# Throughline

Throughline is where you speak notes for your AI agent.

At the product surface, it is a voice note app: say anything, and the note becomes available to Claude, ChatGPT, Cursor, or any MCP client you connect.

Under the hood, each note becomes transcript, structured extraction, and searchable memory exposed through a personal MCP endpoint.

## Local capture loop

Run the backend with the fake extractor:

```bash
npm run stub:dev:extract
```

Run the browser capture client:

```bash
npm run mockup:dev
```

Open `http://localhost:5173`, send a note, then query it through the local MCP adapter:

```bash
npm run mcp:stdio
```

The fake extractor is only for local plumbing. Use `THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs npm run stub:dev` when you want live extraction quality.

## iOS dogfood

The iOS app points at the Supabase Edge Function by default:

```text
https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api
```

Use the in-app `backend` / `connect →` settings to paste the dogfood API token or switch to a local backend.

For real voice notes:

```bash
THROUGHLINE_TRANSCRIBER=groq THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs npm run stub:dev
```

Run `ios/Throughline.xcodeproj` from Xcode on your iPhone and tap `check` before recording.

## Supabase backend

Supabase is the hosted backend for dogfood:

- `supabase/functions/api` receives app recordings and stores processed notes.
- `supabase/functions/mcp` exposes read-only agent memory tools over MCP-style JSON-RPC.
- `supabase/migrations` owns the Postgres and Storage setup.

See [docs/hosted-backend.md](/Users/mikepolner/Documents/Throughline/docs/hosted-backend.md) for deploy commands and environment variables.
