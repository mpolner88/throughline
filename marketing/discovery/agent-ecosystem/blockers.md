# DISC-01 Blockers

Checked 2026-08-27. These are unresolved dependencies, not implied implementation authorization.

| Blocker | Classification | Owner | Smallest reversible next action | Evidence needed to clear |
| --- | --- | --- | --- | --- |
| Current user authentication is a manually supplied bearer token, not OAuth. Anthropic directory policy and OpenAI public-plugin guidance require OAuth for authenticated remote MCP. | blocked | Mike chooses whether to fund/select a product slice; agents specify it. | Approve a bounded OAuth/read-only connection candidate for design and implementation planning. | OAuth discovery, consent, scopes, callbacks, token audience checks, revocation, and synthetic end-to-end evidence. |
| No approved synthetic test account/token exists for authenticated transport, tool, revocation, or injection-resistance checks. | blocked | Mike for exact account-backed action; agents execute after approval. | Approve one synthetic-only proof run with immediate revocation. | Content-free receipt of initialize, tools/list, one read, unsupported write, and post-revocation rejection. |
| Registry namespace ownership is unverified and no publisher identity is selected. | blocked | Mike for account/identity action. | Choose GitHub or verified-domain namespace path without publishing. | Authenticated namespace proof recorded outside the repository; prepared name matches it. |
| A public icon and a stable, product-oriented registry website page are absent from this package. Existing support/privacy pages are live, but they are not product proof. | blocked | Owned-surface lead, then Mike for design approval. | Provide a public asset URL and an approved discovery page. | HTTP checks plus visual/content review. |
| Current public policy pages do not establish every platform listing/review field, such as terms URL, publisher identity, country availability, and review credentials. | blocked | Root coordinator with Mike for external/account decisions. | Inventory listing fields without creating a submission. | Current platform form review and approved public URLs. |
| The current server logs a token use marker, but a public response-field audit and first-successful-tool-use metric are not verified. Missing telemetry is unavailable, not zero. | blocked | Product/measurement owner; root coordinator. | Specify aggregate-only first-tool-use coverage separately from this discovery package. | Privacy-safe aggregate measurement evidence. |
| The official MCP Registry is preview and can change or reset data. | observed_signal | Root coordinator. | Recheck the official registry sources immediately before any future publication. | Dated official-source refresh and post-publication lookup. |

## Dependency Handoff

**Owned-surface lead:** provide an approved public Throughline discovery page and icon asset, preserving support/privacy links and avoiding an unverified comparative claim.

**Root coordinator:** retain the OAuth/authentication gap as a candidate product decision, schedule the synthetic proof only after Mike's exact approval, and prevent the planned registry package from being represented as published or directory-approved.
