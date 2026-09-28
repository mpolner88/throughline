# Throughline product charter

Throughline gives an individual a safe way to capture a thought when stopping to type would be distracting or impractical—especially while driving to work. It is for speaking while driving, walking, or thinking, then returning to something that remains useful.

## Promise

**voice → structured notes and to-dos → readable AI agent**

Throughline turns spoken thoughts into durable, structured knowledge: personal notes and tasks that can be read and used by the individual's AI agent. The intended knowledge experience is Obsidian-like in its durability, ownership, and usefulness over time—not a disposable transcript feed.

## Who it serves

Throughline serves an individual who thinks out loud and wants those thoughts to become reliable personal knowledge and next actions. Capture begins on the phone; the resulting notes remain understandable to the person and available to their chosen AI agent.

## Core loop

1. The individual records a thought.
2. Throughline transcribes and extracts a structured note and to-dos.
3. The individual can review and correct the result.
4. The corrected, durable knowledge is available for the individual's AI agent to read.
5. Learning uses review signals to improve the system while protecting the individual's trust.

## Product direction

The durable vision is a private voice knowledge layer: speaking is the lightest input, structured notes and to-dos are the durable record, and the individual's chosen agent can read that record with clear provenance and owner control.

The outcome ladder is:

1. **Capture without loss:** a spoken thought remains recoverable until durable save is confirmed.
2. **Trust the structure:** notes and to-dos preserve meaning, expose their source, and can be corrected.
3. **Return and reuse:** older knowledge can be found, understood, and acted on after the day it was captured.
4. **Let an agent read:** the individual's chosen agent can retrieve owner-controlled structured context.
5. **Permit scoped action:** write-back or task mutation is a future hypothesis, not a shipped promise; it requires explicit scopes, auditability, and a separately selected product direction.

## Differentiation

- Capture is designed to be lighter than typing when stopping is distracting or impractical.
- The output is structured knowledge with source traceability, not a disposable transcript or unexplained AI summary.
- The record is durable and portable enough to remain useful beyond one screen or one agent.
- Agent access is owner-controlled and readable today; broader agent action remains permissioned future work.

## What Throughline is not

- A meeting recorder or team-transcription product.
- A generic audio archive.
- A replacement for the individual's existing tools or their AI agent.

## Product principles

- **Speed:** capture a thought before it disappears, with minimal ceremony.
- **Trustworthy structure:** preserve the meaning of what was said in readable notes and clear to-dos.
- **Traceability:** make it possible to understand how durable knowledge relates back to the original capture and its review.
- **Portability:** keep the individual's knowledge useful beyond any one interface or agent.
- **Quiet disclosure:** be clear, restrained, and respectful about what the product does and how it handles the individual's information.

## Brand authority

Visual identity, interaction voice, and copy direction are governed by [throughline-brand-decisions.md](../throughline-brand-decisions.md).

## Historical boundaries

Historical specifications and tool-specific workflow documents provide context only; they cannot override this charter, verified current state, architecture, active program briefs, workflow, metrics, or backlog.

`docs/product-learning-loop.md` remains a noncanonical historical document with an explicit banner. Release provenance is preserved separately; current workflow, metrics, and backlog truth live only in their canonical files.
