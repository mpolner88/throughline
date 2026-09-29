# Throughline outside-in product study

Date: 2026-08-07  
Audience: people who think out loud and already use AI agents  
Horizon: current product expectations and a 6–12 month product direction

## Executive read

The framing **“Obsidian for voice”** is strong if it means durable, linked, queryable, portable, user-owned knowledge—not if it means copying Obsidian's graph view. The market already treats transcription, summaries, tags, AI chat, exports, and even MCP as expected capabilities. Voicenotes now has a hosted OAuth MCP server with semantic search and note creation, while Reflect exposes an MCP server that can search and edit notes. Throughline's defensible position is therefore not “voice notes with MCP” by itself. It is the shortest trustworthy path from **spoken thought → structured memory → traceable task → agent action**, with the result available in every system the user already works in.

Throughline already has more of that foundation than the current mobile surface reveals: structured projects, people, tags, priorities, dated todos, a daily loop, and eight read-only MCP tools. The highest-leverage work is to expose that structure as a real knowledge-and-task system, make capture recoverable, and make the agent connection effortless and permissioned. Meeting bots, generic writing templates, and an animated knowledge graph would broaden the product before the core loop is strong.

## What successful products establish as expected

| Product | What users are taught to expect | Implication for Throughline |
| --- | --- | --- |
| Voicenotes | Automatic title, transcript and summary; searchable library; Ask AI; tags; exports; task/content generation; multiple capture modes | Clean transcription and summaries are table stakes, not the destination |
| Voicenotes MCP | Browser OAuth, semantic search, date/tag filters, transcript retrieval, note creation and tagging | MCP is now a category feature; setup quality and structured actions matter more than simply having an endpoint |
| Voicenotes integrations | Obsidian, Todoist, Things 3, Notion, Zapier, webhooks, Readwise and more | Users expect voice capture to flow into their existing system rather than replace it immediately |
| Reflect | Daily notes, backlinks, tags, semantic search, AI, voice transcription, offline capture, encrypted notes, export/API and MCP editing | A durable second brain combines retrieval, relationships, continuity, ownership and trust |
| Obsidian | Local files, typed properties, internal links/backlinks, tags, powerful search and an extensible plugin model | “Obsidian for voice” means open, structured, connected material that can outlive the app |
| Todoist | Today/upcoming views, dates, recurring tasks, filters and natural-language scheduling | Extracting a todo is not enough; a task needs a reliable execution lifecycle |
| AudioPen | Clean rewriting, multiple styles, a keyboard, Apple Watch and cross-app use | Capture has to be available at the moment of thought, not only after opening the app |

## Throughline's verified current foundation

- One-tap iPhone recording with automatic transcription and structured extraction.
- Structured fields already include title, summary, transcript, important items, todos, priorities, intentions, accomplishments, tomorrow items, mood, tags, people, projects and balance areas.
- Todo records already support status, priority, due date, target date, context and completion time.
- The iOS home surface supports completing important items, carrying items forward, opening/editing notes and submitting extraction feedback.
- The MCP server exposes eight read-only tools: today, daily loop, recordings, one recording, lexical search, open todos, recent reflections, energy patterns and balance snapshot.
- Production analytics and the weekly learning loop are in place, although the user sample is still too small for outcome claims.

## Ranked experience gaps

### 1. The structured system is mostly invisible

- **User goal:** find an old thought, see everything about a project or person, and understand how notes connect.
- **Current break:** tags, projects, people and dates are extracted, but the iOS experience is primarily a chronological Today feed. There is no user-facing library search, entity page, related-notes view, or backlink trail.
- **Evidence:** Obsidian and Reflect center links, properties/tags and retrieval; public Obsidian workflows repeatedly ask for a voice dump to be split, filed, tagged and routed rather than stored as one transcript.
- **Severity:** high
- **Likely frequency:** high after a user's first few notes
- **Confidence:** high on the capability gap; medium on demand until Throughline has more active users
- **Product move:** create a voice-native knowledge layer: Library search, Projects, People, Tags, and Related notes. Start with useful lists and backlinks; defer a graph visualization.

