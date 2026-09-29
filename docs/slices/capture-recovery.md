# Capture recovery — TL-CAP-001

**Verified baseline:** 2026-09-29, clean nonsynced `throughline-local` at `ee2e7914410fe3ad32635878ce698db5a6b71b18`; local implementation branch `codex/capture-tray`. Evidence: [ready handoff review](../evidence/2026-09-29-capture-handoff-ready.md).

**Backlog state:** `approved_for_build`
**Slice phase:** `canary`
**Current:** 1.0.5 (2026092901) is VALID / IN_BETA_TESTING in existing Internal QA. Backend v31 and the synthetic capture/replay/deletion check passed. Physical iPhone acceptance remains pending.
**Evidence:** [internal delivery](../releases/2026-09-29-ios-1.0.5-2026092901-delivery.md), [backend rollout](../evidence/2026-09-29-capture-production-rollout.md), and [Claude design review](../evidence/2026-09-29-claude-capture-implementation-review.md). The selected revision-3 handoff remains SHA-256 `eb4456ecda2912a9be3ef59797eb5be7a70584689dfba780e1bc98f70729dd50`.
**Next gate:** Mike installs build 2026092901 and tests capture/recovery on his iPhone before owner acceptance and the following running-list slice.
**Authority:** Mike approved build and internal TestFlight delivery on 2026-09-29 in [decision-log.md](../../decision-log.md). Internal QA only; no main merge, public release, new testers, running list or evaluation activation.

## Problem and outcome

A recorded thought currently resides in temporary storage and can be lost after upload failure. Store it durably before recording; keep truthful local/saved states, replay/retry/discard controls, immutable owner identity and duplicate-safe server acceptance. Preserve the selected Home hierarchy.

## Implementation sequence and ownership

1. Server worker: atomic owner/capture acceptance, incomplete resume, immutable receipts, processing claim, deleted-note tombstones, account-deletion serialization and tests. Additive compatibility for requests without capture identity.
2. iOS service worker: persistent capture store, file validation, queue, receipt/terminal cleanup, owner generations, recorder interruptions, offline/auth handling, playback and durable event dispatch. R7 precedes capture events.
3. Codex coordinator: Home tray, account confirmations/sign-in integration, account-scoped cached notes, project registration, metrics, overall test/build and release evidence. Claude’s design files remain unchanged.
4. Verification: focused Swift state-machine tests and UI integration; Deno and relevant Node regression suites; isolated complete migration replay with synthetic Vault prerequisites and evaluation/capture pgTAP; simulator builds/reference-state captures and physical checks where available. Read-only production preflight before any backend change.
5. Delivery: exact-source Claude review; committed source; isolated signed archive with a fresh internal build number; internal-only upload; verify Apple processing and existing Internal QA availability. Record any unverified device behavior explicitly.

## Primary metric and guardrails

Canonical definition: [capture recovery](../../product/metrics.md#capture-recovery). Report saved, deliberately discarded, confirmed unusable, pending and unobserved outcomes separately. No success claim from transport or poll exhaustion. Preserve cohort attribution and private event deduplication.

Guardrails: no lost usable audio, no duplicate durable recordings or processing claims, no cross-account display/upload, no row resurrection after deletion, bounded retries and storage, reachable accessible actions, legacy request compatibility. No real audio, note/transcript/feedback content, email, raw identifiers or credentials in tracked test/release evidence.

## Dependencies and non-goals

R7: event batches partitioned by owner; permanent invalid references cannot block later events. R10: full isolated replay with inert Vault prerequisites plus relevant pgTAP, not merely the older measurement CI gate. R11: processing completion updates an existing live row only. Providers/models, evaluation, policies, recording limits, onboarding, running list, background recording and processing restart remain unchanged.

## Rollback

Keep additive acceptance/tombstone endpoints while capture-capable builds exist. Revert visible tray behavior only in a newly verified compatible build that retains the local capture store and can drain pending captures. Reinstalling an old app that cannot read the store is not a valid rollback. Retain the pre-deployment API source privately for server rollback analysis; never drop the capture tables to roll back.

## Evidence manifest

Current evidence: [implementation verification](../evidence/2026-09-29-capture-implementation.md) and [backend candidate](../evidence/2026-09-29-capture-backend-candidate.md). The [signed candidate manifest](../releases/2026-09-29-ios-1.0.5-2026092901-candidate.md) records local archive/export success. [Final Claude design review](../evidence/2026-09-29-claude-capture-implementation-review.md) passed. [Internal delivery](../releases/2026-09-29-ios-1.0.5-2026092901-delivery.md) supersedes the candidate’s pending gates; owner acceptance remains pending.
