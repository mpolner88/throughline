# Design Handoffs

This directory stores content-safe, reviewable design contracts between Claude Code and Codex. Start from [the UI design handoff template](../templates/UI_DESIGN_HANDOFF.md) and follow [the tandem workflow](../AGENT_TANDEM.md).

Use one file per bounded handoff: `docs/handoffs/<YYYY-MM-DD>-<surface>-<short-name>.md`. Reference mock sources and screenshots under `docs/handoffs/assets/<handoff-id>/` only after verifying they contain no private note, feedback, email, credential, or user/session data.

A handoff is not implementation authority unless it names Mike's selection record and has tandem stage `handoff_ready`. Preserve superseded handoffs as history with an explicit `superseded` stage; do not silently rewrite what Codex implemented.

Raw TestFlight feedback and unredacted screenshots belong only in ignored `.throughline/feedback-intake/`, never here.

