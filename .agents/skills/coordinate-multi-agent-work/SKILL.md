---
name: coordinate-multi-agent-work
description: Coordinate bounded multi-agent work with matched reasoning effort, deliberate context inheritance, non-overlapping ownership, direct agent communication, and coordinator-led integration. Use when a Throughline task has at least two substantive independent workstreams, when parallel read-only investigation would reduce latency, or when Mike explicitly asks for subagents, delegation, or parallel agent work.
---

# Coordinate Multi-Agent Work

Use multiple agents only when independent work can proceed concurrently without obscuring ownership. Keep the coordinator available to Mike, responsible for decisions, integration, verification, and the final account of the work.

## Decide Whether to Delegate

Delegate when at least two workstreams are substantive, independently verifiable, and unlikely to edit the same files. Work locally when the task is small, tightly sequential, or cheaper to complete than to explain and integrate.

Do not use delegation to bypass missing approval, broaden a slice, or manufacture consensus. If ownership cannot be made exclusive, keep one writer and use read-only scouts.

## Match the Role to the Work

- **Scout — low reasoning:** Answer a narrow, read-only question such as locating files, tracing a code path, checking a canonical source, or identifying relevant tests. Use fresh context by default.
- **Worker — medium reasoning:** Implement a routine, scoped change or run bounded verification. Give exclusive ownership of named files or directories.
- **Smart worker — high reasoning:** Resolve a difficult implementation problem or material ambiguity. Allow it to coordinate help only when the assignment explicitly grants that authority and capacity permits. Require every agent with delegation authority to apply the complete assignment-packaging rules below to each child prompt.

Prefer the coordinator's model family and vary reasoning effort. Override the model only when the user or repository instructions require it.

## Package Each Assignment

State all of the following in every assignment:

1. The bounded objective and expected deliverable.
2. Whether the agent is read-only or the exact files it owns.
3. The canonical sources it must read, including the repository read order when product or runtime facts are involved.
4. Privacy, safety, authority, and approval constraints that must survive fresh context.
5. The verification command or evidence expected.
6. Who should receive dependency findings.
7. Whether the agent is a leaf.

For a leaf agent, include this boundary:

> Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

Use `fork_turns: "none"` for focused scouts and self-contained workers. Inherit a small, bounded number of turns only when earlier user decisions are essential. Do not use full inherited history merely for convenience; fresh-context agents need every task-specific restriction repeated explicitly.

## Coordinate the Team

1. Inspect the checkout and current ownership before spawning agents.
2. Build an assignment map with no overlapping investigations or write surfaces.
3. Launch independent scouts in parallel at low reasoning. Launch routine workers at medium reasoning and difficult workers at high reasoning.
4. Continue coordinator-only work while agents run: user updates, integration design, shared-state checks, and decisions that span assignments.
5. Tell agents to message the teammate who directly needs a dependency finding; do not force every discovery through the coordinator.
6. Review each result against its assignment and the canonical sources. Do not accept a worker's completion claim as verification.
7. Inspect the combined shared checkout, run integration-level checks, and report one coherent outcome.

Concurrency includes the coordinator. Stay within the thread's configured limit and reserve capacity for a follow-up or recovery task when the work is risky.

## Protect the Shared Checkout

- Treat every agent's edits as immediately visible.
- Assign one writer per file. Prefer directory ownership when boundaries are stable.
- Keep discovery agents read-only unless their ownership is later changed explicitly.
- Recheck `git status` before edits, before staging, and after integration.
- Preserve unrelated dirty changes and stage only the approved slice.
- Stop and reassign work if a file boundary becomes ambiguous or another agent is already editing it.
- Never let one worker clean up, revert, or overwrite another worker's changes.

## Preserve Throughline Authority and Privacy

Delegated agents inherit less context, not less responsibility. Repeat that provider, base-model, data-use policy, pricing, recording-limit, onboarding, and App Store submission changes require Mike's explicit approval. Keep raw audio, transcripts, note text, feedback text, emails, credentials, and raw user or session identifiers out of tracked artifacts.

The coordinator owns approval checks, product/design judgment handoff, final verification, and the user-facing synthesis. Workers may identify a required approval; they may not infer or grant it.
