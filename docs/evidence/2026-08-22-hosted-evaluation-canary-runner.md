# TL-EVAL-001 hosted Edge/Storage canary runner

**Verified:** 2026-08-22  
**Scope:** local runner contract and synthetic mocks only  
**Production change:** none  
**Hosted canary execution:** not run  
**User-visible change:** none

## Outcome

The content-free hosted canary runner is implemented at [verify-evaluation-edge-storage-canary.mjs](../../scripts/verify-evaluation-edge-storage-canary.mjs). It closes the rollout-order gap with two distinct proofs:

1. a direct deletion Edge to Supabase Storage preflight after the private-artifact function deploy and before the TL-EVAL migrations/API deploy; and
2. a staged API Edge to deletion Edge to Storage reconciliation proof after the exact migrations and flags-off API candidate exist.

The runner is fixed to the approved Throughline Supabase project, `throughline-audio/evaluation-artifacts`, and the frozen 3,600-second stale contract. Hosted execution requires both an explicit CLI flag and an exact environment authorization gate. No local test can reach the network.

## Safety contract

- Generates random synthetic bytes and receipt hashes only.
- Refuses pre-existing or non-empty receipt scopes before upload.
- Accepts no caller-selected hosted URL, bucket, prefix, receipt, or object path.
- Reserves the reconciliation target before Storage publication.
- Persists recovery state before reservation in one mode-`0600` file under the exact `/private/tmp/throughline-evaluation-edge-canary-*.json` or `/tmp/throughline-evaluation-edge-canary-*.json` namespace.
- Deletes only scopes proven to be owned by the current attempt after partial failure.
- Waits for the fixed stale window before invoking the service-only API reconciler.
- Proves target absence, sibling survival, terminal registry state, deletion idempotency, and cleanup.
- Removes the state file only after successful cleanup.
- Emits fixed aggregate results and safe error categories; receipt hashes, object paths, URLs, credentials, and raw hosted error bodies are never printed.

## Local verification

The focused Node contract suite passed 13 tests and 0 failed. Coverage includes the double execution lock, exact approved project/Storage/stale target, exact CLI phases, state-path restriction, real mode-`0600` file permissions, privacy rejection, direct Edge scope and idempotency, collision refusal, reserve-before-upload order, partial-failure ownership cleanup, stale-window enforcement, API-chain reconciliation, terminal acknowledgment, sibling survival, and successful state removal. The complete intended Node contract/evaluation/package sweep passed 129 tests and 0 failed; the explicit-config, explicit-lock Deno evaluation/API/artifact sweep passed 79 tests and 0 failed.

This is executable local evidence only. Neither hosted phase ran, no function or migration was deployed, no production Storage object or registry row was created, no schedule was installed, and no evaluation behavior flag was enabled.

## Subsequent hosted execution

The statements above describe the runner-verification boundary on 2026-08-22. On 2026-08-23, the direct Edge/Storage preflight passed all seven checks and the fixed one-hour reconciliation exercise passed all eight checks. The recovery state self-removed, the protected schedule completed its first real HTTP `200` call, and all evaluation behavior controls remained absent/off. See [TL-EVAL flags-off production foundation rollout](2026-08-23-evaluation-production-rollout.md).
