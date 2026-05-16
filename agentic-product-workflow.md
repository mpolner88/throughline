# Agentic Product Workflow

This is the operating loop for turning product taste, model critique, and engineering skepticism into buildable specs.

The goal is not to remove human judgment. The goal is to make judgment visible, repeatable, and easier to delegate over time.

---

## 1. Current manual loop

1. Explore product and UI direction with Claude Code.
2. When the direction feels right, ask Claude Code to write a durable spec.
3. Send the spec to llm-council for critical review.
4. Convert council feedback into explicit product decisions.
5. Send the revised spec to Codex for skeptical technical review.
6. Build with Claude Code or Codex.
7. Review the result against the spec and update the decision log.

---

## 2. Target automated loop

Each phase produces an artifact that the next phase can inspect.

| Phase | Primary actor | Output artifact | Human decision required |
|---|---|---|---|
| Product exploration | Claude Code + human | Draft UI, product notes, open questions | Taste and direction |
| Spec writing | Claude Code | `*-spec.md` | Approve spec as reviewable |
| Product critique | llm-council | `*-council-review.md` | Accept, reject, or defer recommendations |
| Decision capture | human, later agent-assisted | `decision-log.md` | Product calls |
| Technical skepticism | Codex | `*-technical-review.md` | Approve architecture or require revision |
| Build planning | Claude Code or Codex | `implementation-plan.md` | Choose builder and scope |
| Implementation | Claude Code or Codex | Code, tests, changed files | Merge or iterate |
| Post-build review | Codex + human | `post-build-review.md` | Ship, fix, or cut scope |

---

## 3. Required artifacts

### Product spec

The spec must include:

- Problem statement
- Target user
- Non-goals
- End-to-end user flow
- Data model or state model
- External dependencies
- Pricing or limits, if relevant
- Open questions
- Explicit acceptance criteria

### Council review

The council review must include:

- Strongest argument for the spec
- Strongest argument against the spec
- Product risks
- Missing user decisions
- Confusing or contradictory requirements
- Suggested cuts
- Suggested experiments

### Decision log

Every material decision should be captured as:

```markdown
## YYYY-MM-DD — Decision title

**Decision:** What was chosen.
**Context:** Why this came up.
**Alternatives considered:** What else was plausible.
**Reasoning:** Why this choice won.
**Revisit when:** The trigger that should reopen the decision.
```

### Technical review

Codex should review from first principles and assume the spec may be wrong.

The review must cover:

- Whether the core loop can actually work
- Hidden platform constraints
- Authentication and security risks
- Data model risks
- Cost and scaling assumptions
- Operational failure modes
- Testability
- Simplifying cuts
- Architecture decisions that should be locked before coding

### Implementation plan

The implementation plan must include:

- Build sequence
- First risky spike
- File/module ownership
- Acceptance tests
- What not to build yet
- Rollback or failure plan

---

## 4. Codex review stance

Codex's role is not to validate the spec. Codex's role is to try to break it before implementation does.

Default assumptions:

- The happy path is overrepresented.
- Platform constraints are under-specified.
- Auth, billing, and background work are harder than the spec implies.
- LLM extraction quality will regress unless measured.
- Every external API has limits, latency, failures, and policy constraints.
- A beautiful product direction can still produce an unbuildable v0.

Codex should be direct, skeptical, and concrete. Findings should name the exact decision that needs to change or the exact experiment that would de-risk it.

---

## 5. Automation path

### Stage 1: Manual artifacts

Keep the current human-driven flow, but require artifacts at every step. This makes the process inspectable.

Minimum files:

- `throughline-brand-decisions.md`
- `throughline-product-spec-v0.md`
- `decision-log.md`
- `council-review.md`
- `technical-review.md`
- `implementation-plan.md`

### Stage 2: Prompted agents

Create reusable prompts for each role:

- Spec writer
- Product council
- Decision extractor
- Technical skeptic
- Implementation planner
- Post-build reviewer

Each prompt consumes the previous artifact and emits the next artifact.

### Stage 3: Repo workflow

Add a script or command runner that executes the loop:

```text
spec → council → decision extraction → technical review → implementation plan
```

The script should never auto-approve decisions. It should create reviewable diffs.

### Stage 4: Judgment memory

Codify repeated human choices into a preferences file.

Example:

```markdown
# Judgment profile

- Prefer narrower v0s with one excellent loop over broad feature coverage.
- Treat background recording reliability as a launch blocker.
- Avoid building integrations when an agent/MCP surface can carry the job.
- Prefer native mobile when platform primitives are central to the product.
- Pricing must be legible and tied to usage limits.
```

This should evolve from observed decisions, not guesses.

### Stage 5: Semi-autonomous product ops

Agents can begin making provisional recommendations:

- "This decision matches prior judgment."
- "This decision conflicts with prior judgment."
- "This spec is missing acceptance criteria."
- "This should not enter build yet."

Human remains the final authority until the decision class is low-risk and well codified.

---

## 6. Throughline-specific first checks

Before implementation begins, the workflow should force these reviews:

1. Prove 30-minute locked-phone recording works on iOS.
2. Prove AirPods stop recording through system media events.
3. Prove the MCP auth model is acceptable for Claude, ChatGPT, and generic clients.
4. Prove demo rate limiting is possible without invasive tracking.
5. Prove extraction quality with real messy speech samples.
6. Prove free-tier transcription behavior when Apple Speech is unavailable or fails.

Nothing else matters until these risks are reduced.

---

## 7. Operating rules

These rules govern how agents and humans interact with the artifacts above. They exist because the cost of process drift compounds — sloppy logs, silent file edits, and lost decisions become unrecoverable across sessions.

### Updates are announced

When an agent modifies a spec, decision log, or other canonical doc, the change is announced inline in the chat reply that produced it. Silent mutation is not allowed.

### Decisions are logged when locked, not when proposed

A decision enters `decision-log.md` only after the human has explicitly locked it ("lock", "locked", "decided", or equivalent). Iteration before lock does not produce a log entry.

The log entry is drafted inline in chat at the moment of lock. Actual file writes happen at session breakpoints — end of session, transition to a new phase, or when the human says "update files." Don't regenerate the file per individual lock.

### Decisions are append-only

When a previously-locked decision is revisited and changed, the old entry is marked superseded; a new entry is appended below it. The old entry stays. Both entries reference each other.

Header pattern: `## YYYY-MM-DD — Old title [SUPERSEDED by YYYY-MM-DD entry below]`

### Open questions live in the spec, not the log

Unresolved items go in the relevant spec file's "Open questions" section. The decision log is for things that have been decided.

### Default to diffs over full files

For small changes (one new decision entry, one new section, copy edits), output the change as a markdown block the human can paste into Claude Code with a one-line instruction. Full file regeneration is for initial creation or substantial restructures only. The default delivery is the smallest unit that captures the change.

### Lock and move

When the human says "lock X," draft the decision log entry inline in the reply and continue. Don't end iterations with a formal lock-check ceremony ("ready to lock 1, 2, 3?"). The human signals locks; the agent records them. Lock summary on request only.

### Keep this file small

This document should stay around two pages. If it grows beyond that, split into focused docs.
