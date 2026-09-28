---
name: ui-handoff
description: Design and document a bounded Throughline UI improvement before Codex implementation. Use for UX audits, UI candidates, mockups, design refinement, and TestFlight UI feedback.
---

# Throughline UI Handoff

Read [the root Claude guide](../../../CLAUDE.md) and [tandem workflow](../../../docs/AGENT_TANDEM.md) before acting.

## Procedure

1. Begin with read-only inspection and the canonical read order. Read `throughline-brand-decisions.md` immediately after `docs/PRODUCT.md`.
2. Identify one user problem and declare a design-only write scope. Do not edit production app or backend files.
3. Establish fresh current-flow evidence and label its provenance and gaps.
4. Produce exactly three materially distinct, brand-coherent, inspectable candidates with full state and accessibility coverage.
5. Present the candidates and stop for Mike's selection. This pause is required; polish does not confer selection or implementation authority.
6. After explicit selection, use [the handoff template](../../../docs/templates/UI_DESIGN_HANDOFF.md), record the selection, and freeze the selected target as a content-safe repository artifact.
7. End with the committed handoff path/revision for Codex. Do not implement, distribute, upload, submit, publish, or change approval-bound product behavior.

Use the full [copy-ready prompt](../../../docs/prompts/claude-code-ui-design.md) when the user wants a guided end-to-end design session.

