# Higgsfield MCP setup

Higgsfield is the preferred first external creative MCP to try for Throughline asset generation.

## Why this provider

It is purpose-built for agentic image and video generation and can route across multiple models from one connection. For Throughline, this is useful for:

- 9:16 atmospheric clips for X/Twitter, TikTok, Reels, and Shorts.
- Cinematic walking/thinking clips.
- Fast image variants.
- Testing Kling, Veo, Minimax/Hailuo, Seedream, Wan, and other models without building each adapter first.

## Codex setup

Add the MCP server:

```bash
codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp
```

If auth did not complete during add, run:

```bash
codex mcp login higgsfield
```

Verify:

```bash
codex mcp list
```

Expected state:

- `higgsfield` exists as a global MCP server.
- Auth completes through browser OAuth.
- A new session exposes Higgsfield tools, if Codex supports that remote MCP tool set in the current environment.

## Current local status

As of 2026-05-29:

- `higgsfield` has been added to the global Codex MCP list.
- `codex mcp list` shows `https://mcp.higgsfield.ai/mcp` as enabled.
- `codex mcp login higgsfield` completed successfully after browser OAuth.
- This already-running Codex session still does not expose Higgsfield generation tools through tool discovery.
- Next verification step: start a fresh Codex session and search for Higgsfield tools before attempting generation.

## Usage policy

Do not use Higgsfield to publish directly.

Use it to generate candidates, then save outputs under `marketing/assets/YYYY-MM-DD-experiment-id/`.

Every generation should have:

- Experiment ID.
- Channel.
- Format.
- Prompt.
- Negative prompt.
- Provider/model.
- Cost/credit note if available.
- Selection notes.

## First prompt families

### Atmospheric walk

Purpose: hook asset for "fastest way to get your voice to an AI agent."

Prompt:

> Vertical 9:16 cinematic phone-shot style video, early morning city walk, a founder holding an iPhone and speaking a short voice note while walking, restrained realistic lighting, quiet software mood, minimal electric blue accent in the phone UI glow, no visible app UI details, natural movement, not an advertisement, documentary feel.

Negative prompt:

> no fake app screens, no exaggerated sci-fi, no robots, no glowing brain, no corporate stock footage, no text, no logos, no testimonials.

### Desk handoff

Purpose: visual bridge from walk to agent.

Prompt:

> Vertical 9:16 realistic video, same person returns to a desk, opens a laptop with an AI chat interface visible but unreadable, mood is focused and calm, the visual story is voice note captured earlier becoming useful work context now, quiet minimal workspace, subtle electric blue accent, documentary product demo feel.

Negative prompt:

> no readable fake brand names, no fake claims, no robots, no busy dashboards, no sci-fi holograms, no generic startup office.

### Abstract but useful

Purpose: social card or landing hero background.

Prompt:

> Minimal editorial image, white background, one thin electric blue line travels from an iPhone voice waveform into a clean chat window shape, restrained Swiss design, lots of negative space, no text, no icons beyond phone, waveform, and chat outline.

Negative prompt:

> no purple gradients, no AI brain, no robot, no 3D mascot, no clutter, no fake UI text.
