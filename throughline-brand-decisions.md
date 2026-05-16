# Throughline — Brand Decisions

Canonical reference for design and engineering. Updated as decisions are made.

---

## Identity

- **Name:** Throughline
- **Direction:** Quiet Software — restrained monochrome with one bold accent
- **Audience:** AI-curious productivity people who already think out loud on walks
- **Promise:** The quiet thread between what you said and what your AI does next.

## Marks

| Mark | Form | Where it lives |
|---|---|---|
| Lockup | `throughline →` (trailing arrow, electric blue) | Splash, marketing, login, App Store, social profiles |
| Wordmark | `throughline` (lowercase, no embellishment) | App chrome, settings, footer, body |
| Mark alone | `→` (electric blue) | App icon, favicon, avatar, loading, empty-state |

## Color

The brand color is electric blue. Used sparingly but boldly.

- **Electric blue:** `#2563EB` — primary brand color (arrow, primary buttons, links)
- **Lifted blue:** `#3B82F6` — dark-mode active states
- **Pill background:** `#EFF6FF` — subtle blue surfaces (mood pills, highlights)
- **Pill text:** `#1E3A8C` — text on blue pill backgrounds

Neutrals follow standard light/dark mode conventions. Text is near-black on white in light mode, near-white on near-black in dark mode. All borders are 0.5px.

## The arrow rule

The arrow `→` is the brand's central element. Treat it as scarce.

**Used for:** the tagline, the lockup, forward-action buttons ("save and continue →"), navigation chevrons on cards, transitions between states.

**Never used for:** list bullets, decoration, repeated UI patterns where it has no destination.

## Typography

- **Display:** refined sans (Inter Display, Söhne, Geist). Letter-spacing -0.5px on headlines.
- **Body:** same family, regular weight, line-height ~1.5.
- **Mono:** for MCP URLs, IDs, technical content.
- **Weights:** 400 regular, 500 medium. Never 600/700.
- **Case:** Sentence case always. Never Title Case. Never ALL CAPS.

## Voice

- Quiet, not loud (no exclamation points)
- Concrete, not abstract ("on a walk," not "on the go")
- Earned, not promised (show before you tell)
- Sentences that breathe (short, then a longer one when it earns it)
- The user's words, not ours

**Words we use:** talk, speak, voice, walk, drive, morning, evening, capture, surface, weave, throughline, thread, quiet, considered, true.

**Words we avoid:** productivity, hack, optimize, supercharge, AI-powered, revolutionary, just (as softener), seamless, effortless, smart (when describing the product).

## Copy

- **Tagline:** voice → agent (arrow always in electric blue)
- **Subhead:** the shortest path from your voice to an agent
- **Promise:** Throughline is the quiet thread between what you said and what your AI does next.

## Iconography

Lucide icons (single-weight stroke, geometric, slightly cool). Custom marks reserved for: app icon, brand lockup, recording state.

## Components

- **Recording button:** filled circle in `#2563EB`, ~92px on phone, white inner shape (rounded square idle).
- **Cards:** white surface, 0.5px border, `border-radius-lg`.
- **Pills:** 11px, padded, rounded. Mood pills use blue (`#EFF6FF` bg, `#1E3A8C` text). Domain pills use neutral surface.
- **Lists:** no bullets. Whitespace and line-height do the work. Section labels above in uppercase tracking.

---

## Product decisions captured here

- **Free tier:** 10 minutes/day (5 morning + 5 evening), capped at 5 minutes per recording. Longer recordings paid.
- **Demo (unauthenticated):** 30 seconds per recording, rate-limited 3 demos per device per 24 hours.
- **Auth:** Apple, Google, email. No "Sign in with Claude/OpenAI" — Anthropic prohibits third-party Claude.ai login.
- **MCP connection:** separate flow after sign-up. Paste URL into Claude's connector settings or ChatGPT's MCP catalog. Works with any MCP client (Cursor, Obsidian, etc.).
- **Recording schema and MCP tools:** see separate technical spec.
- **Onboarding flow:** Hero → Record → Magic moment → Sign in. Connect happens post-onboarding via the home screen's `connect →` affordance.
