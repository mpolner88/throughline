# Part 3: home agent entry

**Status:** Candidate; evidence and design approval pending  
**Backlog:** `TL-AGENT-001`  
**Verified:** 2026-08-25; [feedback intake](../../evidence/2026-08-25-home-feedback-specification-intake.md), `HomeView.topBar`, `AccountSettingsView`, and `AgentConnectionView`

## User problem

The current gear is a conventional Settings destination, but it does not make Throughline's voice-to-agent promise obvious from Home. Replacing it would hide account deletion, privacy, feedback, and token-revocation controls.

## Outcome

Keep Settings dependable and add a separate, contextual path that makes agent connection actionable at the moment a user has something useful for an agent to read.

## Interaction contract

- Keep the top-right gear, retain the accessibility label **Settings**, and give it an explicit minimum 44 by 44 point target and content shape.
- Do not overload the gear with agent state or replace its destination.
- After the user has at least one successfully processed non-demo note, show one quiet text action on Home: **Connect your agent →**. This implements the existing brand decision that connection is a post-onboarding Home affordance.
- Place the action beside or immediately beneath the first task/note value area; it must not displace the recorder, date, or first useful task.
- Route the action to the existing `AgentConnectionView`.
- Make the copy state-aware:
  - no active token: **Connect your agent →**;
  - active token: **Agent connected · Manage access →**;
  - revoked or failed token: **Reconnect your agent →**.
- `Manage access` opens the same destination where the user can inspect and revoke access. Revocation remains explicit and discoverable.
- The action may be dismissed for the current app session, but a permanent hide requires a separately specified preference.

## Trust and scope contract

- This part promotes only the existing read-only agent connection. It adds no write scope or new MCP tool.
- Never put a token, command, user identifier, note content, or connection secret in the Home view's accessibility text or analytics.
- Copy says what the agent can currently do. It does not imply a successful tool call merely because a token exists.
- Keep Settings as the home for account, privacy, feedback, debug, and access revocation controls.

## Metric and guardrails

The primary metric is a signed-in user who completes a first MCP tool call. `agent_connection_opened` and `agent_token_created` are supporting steps; first server-side tool use remains a known measurement gap.

Track `agent_connection_opened` with only a bounded `surface = home` or `surface = settings` after the event contract is updated. Guardrails are token revocation rate, unauthorized-action reports, connection-open-to-token-create abandonment, and first-tool-use coverage. A token-create event alone is not adoption.

## Accessibility and visual behavior

- Use a labeled text action, not an unexplained terminal or robot icon.
- VoiceOver announces connection state and the resulting action.
- The action follows sentence case, medium weight, electric-blue link treatment, and the existing arrow convention. It introduces no new card style or color.
- Dynamic Type may wrap the label; the interaction target remains at least 44 points high.

## Acceptance criteria

- UI tests cover no-note, processing, first-processed-note, disconnected, connected, revoked, offline, dismissed-for-session, and signed-out states.
- The gear always opens Settings and has a 44-point target.
- The Home action always opens the existing agent connection flow and never exposes token material.
- Analytics tests prove only the bounded surface and state category are emitted.
- The UI distinguishes token creation from confirmed first tool use.

## Non-goals, authority, and rollback

This part does not add browser OAuth, agent write permissions, new MCP tools, onboarding changes, or a new token policy. Mike approves the Home placement and copy; any agent write capability requires a separate explicit approval.

Rollback hides the contextual Home action and preserves Settings plus existing tokens and revocation. The release manifest records source commit, selected placement/copy, event-contract version, internal build, agent-scope statement, and rollback commit without tokens, content, or identifiers.

