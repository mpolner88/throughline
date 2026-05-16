# Throughline — Product Spec v0

> Canonical reference for what we're building. Source of truth for product decisions. Brand decisions (visual identity, voice, design system) live in `throughline-brand-decisions.md`.

---

## 1. Summary

Throughline is where you speak notes for your AI agent. You speak into your phone — on a walk, on a drive, in the morning — and that note becomes available to Claude, ChatGPT, Cursor, or any MCP client through your personal MCP endpoint. The agent orchestrates whatever you've already wired up: Obsidian, Todoist, Calendar, Linear.

Throughline is a voice note app first, the same way Obsidian is a note-taking app first. People can say anything into Throughline and trust that their AI agent can use it. Underneath that simple surface, Throughline is the voice-powered queryable memory layer for AI agents: each note becomes transcript, structured extraction, and searchable memory exposed through MCP. Obsidian owns notes-based memory; no one owns voice-based memory. The mobile app is the input device; the MCP server is the product.

- **Tagline:** voice → agent
- **Subhead:** the shortest path from your voice to your AI agent
- **Promise:** Throughline is the quiet thread between what you said and what your AI does next.

---

## 2. Positioning

### What's different

Existing voice-to-text apps (Voicenotes, AudioPen, Whisper Memos, Letterly) are integration silos. They push your transcripts to Notion, Obsidian, or Todoist via Zapier or built-in connectors. Throughline pushes nothing. It hosts your voice notes as a queryable data source; your AI agent reads them and does the orchestration using its own MCP tools.

This means:

- We don't build or maintain integrations to other tools.
- The agent ecosystem absorbs the integration work.
- Power users find us through connector directories (Claude.ai settings, ChatGPT MCP catalog), not just the App Store.
- We stay tiny while the value compounds with the agent ecosystem.

### Target user

An AI-curious knowledge worker who:

- Already pays for Claude Pro, ChatGPT Plus, or both.
- Has a second-brain practice (Obsidian, Notion, Logseq, Roam).
- Reflects on walks, drives, mornings, or evenings.
- Wants voice → action without a Zapier chain.
- Will pay $9.99/mo for less friction.

Not the broad voice memo market. Specifically the overlap of "voice journaler" and "AI power user."

### Competitive landscape

| App | Price | Mobile | MCP | Positioning |
|---|---|---|---|---|
| Voicenotes | $99/yr | Yes | No | Meetings + workspace integrations |
| AudioPen | $99/yr | Yes | No | Journaling, cleaned-up prose |
| Whisper Memos | ~$60/yr | Yes | No | Email-routed agents, ADHD framing |
| Apple Voice Memos | Free | Yes | No | OS-native, no agent surface |
| Whisper Notes | $6.99 once | Yes | No | Offline transcription only |
| **Throughline** | **$9.99/mo** | **Yes** | **Yes** | **Voice-powered queryable memory for AI agents** |

The wedge: nobody combines (1) mobile-first capture, (2) hosted MCP endpoint, (3) prosumer pricing, and (4) voice-as-queryable-memory positioning.

---

## 3. Product principles

These shape every decision:

1. **Personal, not professional.** Not a meeting recorder. Not a Granola competitor. Morning rituals, evening reflections, walks, drives, idea capture.
2. **Mobile-first capture, agent-first review.** Record on the phone. Query from any MCP client.
3. **The note is the user-facing object.** The user experience is simple: speak anything into Throughline, and your AI agent can use it. The extraction and MCP endpoint are the passthrough layer that make the note useful.
4. **The MCP is the product.** The app is the input device. Features that compete with the agent surface (search dashboards, lists in-app) are deferred or never built.
5. **Small surface area.** No integrations. No Zapier. The agent ecosystem handles routing.
6. **Quiet, not loud.** Restrained UI. The user is the focal point. (See brand decisions doc for full voice principles.)
7. **Memory persistence is the moat.** Schema and extraction quality become commodity over time; the user's accumulated voice data is what compounds.

---

## 4. Core user flow: the daily loop

Throughline is built around a daily rhythm — not a feature list but a habit:

**Morning** — user records on a walk, drive, or first thing. Tells Throughline what's on their mind, what they want to accomplish today, how they're feeling. Recording is transcribed and structured into todos, priorities, intentions, mood, tags.

