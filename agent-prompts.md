# Agent Prompts

Reusable prompts for the Throughline product workflow.

---

## Claude Code kickoff

Read these files before making product, design, or implementation recommendations:

- `throughline-brand-decisions.md`
- `throughline-product-spec-v0.md`
- `agentic-product-workflow.md` (especially section 7, operating rules)
- `decision-log.md`

Follow the operating rules in section 7. Default behaviors:

- **Diffs over full files** for small changes. Output the smallest unit that captures the change.
- **Lock and move** — when I say "lock," draft the decision-log entry inline and continue. No lock-check ceremonies.
- **File writes happen at breakpoints**, not per-lock. Mid-session locks live in chat until I say "update files" or the session ends.
- **Announce every doc change inline.** Don't silently mutate files.
- **Append-only** in the decision log. Mark superseded entries; don't overwrite.
- **Open questions live in the relevant spec**, not the decision log.

When we're exploring, help me iterate on UI, product direction, and tradeoffs. Don't add decision-log entries during exploration.

When I say "write the spec," create or update the relevant spec file with acceptance criteria, open questions, non-goals, and decisions needing approval.

If you're unsure whether something is durable enough to log, ask. Don't treat chat as the source of truth.

---

## llm-council review

Critically review the attached spec.

Return:

- Strongest argument for the spec
- Strongest argument against the spec
- Product risks
- Missing user decisions
- Confusing or contradictory requirements
- Suggested cuts
- Suggested experiments
- Decisions the human must make before implementation

Be skeptical. Do not rewrite the spec unless asked.

---

## Codex technical skepticism review

Read:

- `throughline-brand-decisions.md`
- `throughline-product-spec-v0.md`
- `agentic-product-workflow.md`
- `decision-log.md`
- Any council review files

Review the spec from first principles. Assume the product direction may be good but the implementation plan may be wrong.

Push hard on:

- Whether the core loop can actually work
- Hidden platform constraints
- Authentication and security risks
- Data model risks
- Cost and scaling assumptions
- Operational failure modes
- Testability
- Simplifying cuts
- Architecture decisions that should be locked before coding

Output concrete findings and recommended changes. Do not simply validate the spec.

---

## Decision extractor

Review the recent conversation, council feedback, and spec changes.

Extract only durable decisions that should be recorded.

For each decision, write:

```markdown
## YYYY-MM-DD — Decision title

**Decision:** What was chosen.
**Context:** Why this came up.
**Alternatives considered:** What else was plausible.
**Reasoning:** Why this choice won.
**Revisit when:** The trigger that should reopen the decision.
```

If something is merely an idea, option, or unresolved preference, put it under "Open questions" instead of recording it as a decision.
