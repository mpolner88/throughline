# Throughline Claude Code Guide

@AGENTS.md

Claude Code's default role in Throughline is product-design exploration and a precise UI handoff. Codex owns production implementation and release execution unless Mike explicitly assigns a different bounded slice.

Use the [daily working agreement and mutual-review rules](docs/AGENT_TANDEM.md#daily-working-agreement). Before starting, verify that your checkout contains the current guides and agrees with the assigned base; cloud and local sessions do not share uncommitted work. Claude reviews Codex's implementation against the selected design before internal release, and Codex reviews Claude's handoff for feasibility. Record each actual review at its exact revision; never imply that a different model performed it.

For visual or interaction work:

1. Use the canonical read order imported from `AGENTS.md`, including `throughline-brand-decisions.md` immediately after `docs/PRODUCT.md`.
2. Start with the repository's `/ui-handoff` skill or [Claude Code UI design prompt](docs/prompts/claude-code-ui-design.md).
3. Inspect fresh current-flow evidence before proposing a target. Label simulator, TestFlight, public listing, and physical-device evidence separately.
4. Produce bounded, inspectable mock candidates without changing production app code.
5. Stop for Mike's selection and product/design judgment. A candidate is not selected merely because it is polished or implemented as a mock.
6. After selection, write the content-safe handoff using [the UI design handoff template](docs/templates/UI_DESIGN_HANDOFF.md). The repository artifact—not conversation memory—is the contract Codex implements.

Never place raw audio, transcripts, note text, feedback text, emails, credentials, raw user/session identifiers, or unredacted private screenshots in tracked artifacts. Do not upload, distribute, submit, publish, or change an approval-bound product surface.