**Throughout the day** — user opens Claude (or ChatGPT, Cursor, etc.) and asks something like *"what's on my plate today?"*. The agent calls Throughline's `get_today` MCP tool, reads the morning recording's structured output, and orchestrates downstream work using whatever MCPs the user has connected: updating their Obsidian daily note, adding tasks to Todoist, blocking calendar time, drafting emails. **None of these integrations are Throughline's responsibility.**

This loop requires the user to have connected Throughline to their AI agent. Connection happens after sign-up, not during onboarding, via the home screen's `connect →` affordance. Users who have not connected can still record and see structured output in-app; they do not have agent-side query capability until they connect.

**Evening** — user records a reflection on the drive home or at end of day. Server auto-links it to the morning recording (same calendar day in user's local timezone). The agent can now answer *"did I do what I said I'd do today?"* by comparing morning priorities to evening accomplishments.

**Weekly** — Sunday night reflection. Longer recording. Agent can answer *"how was this week, where did my energy go, what should I carry into next week?"* by querying across the week's recordings.

---

## 5. Recording schema

Every recording produces one typed object. Speech is freeform — the user just talks. After recording, an LLM (Llama 3.1 8B on Groq, ~$0.0001/recording) extracts structure into the schema below. Validated server-side; on validation failure, retry once, then fall back to a minimal-fields version.

```typescript
interface Recording {
  // Identity & timing
  id: string                    // uuid v7 (time-sortable)
  user_id: string
  created_at: string            // ISO 8601 UTC
  user_local_time: string       // ISO 8601 in user's TZ
  duration_seconds: number
  time_of_day: "morning" | "afternoon" | "evening" | "night"

  // Type & framing
  type: "morning" | "evening" | "weekly_review" | "freeform"
  title: string                 // LLM-generated, ≤80 chars
  summary: string               // LLM-generated, 1–2 sentences
  linked_recording_id: string | null   // morning ↔ evening pair (same calendar day)

  // Content
  transcript: string            // cleaned (filler removed)
  transcript_raw: string        // original Whisper output, preserved

  // Shared extracted structure
  todos: Todo[]
  reflections: Reflection[]
  questions: Question[]
  notes: Note[]

  // Morning / weekly_review fields
  priorities: string[]
  intentions: string[]

  // Evening fields
  accomplishments: string[]
  time_spent: { area: string; description: string }[]
  lessons: string[]
  tomorrow_todos: string[]      // appear immediately in list_open_todos

  // Daily checklist
  energy_givers: string[]
  energy_sappers: string[]
  energy_recoverers: string[]
  went_well: string[]
  carry_forward: string[]

  // Dimensional tagging
  centers_of_balance: ("health" | "relationships" | "passions" | "purpose" | "profession")[]
  mood: Mood | null
  tags: string[]
  people: string[]
  projects: string[]

  // Audio
  audio_url: string | null      // signed URL, 7-day TTL, regeneratable; underlying audio deleted after 30 days
}

interface Todo {
  id: string
  text: string                  // imperative form ("Call Sarah", not "I should call Sarah")
  status: "open" | "done"       // always "open" in v1 (read-only MCP)
  priority: "high" | "medium" | "low" | null
  due: string | null            // ISO date if mentioned aloud
  for_date: string | null       // ISO date for tomorrow_todos
  context: string | null
}

interface Reflection {
  id: string
  text: string
  mood: Mood | null
}

interface Note     { id: string; text: string; tags: string[] }
interface Question { id: string; text: string }

type Mood =
  | "focused" | "energized" | "grateful" | "calm"
  | "anxious" | "frustrated" | "tired" | "sad"
  | "neutral"
```

**Key design decisions:**

- All array fields default to `[]`. The LLM only fills what the user actually said. No invention.
- `transcript_raw` is included by default for fidelity.
- `linked_recording_id` only links recordings on the same calendar day in user's local timezone.
- `tomorrow_todos` appear in `list_open_todos` immediately after processing — agents can surface them right away.
- `centers_of_balance` is the locked enum: Health, Relationships, Passions, Purpose, Profession. Multiple allowed per recording.

---

## 6. MCP tool surface (v1)

Nine read-only tools exposed via a per-user MCP endpoint at `https://throughline.app/mcp/{user_token}`. v1 is read-only; v2 adds write tools (mark todos done, append to recordings).

### `get_today`
Today's recordings. Most-called tool.
```
input:  { type? }
output: { recordings: Recording[]; count: number }
```

### `get_daily_loop`
Morning + evening recording for a date plus a computed completion summary.
```
input:  { date? }   // defaults to today
output: { morning, evening, completion: { satisfied, outstanding, unplanned } }
```

### `get_recordings`
Date range and type filter, paginated.
```
input:  { start_date?, end_date?, type?, limit?, cursor? }
output: { recordings: Recording[]; next_cursor }
```

### `get_recording`
Fetch one by ID.
```
input:  { id }
output: { recording }
```

### `search`
Hybrid search (BM25 + embeddings) across transcripts and extracted fields.
```
input:  { query, start_date?, end_date?, type?, limit? }
output: { results: { recording, score, matched_excerpt }[] }
```

### `list_open_todos`
Open todos with parent recording context. Includes `tomorrow_todos`.
```
input:  { start_date?, priority?, limit? }
output: { todos: (Todo & { recording_id, recording_created_at, recording_title })[] }
```

### `get_recent_reflections`
Reflections with mood/date filter.
```
input:  { days?, mood?, limit? }
output: { reflections: (Reflection & { recording_id, recording_created_at })[] }
```

### `get_energy_patterns`
Aggregated energy_givers / energy_sappers / energy_recoverers over a date range with frequency counts.
```
input:  { start_date?, end_date? }
output: { givers: { item, count }[], sappers, recoverers }
```

### `get_balance_snapshot`
Counts of how often each Center of Balance came up over a date range, with example excerpts.
```
input:  { start_date?, end_date? }
output: { health: { count, examples }, relationships, passions, purpose, profession }
```

**Tool design principles:**

- Names read like questions a user would ask ("get today" not "query_recordings_with_filters").
- Descriptions written for the LLM to read; trigger phrases included.
- Inputs strict (enums, ISO dates); outputs rich (the LLM can ignore what it doesn't need).
- 9 tools is the sweet spot — generic enough to combine, specific enough that the LLM picks the right one.

---

## 7. Onboarding flow

Four screens. Locked design.

1. **Hero** — tagline (voice → agent), subhead, "try it" CTA. Unauthenticated.
2. **Record** — one-tap record, big electric blue button, 30-second demo cap, no account required.
3. **Magic moment** — italicized transcript card, extracted todos (no bullets), mood/domain pills, "save and continue →" button.
4. **Sign in** — Apple primary, Google secondary, email tertiary.

After sign-in, the user lands directly on the home screen. There is no required Connect step. Connecting an MCP client (Claude.ai, ChatGPT, Cursor, Obsidian, etc.) happens via the home screen's `connect →` affordance, which replaces the settings gear in the top-right until the user has connected.

**Demo recordings:** stored locally on device, migrated to user's account on sign-in. If user abandons before sign-in, recording deleted on next launch.

**Demo limits:** 30s per recording, 3 demos per device per 24 hours (rate-limited server-side).

---

## 8. Home screen

The home screen is the primary surface in Throughline. It exists to do one thing: get the user to record a voice note. Captured cards, the throughline visual, and carried-forward items serve to confirm "you have today" or "the loop is closed" — they support the action; they don't replace it.

### Layout

Three regions, top to bottom:

- **Top bar.** Wordmark on the left. Top-right is state-dependent: when the user has not connected an MCP client, an electric-blue `connect →` affordance appears here; once connected, this is replaced by a settings gear icon. Fixed.
- **Content body.** Date, then state-specific content. Scrolls if content exceeds the available height.
- **Bottom action area.** 0.5px top border. Contains a 50–56px electric blue record button (`#2563EB`) with a "tap to record" label below. Fixed; always visible.

The record button is structurally always reachable. Content scrolls underneath; the button never gets pushed off screen.

### Connect affordance (unconnected state)

Until the user connects an MCP client, the top-right corner of the home screen displays `connect →` in electric blue, replacing the settings gear. Tapping it opens the connection flow for Claude.ai connector setup, ChatGPT MCP catalog, or a generic MCP client URL.

For v0, this affordance is the only nudge toward connection. v1 introduces progressive nudges such as banners or prompts after N recordings, based on connect-rate measurement. Settings access for unconnected users is reachable via a long-press on the wordmark.

### States

Four canonical states, defined by today's recording state:

**State 1: Empty (fresh start).** No recordings today, no carried-forward items. Content body shows the date only. Breathing room below it; the record button is the focal point.

**State 2: Empty + carried forward.** No recordings today, but yesterday's evening included `tomorrow_todos`. Carry-forward section appears.

**State 3: Morning captured.** Morning recording exists; evening doesn't. "Morning · {time}" section appears with the structured card (title, mood pill, domain pill).

**State 4: Loop closed.** Both morning and evening recordings exist. Throughline visual appears centered between the cards.

Carried-forward content, when present, appears in States 2, 3, and 4 — not just State 2. The state names describe today's recording progress, not the full screen content.

### Carry-forward section

Yesterday's `tomorrow_todos` surface here.

- **Position.** Below the date, above any captured cards.
- **Visual.** 1.5px electric-blue left accent border. "Carried forward · last night" label in uppercase tracking. Items listed in muted text (text-secondary), no bullets, no numbering.
- **Visibility.** Shown whenever `tomorrow_todos` exist from the previous day's recording. Hidden otherwise.
- **Lifetime.** Visible throughout day N+1 regardless of recording state. Cleared at the start of day N+2.

### Throughline visual

A vertical electric-blue marker that appears between the morning and evening cards on the loop-closed state.

- **Components.** Top dot (5–6px, `#2563EB`), connecting line (1.5–2px, `#2563EB`), bottom dot (5–6px, `#2563EB`). Centered horizontally.
- **Animation.** Plays once when the evening recording transitions from "processing" to "ready." Top dot fades in (0.3s delay, 0.4s duration), line draws downward (0.5s delay, 0.55s duration), bottom dot fades in with a brief glow halo (1.0s delay, 0.4s duration). Total animation ≈ 1.5 seconds.
- **State after animation.** Static. No ambient pulse, no tap interaction, no tooltip. The line is the signal.

### Acceptance criteria

- Record button is visible in every state without scrolling.
- Empty state with no carry-forward shows only date, button, and breathing room.
- Throughline animation plays once per loop closure (not on every home screen view).
- Carry-forward section is visible only when `tomorrow_todos` exist from the previous day's recording.
- All four states render correctly in light and dark mode.
- `connect →` affordance is shown in the top-right until the user has connected an MCP client; the settings gear replaces it once connected.

---

## 9. Recording experience (v0 — foreground only)

v0 is foreground-only. The user must keep the app open while recording. Lock-screen Live Activity, Dynamic Island integration, AirPods stem-tap, and background-audio mode are deferred to v1.1.

### In-app

- Same circular electric blue button used in onboarding (~92px).
- Tap to start, tap to stop. No confirmation dialogs.
- Active state: same blue circle, white square inside, subtle 8px blue ring around it (echoes "active"). 36px tabular timer above. Animated waveform between. Wordmark gains a small red dot + `rec` label. `cancel` link below for explicit abort.

### Auto-stop at limit

- 30s for demo, 5min free, configurable max for paid (default 30 min).
- 5 seconds before limit: soft haptic warning.
- At limit: auto-stop and process. User never gets cut off mid-sentence.

### Network resilience

- Audio captured locally in 10-second chunks.
- Offline → recording continues; chunks upload when network returns.
- Local audio only deleted after server confirms storage.

### Product decisions (locked)

- Stop = save and process. No "are you sure?" confirmation.
- No pause/resume in v1. One continuous recording.
- Foreground-only for v0. Recording stops if the app is backgrounded.

### Deferred to v1.1

- Lock-screen Live Activity (ActivityKit, iOS 16.1+).
- Dynamic Island compact + expanded states (iPhone 14 Pro+).
- AirPods stem-tap as stop signal (system media-pause event).
- Background-audio entitlement (`audio` background mode in `Info.plist`, AVAudioSession with `.playAndRecord` and `.allowBluetooth`, `UIApplication.beginBackgroundTask`).
- 30-minute locked-phone walk acceptance test.

---

## 10. Auth and connections

### App auth

- Apple (primary), Google (secondary), email (tertiary).
- **No "Sign in with Claude" or "Sign in with OpenAI"** — both providers prohibit third-party use of their auth. Anthropic explicitly bans it.

### MCP connection

- Per-user URL generated post-sign-in.
- For Claude: paste URL into Claude.ai connector settings (custom connector, OAuth 2.0 with scoped tokens).
- For ChatGPT: open in MCP catalog.
- For other clients (Cursor, Obsidian, Continue, Claude Desktop): copy URL with long-lived token.
- Token revocable from app settings.

Connection is not part of onboarding. Users connect via the home screen's `connect →` affordance whenever they're ready (see Section 8).

---

## 11. Pricing

| Tier | Price | Recording limits | Other |
|---|---|---|---|
| Demo (no account) | Free | 30s per recording, 3 per device per 24 hours | Local-only, expires on app close |
| Free | $0 | 10 min/day total (5 morning + 5 evening), 5 min cap per recording | Apple Speech transcription |
| Paid | $9.99/mo | Up to 30 min per recording, no daily cap | Groq Whisper Turbo, priority processing |

**Cost economics:**

- Whisper transcription: ~$0.04/hr on Groq Turbo (~$0.0007/min)
- LLM structuring: ~$0.0001/recording on Groq Llama 3.1 8B
- Heavy paid user (15 min/day): ~$0.30/mo in transcription, $0.06/mo in LLM
- Gross margin at $9.99: ~96%

---

## 12. Tech architecture (high-level)

### iOS app (v0)

- Native Swift. Not React Native. Not Capacitor.
- AVFoundation for audio capture (foreground only).
- Speech framework for on-device transcription.
- App Store distribution.
- v0 does not use ActivityKit, Dynamic Island APIs, AirPods media-event handling, or the background-audio entitlement. Those move to v1.1.

### Backend

- Node/TypeScript or Python — pick later, both work.
- Postgres for primary data, pgvector for hybrid search.
- Object storage (S3 or R2) for audio files. 30-day TTL on stored audio files; transcripts and structured extraction persist.
- MCP server using Anthropic's official SDK (~300–500 LOC).
- OAuth 2.0 provider for Claude connector flow.
- US data residency for v0.

### Privacy and retention

- US-only data residency.
- Audio files are deleted from object storage 30 days after recording.
- Transcripts and structured extraction persist indefinitely.
- Users can delete individual recordings or all data via settings.
- Retention preferences are user-configurable: audio TTL can be shortened, and transcripts can be auto-purged after N days if the user opts in.

### Transcription pipeline

```
Recording stops →
  audio saved local (10s chunks) →
  Apple Speech transcript exists in parallel (on-device, free) →
  upload to backend →
  Groq Whisper Turbo (paid users get this; free users keep Apple's) →
  LLM structuring (Llama 3.1 8B, ~$0.0001/recording) →
  validate against schema, retry once →
  store + index for hybrid search →
  push notification to user
```

### Hosting

- TBD: Fly.io, Railway, Vercel + Neon, or similar.
- Need: low-latency for MCP queries (US/EU regions), object storage, Postgres, background workers.
- ~$50–100/month at <1000 users.

---

## 13. Build sequence (parallel-track v0)

v0 builds two parallel tracks in week 1, then integrates.

**Track A — Eval foundation.**

- 30 labeled voice samples covering distribution: morning vs. evening, walks vs. drives vs. stationary, clean speech vs. heavy filler, varied speakers, varied lengths, and accents/languages.
- Scoring script: runs LLM extraction over each sample, compares against hand-labeled correct extraction, and outputs quality by field plus an overall score.
- Threshold: 90%+ overall quality required before shipping any prompt or model change.
- Regression suite runs on every prompt or model change throughout development.

**Track B — iOS shell.**

- Swift project setup, locked onboarding screens, 4-state home, recording state, post-recording confirmation, and minimal settings.
- Recording capture is foreground-only.
- Upload to backend stub.
- No structured extraction in iOS yet; recordings sit on the server with raw audio and transcripts until Track A is wired in.

**Week 2: Wire them together.** LLM extraction plugs into the iOS upload pipeline. iOS users start daily testing. Eval continues catching regressions.

**Week 3: MCP loop validation.** Hosted MCP server, OAuth to Claude, ChatGPT catalog path, and real tests of questions like "what's on my plate today?"

**Week 4+: Polish, iterate, ship.**

---

## 14. Out of scope for v0

These are deliberate non-goals. Some come back in v1.1 or v2; some never come back.

- **Lock-screen Live Activity** — deferred to v1.1.
- **Dynamic Island integration** — deferred to v1.1.
- **AirPods stem-tap as stop** — deferred to v1.1.
- **Background-audio recording** — deferred to v1.1.
- **30-minute locked-phone walk acceptance test** — deferred to v1.1.
- **Apple Watch app** — deferred to v1.1.
- **Lock Screen widget for instant recording** — deferred to v2.
- **Write-back MCP tools** — v2 (mark todos done, append, edit recordings).
- **iPad app** — later.
- **Web app for recording** — never. Mobile-first means mobile-first.
- **Team / shared recordings** — never. Personal use only.
- **Meeting transcription** — explicit non-goal. Would dilute positioning.
- **Real-time agent control during recording** — never. Recording is one-shot.
- **In-app feed / dashboard / list views** — minimal in v1. The MCP is the product, not the app's lists.
- **Notion / Obsidian / Todoist integrations** — never. The agent does this via its own MCPs.
- **Pause/resume recording** — never. One-shot recordings only, simpler.
- **Migration from Apple Voice Memos / other voice apps** — out for v0. Reconsider post-launch.
- **EU data residency** — US-only for v0. Reconsider when EU traffic justifies it.

---

## 15. Phasing

### v0 (launch)

Onboarding (4 screens), foreground-only recording, transcription, structuring, MCP read tools, optional-but-visible Claude/ChatGPT connection, $9.99/mo subscription, free + demo tiers. Eval foundation runs alongside development.

### v1.1 (4–8 weeks post-launch)

Touchless recording experience: lock-screen Live Activity, Dynamic Island, AirPods stem-tap, background-audio mode, and 30-minute locked-phone walk acceptance test. Apple Watch app. Lock Screen widget. Progressive connection nudges after N recordings. Paid recording length increase if needed.

### v2 (3–6 months post-launch)

MCP write tools. Additional read tools as user feedback shows what agents actually want to do. Possible web companion (read-only). Migration from Apple Voice Memos if user demand surfaces.

### v3+ (later)

TBD based on real usage. Possibilities: shared MCP for households, integrations with custom GPTs, dedicated Obsidian/Notion plugins (only if user demand specifically asks).

---

## 16. Open questions

- Hosting provider (Fly.io vs Railway vs Vercel + Neon).
- Backend language (Node/TypeScript vs Python).
- Marketing site stack.
- Analytics events to track (Posthog likely).
- Customer support channel.
- App Store category and keywords.
- Onboarding email sequence after sign-in.
- Pricing page design.
- **Eval test set composition.** 30 samples is the starting number. What is the right distribution across morning/evening, walking/driving/stationary, clean speech vs. heavy filler, different speakers, different lengths, and accents/languages?
- **What happens when the eval drops below 90% mid-development.** Hold the release? Roll back the prompt? Lower the threshold? Decide before it happens.
- **Agent-side reliability metric.** How do we measure "the loop works" given that Throughline does not control whether Claude or ChatGPT chooses the right tool or produces a useful answer?
- **MCP token revocation semantics.** When the user revokes the connector, what happens to data on Throughline's servers? Stays queryable on reconnect, deleted, or user-configurable?
- **Connect-rate metric.** What percentage of users connect within 7 days post-signup? v1's progressive nudge intensity should be calibrated to this.
- **Long-term memory accrual UX.** At year 2, the user has thousands of recordings. What does the app surface? Trends, anniversaries, year-over-year reflections, or nothing?
- **Settings access for unconnected users.** Currently reachable via long-press on the wordmark. Is this discoverable enough, or does it need a more visible escape hatch?

---

This is the canonical spec. Brand decisions live in `throughline-brand-decisions.md`. Update this doc when product decisions are made.
