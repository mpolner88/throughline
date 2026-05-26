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
