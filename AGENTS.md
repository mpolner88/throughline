# Throughline Repository Guide

## Required Read Order

Before proposing, planning, or changing an active slice, read these sources in order:

1. `docs/CURRENT_STATE.md`
2. `docs/PRODUCT.md`
3. The relevant program or slice brief
4. `docs/WORKFLOW.md`
5. `product/metrics.md`
6. `product/backlog.json`
7. The relevant component runbooks

For visual or interaction work, read `throughline-brand-decisions.md` immediately after `docs/PRODUCT.md`. It governs the design language but does not replace the relevant program or slice brief.

Current-state facts must include a verification date and an evidence link. Historical documents, superseded specifications, and prior reports provide context only; they cannot override a canonical source. Inspect a dirty checkout before staging, and stage only files within the approved slice.

## Canonical Sources

| Need | Canonical source | Notes |
| --- | --- | --- |
| Verified runtime, release, and operational facts | `docs/CURRENT_STATE.md` | Every live fact needs a verification date and evidence link. |
| Durable product intent and non-goals | `docs/PRODUCT.md` | Does not establish live runtime facts or metrics. |
| Visual identity, interaction character, and design-review rules | `throughline-brand-decisions.md` | Guides proposals; it does not select a new visual target or prove what is live. |
| Claude Code to Codex design, implementation, feedback, and release handoff | `docs/AGENT_TANDEM.md` | Defines interoperability and gates; it does not replace product, brand, backlog, metrics, current-state, or release evidence. |
| Slice process and decision path | `docs/WORKFLOW.md` | Defines lifecycle, authority classes, and required slice records. |
| Active program and slice scope | Relevant program or slice brief | Bounded work must link to its program when one exists. |
| Metrics definitions and interpretation | `product/metrics.md` | This is the only metrics-definition source. |
| Prioritized work | `product/backlog.json` | This is the only backlog source. |
| Decisions | `decision-log.md` | Append-only record of decided context. |
| Architecture and operations | `docs/ARCHITECTURE.md` and component runbooks | Runbooks describe operation; they do not replace current-state or product sources. |
| Specifications and historical documents | `docs/superpowers/specs/` and legacy documents | Context or history only unless explicitly named as an active slice brief. |

## Authority Matrix

The operating responsibilities are:

- Mike decides what enters build, reviews product/design taste and judgment, and sets priority.
- Agents own baseline inspection, options, specifications, plans, implementation, verification, routine reversible rollout, measurement, and documentation.
- The user who recorded a note is the only human evaluator; there is no Mike, employee, contractor, or external-review queue.

| Decision or work | Owner |
| --- | --- |
| What enters build | Mike |
| Product/design taste and judgment | Mike |
| Priority | Mike |
| Baseline inspection, options, specifications, plans, implementation, verification, routine reversible rollout, measurement, and documentation | Agents |
| Evaluation of a recorded note | The user who recorded the note; there is no Mike, employee, contractor, or external-review queue |

Routine reversible work inside an approved slice does not need another approval. Provider, base-model, data-use policy, pricing, recording-limit, onboarding, and App Store submission changes require Mike's explicit approval.

Keep raw audio, transcripts, note text, feedback text, emails, credentials, and raw user or session identifiers out of tracked reports, analytics, fixtures, and release manifests.

## Multi-Agent Orchestration

Use [`.agents/skills/coordinate-multi-agent-work/SKILL.md`](.agents/skills/coordinate-multi-agent-work/SKILL.md) when a task contains at least two substantive, independent workstreams or Mike explicitly asks for subagents, delegation, or parallel agent work. Do not delegate a trivial task or split work whose ownership cannot be made unambiguous.

The root coordinator remains the primary user contact and integration owner. In the shared checkout, scouts are read-only by default and every writing agent receives exclusive ownership of named files or directories. Each assignment must repeat the relevant canonical read order, privacy rules, authority limits, and verification requirements; delegation never enlarges the approved slice or an agent's authority.
