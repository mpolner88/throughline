# Throughline

Throughline is where you speak notes for your AI agent.

## Start here

Returning to the project: read the [September 28 audit](docs/evidence/2026-09-28-return-audit.md) for the local/cloud work map, unfinished work, verified release state, and recovered ideas. Then use the [Claude–Codex operating loop](docs/AGENT_TANDEM.md#daily-working-agreement) for the next bounded assignment. The audit is dated evidence; the canonical sources below remain authoritative.

Before planning or changing the product, follow the repository guide in [AGENTS.md](AGENTS.md). The canonical operating path is:

1. [Verified current state](docs/CURRENT_STATE.md)
2. [Durable product charter](docs/PRODUCT.md)
3. The relevant [program](docs/programs/core-quality-learning.md) or slice brief
4. [Slice workflow and authority](docs/WORKFLOW.md)
5. [Metric definitions](product/metrics.md) and [prioritized backlog](product/backlog.json)

For visual or interaction work, also read the canonical [brand and product-design principles](throughline-brand-decisions.md) before proposing a target.

For UI work split between Claude Code and Codex, use the [design-to-release tandem workflow](docs/AGENT_TANDEM.md). Claude Code begins at [CLAUDE.md](CLAUDE.md); the copy-ready [UI design prompt](docs/prompts/claude-code-ui-design.md) produces a repository handoff for Codex rather than relying on conversation memory.

The remainder of this README is developer setup, not proof of current deployment, release, or provider state.

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

Release builds use Supabase Auth. Debug builds keep the backend panel available for local backend work and dogfood token checks.

For real voice notes:

```bash
THROUGHLINE_TRANSCRIBER=groq THROUGHLINE_EXTRACTOR_COMMAND=./evals/adapters/groq-extract.mjs npm run stub:dev
```

Run `ios/Throughline.xcodeproj` from Xcode on your iPhone, sign in, and record.

## Supabase backend

Supabase is the hosted backend for dogfood:

- `supabase/functions/api` receives app recordings and stores processed notes.
- `supabase/functions/mcp` exposes read-only agent memory tools over MCP-style JSON-RPC.
- `supabase/migrations` owns the Postgres and Storage setup.

See the [hosted-backend runbook](docs/hosted-backend.md) for deploy commands and environment variables. See [current state](docs/CURRENT_STATE.md) for verified release/runtime facts and [App Store readiness](docs/app-store-readiness.md) only for the mutable packaging checklist.

## Brand assets

The canonical logo assets live in `assets/brand/`:

- `throughline-mark.svg` — electric-blue standalone mark
- `throughline-mark-white.svg` — white standalone mark for blue/dark surfaces
- `throughline-lockup.svg` — underlined lowercase wordmark
- `throughline-app-icon.svg` — source reference for the generated iOS line icon

Public app links:

- Privacy policy: `https://mpolner88.github.io/throughline/privacy/`
- Support: `https://mpolner88.github.io/throughline/support/`