### 2. Extracted tasks do not yet become a dependable task system

- **User goal:** speak an obligation once and trust that it will appear when and where it matters.
- **Current break:** the data model has dates and completion state, but the app does not present a full task inbox, Today/Upcoming/Completed views, reminders, recurring tasks, or a clear link back to the source moment.
- **Evidence:** Todoist's core experience revolves around natural-language dates, recurring schedules and filtered views. Voice-to-Obsidian users specifically ask for due dates in task-compatible Markdown and daily-note routing.
- **Severity:** critical to the stated value proposition
- **Likely frequency:** high
- **Confidence:** high
- **Product move:** build a task home with Today, Upcoming and Completed; show date/priority; let every task open its source note and transcript; add reminders before recurrence.

### 3. The agent connection is capable but feels like developer setup

- **User goal:** connect Throughline to an agent in seconds, safely, and let it help—not merely read.
- **Current break:** Throughline's MCP is read-only and setup depends on copying a token and command. It cannot complete a task, append to a note, or create a structured item through an explicit user-approved scope.
- **Evidence:** Voicenotes uses browser OAuth and offers semantic search plus note creation. Reflect's MCP supports note creation, editing and checkbox toggles.
- **Severity:** high for differentiation
- **Likely frequency:** medium overall; high for the target early adopter
- **Confidence:** high
- **Product move:** add OAuth-style connection, semantic retrieval and explicit scopes such as `read_notes`, `read_tasks`, `complete_tasks`, and `append_notes`. Keep writes auditable and revocable.

### 4. Capture is not yet recoverable enough to become trusted memory

- **User goal:** speak from anywhere and know the thought cannot disappear because the network or processing service failed.
- **Current break:** a recording is made in temporary storage and the UI has no durable outbox or retry action after upload failure.
- **Evidence:** recent public voice-workflow discussions emphasize fewer taps, lock-screen capture, offline behavior and reliable handoff. Reliability is a prerequisite for users to offload memory.
- **Severity:** critical trust risk
- **Likely frequency:** low-to-medium, but costly when it happens
- **Confidence:** high from current implementation; frequency unknown
- **Product move:** persist a local recording draft before upload, show an outbox, retry automatically, and let the user replay or resend failed items.

### 5. Throughline is an island when users expect a bridge

- **User goal:** use Throughline as the best capture and structuring layer while tasks and notes remain available in existing tools.
- **Current break:** no visible Markdown/JSON export, Obsidian sync, Apple Reminders/Todoist/Things delivery, webhook, or share/import workflow was found in the iOS app.
- **Evidence:** Voicenotes' integration catalog and official Obsidian plugin make portability a prominent part of the product; Obsidian itself stores knowledge as local files.
- **Severity:** high for adoption and trust
- **Likely frequency:** medium
- **Confidence:** high on the feature gap; medium on initial ordering
- **Product move:** ship Markdown/JSON export first, then one task destination and an Obsidian-compatible sync path. Use integrations to distribute Throughline rather than treating them as leakage.

### 6. Capture is constrained to the main app

- **User goal:** capture during a walk, commute, conversation, or while using another app.
- **Current break:** no Share Sheet import, lock-screen widget, Action Button/App Intent, Apple Watch surface, or audio-file import was found.
- **Evidence:** AudioPen advertises a keyboard and Apple Watch; Reflect supports offline iOS capture and lock-screen recording controls; Voicenotes supports cross-app and third-party capture surfaces.
- **Severity:** medium
- **Likely frequency:** medium-to-high
- **Confidence:** medium
- **Product move:** prioritize App Intent/Action Button and Share Sheet import, then Apple Watch after core retention signals appear.

## Product thesis

### Recommended positioning

**Throughline is a voice-first knowledge and task system for your AI agent. Speak once; your memory, tasks, and agent stay in sync.**

“Obsidian for voice” is an excellent internal product compass. The public promise should emphasize the outcome rather than require users to know Obsidian.

### The differentiated object

The core object should not be an audio file or a cleaned transcript. It should be a **traceable voice memory**:

