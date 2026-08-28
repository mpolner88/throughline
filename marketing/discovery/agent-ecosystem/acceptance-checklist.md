# DISC-01 Acceptance Checklist

Checked 2026-08-27. `Pass` reflects this preparation package only; it does not imply publication, platform approval, OAuth readiness, or a live product change.

| Check | Evidence or method | Status |
| --- | --- | --- |
| Transport is a public HTTPS MCP endpoint with a content-free health response. | `GET /functions/v1/mcp/health` returned HTTP 200. | Pass |
| Unauthenticated private-data access is rejected. | Content-free JSON-RPC `initialize` returned HTTP 401. | Pass |
| Authorization form is accurately named. | `docs/agent-connect.md` documents a bearer header; no artifact calls it OAuth. | Pass |
| Tool inventory and read-only annotations are source-audited. | `supabase/functions/mcp/index.ts`, `supabase/functions/_shared/memory-tools.ts`. | Pass, source only |
| An authenticated `initialize`, `tools/list`, synthetic read, empty result, and unsupported-write rejection are recorded with no retained user content. | Synthetic test account and token are not provided or approved. | Blocked |
| Token revocation is verified end to end. | A live synthetic token-revocation test was not approved. | Blocked |
| Public support and privacy pages are reachable. | Both public URLs returned HTTP 200. | Pass |
| Support, privacy, and manual connection documentation are cross-checked against actual tool responses. | Requires approved synthetic proof and a response-field privacy audit. | Blocked |
| Official MCP, Anthropic, and OpenAI sources were checked within seven days. | Source ledger in `evidence-manifest.md`; all checked 2026-08-27. | Pass |
| Every surface has a reversible next action, approval gate, and verification method. | `platform-readiness.md` and `submission-backlog.md`. | Pass |
| Registry metadata uses the current official schema and has no real credential. | Package prepared with `USER_SUPPLIED_TOKEN` only; schema validation remains an offline future command. | Partial |
| No registry/directory submission, account login, deployment, spend, outreach, or product/auth change occurred. | Workstream boundary and command history. | Pass |
| Package contains no raw audio, transcript, note, feedback, email, token, or raw identifier. | Scoped credential-pattern scan returned no match. | Pass |

## Future Proof Protocol

Use a newly created synthetic account containing synthetic notes only. Keep the generated token in a local secret store, never in shell history, terminal capture, or a tracked artifact. Record only request category, HTTP/JSON-RPC outcome, tool name, and a pass/fail result. Revoke the token immediately after the test and verify a subsequent request is rejected. Mike must explicitly approve both the account-backed proof and any platform submission.
