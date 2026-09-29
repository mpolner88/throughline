# Decision Log

This file records product, design, technical, and workflow decisions for Throughline.

Each decision should explain the call that was made, the alternatives considered, and the trigger for revisiting it. Do not use this as a changelog. Use it for judgment.

---

## 2026-04-30 — Voice-to-agent MCP positioning

**Decision:** Position Throughline as a hosted MCP endpoint for personal voice notes, not as an integration silo that pushes to specific tools (Notion, Obsidian, Todoist). The mobile app is the input device; the MCP server is the product. Throughline does not build or maintain integrations to other apps.

**Context:** Other voice-note apps (Voicenotes, AudioPen, Whisper Memos, Letterly) all build their own integrations and push transcripts there. The integration surface is large, never finished, and always behind whatever new tool a user adopts.

**Alternatives considered:** Build native integrations (Notion, Obsidian, Todoist). Use Zapier as the integration layer. Push to a single hub like email and let the user route from there. Hybrid (MCP + a few priority integrations).

**Reasoning:** MCP is a 2026-native distribution channel. Power users find tools through Claude.ai's connector settings and ChatGPT's MCP catalog. Letting the agent ecosystem absorb the integration work keeps Throughline tiny and lets value compound with that ecosystem rather than competing with it. The integration burden goes to zero; the agent does the orchestration.

**Revisit when:** MCP adoption stalls in major clients, Anthropic or OpenAI close their MCP surfaces, or one specific integration would clearly 10x acquisition.

---

## 2026-04-30 — Personal use, not professional

**Decision:** Throughline is for personal productivity (morning rituals, evening reflections, walks, drives, idea capture). It is explicitly not a meeting recorder, team tool, or interview transcription product.

**Context:** Voicenotes and similar apps lead with meeting transcription. That positioning is tempting because the audience is broader. But it dilutes the brand and puts Throughline in direct competition with funded incumbents (Granola, Otter, Fireflies).

**Alternatives considered:** Pursue meetings (compete with Granola, Otter). Stay broad and let users decide. Add meetings as a v1.1 feature.

**Reasoning:** A 5-minute recording cap on the free tier — and even paid's longer cap is tuned for solo use — makes meetings practically impossible. The brand voice ("on a walk," "morning rituals") locks in personal positioning. Going professional would require building integrations to enterprise tools, complicating auth, and entering a crowded fight. Personal-only is the wedge that keeps the product small and clearly different.

**Revisit when:** Personal use saturates a niche, enterprise demand surfaces organically, or the morning/evening ritual framing fails to drive retention.

---

## 2026-04-30 — Pricing tiers and recording limits

**Decision:** Three tiers. Demo (no account): 30s per recording, 3 per device per 24 hours. Free (with account): 10 min/day total split as 5 morning + 5 evening, 5 min cap per recording, Apple Speech transcription. Paid: $9.99/mo, up to 30 min per recording, no daily cap, Groq Whisper Turbo transcription.

**Context:** Pricing has to support the wedge (prosumer, mobile, MCP) and stay legible. Apple Voice Memos is free; AudioPen and Voicenotes are $99/yr; Whisper Notes is $6.99 once.

**Alternatives considered:** $99/yr annual matching incumbents. $4.99/mo cheaper tier. No free tier. Time-based credits instead of daily caps. Free tier with no recording cap.

**Reasoning:** $9.99/mo is the prosumer sweet spot — cheap enough to be impulse-pay for an AI power user, expensive enough to support real margin (~96% gross given Groq pricing). Daily caps train the morning-walk habit better than monthly caps. The 5-minute recording cap on free is a feature, not just a limit — it pushes anyone with longer needs to paid and explicitly prevents meeting use even on free.

**Revisit when:** Conversion from free to paid stalls below industry norm, infrastructure costs spike, or there's a clear case for an annual plan with discount.

---

## 2026-04-30 — Demo recording cap is 60 seconds [SUPERSEDED by 2026-04-30 entry below]

**Decision:** Unauthenticated demo recordings cap at 60 seconds, rate-limited to 3 demos per device per 24 hours.

**Context:** The first-touch demo (try-it from the hero screen, no account) needs a time limit to prevent abuse and to encourage sign-up.

**Alternatives considered:** 30 seconds (felt too short to convey value at the time). 5 minutes (too generous, encourages abuse). 90 seconds (asymmetric).

**Reasoning:** 60 seconds gives users enough to record a real morning ritual sample, see structure extracted, and feel the magic moment. The 3-per-day rate limit prevents a determined non-signer from getting unlimited demos.

**Revisit when:** Conversion from demo to sign-up is too low, or demo abuse becomes a real cost.

---

## 2026-04-30 — Demo recording cap is 30 seconds (supersedes 60-second decision above)

**Decision:** Demo recording cap revised to 30 seconds. Rate limit unchanged at 3 per device per 24 hours.

**Context:** Reviewing the onboarding screen 2 copy in design, the user determined 60 seconds was longer than necessary. The original 60-second decision was made before the magic-moment design was concrete.

**Alternatives considered:** Hold at 60 seconds. Drop to 15 seconds. Add a per-recording warning at 25s instead of cutting. Variable limit based on device or network.

**Reasoning:** 30 seconds is enough to record a meaningful demo (e.g. "today I want to ship the launch email and call Sarah about pricing") and see structured output. Halving the cap halves Whisper/LLM cost on demos, and the friction of asking the user to re-record if they want more nudges sign-up earlier without feeling unfair.

**Revisit when:** Demo-to-sign-up conversion drops, or user feedback indicates 30s feels too short to capture real intent.

---

## 2026-04-30 — Auth providers: Apple, Google, email only

**Decision:** Sign-in is Apple (primary), Google (secondary), email magic link (tertiary). No "Sign in with Claude" or "Sign in with OpenAI."

**Context:** Both Anthropic and OpenAI have power users who would value "Sign in with Claude/ChatGPT" because Throughline's whole value is connecting to those AIs. It would also reduce account creation friction.

**Alternatives considered:** Add Sign in with Claude. Add Sign in with OpenAI. Email-only (no OAuth providers at all). Passkey-first.

**Reasoning:** Anthropic's terms explicitly prohibit third-party apps from offering Claude.ai login. OpenAI's posture is similar. Even if it worked technically, both providers reserve the right to revoke at any time, which would break Throughline overnight. Apple+Google+email is the standard prosumer auth set and works on every platform.

**Revisit when:** Anthropic or OpenAI publish a third-party login API, or passkeys become the dominant prosumer auth.

---

## 2026-04-30 — Brand direction: Quiet Software with electric blue accent

