# Anthropic Connector Readiness

Checked 2026-08-27 against Anthropic's [custom remote MCP connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) and [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy).

## Boundary

**Manual custom connection:** Anthropic documents adding a remote MCP URL as a custom connector. This is a user or organization configuration path, not a directory listing and not an Anthropic approval.

**Directory readiness:** Anthropic's current policy requires secure OAuth 2.0 for remote MCP servers that require authentication, along with clear privacy/support documentation, verified contact information, standard test credentials with sample data, three working examples, domain/API ownership verification, accurate tool annotations, and Streamable HTTP support. Throughline's existing bearer token is not OAuth and cannot be described as directory-ready.

| Requirement | Current Throughline state | Assessment | Smallest reversible next action |
| --- | --- | --- | --- |
| Public remote MCP reachability | Health endpoint returned HTTP 200; Anthropic cloud must be able to reach remote connector hosts. | meets for basic reachability | Recheck from approved synthetic connector proof. |
| Streamable HTTP | Source handles JSON-RPC POST, but a protocol-level authenticated client proof is absent. | partial | Verify with MCP Inspector and synthetic token. |
| Authenticated remote MCP uses secure OAuth 2.0 | Manual bearer token setup only. | does_not_meet | Candidate product slice below. |
| Privacy policy and support channel | Both public URLs returned HTTP 200. | partial | Map actual tool response fields to public disclosures. |
| Accurate narrow tool descriptions and annotations | Source has named tools and `readOnlyHint`; Anthropic also calls out title annotation. | partial | Inspect actual `tools/list` from synthetic account and add only accurate metadata in an approved product slice. |
| Test account with sample data | No approved synthetic test account. | does_not_meet | Mike approval for an isolated test fixture/account. |
| Three working prompts/use cases | Manual connection prompt exists; a review pack has not been validated. | partial | Draft and test three synthetic-only workflows. |
| Organization controls / directory review | Not exercised; no submission. | not_verified | Do not access account settings without Mike's exact action approval. |
| Token revocation and safe error behavior | Repository docs describe revocation; no end-to-end proof. | partial | Synthetic creation, revocation, and rejection proof. |

## Redacted Connection Proof

After Mike approves an account-backed test, use a synthetic account with synthetic notes. Record only: configuration completion, HTTP/JSON-RPC status, tool name, result-shape check, unsupported-write rejection, revocation result, and injection-resistance result. The injection check must verify that note text is treated as data/context and does not modify host instructions; do not retain note text, token values, prompt content, or identifiers.

## Candidate Product Slice: OAuth Read-Only Connector

**User problem:** a person with Throughline notes cannot use directory-grade Claude connection flow without manually handling a bearer token.

**Primary metric:** first successful MCP tool use, reported only after aggregate privacy-safe server-side coverage exists.

**Guardrail:** no note content, tokens, identifiers, or connection secrets in analytics or artifacts; keep internal/test/public cohorts separate.

**Planned scope:** OAuth 2.0 authorization-code/PKCE flow for read-only scopes, protected-resource discovery, consent, exact audience/scope validation, token lifecycle/revocation, and synthetic proof. Consider guided connection UI only after Mike selects product/design direction.

**Non-goals:** agent write tools, platform directory submission, new provider/model/data-use behavior, and external publishing.

**Rollback:** disable the new OAuth connector route while leaving the existing bearer-token path unchanged; revoke only synthetic test credentials during proof.

**Mike gate:** select and design-approve this product/authentication slice before implementation. The current bearer-token path must not be called OAuth or approved.
