# Agent Ecosystem Submission Backlog

This is a preparation queue, not authorization for external action. Checked 2026-08-27.

| Phase | Action | Owner | Dependency | Verification | Rollback / stop condition | Mike gate |
| --- | --- | --- | --- | --- | --- | --- |
| prepare | Validate the proposed Registry JSON against the current schema; keep `USER_SUPPLIED_TOKEN` redacted. | DISC-01 / root coordinator | Exact schema refresh | Local schema validation and secret scan | Discard draft on schema drift; no external state exists | Not required for local preparation |
| prepare | Supply a reviewed HTTPS icon and product-facing website URL. | Owned-surface lead | Approved owned discovery asset/page | HTTP and visual checks | Keep registry field absent until asset is approved | Product/design approval for public asset/page |
| prepare | Decide GitHub versus verified-domain registry namespace and proposed metadata version. | Mike | Current package | Name format and publisher method match official registry rule | Stop before login if ownership cannot be verified | Required |
| prove | Create one synthetic test account and short-lived token, then test initialize, tools/list, one read, unsupported write, injection resistance, and revocation. | Agents after exact approval | Synthetic-only account and Mike approval | Content-free pass/fail receipt; post-revocation rejection | Revoke immediately; stop on any non-read-only or privacy failure | Required for account-backed action |
| build candidate | Specify OAuth read-only connection behavior for one selected platform path. | Root coordinator / product lead | Mike selects product/auth slice | Architecture, privacy, metric, and rollback review | No implementation, no directory draft | Required |
| submit | Log in to MCP Registry and publish final server metadata. | Mike performs account action; agent assists only when approved | Prepared package, namespace proof, approved proof evidence | Registry lookup matches signed-off JSON | Remove/mark published entry only through an approved provider action; stop if registry preview conditions changed | Required exact action |
| submit | Create Anthropic directory or OpenAI plugin submission. | Mike performs account/submission action | Selected OAuth slice, public listing assets, review pack, test account | Platform review evidence; no public claim before approval | Withdraw/disable draft through approved provider action | Required exact action |
| measure | Read aggregate discovery and first-tool-use evidence. | Root coordinator / measurement owner | Named campaign/source and coverage implementation | Privacy-safe aggregate report with cohort labels | Mark below-threshold/unavailable data as unavailable | No new approval for read-only measurement |

## Submission Stop Conditions

Stop before any external submission when: the source refresh is older than seven days; OAuth remains incomplete for an authenticated directory surface; the platform asks for credentials or a test account without Mike's exact approval; tool output includes unnecessary personal data, debug payloads, internal identifiers, or secrets; or the final listing makes an unverified comparative, integration, approval, or adoption claim.
