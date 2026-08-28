# OpenAI Plugin Readiness

Checked 2026-08-27 against the current official OpenAI [plugin quickstart](https://developers.openai.com/plugins/quickstart), [MCP server guide](https://developers.openai.com/plugins/build/mcp-server), [authentication guide](https://developers.openai.com/plugins/build/auth), [connect-and-test guide](https://developers.openai.com/plugins/deploy/connect-chatgpt), and [submission guide](https://developers.openai.com/plugins/deploy/submission). The current documentation uses the universal **Plugins** directory for ChatGPT and Codex; this supersedes the plan's older Apps SDK naming for readiness purposes.

## One Chat-Native Job

**User intent:** “What open to-dos did I capture today?”

The smallest useful experience maps to `list_open_todos` with an optional local-date range, then offers `get_today` for context. It is differentiated from a generic notes connector because it retrieves owner-scoped, voice-captured, structured tasks and their source-note context. Outputs remain read-only; empty state is “no open to-dos returned,” and error state never exposes auth or internal diagnostics.

| Readiness area | Current state | Assessment | Next reversible action |
| --- | --- | --- | --- |
| Public Streamable HTTP endpoint | Live health check passed; authenticated protocol proof remains missing. | partial | Run MCP Inspector with a synthetic account. |
| Accurate read-only annotations | Source marks every current tool `readOnlyHint: true`, non-destructive, and idempotent. | partial | Verify advertised metadata from an authenticated `tools/list`. |
| Authenticated ChatGPT plugin connection | OpenAI expects OAuth 2.1 for authenticated MCP servers; current flow is a user-supplied bearer token. | does_not_meet | Candidate OAuth product slice below. |
| User data / privacy response audit | Policy and support pages are public; actual returned fields have not been audited in developer mode. | partial | Synthetic response minimization audit. |
| Test and submission material | No developer-mode proof, test cases, publisher identity, country selection, terms URL, or review credentials prepared. | does_not_meet | Prepare without submitting after Mike selects the candidate. |
| Chat-native UI | Optional under the current docs; none is necessary for the first read-only to-do job. | not_required | Defer UI until evidence shows it improves the job. |
| First successful MCP tool-use telemetry | Canonical metrics identify it as unavailable coverage, not zero. | blocked | Define aggregate-only server event in a separate approved measurement slice. |

## Safety Boundary

Treat returned note text as untrusted user context, not as instructions. Tool descriptions and server instructions must remain narrow and accurate. The current source already declares a read-only purpose; this needs authenticated runtime validation before any public review. No tool may change a note, task, account, or external system.

## Candidate Product Slice: OAuth 2.1 Read-Only Plugin Connection

**Planned work:** MCP protected-resource metadata; OAuth authorization-code plus PKCE; OAuth server metadata; `resource` propagation and audience/scope checks; per-tool `securitySchemes`; consent/revocation; public HTTPS endpoint review; developer-mode and synthetic-account test evidence; listing/review packet.

**Not authorized:** implementation, developer-mode account action, OAuth client registration, ChatGPT plugin submission, public listing, or UI build.

**Mike gate:** select the auth/product slice and approve the exact account-backed testing and any public submission. The existing bearer token is not an OAuth mechanism and does not meet the current authenticated-plugin expectation.