- raw audio and transcript as the source;
- a structured summary that can be edited;
- tasks with dates, status, priority and source anchors;
- linked people, projects and topics;
- portable Markdown/JSON representation;
- agent-readable resources and permissioned actions;
- change history showing what the user, app and agent changed.

This creates an action graph, not merely a note archive.

## Opportunity map

### Fix this week

1. Mock and approve the value-led account handoff already in the backlog.
2. Mock the first Task Home: Today, Upcoming, Completed, with source-note traceability.
3. Design the local recording outbox/retry state before adding more capture surfaces.
4. Upload the regenerated App Store screenshots; Figma is not required.

### Build this quarter

1. Ship recoverable capture and the Task Home.
2. Add in-app Library search plus Project/Person/Tag pages and Related notes.
3. Add Markdown/JSON export and one task integration.
4. Replace manual MCP setup with a guided connection and scoped agent actions.
5. Add App Intent/Action Button and Share Sheet capture.

### Deeper research

1. Interview the first 5–10 activated users about what they expected to happen after speaking a task.
2. Test whether users want Throughline to be the task system of record or the best feeder into Reminders/Todoist/Things.
3. Observe which entities—projects, people, or topics—users actually revisit before choosing the first backlink surface.
4. Measure successful retrieval and task completion, not note count alone.

## Do not prioritize yet

- Meeting bots and broad multi-speaker meeting software.
- Generic content-generation templates such as tweets and blog posts.
- A global graph visualization.
- Heavy manual folder taxonomies.
- A full built-in chatbot that competes with the user's preferred agent.

## Source map

Official product evidence:

- [Voicenotes capabilities](https://help.voicenotes.com/en/articles/15391505-what-can-voicenotes-do)
- [Voicenotes MCP](https://help.voicenotes.com/en/articles/14336494-voicenotes-mcp)
- [Voicenotes integrations](https://help.voicenotes.com/en/collections/12277349-integrations)
- [Voicenotes Obsidian plugin](https://help.voicenotes.com/en/articles/13250610-obsidian-plugin)
- [Obsidian data storage](https://obsidian.md/help/data-storage)
- [Obsidian properties](https://obsidian.md/help/properties)
- [Obsidian backlinks](https://obsidian.md/help/backlinks)
- [Obsidian internal links](https://obsidian.md/help/links)
- [Reflect product overview](https://reflect.app/)
- [Reflect advanced search](https://reflect.academy/advanced-search)
- [Reflect MCP capabilities](https://reflect.academy/artificial-intelligence)
- [Todoist recurring dates](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)
- [Todoist filters](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH)
- [AudioPen App Store listing](https://apps.apple.com/us/app/audiopen/id6502638001)

Qualitative public workflow evidence (anecdotal, not prevalence estimates):

- [Turning voice thoughts into actual notes](https://www.reddit.com/r/ObsidianMD/comments/1tb4a58/how_do_you_turn_voice_thoughts_into_actual_notes/)
- [Voice-to-Obsidian workflow friction](https://www.reddit.com/r/ObsidianMD/comments/1s7nh7g/voice_notes_to_obsidian_markdown_built_a_workflow/)
- [Voice capture and transcription workflows](https://www.reddit.com/r/ObsidianMD/comments/1ndc0jq/workflows_for_capturing_voice_and_transcribing_to/)
- [Voice notes and task-compatible Markdown](https://www.reddit.com/r/ObsidianMD/comments/1qpxpo4/i_updated_my_voice_note_taking_workflow_for/)
- [Questioning the value of a graph view](https://www.reddit.com/r/ObsidianMD/comments/1tgbb1v/i_built_a_voicetoobsidian_workflow_but_im_not/)

## Evidence limits

- Competitor capabilities were checked against official public pages on 2026-08-07; packaging and pricing can change.
- Public forum posts are directional anecdotes, not a representative user sample.
- Throughline gap claims are based on the current repository and visible iOS implementation, not undisclosed roadmap intent.
- Priority ordering should be revised once Throughline has at least five newly signed-in users with complete event coverage and direct interviews.