**Decision:** Quiet Software direction — restrained monochrome, refined sans typography, generous whitespace — with electric blue (#2563EB) as the singular accent color. Lifted blue (#3B82F6) for dark-mode active states.

**Context:** Three brand directions were considered: Field Notes (warm, analog, intimate), Quiet Software (restrained, calm, minimal), Warm Companion (warm, conversational, AI-friend). Each maps to a different audience and posture.

**Alternatives considered:** Field Notes direction (cream paper, ink, serif display). Warm Companion direction (peach palette, rounded sans). Klein blue accent (#002FA7, more editorial). Deep ink blue (#1E3A8C, more authoritative).

**Reasoning:** Quiet Software matches the target user (Claude Pro / Things 3 / Linear demographic) and the use case (personal reflection, walks). Electric blue over Klein because Klein reads as art-historical and potentially pretentious; over deep ink because deep ink reads corporate. Electric blue is modern and AI-coded without being shouty. The single-accent restraint is what makes the brand feel disciplined.

**Revisit when:** Brand testing shows the direction reads cold or generic, or a different audience becomes the primary target.

---

## 2026-04-30 — Wordmark, lockup, and standalone mark [SUPERSEDED by 2026-05-24 entry below]

**Decision:** Three brand mark formats. Clean wordmark `throughline` (lowercase, no embellishment) for app chrome, body, settings. Lockup `throughline →` (trailing arrow in electric blue) for splash, marketing, login, App Store, social profiles. Standalone mark `→` (electric blue) for app icon, favicon, social avatar, loading states, empty-state mark.

**Context:** Original placeholder used a small dot after the wordmark, which was meaningless. The arrow is the brand's actual visual element and needed proper integration into the wordmark family.

**Alternatives considered:** Clean wordmark only (no mark integration anywhere). Leading arrow lockup (`→ throughline`, conventional logo pattern). Trailing arrow lockup (`throughline →`). Inline arrow embedded in the word.

**Reasoning:** A three-mark system gives different formats for different contexts and protects each from overuse. Trailing arrow over leading because trailing reads as "throughline pointing toward what's next" — momentum rather than entry — which fits the product's promise of moving from voice to action. The standalone arrow becomes iconic precisely because users have seen the lockup first.

**Revisit when:** App Store rejects the icon, the trailing-arrow lockup tests as confusing in marketing, or a fourth mark format becomes useful.

## 2026-05-24 — Continuous-line logo mark [SUPERSEDED by 2026-05-25 entry below]

**Decision:** Supersede the arrow-only standalone mark with a continuous-line mark: one line enters from the left, forms a full connected circle, crosses through the center, and exits to the right. The lockup is the mark plus lowercase `throughline`; the app icon is the mark alone in white on an electric-blue tile.

**Context:** The arrow communicated "voice to agent" in copy, but it was too generic as an app icon and did not carry the voice-note-to-memory metaphor strongly enough. The user steered the mark toward a literal throughline: not disconnected parts, not a loose curl, but a full circle connected in the middle.

**Alternatives considered:** Keep the trailing arrow as the icon. Use the wordmark alone. Use a disconnected loop plus entry and exit lines. Use a partial curl that suggests a thread but never becomes a full memory object.

**Reasoning:** A continuous mark gives Throughline a distinctive ownable shape while preserving the original metaphor. The circle reads as the saved memory object; the center line keeps the motion from voice to agent readable. Keeping the arrow only in text-level transitions protects `voice → agent` without making the whole brand depend on a generic glyph.

**Revisit when:** The mark becomes illegible at App Store/home-screen sizes, user testing reads the circle as unrelated to voice notes, or a future visual system needs a simpler single-glyph fallback.

## 2026-05-25 — Underlined wordmark logo

**Decision:** Supersede the circle/loop mark with the K direction from the radical logo exploration: the primary logo is lowercase `throughline` with a single electric-blue underline. The standalone app icon is the underline reduced to one solid horizontal white line on the electric-blue tile.

**Context:** After exploring larger departures from the loop family, the underlined wordmark felt stronger: quieter, simpler, more ownable, and less like a generic startup icon. It makes the name itself carry the identity instead of attaching a separate symbol beside it.

**Alternatives considered:** Keep the circle mark. Use a single line beside the word. Use a waveform/signal mark. Use a solid rail icon. Use a cursor-like agent mark.

**Reasoning:** Throughline should feel like the shortest path from voice to usable memory. The underline says that with almost no visual machinery. It also scales cleanly across app chrome, App Store assets, and marketing surfaces without forcing a metaphor-heavy symbol into every view.

**Revisit when:** The app icon feels too minimal in a crowded home screen, users fail to associate the line icon with Throughline after seeing the wordmark, or the underline starts being confused with a generic text emphasis treatment.

---

## 2026-04-30 — The arrow rule [UPDATED by 2026-05-25 underlined wordmark logo]

**Decision:** The arrow `→` is reserved for moments of actual transition or connection: the tagline `voice → agent`, the lockup, forward-action buttons (`save and continue →`), navigation chevrons on cards, transitions between states. It is never used for list bullets, decoration, or repeated UI patterns where it has no destination.

**Update:** The arrow is no longer the logo lockup or standalone mark. It remains reserved for text-level transitions and explicit forward actions.

**Context:** Early designs used the arrow as a list bullet on extracted items in the magic moment screen. It was visually consistent and reinforced the brand metaphor — but it diluted the arrow's meaning by making it ambient.

**Alternatives considered:** Use the arrow as a list bullet (brand-forward but dilutive). Use no bullets (cleanest). Use em-dash bullets (editorial, neutral). Use circle bullets (conventional).

**Reasoning:** Brand marks are most powerful when they're rare and meaningful. The arrow's whole power comes from semantic content ("from X to Y"). Using it for list bullets — where there's no "from" and no "to" — strips that meaning. Reserving it for actual connections protects the metaphor and keeps the brand disciplined. Lists use whitespace and labels; the arrow gets to mean something every time it appears.

**Revisit when:** The brand feels too sparse, a new connection-pattern emerges that genuinely benefits from the arrow, or design testing shows the rule is being misapplied.

---

## 2026-04-30 — MCP tools are read-only in v1

**Decision:** v1 ships nine read-only MCP tools (`get_today`, `get_daily_loop`, `get_recordings`, `get_recording`, `search`, `list_open_todos`, `get_recent_reflections`, `get_energy_patterns`, `get_balance_snapshot`). Write tools (`mark_todo_done`, `append_to_recording`, `update_recording`) are deferred to v2.

**Context:** A read+write MCP would be more powerful — agents could mark todos done in Throughline directly. But writes raise auth, conflict-resolution, and audit complexity that read tools don't.

**Alternatives considered:** Ship full read+write at v1. Ship read-only forever (writes via the app only). Ship a partial write surface (just `mark_todo_done`).

**Reasoning:** Read-only ships sooner, has a smaller security surface, and lets us learn what writes agents actually want before designing the write API. Users who want to mark a todo done can do it in the Throughline app or in their downstream tool (Obsidian/Todoist) where the agent already wrote it. The cost of waiting on writes is low; the cost of getting them wrong is high.

**Revisit when:** Real usage shows agents repeatedly trying to write back, a clear write pattern emerges from feedback, or v1 retention depends on write-back closing the loop.

---

## 2026-04-30 — Recording is one-shot: stop = save, no pause, AirPods stop

**Decision:** Tapping stop saves the recording and processes it — no "are you sure?" confirmation. There is no pause/resume; one continuous recording per take. AirPods stem-tap (the system media-pause event) is interpreted as stop.

**Context:** Voice memo apps differ on these behaviors. Apple Voice Memos has pause/resume; AudioPen and Voicenotes do not. Confirmation dialogs are common but add friction. AirPods stem-tap is technically optional behavior we can choose to listen for or ignore.

**Alternatives considered:** Pause/resume (matches Apple's pattern). Stop confirmation dialog ("save or discard?"). Reserve AirPods stem-tap for media playback only.

**Reasoning:** All three decisions push toward simpler audio pipelines and less in-product friction. Pause/resume creates a class of edge cases (long pauses, audio artifacts, "did I forget to resume?") that doesn't pay for itself in personal-productivity use. Confirmation dialogs are hostile in a "tap and walk" context. AirPods stop is the entire morning-walk dream — it makes the product touchless.

**Revisit when:** Users repeatedly request pause/resume, confirmation dialogs become necessary because of an unexpected save problem, or AirPods stem-tap conflicts with another action we want.

---

## 2026-04-30 — Type selection: smart default with override

**Decision:** Recording type (`morning` / `evening` / `weekly_review` / `freeform`) is auto-selected based on time-of-day and shown on the post-recording confirmation screen with a one-tap override. Default rules: 5–11 am = morning, 6 pm – 1 am = evening, Sunday after 6 pm = weekly_review, else freeform.

**Context:** The user has to either pick the type before recording (friction at the moment they want to start talking) or after recording (could mis-tag if they tap save fast).

**Alternatives considered:** Always ask before recording. Always default to freeform and let the user re-tag later. Auto-tag with no override.

**Reasoning:** Time-of-day is right ~95% of the time for personal-productivity use. Smart default eliminates pre-tap friction (the most expensive moment to add a step). Override on the confirmation screen catches the 5% wrong cases. The structuring LLM is biased by the type, so getting it right matters for extraction quality, but the bias is mild and the override is one tap.

**Revisit when:** The auto-tag gets it wrong frequently in real use, users abandon at the confirmation screen, or a clear new type emerges (e.g. midday check-in).

---

## 2026-04-30 — Native Swift iOS app

**Decision:** Build the iOS app in native Swift, using AVFoundation, Speech framework, and ActivityKit. Not React Native, not Capacitor, not Flutter, not a web wrapper.

**Context:** Cross-platform frameworks save engineering time and let the same codebase target Android. Native is more work upfront but gives full access to platform primitives.

**Alternatives considered:** React Native (broad team familiarity, fast iteration). Capacitor (web devs can build it). Flutter (cross-platform, modern). Web app with native shell.

**Reasoning:** The product depends on iOS platform primitives that cross-platform frameworks handle poorly or not at all: background audio entitlement, lock-screen Live Activity (ActivityKit, iOS 16.1+), Dynamic Island, Apple Speech framework for free on-device transcription, AirPods media event handling. The "30-minute locked-phone walk and the recording is intact" acceptance test is a non-negotiable launch blocker, and getting it right requires direct AVAudioSession and background-task control. Cross-platform frameworks bury those APIs behind abstractions that break in subtle ways. The cost of a second Android codebase comes later if the product works; the cost of an unreliable iOS recording engine kills the product.

**Revisit when:** Android demand becomes urgent, a cross-platform framework adds first-class background audio + Live Activity support, or platform primitives change.

---

## 2026-04-30 — Agentic product workflow

**Decision:** Use an artifact-driven workflow for product development: product exploration, spec writing, council review, decision capture, technical skepticism, build planning, implementation, and post-build review.

**Context:** The current process works manually but depends on conversation memory across Claude Code, llm-council, Codex, and the human operator.

**Alternatives considered:** Keep the flow fully manual; move immediately to automated agents; use only one coding agent for all product and implementation work.

**Reasoning:** The workflow should preserve human judgment while making decisions inspectable and repeatable. Artifacts create a stable handoff between models and make it possible to automate later without losing context.

**Revisit when:** The artifacts feel like overhead, agents repeatedly ignore them, or the workflow slows down implementation without improving decisions.

---

## 2026-04-30 — Operating rules for the workflow

**Decision:** Add explicit operating rules to `agentic-product-workflow.md` (section 7) covering five practices: (1) announce all doc updates inline in the chat reply that produced them, (2) log decisions only after explicit lock — not during iteration, (3) treat the decision log as append-only, marking superseded entries rather than overwriting, (4) keep open questions in the relevant spec file rather than the decision log, (5) keep the workflow doc to roughly two pages.

**Context:** A long design session produced ~50 micro-decisions in chat, most of which were never captured in any file. The workflow doc described the loop but not the discipline of keeping artifacts honest. Without explicit rules, agents drift toward silent file edits, premature decision logging, or treating chat history as canonical.

**Alternatives considered:** Leave the rules implicit and rely on judgment. Embed the rules only in `agent-prompts.md` rather than the workflow doc. Build a more elaborate rule system upfront.

**Reasoning:** Implicit rules drift across sessions and agents. A small named ruleset is easier to enforce, easier to revise, and easier for new agents to internalize from a single read. Putting the rules in the workflow doc (rather than only in prompts) means humans can reference them too without reading the prompt file.

**Revisit when:** The rules feel pedantic, agents repeatedly violate them, or new patterns emerge (multi-agent decisions, async review handoffs) that the rules don't cover.

---

## 2026-04-30 — Home screen layout

**Decision:** Three-region home screen — fixed top bar (wordmark + settings icon), scrollable content body, always-visible bottom action area separated by a 0.5px top border. Bottom action contains a 50–56px electric blue record button with a "tap to record" label below. Button is structurally always reachable; content scrolls underneath, never pushing the button off screen.

**Context:** Earlier home screen iterations used a giant centered button (~100×100) that got pushed off screen when both morning and evening cards filled the view. The record button being unreachable violates the core principle that recording is the primary action — the user should never be in a state where they cannot tap record.

**Alternatives considered:** Giant centered button (gets cut off when content fills the screen). Floating action button overlaid on content (could obscure cards; less iOS-conventional). Hide button when content fills (violates always-accessible). Smaller button at the top of the screen (not bottom-thumb-reachable on modern phones).

**Reasoning:** Recording is the single most important action in the app and must be reachable in every state. Pinning the button to the bottom in a fixed action area, with the content body as a scroll region, is the iOS-conventional pattern that delivers this guarantee. The smaller size (50–56px instead of 100×100) better fits the "quiet software" direction — the button is an instrument, not a hero. The same layout works for all four canonical home screen states (empty fresh, empty with carry-forward, morning captured, loop closed).

**Revisit when:** Users report not finding the button, accessibility testing reveals tap-target issues at this size, or a new state emerges where this layout breaks down (e.g. a paywall overlay or recording-in-progress sheet).

---

## 2026-04-30 — Carry-forward pattern on the empty state home screen

**Decision:** Yesterday's `tomorrow_todos` surface on the home screen as a "Carried forward · last night" section with a 1.5px electric-blue left accent and items listed in muted text (text-secondary, no bullets). The section is hidden entirely when there are no items to carry forward — the empty state then shows just date + record button. Carry-forward is visible throughout day N+1 regardless of state, and clears at the start of day N+2.

**Context:** When the user records "tomorrow I need to call Marcus, ship the deck" in their evening recording, those `tomorrow_todos` exist in the schema but had no surface in the app. Either they appear in the agent's MCP results only (invisible inside Throughline) or somewhere on the home screen. We needed to decide where, when, and how prominently.

**Alternatives considered:** Surface `tomorrow_todos` in tonight's end-of-day footer (rejected — feels like productivity-app overlay; tonight's screen earns the closed-loop visual, not a forward-looking task list). Surface only when there's empty visual space (interpretation-dependent, fragile). Don't surface in the app at all (relies entirely on the agent for the carry-forward signal). Use a card style identical to morning/evening cards (would compete visually with the day's actual content).

**Reasoning:** Surfacing on the next day's home screen makes the throughline metaphor literal — yesterday's evening becomes today's start. The 1.5px electric-blue left accent visually echoes the throughline without overusing the arrow. Muted text and the "carried forward · last night" label clarify that these are context, not today's content. Hiding the section when empty preserves the brand voice (no fake content, no productivity-coach prompts when there's nothing to carry).

**Revisit when:** Users frequently miss carried-forward items, the visual treatment is mistaken for a quote/blockquote, carry-forward expands to include items beyond `tomorrow_todos` (unfinished priorities, recurring intentions), or carry-forward semantics need to handle multi-day skips (Friday's items if the user didn't open the app on Saturday).

---

## 2026-04-30 — Throughline visual element on the loop-closed home screen

**Decision:** A 2-dot, 1-line vertical electric-blue marker centered between the morning and evening cards, displayed only when both recordings exist for the day. Animates in once when the second recording is processed (top dot fades in, line draws downward, bottom dot lands with a brief glow halo). Static thereafter. No tap interaction, no tooltip, no ambient pulse.

**Context:** When the daily loop closes (both morning and evening captured), the user's success deserves a small visual signal. The brand metaphor — a throughline through the day — needed a literal visual expression on the home screen. Earlier iterations explored a tap-to-reveal mood-arc tooltip ("focused → grateful") and ambient pulsing on the dots; both added complexity that didn't pay for itself in v0.

**Alternatives considered:** Static line with no animation (less rewarding moment of completion). Mood-arc tap tooltip ("focused → grateful"). Productivity-completion tap tooltip ("3 to-dos, all done for now"). Ambient pulse on dots after draw-in (kept the element feeling alive but added complexity). Connecting line via card borders (more integrated but harder to read as a discrete moment).

**Reasoning:** The line is the brand metaphor made literal. The one-time draw-in animation rewards completing the loop without demanding interaction. Removing the tap target avoids the question "what does it do?" — it's a visual signal, not a feature. The brief glow on the bottom dot at completion is the only flourish, and it's tied to the moment of state change, not ongoing motion. Simpler, on-brand, lower implementation cost. Productivity tooltip language ("3 to-dos done") was held alongside the productivity-positioning question — neither is locked yet.

**Revisit when:** User testing shows people don't notice the throughline, the lack of tap target leaves users wanting more information about the day's loop closure (e.g. priority completion stats), or productivity positioning gets locked in a way that demands a richer completion signal.

---

## 2026-04-30 — Workflow efficiency rules (extends "Operating rules for the workflow")

**Decision:** Add two rules: (1) default to diffs over full files for small changes, and (2) lock and move — draft entries inline at lock, defer file writes to session breakpoints, skip the formal "lock candidates" ceremony.

**Context:** Sessions developed a habit of regenerating full files at every lock and ending iterations with a "ready to lock 1, 2, 3?" round-up. Both added overhead without improving outcomes. The user flagged it: "I want to focus just as much on building (more) than just workflows."

**Alternatives considered:** Keep regenerating full files. Drop the ceremony but keep full-file regeneration. Move all file writes to a separate end-of-session pass with no inline drafting.

**Reasoning:** Diff delivery is faster to review and apply. Inline drafting at lock preserves history without forcing file regeneration. Skipping the ceremony respects that the user already named what they were locking — recapping is bureaucracy.

**Revisit when:** Diffs become hard to track (small changes accumulate without a coherent file-write pass), or breakpoint batches lose state because inline drafts weren't captured.

---

## 2026-04-30 — Positioning sharpened: voice-powered queryable memory

**Decision:** Throughline is positioned as the voice-powered queryable memory layer for AI agents. The wedge is that Obsidian owns notes-based memory, but no one owns voice-based memory. Brand language can shift from "voice notes app" toward "voice-powered memory layer" or "your voice, structured for your agent" where it fits naturally. The tagline `voice → agent` holds because voice is still the entry point; the memory layer is implied beneath.

**Context:** The council reframed the actual product as memory-for-agents rather than voice notes. The original spec led with capture; the wedge is structured, queryable, time-aware memory that agents can read.

**Alternatives considered:** Full tagline rebrand; no change; replace only small copy snippets without changing positioning.

**Reasoning:** The reframe is real but does not require a brand reset. `voice → agent` still communicates the entry point and destination, while the spec and supporting copy can make the memory layer explicit.

**Revisit when:** Marketing tests show "voice notes" framing converts better, or "memory layer" resonates strongly enough to earn elevation into the tagline itself.

---

## 2026-04-30 — Build sequence inverts: parallel-track v0

**Decision:** v0 build runs two parallel tracks in week 1. Track A is the eval foundation: 30 labeled voice samples, scoring script, and regression suite that runs on every prompt or model change. Track B is the iOS shell: project setup, locked screens, foreground recording capture, and upload to a backend stub. Week 2 wires extraction into iOS. Week 3 validates the MCP loop with Claude and ChatGPT.

**Context:** The council surfaced that the original spec was paced like a launch plan, with iOS polish treated as foundational while extraction quality and the agent loop were assumed.

**Alternatives considered:** Pure extraction-first; pure iOS-first; sequential eval then iOS; skip eval entirely.

**Reasoning:** The eval makes "90%+ extraction quality" a real claim. Running iOS shell work in parallel keeps the product moving while preserving an independent quality gate.

**Revisit when:** Eval maintenance cost exceeds value, iOS shell work blocks on backend decisions that require eval first, or extraction quality stabilizes so strongly that the regression suite stops catching regressions.

---

## 2026-04-30 — iOS v0 scope cut: foreground-only

**Decision:** v0 iOS app is foreground-only. Cut from v0: lock-screen Live Activity, Dynamic Island integration, AirPods stem-tap stop, background-audio entitlement, and the 30-minute locked-phone walk acceptance test. Recording requires the app to be in the foreground; the user taps to start and taps to stop. Cut features move to v1.1.

**Context:** The original spec made the touchless morning-walk experience a launch blocker. The council pushed back that the actual product risk is whether extraction and the MCP loop work.

**Alternatives considered:** Keep all original iOS features; cut only background mode; cut iOS entirely until extraction is proven.

**Reasoning:** Foreground-only recording is enough for v0 learning and shrinks the iOS build from the long pole into a parallelizable shell. The morning-walk ideal remains a v1.1 target.

**Revisit when:** v1.1 is scoped, users repeatedly request touchless recording, or Apple platform changes make background audio meaningfully easier.

---

## 2026-04-30 — Connect is optional but visible

**Decision:** Onboarding ends at sign-in: Hero → Record → Magic moment → Sign in. The required Connect screen is removed. An electric-blue `connect →` affordance replaces the settings gear in the home screen's top-right corner whenever the user has not connected an MCP client. Once connected, the gear returns. Users can record without connecting.

**Context:** The original onboarding required OAuth or URL paste into Claude.ai before the user reached the app home. Council critique identified this as the highest-friction step, and the user agreed connection should be optional but visible.

**Alternatives considered:** Keep mandatory Connect; defer Connect entirely; split users into "I have Claude/ChatGPT" and "not yet" paths; use a persistent banner above the date.

**Reasoning:** The top-right affordance keeps the next step visible without making setup a gate. It preserves the magic moment and lets users experience structured output before asking for connector trust.

**Revisit when:** Connect-rate measurement shows the affordance is too subtle, settings access for unconnected users becomes a complaint, or v1 progressive nudges require a different surface.

---

## 2026-04-30 — Onboarding flow superseded

**Decision:** The original five-screen onboarding flow, Hero → Record → Magic moment → Sign in → Connect, is superseded by the four-screen flow Hero → Record → Magic moment → Sign in.

**Context:** The five-screen flow was captured in `throughline-brand-decisions.md`. The new connect model moves connection post-onboarding into the home screen.

**Alternatives considered:** Keep the original required Connect screen; keep Connect as a skippable fifth screen; move Connect entirely to settings.

**Reasoning:** Required setup belongs after the first product value is shown. The home-screen `connect →` affordance keeps the agent loop discoverable without front-loading OAuth friction.

**Revisit when:** Users fail to find Connect after sign-in or connection becomes essential to explaining product value.

---

## 2026-04-30 — Privacy posture for v0

**Decision:** Voice recordings are stored in US data centers. Audio files have a 30-day TTL. Transcripts and structured extraction data persist indefinitely. Users can delete individual recordings or all data via account settings. Retention preferences are user-configurable.

**Context:** The council surfaced that the original spec had no documented privacy posture for personal voice recordings processed by LLMs and queryable through third-party AI clients.

**Alternatives considered:** Keep audio forever; delete audio immediately after transcription; per-recording retention controls; EU data residency from day 1.

**Reasoning:** 30-day audio TTL is a meaningful trust signal while preserving short-term playback and debugging. Persisting transcripts is necessary because long-term queryable memory is the product. User-configurable retention respects different privacy preferences.

**Revisit when:** EU traffic becomes material, audio playback past 30 days becomes important, privacy becomes a marketing differentiator, or regulations change the retention calculus.

---

## 2026-04-30 — Memory persistence is the moat

**Decision:** Throughline's defensibility over time is the user's accumulated personal voice data, not the schema or extraction prompt. Product, retention, and pricing decisions should defend accumulated memory.

**Context:** A council reviewer noted that structured extraction becomes cheaper and more commoditized as LLMs improve. The data has to be the moat, not the structure.

**Alternatives considered:** Treat schema as moat; treat extraction quality as moat; treat distribution through app stores and MCP catalogs as moat.

**Reasoning:** A longitudinal record of a user's voice, organized and queryable over time, is the thing models cannot recreate later by becoming smarter. This affects retention, privacy, roadmap, and export decisions.

**Revisit when:** A feature decision reopens data portability or lock-in, pricing strategy changes, or extraction quality proves unexpectedly durable as a moat.

---

## 2026-05-02 — Eval profiles separate action correctness from memory enrichment

**Decision:** The extraction eval reports three profiles: `full`, `action`, and `memory`. `full` keeps the complete v0 contract. `action` isolates the core voice-note-to-agent path: todos, tomorrow todos, priorities, intentions, accomplishments, people, mood, and note type. `memory` isolates retrieval and persistence quality: title, summary, accomplishments, mood, people, projects, tags, and centers of balance. The default pass profile remains `full`, but engineering diagnosis should look at `action` first when validating the core product experience.

**Context:** The first live Groq run showed stronger task extraction than metadata enrichment. A single overall score made it hard to see whether the product was failing at the core promise or at richer memory organization.

**Alternatives considered:** Keep one overall score only. Lower the threshold. Remove subjective fields from the eval entirely. Split the fixture suite into separate files.

**Reasoning:** Throughline's surface is a voice note that reaches an AI agent, so action correctness deserves an independent signal. Memory persistence is still the moat, so metadata cannot disappear from the eval. Separate profiles preserve both truths without letting subjective retrieval labels obscure whether the agent can act safely on the note.

**Revisit when:** The profiles create confusion, the memory layer becomes the primary user-facing value, or real agent usage shows different fields should define action correctness.

---

## 2026-05-02 — Product-ready extraction applies deterministic invariants

**Decision:** The eval runner applies deterministic post-processing after model output normalization. If a todo is dated for tomorrow, it is mirrored into `tomorrow_todos`. The scorer accepts same-day `for_date` values as equivalent to empty `for_date` when the fixture did not require another date. Critical hallucination detection checks whether unmatched output is unsupported by the transcript, not merely whether it differs from the labeled expectation.

**Context:** The Groq output often placed tomorrow dates correctly in `todos` but failed to duplicate the same item into `tomorrow_todos`. It also produced grounded alternate wording and same-day dates that were useful for an agent but penalized as if they were invented.

**Alternatives considered:** Require the model to maintain every invariant unaided. Keep exact label matching for all critical hallucinations. Rewrite all fixture labels to include same-day dates. Treat every unmatched string as critical.

**Reasoning:** Deterministic invariants should be enforced by code, not left to the model. Same-day dates help agent handoff. Hallucination means unsupported by the user's note, not "not phrased exactly like the fixture." Keeping that distinction makes the eval skeptical without becoming brittle.

**Revisit when:** Post-processing starts hiding model errors, same-day dating causes unwanted agent behavior, or transcript-support heuristics miss real hallucinations.

---

## 2026-05-02 — Default Groq eval model is gpt-oss-120b for now

**Decision:** Use `openai/gpt-oss-120b` as the default Groq model for extraction eval runs.

**Context:** Live Groq bakeoff results on the 30-fixture suite: `llama-3.1-8b-instant` scored 64.5 full / 77.8 action / 47.2 memory; `llama-3.3-70b-versatile` scored 73.8 / 84.9 / 57.9; `openai/gpt-oss-120b` scored 78.6 / 86.1 / 68.1; `qwen/qwen3-32b` scored 75.5 / 82.2 / 66.4 and was much slower in this setup.

**Alternatives considered:** Keep the cheap 8B default. Use Llama 70B for speed/quality balance. Use Qwen 32B. Continue prompt-only tuning before choosing a default.

**Reasoning:** None of the tested models passes the v0 threshold, but `openai/gpt-oss-120b` is the strongest current default and gives the most honest signal for extraction work. The eval should optimize for quality first because the product promise depends on a voice note reaching an agent safely.

**Revisit when:** Groq model availability changes, a model passes the action profile with fewer criticals, latency/cost becomes the blocker, or the extraction pipeline adds enough deterministic post-processing to change model choice.

---

## 2026-05-02 — Feedback loop creates eval candidates, not auto-deploys

**Decision:** Alpha user feedback is stored as reviewable eval material. Feedback can become private fixture candidates when it includes a corrected `expected` extraction, but it does not automatically train models, change prompts, or deploy extraction behavior.

**Context:** The product should learn from real usage: whether a note was agent-ready, what was missing, what was invented, and what should be remembered. But Throughline handles private personal memory, so a silent self-modifying extraction loop would be a trust risk.

**Alternatives considered:** Fully autonomous self-improvement. Manual feedback notes only. Fine-tuning immediately. No feedback loop until launch.

**Reasoning:** Eval-candidate feedback preserves the learning loop while keeping user trust intact. Agents can propose prompt or post-processing changes from reviewed failures, and those changes must pass the eval suite before promotion.

**Revisit when:** Feedback volume becomes large enough to justify semi-automated review, privacy controls mature, or there is a safe canary deployment path for extraction changes.

---

## 2026-08-17 — Core-quality target user and boundary

**Decision:** Core quality work serves the individual who captures personal thoughts while driving, walking, or thinking, then needs durable structured notes and to-dos readable by their AI agent. It does not expand Throughline into a meeting recorder, team-transcription product, or generic audio archive.

**Reasoning:** The quality program must measure the product promise it is improving, rather than optimize for a broader transcription category.

**Revisit when:** Mike changes product priority or approves a change to the durable product charter.

---

## 2026-08-17 — Feedback evaluation and hybrid learning authority

**Decision:** The user who recorded a note is the only human evaluator for that note. Feedback automation validates, deduplicates, classifies, and quarantines signals; ambiguous labels are excluded until they can be classified without inventing a label. Mike does not review examples, and there is no employee, contractor, or external-review queue. Safe prompt, schema, and normalizer changes may auto-promote only after declared quality, critical-error, reliability, latency, cost, canary, lineage, and rollback gates pass.

**Reasoning:** This preserves user authority over their note while making learning repeatable, auditable, and safe to operate without a recurring manual review function.

**Revisit when:** A change to data-use policy, the learning authority model, or a promotion gate is explicitly approved.

---

## 2026-08-17 — Onboarding and recording-limit baseline

**Decision:** Onboarding is unchanged. The current recorded limits are a 30-second onboarding demo and a five-minute authenticated client cap per recording. A ten-minute daily allowance is intended but is not implemented or enforced; it must not be described as live.

**Reasoning:** Documentation and quality work must not silently alter a user-facing experience or present an intended policy as runtime behavior.

**Revisit when:** Mike explicitly approves an onboarding or recording-limit change after the relevant baseline and rollout evidence exist.

---

## 2026-08-17 — Premium limits and evaluation credits remain backlog-only

**Decision:** Premium recordings up to 15 minutes and evaluation credits remain backlog items. They are not a current program milestone, implementation commitment, or credit-ledger build.

**Reasoning:** Monetization and limits require decision-grade usage and cost evidence, and both are approval-bound changes.

**Revisit when:** Mike prioritizes a bounded, approved pricing or recording-limit slice supported by decision-grade baselines.

---

## 2026-08-17 — Baseline-first quality changes and operating authority

**Decision:** Establish a baseline through measurement before setting lift targets or changing a quality control. Mike decides what enters build, reviews product/design taste and judgment, and sets priority. Agents own baseline inspection, options, specifications, plans, implementation, verification, routine reversible rollout, measurement, and documentation; within an approved reversible slice, agents may implement and roll out routine reversible work without another approval.

**Reasoning:** A baseline prevents false improvement claims, while the authority boundary keeps routine reversible progress moving without widening approval-bound work.

**Revisit when:** The workflow authority matrix or canonical metric definitions change through an approved decision.

---

## 2026-08-17 — Evaluation truth and immutable lineage selected

**Decision:** Select `TL-EVAL-001` for build after the verified `TL-DATA-001` migration and API rollout. The slice will preserve immutable inference contracts, processing attempts, original model output, user revisions, and owner-only evaluations before any model benchmark or learning promotion is interpreted.

**Reasoning:** Current feedback is stored but unused, note edits overwrite originals, and the existing golden evaluator proves plumbing rather than model quality. Honest lineage is the dependency for measuring whether a transcription, extraction, or prompt candidate actually improves the voice-to-tasks result.

**Revisit when:** The measurement rollout cannot establish its required compatibility and reconciliation gates, or the evaluation slice's bounded design changes materially.

---

## 2026-08-17 — Explicit evaluation contribution and audio-retention boundary

**Decision:** Only the recording owner explicitly saving a 1–5 grade or a material content correction under the current contextual disclosure may make that recording eligible for Throughline's private evaluation corpus. Opening a note, completing or reopening a task, submitting general product feedback, inactivity, a no-op edit, legacy `should_remember`, or an inferred historical action does not qualify. Eligible audio that is still available may remain beyond the ordinary 30-day window until the user removes the evaluation contribution, deletes the note, or deletes the account. Historical grades may remain legacy aggregate signals but do not gain extended-retention eligibility without a new disclosed contribution action.

**Reasoning:** This makes the recording user the only reviewer and gives Throughline reusable quality evidence without silently turning ordinary recordings or historical feedback into a corpus. It also keeps the retention exception narrow, reversible, and technically enforceable.

**Revisit when:** Mike approves a different corpus trigger, retention duration, withdrawal model, or training use.

---

## 2026-08-17 — Quiet evaluation disclosure and no-training scope

**Decision:** Put a short contextual explanation next to the grade or content-correction action and provide full policy detail, without changing onboarding or adding a blocking modal. Record the disclosure version and contribution action immutably. Evaluation contributions are for private quality evaluation only: no model training or fine-tuning, no automatic promotion, no advertising or tracking use, and no sharing with a model provider beyond the separately disclosed normal transcription and extraction inference. Free-text explanations remain quarantined and excluded from corpus scoring, candidate generation, promotion evidence, analytics, and tracked artifacts.

**Reasoning:** The action-specific disclosure is restrained but clear about the new purpose, associated data, retention exception, and deletion controls. A hidden boolean or policy-only statement would not provide an honest, auditable user action.

**Revisit when:** Mike approves training, fine-tuning, new provider sharing, a different disclosure surface, or another data-use-policy change.

---

## 2026-08-23 — Evaluation disclosure, preview, readiness, and removal treatment

**Decision:** Use this exact contextual copy beside note grading and material content correction, not in onboarding: “Private quality check. Saving this grade or a content correction may keep this recording’s audio past 30 days until you remove the contribution. Not used to train models. Learn more.” The adjacent “What your agent will read” preview shows all 14 canonical extraction fields, including inspectable nested to-dos. Agent readiness is off by default, can be accepted only after the complete matching preview is shown, and resets whenever the note revision, canonical payload, output hash, schema, normalizer, or keyset changes. An evaluated note provides an owner-only control to remove its evaluation contribution.

**Context:** The evaluation-truth slice needs an honest, quiet owner action that binds a grade and readiness judgment to the exact note revision being reviewed while keeping the audio-retention exception visible and reversible.

**Reasoning:** Placing the disclosure at the contribution action gives the user relevant context without adding onboarding friction. Showing the exact agent-facing structure makes readiness a concrete judgment rather than a hidden boolean. Default-off and invalidation rules prevent stale acceptance, while note-level removal keeps the contribution reversible.

**Revisit when:** Mike approves a different disclosure, surface, preview field set, readiness behavior, retention boundary, or removal model. This decision does not authorize a production rollout, publication, App Store submission, provider change, or broader data use.

---

## 2026-08-25 — Verified feedback iterations advance to internal TestFlight

**Decision:** After a TestFlight feedback item is privately ingested, converted into a bounded specification, implemented, and verified, agents may archive a fresh build, upload it with Apple's internal-testing-only control, assign it to the existing `Internal QA` group, and verify tester visibility without requesting another approval for each iteration.

**Reasoning:** The feedback loop creates user value only when the tester can install the corrected build. Repeating the same approval gate after every already-authorized internal iteration adds latency without changing the product, distribution population, or public risk boundary.

**Revisit when:** The workflow would change App Store submission or public release state, add an external tester population, publish or change privacy disclosures, change provider/model/data-use policy, or alter another Mike-owned product boundary. Those actions remain separately approval-gated.

---

## 2026-08-27 — Discovery growth system selected for build

**Decision:** Select `TL-DISC-001` and authorize agents to build, verify, and deploy the reversible owned discovery surface plus the repository-native discovery queue and workstream artifacts. The durable public promise is voice to structured notes and to-dos to a readable AI agent. “Fastest” remains an unverified message hypothesis. Paid spend, compensation, direct outreach, posting from Mike's accounts, community or directory submission, App Store changes, and live product changes require approval of the concrete action.

**Reasoning:** The live App Store page explains the product, but the public website is still a support/privacy placeholder and discovery work lacks one evidence-bound production and learning loop. Shipping the owned, reversible layer creates proof and attribution without silently authorizing open-ended external commitments.

**Revisit when:** Comparative evidence supports a stronger claim, the measurement contract changes, or Mike approves a concrete external distribution action.

---

## 2026-08-27 — Owned discovery surface deployed and enters measurement

**Decision:** Accept the verified six-file static release and deploy it from a sparse worktree based directly on current `origin/main`. Pages build `1179780269` published commit `1770db3`; `TL-DISC-001` now enters `measuring`. No acquisition lift is claimed until aggregate traffic, App Store attribution, and downstream product evidence are available.

**Reasoning:** The home and task-intent pages passed the full responsive, accessibility, link, metadata, image, claim, and public postflight gates. Shipping this reversible owned layer creates a usable destination and named campaign path without widening authority to third-party posting, outreach, submissions, spend, provider generation, App Store changes, or product changes.

**Revisit when:** The first privacy-safe baseline is available or Mike approves one of the prepared external action packets.

---

## 2026-08-28 — Home feedback first slice rolled back after owner review

**Decision:** Restore the preceding Home presentation and remove the presentation/projection work introduced in internal build `2026082601`, while preserving the newer backend, immutable-lineage, private-evaluation, and privacy-related source. Deliver the recovery as a fresh internal-only TestFlight build. Parts 1, 4, and 5 of the Home feedback slice are no longer active product direction.

**Reasoning:** Mike rejected the canary's visual and information treatment after using it in TestFlight. The slice was intentionally reversible, so preserving the accepted backend and evaluation foundation while restoring the preceding Home UI is the smallest response to that product judgment.

**Revisit when:** Mike selects a newly bounded Home mock or specification. Internal rollback build `2026082801` is recovery evidence, not a user-outcome improvement claim.

---

## 2026-08-29 — Stabilize the operating foundation before acceleration

**Decision:** Treat `TL-OPS-002` as the leading operating slice before net-new product acceleration. Status and handoffs use four named perspectives—Current, Evidence, Next gate, and Authority. `product/backlog.json` records portfolio disposition while the relevant slice brief records execution phase; runtime, release, and metric-readiness labels remain separate. Canonical navigation and backlog integrity must pass the read-only foundation verifier before this slice closes.

**Reasoning:** The audit found an undeclared backlog state, superseded internal-build actions, outdated architecture language, broken canonical navigation, and different authority interpretations across active records. It also found that capture durability and truthful saved/agent-readable state are a stronger product gate than another Home presentation. Resolving the operating contradictions first reduces the chance that the next agent accelerates the wrong slice or overstates evidence.

**Revisit when:** The canonical source map or authority model changes, the verifier creates false constraints, or Mike selects the bounded capture-durability/truthful-save candidate. This decision authorizes reversible documentation and validation cleanup only; it does not authorize onboarding, Home, provider, model, policy, pricing, recording-limit, App Store submission, deployment, or public-release changes.

---

## 2026-08-29 — Separate product direction, design language, and feature priority

**Decision:** Keep durable product direction and the outcome ladder in `docs/PRODUCT.md`; keep look, feel, interaction character, and design-review rules in `throughline-brand-decisions.md`; keep feature hypotheses, evidence, dependencies, priority, and one next gate in `product/backlog.json`. Product-facing candidates require fresh current-flow evidence and a bounded decision packet before build. An audit may recommend a direction, but it does not select a visual target, reprioritize the portfolio, or authorize implementation.

**Reasoning:** The repository already had a coherent product promise and distinctive visual language, but runtime policies had leaked into the brand document, the immediate product wedge was implicit, historical design QA could be mistaken for current visual truth, and the core-quality program contained a personalization candidate missing from the canonical backlog. Separating these perspectives makes disagreements visible without creating another roadmap or strategy source.

**Revisit when:** Mike changes the durable product promise, selects a new visual direction, reprioritizes the portfolio, or approves a different product/design decision path. This record does not approve a Home redesign, capture implementation, agent write capability, personalization, pricing, provider, policy, onboarding, release, or publication change.

---

## 2026-08-30 — Claude Code and Codex coordinate through selected repository handoffs

**Decision:** Claude Code owns bounded UI exploration, inspectable mock candidates, and the selected-design specification; Codex owns scoped production implementation, verification, backend or implementation fixes, release evidence, and already-authorized internal-only TestFlight delivery. They coordinate through a committed, content-safe design handoff rather than direct agent invocation or conversation memory. Mike retains priority, what enters build, product/design selection, acceptance of the TestFlight journey, and exact App Store metadata/submission/public-release authority.

**Context:** The repository already contains product, design, backlog, workflow, private TestFlight feedback intake, and dated internal-release evidence, but it did not contain a current Claude Code entry point, a shared handoff format, a deterministic UI-versus-bug routing boundary, or a reusable signed archive/upload runner. The legacy `agent-prompts.md` predates the current canon and is not a safe current kickoff.

**Alternatives considered:** Let both agents independently design and implement; pass summaries manually between chats; make Claude Code call Codex directly; let every accepted TestFlight build flow automatically into public submission; use GitHub automation as the first integration layer.

**Reasoning:** Repository artifacts are inspectable, versionable, and usable by either tool without coupling their APIs or sharing hidden context. One design owner and one implementation owner reduce taste drift and overlapping edits. Standing internal-TestFlight authority keeps bounded iteration fast, while a separate exact public-release gate protects metadata, privacy, review, and release decisions.

**Revisit when:** A reviewed repository-native internal release runner and privacy-safe feedback router exist, the handoff creates measurable friction or design drift, or Mike changes role ownership or an approval-bound surface. This decision does not itself authorize an upload, App Store metadata mutation, submission, public release, provider/model/data-use change, onboarding change, pricing change, or recording-limit change.

---

## 2026-09-28 — Reaffirm design and engineering ownership with mutual review

**Decision:** Mike requested an end-to-end return audit and a centralized workflow: Claude performs front-end design; Codex performs production implementation, complex engineering, and voice-note quality work; they review each other's work. Maintain the existing role split and add exact-revision feasibility and implementation-review receipts to the existing tandem and handoff documents.

**Evidence:** The [return audit](docs/evidence/2026-09-28-return-audit.md) found substantial uncommitted August work and a separate September Claude cloud PR whose Git tree does not contain the local operating guides. The first implementation gate is a reviewed shared base that preserves both bodies of work. Green PR checks alone do not establish that base, peer review, deployment, or product acceptance.

**Authority:** This records Mike's requested audit and process organization. It does not select the running-list PR or a capture candidate, authorize a merge, enable a quality behavior, resume a state-changing automation, approve new credentials, or change release/product-policy boundaries. Existing approved-slice authority remains unchanged.

**Revisit when:** One bounded slice has completed the full cross-tool review and device acceptance loop, or Mike changes the role split. Keep practical lessons in the existing tandem workflow rather than creating another process system.

---

## 2026-09-28 — Reconcile the preserved base; capture recovery precedes the running list

**Decision:** Mike approved Phase 2 for `codex/reconcile-september-base` and its new pull request only. Publish the reviewed August engineering work, operating guides and design artifacts, and incorporate the two newer main commits into that branch. Do not merge into main. Mike explicitly accepted first public repository publication of current state, product charter, workflow, backlog and metrics. The working-copy preservation and publication screens are recorded in the [reconciliation evidence](docs/evidence/2026-09-28-reconciliation-plan.md).

**Product order:** Capture recovery (`TL-CAP-001`) first, then the running list (`TL-TASK-001`). Candidate B, “The recorder holds it,” is selected. The [draft capture handoff](docs/handoffs/2026-09-28-home-capture-recovery.md) remains `selected_pending_codex_feasibility_review`; preserve its SHA-256 `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c` and all design assets byte-identically. Codex’s feasibility review follows Phase 2 against the committed revision as a separate task. Claude owns any later handoff edit. This decision does not authorize feature implementation.

**Integration evidence:** Preservation commits and main-ancestry reconciliation produced source revision `a743aac555b7e59e25bc55c7a0659864ed02c548`. Both `1770db3` and `fd85d01` are ancestors; the one discovery-document conflict retained the newer local rollback evidence. Node/Deno tests, documentation/privacy checks, the isolated unsigned Simulator build and focused Swift contracts passed. The local database replay was unavailable; peer review remains pending. See the linked evidence for counts and limitations.

**Authority:** Only this branch and its new PR may be published. Posting the PR #2 review and contacting Claude each require their own go-ahead. Main merges, force-pushes, branch deletion, deployments/migrations, deployment/TestFlight workflow dispatch, secrets, automations, behavior flags and Apple changes remain outside this approval. Moving or repointing the active checkout out of iCloud is a separate proposed action after the PR is open. The existing checkout and private recovery copy stay intact.

**Revisit when:** The exact committed handoff receives its separate feasibility review, the reconciled base receives the required peer review, or Mike changes priority or approves one of the separately gated actions.


---

## 2026-09-28 — Approve the current-operation privacy policy text

**Decision:** Mike approved the exact revised Markdown and HTML policy presented after the privacy publication audit. The approved text discloses the current server-side PostHog processing and account linkage, accurately describes the current AI-processing controls, and clearly marks Private Evaluation and its contribution/retention/removal controls as planned and not enabled. Account deletion is described separately from that future feature. The policy retains the no-training, no-fine-tuning and no-automatic-promotion boundaries.

**Exact approved files:** `docs/privacy-policy.md`, SHA-256 `2b0b68dce68b816f9471df3855fe0d2e7462ae9050c7d0c8ae34a144e71c7fce`; `docs/privacy/index.html`, SHA-256 `4be13989c8a52153f4f9faf54770c564a483437ec54ce74803dfbc7d2a455965`. Any later wording change requires approval of the revised text before publication.

**Authority:** Record the approval and publish these bounded policy/decision changes only on the already-authorized `codex/reconcile-september-base` branch and [PR #3](https://github.com/mpolner88/throughline/pull/3). The exact-text gate is satisfied for these bytes. Main merge remains unapproved and mutual review remains pending; GitHub Pages continues to serve main until a separately approved publication action. This does not enable evaluation, deploy functions or migrations, change secrets/flags, dispatch release workflows, or change App Store answers. App Store privacy answers will be finalized and updated with the next approved build as Mike requested; the known current linkage discrepancy remains unresolved until that action.

**Product direction:** Mike reaffirmed capture recovery first, followed by the next running-list version. The selected capture tray still needs its committed-handoff feasibility findings resolved before build entry. Mike wants the learning loop enabled soon and asked to return to that separately; this records intent, not approval to enable production collection, benchmarking, training or automatic promotion.

**Revisit when:** The approved policy bytes change, an exact main/publication action is approved, the capture handoff is ready for build, or Mike resumes the bounded learning-loop decision.


## 2026-09-28 — Complete the approved nonsynced checkout migration

**Decision and execution:** Mike approved moving the active checkout at exact starting revision `bda1058947397b7bf1b908a0a682eb3966868a54` to the real, user-restricted `throughline-local` directory outside iCloud. The filesystem migration and saved Codex project selection completed; Claude's subsequent review independently named the same active checkout and base `372178b`. The earlier September entry describing migration as future is superseded. Exact personal paths and private configuration receipts remain outside tracked files.

**Preservation:** The old dirty checkout, original shortcut, separate `throughline-reconciliation` reference checkout and recovery copy remain intact. `.throughline/`, `.superpowers/`, `supabase/.temp` and `supabase/.branches` remain behind. No recreation is needed for immediate build work: regenerate reporting/task outputs only when needed, preserve historical reports/private feedback, and establish CLI linkage/branch context only during a later approved operation. Existing chats may retain their original directory context; verify the physical target for every task. Evidence: [integration follow-up](docs/evidence/2026-09-28-reconciliation-plan.md#review-integration-follow-up).

## 2026-09-28 — Accept capture account and interruption defaults; authorize bounded re-review

**D1:** Mike accepts one neutral tray row for other-account captures: “2 captures from another account. Sign in to that account to save them.” It offers Discard from phone after confirmation. Those captures are never uploaded, played, individually listed or counted under the signed-in account. This aggregate notice does not transfer ownership; discard is local only.

**D2:** Mike accepts that a call, locking the phone or leaving the app ends recording and keeps playable audio as Stopped early. Background recording is outside this slice; unrecoverable audio follows the handoff's truthful interruption state.

**Authority:** Review revision 2, disposition the base findings, integrate reviewed files and canonical corrections, and push only the existing `codex/reconcile-september-base` branch for PR #3. Return findings to Claude. Do not build capture or running list. Claude owns handoff/assets and sets `handoff_ready` only after findings are resolved. The immutable revision-2 review target is `75eda71e6606374145eb6f2b9fbdea807ad50f9cbd6fa2274f0908e27432c3b9`; preserving it does not make it build-ready.

**Still undecided:** R8 AI-consent removal and R9 Pages publication boundaries. Main merge and PR comments remain unapproved. Approved policy bytes stay unchanged; no migration, deployment, flag, secret, automation, App Store or TestFlight action follows. Private Evaluation remains deferred despite Mike's interest in returning to the learning loop soon. Product order remains capture recovery, then running list. Evidence: [Codex re-review](docs/evidence/2026-09-28-codex-capture-rereview.md) and [R8/R9 packet](docs/evidence/2026-09-28-main-merge-decisions.md).


## 2026-09-28 — Restore AI permission and restrict the Pages publication surface

**Decision:** Mike approved both recommendations in the [R8/R9 packet](docs/evidence/2026-09-28-main-merge-decisions.md): restore equivalent explicit AI-processing permission before inference, including demo transcript promotion, and limit GitHub Pages output to the intended public pages and assets. Adapt the prior permission gate to the reconciled source, verify persisted choice/refusal/withdrawal and request boundaries, and obtain independent engineering and Claude presentation review.

**Scope:** Implementation and verification on `codex/reconcile-september-base`, followed by publication to existing draft PR #3. The exact main merge is not approved. Capture tray and running list are not implemented; Claude still resolves C1–C6 before capture readiness. Private Evaluation remains deferred. No provider, model, data-use, pricing, limits, backend migration/deployment, flags, secrets, automations, TestFlight or App Store action is included.

**Latest direction:** Mike asked to leave privacy-policy work aside. The already approved policy files stay byte-identical; this follow-up does not revise them or require another policy discussion.

**Evidence:** [Consent and Pages follow-up](docs/evidence/2026-09-28-consent-pages-follow-up.md) records exact source, checks, review and remaining release boundaries.

## 2026-09-29 — Finish the selected capture-tray handoff

**Decision:** Mike directed, “Finish the capture tray handoff.” Claude is authorized to revise the selected Candidate B handoff and its reference assets to resolve C1–C6; Codex reviews the exact revised contract, integrates the reviewed files and updates canonical state. D1 and D2 remain accepted. This is handoff completion, not capture-tray or running-list implementation.

**Focus:** Mike stopped further AI-permission and privacy-policy work. The interrupted permission screenshot review and the pending onboarding-exit question are not part of this task. Existing product behavior is not changed by this direction. Capture recovery stays first, running list second, and Private Evaluation stays deferred.

**Authority:** The existing PR #3 branch-only publication authorization remains the integration boundary. No main merge, feature implementation, migration execution, deployment, behavior flag, automation, provider/model/data-use/pricing/limit/onboarding or Apple action follows. A completed handoff records design and feasibility readiness; Mike retains build entry.

**Completion evidence:** [Revision-3 handoff readiness](docs/evidence/2026-09-29-capture-handoff-ready.md) records the exact contract, mutual review, resolved findings and verification limits.
