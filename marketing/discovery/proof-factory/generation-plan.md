# DISC-03 generation plan

**Status:** `planned`; zero provider calls, zero credit spend, and zero generated assets in this package.
**Provider status:** Higgsfield authentication is `verified_current` through a read-only account-status call. One 15-second Marketing Studio video is estimated at 75 credits with default 720p/audio settings. Generation quality, rights review, data-use posture, and output suitability remain `unproved`; no generation was submitted.

## Support-only jobs

Generated visuals may provide atmosphere or a simple transition. They cannot show a phone screen, chat screen, terminal, product UI, proof result, person presented as a customer, testimonial, or an actual use event.

| Asset ID | Purpose | Immutable prompt version | Format / candidates | Prohibited elements | Cost cap | Disclosure / select owner |
| --- | --- | --- | --- | --- | --- | --- |
| `20260827-proof-agent-builders-voice-agent-01-support-walk-v1` | Optional 0-3 second tension transition. | `v1`: "Vertical documentary-style scene of an unidentifiable person walking toward a quiet desk, phone kept face-down or screen fully unreadable, natural daylight, restrained monochrome palette with one small electric-blue accent, no text, no logos, no visible application interface. The scene suggests a thought captured before returning to work." | 9:16; 3 candidates maximum. | No app UI, chat UI, readable screen, identifiable person, brand, testimonial, futuristic imagery, copied creator aesthetic, or voice clone. | $0 until Mike approves a provider and price; then a hard cap of the current documented per-job price for 3 candidates, recorded before submission. | Label `Contextual visual, generated` in the export and passport. Mike selects; proof-factory lead accepts after inspection. |
| `20260827-proof-agent-builders-voice-agent-01-support-thread-v1` | Optional 1-second non-UI transition between note and agent-read proof. | `v1`: "Minimal flat editorial motion: one thin electric-blue line travels from an abstract microphone shape to an abstract note shape to an abstract chat outline, white background, precise geometry, no text, no product interface, no logo, no gradients." | 9:16 and 16:9; 3 candidates maximum. Prefer local motion graphic before provider use. | No UI controls, screenshots, product behavior, person, brand claim, or readable text. | $0 for local composition; provider alternative remains unapproved. | Label `Diagram, not product UI`; proof-factory lead accepts after inspection. |

## Provider gate

Before any Higgsfield, Gemini, Firefly, Runway, Veo, Kling, or other provider request, the operator must record all items below in a dated untracked execution record and obtain Mike's explicit approval for the concrete purchase/use:

1. Provider account access actually works for the intended model and feature.
2. Current price, credit use, candidate count, and hard cost cap are known.
3. Current commercial-use rights, attribution, watermark, provenance, and output-retention terms are reviewed from the provider's official source.
4. Training/data-use posture and input/output handling are reviewed; no personal, private, or product-secret material is supplied.
5. The selected prompt version, negative prompt, seed or continuity inputs (if any), model, and provider are frozen before generation.
6. Each candidate receives an asset passport before it can be reviewed or exported.

## Asset passport schema

`asset_id`, `experiment_id`, `purpose`, `generated_or_source`, `provider`, `model`, `prompt_version`, `negative_prompt_version`, `submitted_at`, `cost_or_credit`, `rights_url`, `training_data_use_url`, `watermark_or_provenance`, `disclosure_text`, `input_material_classification`, `candidate_location`, `reviewer`, `accepted_select`, `rejection_reason`, `export_locations`.

No prompt or passport may contain credentials, tokens, private text, actual customer material, an actual device capture, or an identifiable person's likeness without separately documented rights and approval.
