# Creative provider matrix

This matrix is for choosing how to create Throughline marketing assets.

Provider status changes quickly. Re-check docs before building an automated integration.

## Recommended stack

| Use case | Preferred path | Why |
|---|---|---|
| Core demo video | Real app capture + local edit | Highest trust and least hallucination risk |
| Screenshot triptych | Real screenshots + HTML/Remotion composition | Precise and brand-controlled |
| MCP explainer | Local diagram or Remotion | Clearer than generative video |
| Atmospheric walking/thinking clip | Higgsfield MCP | Fast model routing for short video variants |
| Social thumbnail or card | Gemini/Nano Banana or Firefly | Strong image generation and edit workflows |
| Brand-safe polished imagery | Firefly | Commercial creative workflow and custom model support |
| Cinematic 9:16 variants | Higgsfield routing to Kling/Veo/Minimax/Seedance/Wan | One interface for many video models |
| Direct API video pipeline | Google Veo on Vertex AI or Kling API | Scriptable, measurable, less dependent on chat UI |

## Provider notes

### Higgsfield MCP

Best for:

- Rapid image and video generation from an agent.
- Testing multiple video models from one interface.
- Short social clips.
- Character/style continuity experiments.
- Asset-history-based iteration.

Current notes:

- Higgsfield documents MCP support for image generation, video creation, character training, and asset management.
- Their MCP page says it exposes models including Soul, Cinema Studio, Flux, Seedream, Kling, Minimax Hailuo, Veo, and more.
- It uses account OAuth rather than local API keys.
- Treat it as the preferred creative MCP path if auth works cleanly in Codex.

Setup doc:

- [higgsfield-mcp.md](higgsfield-mcp.md)

### Google Gemini image generation

Best for:

- Static social images.
- Product-style mockups.
- Text-heavy image generation where instruction following matters.
- Iterative image editing with text + image inputs.

Current notes:

- Google's Gemini API docs describe Nano Banana image generation as native image generation inside Gemini.
- Models include `gemini-3.1-flash-image`, `gemini-3-pro-image`, and `gemini-2.5-flash-image`.
- Generated images include SynthID watermarking.
- Gemini image generation is a good candidate for an API adapter.

### Google Veo / Vertex AI

Best for:

- Scriptable text-to-video and image-to-video.
- 9:16 and 16:9 proof-of-concept video variants.
- A production API if we want repeatable runs and asset tracking.

Current notes:

- Google's Vertex AI docs describe Veo video generation from text or image prompts.
- Veo requests are long-running operations that you submit and poll.
- It supports parameters such as aspect ratio, duration, negative prompt, sample count, seed, and resolution depending on model.
- This is more setup-heavy than Higgsfield MCP but better for repeatable automation.

### Adobe Firefly API

Best for:

- Commercially conservative visual work.
- Brand-aligned image variations.
- Product composites.
- Upscaling and image editing.

Current notes:

- Adobe documents Firefly APIs for creative workflows.
- Firefly Custom Models can train subject or style models and generate brand-aligned images.
- Composite APIs can blend product shots and objects into generated scenes.
- Good for polished static assets once the visual direction is locked.

### Kling API

Best for:

- Direct API video generation.
- Text-to-video and image-to-video variants.
- Short 5-10 second social clips.

Current notes:

- Kling API docs list text-to-video, image-to-video, extend, and lip-sync endpoints.
- The public docs describe async processing with task IDs and polling.
- Treat direct Kling as a provider adapter option; Higgsfield may be easier first if it routes to Kling already.

## Build stance

Do not wire every provider at once.

Start with:

1. Real app capture and local composition.
2. Higgsfield MCP for fast generated video/image exploration.
3. One API-backed image provider if needed.
4. One API-backed video provider only after we know which content format works.
