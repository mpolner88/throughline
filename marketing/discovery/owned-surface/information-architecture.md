# Owned discovery surface information architecture

**Selected:** 2026-08-27 under Mike's "Ship it" approval for the reversible static build.

## Page set

| Page | Intent | Distinct answer | Primary proof |
| --- | --- | --- | --- |
| `/` | Broad personal voice notes and agent-readable context | What Throughline is and how record -> structure -> read-only retrieval works. | Three-step public 1.0.4 screenshot sequence. |
| `/voice-to-task-list/` | Voice to task list | How a spoken plan becomes a reviewable structured note and clear to-dos while typing is impractical. | Structured-note screenshot, with optional agent context after the task result. |

## Main page sequence

1. Header: brand, agent connection, support, privacy.
2. First viewport: Throughline, category, literal outcome, App Store action, and a public 1.0.4 proof image.
3. Mechanics: record, structured note and to-dos, owner-scoped read-only agent retrieval.
4. Workflow: a personal plan captured while walking, driving, or thinking; explicitly not a meeting recorder.
5. Trust boundary: the owner creates and controls the connection; the agent reads saved notes and does not write back.
6. Connection, support, privacy, and a final campaign-attributed App Store action.

## Intent-page sequence

1. Header shared with the main page.
2. First viewport: literal task-list job, structured-note proof, campaign-attributed action.
3. Three-step explanation focused on task output and review.
4. Optional read-only agent context as a differentiated next step, not a native integration claim.
5. Support, privacy, connection guide, home link, and final action.

## Interaction and responsive contract

- Content is ordinary semantic HTML and remains fully usable without JavaScript.
- At 390x844 and 1440x900, the first viewport shows the product, category, outcome, proof, action, and the start of the next mechanics section.
- Product images retain their source aspect ratio in stable frames. Sections are full-width bands, not floating cards.
- Visible keyboard focus, legible text, responsive column collapse, and `prefers-reduced-motion` support are required.
