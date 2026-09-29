# Throughline — Brand and Product Design Principles

Canonical reference for Throughline's visual identity, interaction character, and product-design judgment. This document describes the durable design language. It guides proposals; it does not approve a new direction or replace Mike's design selection. It is not proof of what is live; verified runtime and release facts belong in [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md).

Last reconciled with the accepted iOS source and rollback evidence: **2026-08-29**.

---

## Identity

- **Name:** Throughline
- **Direction:** Quiet Software — restrained monochrome with one bold accent
- **Audience:** people who think out loud, especially while walking or driving
- **Promise:** the quiet thread between what you said and what your AI does next

Throughline should feel calm, direct, and considered. It is a private thinking tool, not a generic task manager and not a chat interface. The interface should reduce the distance between speaking, understanding what was captured, and acting on it later.

## Design principles

### 1. Voice before interface

Capture must feel lighter than typing. Recording is the product's signature action, so it should be immediately recognizable and available without competing with the user's notes and next actions. Do not reduce it to a generic microphone icon or let it obscure the content it creates.

### 2. Show the transformation

The product earns trust by showing `voice → structured note and to-dos → readable by an AI agent`. Prefer a concrete before-and-after example, a transcript connection, or a visible result over claims about intelligence or automation.

### 3. Preserve the user's words

Summaries and tasks are projections of a recording, not replacements for it. Keep the path back to the source clear, make correction easy, and never imply meaning the user did not provide. Traceability matters more than polish.

### 4. Use quiet hierarchy

Create order with spacing, typography, and sequence before adding containers, labels, or decoration. A screen should have one dominant reading path and one obvious primary action. White space is structural, not leftover space.

### 5. Give every item one clear role

A task, note, or carry-forward item should have one canonical representation in a given context. Do not repeat the same words in a task row, a summary card, and a source card without making the relationship and purpose of each view clear.

### 6. Reveal depth progressively

Home answers “what matters now?” Detail screens explain why and where it came from. Transcripts, evaluation, agent setup, and technical information belong one level deeper unless they are needed for the immediate decision.

### 7. Let blue mean something

Electric blue identifies Throughline, primary action, selection, and meaningful progress. It is not ambient decoration. A screen with too much blue has lost its hierarchy.

### 8. Be native where trust matters

Use familiar iOS behavior for authentication, settings, permissions, destructive actions, accessibility, and system navigation. Throughline's character comes from its spacing, typography, voice, and capture experience—not from making utility surfaces unfamiliar.

### 9. Make gestures additive

Gestures can make repeated actions fast, but they must supplement understandable controls and accessible alternatives. Completion, archive, delete, and recovery need distinct outcomes, useful feedback, and a non-gesture path.

### 10. Earn disclosure

Explain privacy, agent access, and technical behavior at the moment the user needs to decide. Use plain, restrained language. Do not front-load caveats, hide consequential behavior, or use reassuring copy that the product has not earned.

### 11. Design for accessible calm

Calm is not faintness. Preserve readable contrast, Dynamic Type, VoiceOver meaning, Reduce Motion, and at least 44-point touch targets. De-emphasis may reduce visual weight; it must not hide information or action.

### 12. Extend the current language before inventing a new one

New experiences should begin with Throughline's established signature: lowercase wordmark, generous spacing, strong but restrained type, hairline borders, modest corner radii, one blue accent, concise copy, and visible source relationships. A new pattern should have a product reason, not merely look like a familiar productivity-app convention.

## Product hierarchy

### Home

Home is a usable return surface, not a dashboard. Its hierarchy is:

1. temporal context
2. what needs attention now
3. unfinished work, when it is actionable
4. recent source notes and their status
5. persistent access to recording

The exact sections may change, but the reading order should remain calm and legible. Carry-forward content must help the user act or orient; it should not become a decorative alert. A projected task and its source note may both appear only when each has a distinct job and the relationship is understandable.

### Onboarding

The accepted flow is **Hero → Record → Magic moment → Sign in**. Let the person experience the transformation before asking for commitment. Each step should make one promise, ask for one action, and leave enough space for the product idea to land.

### Detail and utility surfaces

Note detail should lead with the structured result, preserve access to source material, and keep editing and evaluation clearly secondary. Settings, feedback, connection setup, and account surfaces may use native containers, but their spacing, copy, and hierarchy should still feel like Throughline.

## Interaction rules

- One primary action per screen or state.
- A gesture never provides the only way to perform an important action.
- Completion and archive are different concepts and must look, sound, and recover differently.
- Destructive or difficult-to-reverse actions require confirmation or a clear undo path.
- Touch targets are at least 44 × 44 points, including compact icons and swipe alternatives.
- Motion should explain state change, not decorate it. Keep it brief and respect Reduce Motion.
- Loading, recording, processing, success, failure, empty, and offline states need explicit treatment.
- Selected, disabled, focused, and pressed states must remain legible in light and dark mode.

## Marks

| Mark | Form | Where it lives |
|---|---|---|
| Lockup | Underlined `throughline` | Splash, marketing, login, App Store, social profiles |
| Wordmark | Underlined `throughline` at brand moments; plain lowercase `throughline` when space is tight | App chrome, settings, footer, body |
| Mark alone | One solid horizontal line | App icon, favicon, avatar, loading, empty-state |

The logo is the word becoming the line. The underline is not decoration; it is the product promise in its most reduced form: the shortest path from what was said to what remains usable.

## Color and surfaces

The brand color is electric blue. Use it sparingly and confidently.

- **Electric blue:** `#2563EB` — primary action, links, selection, and brand moments
- **Lifted blue:** `#3B82F6` — dark-mode active states
- **Pill background:** `#EFF6FF` — subtle blue emphasis
- **Pill text:** `#1E3A8C` — text on subtle blue surfaces

