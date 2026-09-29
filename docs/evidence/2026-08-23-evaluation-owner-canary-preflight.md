# TL-EVAL-001 owner-canary production preflight

**Verified:** 2026-08-23  
**Production change:** additive API revision-binding response only  
**Active API after deployment:** version 30  
**Evaluation behavior controls after deployment:** absent/off  
**Active evaluation eligibility after deployment:** 0  
**Owner evaluation submitted:** no

## Result

The read-only owner-canary preflight initially found 12 of 13 active API/deletion source files byte-identical to local source. The only mismatch was the API recording-detail response required by the locally verified revision-bound client: production API v29 returned the recording but not its current immutable revision identifier. All shared evaluation, retention, flag, inference, lineage, event, and deletion sources already matched.

After the full API and compatibility suite passed, the exact local API was deployed by itself with the existing self-authenticating `--no-verify-jwt` contract. No migration, shared provider/model contract, deletion function, MCP function, behavior flag, policy, app binary, or App Store state changed.

Production API v30 then passed authenticated service health on the first probe. Unauthenticated recording access remained `401`. A fresh aggregate-only inspection found all four evaluation behavior controls absent and active evaluation eligibility at zero. The private-artifact deletion function remained active at version 3.

A fresh provider download matched all 13 local API and deletion-function source files byte-for-byte. The private owner-canary package then re-verified its eight local source bindings, nine ordered phases, and SHA-256 identity `e444251d8e2ab622722d4fc1181b144143f533081f95d104e7abbed09f16037f` against the now-active API contract.

## Predeploy verification

- Owner-canary package suite: 6 passed, 0 failed.
- Complete API and retention-aware compatibility suite: 25 passed, 0 failed.
- Evaluation flag and focused compatibility suite: 7 passed, 0 failed.
- Adjacent rollout, lineage-canary, and privacy suite: 20 passed, 0 failed.
- Aggregate product-learning report suite: 15 passed, 0 failed.
- Markdown/HTML privacy policy parity and Node syntax checks: passed.

The first focused Deno invocation omitted the repository API import map and failed dependency resolution. The identical tests passed with the tracked API Deno configuration; no source correction was required.

## Rollback and next boundary

The frozen retention-aware configuration identity remains `a9edf876dff187a854a23ed995ad99c0b1fbe1abd8bfccd81630bf2f776508b2`. Before active eligibility, the service can return to flags-off stable behavior. At or after active eligibility, rollback must keep retention and withdrawal active while disabling new lineage and evaluation writes.

This preflight does not authorize an agent to choose or submit a grade, correction, or readiness value. It does not establish a retained contribution, private corpus, independent prediction, quality result, or user-outcome improvement. The next runtime phase requires the recording owner to perform each private judgment personally while the service follows the fixed lineage, retention, then evaluation-write order.
