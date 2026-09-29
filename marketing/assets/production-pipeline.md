# Asset production pipeline

This pipeline prepares Throughline visuals, images, and videos without publishing them.

## Production principle

Use real product proof for the main story. Use generative media to add speed, variation, and atmosphere.

The highest-performing asset should usually show this loop:

1. iPhone voice note.
2. Throughline captures to-dos, summaries, and memories.
3. MCP connection.
4. Agent reads the note.

## Asset classes

### Product proof

Best for: launch demo, App Store-adjacent posts, X/Twitter, Hacker News, Reddit.

Sources:

- Real iOS simulator or device capture.
- App Store screenshots.
- Agent chat screenshot.
- Light compositing in HTML, Remotion, or design tooling.

Rule: never fake the product if a real capture can make the point.

### Explainers

Best for: MCP audiences, Hacker News, Reddit technical threads, landing page.

Sources:

- Diagrams.
- Screenshot triptychs.
- Short captioned videos.
- Motion graphics generated locally.

Rule: explain the handoff, not the whole backend.

### Atmospheric clips

Best for: short-form social, top-of-funnel hooks, founder narrative.

Sources:

- Higgsfield MCP or another video model.
- Phone-shot footage.
- Stock-like clips only when they feel specific to the workflow.

Rule: atmosphere supports the proof. It does not replace it.

### Brand stills

Best for: launch posts, headers, social cards, thumbnails.

Sources:

- Brand assets in `assets/brand/`.
- Gemini/Nano Banana, Firefly, Higgsfield image models, or local composition.

Rule: keep the underlined wordmark scarce and clean.

## Default production path

1. Write an asset brief.
2. Decide whether the asset needs real product capture, generated media, or both.
3. Choose provider from `provider-matrix.md`.
4. Generate 3-6 candidates.
5. Save outputs under a dated asset folder.
6. Review for product truth, tone, and channel fit.
7. Attach selected asset to an experiment.
8. After posting, feed performance notes back into the next brief.

## Folder convention

Use:

```text
marketing/assets/YYYY-MM-DD-experiment-id/
  brief.md
  prompts.md
  source/
  candidates/
  selected/
  notes.md
```

## Pre-generation checklist

- Experiment ID exists.
- Channel and format are known.
- Claim being supported is explicit.
- Success metric is explicit.
- Provider is chosen.
- Credit/cost risk is acceptable.
- Human approved paid generation if needed.

## Post-generation review

Ask:

- Does it make the voice-to-agent loop clearer?
- Does it look like Throughline, not generic AI content?
- Is any product UI fake or misleading?
- Is any person implied to be a real user?
- Does it work without sound?
- Does it fit 9:16, 1:1, or 16:9 as intended?
- What should the next prompt change?