Neutrals follow light and dark mode conventions: near-black on white in light mode, near-white on near-black in dark mode. Borders are hairline and low contrast. The default corner radius is modest—approximately 8 points—so surfaces feel precise rather than soft or playful.

Do not use a card simply to group adjacent content. Add a surface only when it clarifies ownership, interaction, state, or provenance.

## The underline rule

The underline is the brand's central element. Treat it as scarce.

**Used for:** the app icon, lockup, loading, recording transitions, and moments where Throughline itself is being named.

**Never used for:** list bullets, decoration, dividers, repeated UI patterns, or generic emphasis.

The arrow `→` remains a text-level transition mark for the tagline (`voice → agent`) and explicit forward actions. It is not the standalone logo.

## Typography

- **Display and body:** the native/system sans in the iOS app; refined sans such as Inter Display, Söhne, or Geist in brand material.
- **Mono:** reserved for MCP URLs, identifiers, and technical content.
- **Weight:** regular and medium carry the interface. Heavier weight is exceptional, not a substitute for hierarchy.
- **Case:** sentence case for headlines, sentences, and actions. Compact structural eyebrows may use uppercase with tracking. Avoid Title Case and copy that feels shouted.
- **Rhythm:** large headings, short lines, generous leading, and enough separation that labels do not need extra chrome.

## Voice and copy

- Quiet, not loud; no exclamation points.
- Concrete, not abstract: “on a walk,” not “on the go.”
- Earned, not promised: show before telling.
- Short enough to breathe; longer only when the decision requires it.
- The user's words, not ours.

**Words we use:** talk, speak, voice, walk, drive, morning, evening, capture, surface, weave, throughline, thread, quiet, considered, true.

**Words we avoid:** productivity, hack, optimize, supercharge, AI-powered, revolutionary, seamless, effortless, and “smart” when describing the product. Avoid “just” as a softener.

- **Tagline:** `voice → agent`, with the arrow in electric blue when styling allows.
- **Subhead:** the shortest path from your voice to an agent.
- **Promise:** Throughline is the quiet thread between what you said and what your AI does next.

`voice → agent` means owner-controlled structured context that an agent can read. It does not imply that agent write-back or task mutation is currently shipped.

## Iconography

Use SF Symbols in the iOS app and Lucide in web or brand surfaces. Choose simple, single-weight forms and match their apparent stroke weight to surrounding type. Custom marks are reserved for the app icon, brand lockup, and recording state. Do not use emoji as interface icons.

## Component character

- **Recording:** a persistent, full-width electric-blue capture surface with a white custom inner mark in the accepted onboarding and Home language. Do not substitute a generic floating microphone. A materially different recording shape requires an explicitly selected design direction.
- **Buttons:** full-width primary buttons are approximately 52 points high with an 8-point radius. Secondary actions rely on text, native controls, or restrained outlines.
- **Cards:** white or system-background surfaces, hairline borders, modest radius, and no decorative shadow unless elevation communicates behavior.
- **Pills:** compact and restrained. Blue pills signal selected or meaningful state; neutral pills carry metadata.
- **Task rows:** use an affordance that communicates state and action. Keep task text primary and source or timing metadata secondary.
- **Lists:** avoid decorative bullets. Task lists use task controls; prose detail may use a small blue dot when a true bulleted list improves scanning.
- **Labels:** small tracked eyebrows may organize sections, but should not compete with the content beneath them.

## Design review checks

Before a mockup or implementation is accepted, ask:

- Can someone understand the screen's purpose and primary action in a glance?
- Does the design show the relationship between voice, structured output, and source?
- Is any task or message repeated without gaining a distinct purpose?
- Could spacing, type, or sequence replace a box, pill, label, or divider?
- Is electric blue carrying meaning, or merely filling space?
- Are gesture actions also discoverable and accessible without a gesture?
- Does the interface still work with long text, empty data, errors, dark mode, Dynamic Type, and Reduce Motion?
- Does every consequential claim or reassurance have behavior to support it?
- Does this feel specifically like Throughline, or like a generic notes or to-do app?

## Current baseline and evidence

This document was reconciled on **2026-08-29** against the repository's accepted iOS language and the recorded Home rollback. These links establish the basis for the principles; they do not claim that an uninstalled internal build is publicly visible.

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — verified runtime, release, and operational facts
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — durable product intent and non-goals
- [`docs/evidence/2026-08-28-home-ui-rollback.md`](docs/evidence/2026-08-28-home-ui-rollback.md) — evidence that the preceding Home presentation was restored after the replacement was rejected
- [`ios/Throughline/Theme.swift`](ios/Throughline/Theme.swift) — accepted color, type, spacing, and radius tokens in source
- [`ios/Throughline/Views/SharedComponents.swift`](ios/Throughline/Views/SharedComponents.swift) — wordmark, labels, buttons, and utility surfaces
- [`ios/Throughline/Views/OnboardingView.swift`](ios/Throughline/Views/OnboardingView.swift) — accepted onboarding hierarchy and capture treatment
- [`ios/Throughline/Views/HomeView.swift`](ios/Throughline/Views/HomeView.swift) — accepted Home, note, and task presentation in source

## Scope boundary

This file does not define current runtime limits, pricing, provider configuration, release state, agent capabilities, or portfolio priority. Use [current state](docs/CURRENT_STATE.md) for dated live facts, [the product charter](docs/PRODUCT.md) for durable direction, [the workflow](docs/WORKFLOW.md) for authority, and [the backlog](product/backlog.json) for prioritized hypotheses and next gates.
