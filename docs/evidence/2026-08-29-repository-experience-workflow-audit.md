# Repository, experience, and workflow audit

**Verified:** 2026-08-29
**Scope:** Read-only inspection of the shared checkout, canonical documentation, backlog and decision records, current iOS source, existing screenshot sources, and dated repository evidence. No live provider, production database, App Store Connect, physical-device, or installed-TestFlight journey was re-verified.
**Slice:** [Operating foundation cleanup](../slices/operating-foundation-cleanup.md)

## Outcome

Throughline has a strong evidence and authority foundation, but it accumulated four kinds of drift: ambiguous status vocabularies, current records retaining superseded actions, navigation tied to an obsolete checkout, and product surfaces that imply more durability or learning than the current path can always guarantee.

The highest-impact product finding is not visual polish: a failed onboarding promotion can still place a local-only note into Home, while a failed normal recording has no durable replay/retry outbox. Both can break the durable, agent-readable knowledge promise.

## Findings

| Priority | Finding | Evidence strength and source | Disposition |
| --- | --- | --- | --- |
| P0 | Onboarding can route to Home with the captured demo note after durable promotion fails. A later refresh intentionally preserves non-recording local notes, so the note may remain visible without being readable through the hosted agent path. | Direct source: [OnboardingView.swift](../../ios/Throughline/Views/OnboardingView.swift) and [AppState.swift](../../ios/Throughline/AppState.swift). Actual failure frequency and user interpretation are unmeasured. | Make capture durability and truthful saved/agent-readable state the first product candidate after this foundation slice. This audit does not authorize an onboarding change. |
| P0 | A failed normal upload can lose the thought because the recording begins in temporary storage and the Home failure path has no durable outbox, replay, or manual retry. | Direct source: [AudioRecorder.swift](../../ios/Throughline/Services/AudioRecorder.swift), [HomeView.swift](../../ios/Throughline/Views/HomeView.swift), and canonical backlog item `TL-CAP-001`. Real failure frequency is unavailable. | Bound a recovery mock covering pending, failed, replay, retry, idempotency, and storage guardrails; Mike selection/design approval remains required. |
| P1 | Backlog disposition, slice phase, runtime status, release status, and metric readiness were frequently collapsed into one ambiguous `status`. `TL-EVAL-001` also used undeclared backlog state `in_progress`. | Direct canonical-source comparison: [workflow](../WORKFLOW.md), [backlog](../../product/backlog.json), and active [slice briefs](../slices/). | Separate backlog state from slice phase; require the `Current / Evidence / Next gate / Authority` lens; validate backlog states automatically. |
| P1 | Canonical records retained superseded state: the architecture called the flags-off evaluation foundation undeployed, the measurement slice remained selected after rollout, and backlog actions referenced internal build `2026082501` after build `2026082801` became the current internal candidate. | Dated repository evidence: [current state](../CURRENT_STATE.md), [measurement rollout](2026-08-22-measurement-production-rollout.md), and [Home rollback](2026-08-28-home-ui-rollback.md). | Refresh current projections while retaining dated history. Do not infer installation or user-outcome success. |
| P2 | Root navigation linked to an obsolete absolute checkout and did not lead contributors through the canonical read order. | Direct source: repository `README.md`. | Use relative links and put the canonical read path first. The verifier rejects absolute local links on the canonical surface. |
| P2 | Home flattens tasks primarily by text, caps the visible list, and omits available due, priority, context, and source meaning. The rejected Home iteration means no replacement presentation is approved. | Direct source: [HomeView.swift](../../ios/Throughline/Views/HomeView.swift), [ThroughlineNote.swift](../../ios/Throughline/Models/ThroughlineNote.swift), and [rollback evidence](2026-08-28-home-ui-rollback.md). | Prepare a new mock-only task-home slice after capture truth, using source identity and honest counts. Do not revive the rejected presentation. |
| P2 | Agent connection ends at token and command copy; there is no in-app verified first-read success and server-side first MCP use remains a measurement gap. | Direct source plus canonical metric gap: [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift), the settings UI in `SharedComponents.swift`, and [product metrics](../../product/metrics.md). | Later bound a read-only connection-check slice; write permissions remain a separate approval-bound decision. |
| P2 | Several review surfaces invite grades, corrections, or feedback while the canonical state still says feedback is stored but not consumed by a learning/promotion path. | Direct source and [current state](../CURRENT_STATE.md). User confusion is an inference. | Specify one truthful review disclosure before changing policy or enabling learning behavior. |

## Canonical perspective adopted

Every active review should be expressible in four lines:

- **Current:** the dated fact or explicit coverage gap.
- **Evidence:** the source and its readiness/verification boundary.
- **Next gate:** one executable next action or decision.
- **Authority:** routine agent work or the named Mike-owned gate.

The backlog is the portfolio disposition. A slice brief carries the more detailed execution phase. Runtime, release, and metric-readiness labels remain separate.

## Cleanup completed in this slice

- Added the canonical read path and relative runbook links to the root README.
- Defined the four canonical decision perspectives and the backlog-state/slice-phase mapping in the workflow.
- Projected the already-recorded internal-only TestFlight authority into the workflow while preserving external/public gates.
- Added a read-only foundation verifier for required canonical files, canonical local links, backlog fields, declared states, dated evidence, dependencies, and dependency cycles.
- Refreshed the architecture's flags-off evaluation boundary, active slice projections, and superseded internal-build pointers.
- Added an explicit historical/noncanonical banner to the product-learning-loop document without rewriting its body.
- Moved superseded local-foundation narrative out of the current-state snapshot and replaced the stale measurement row with the successful production-rollout status.
- Replaced obsolete absolute checkout links in the marketing/operator documentation with repository-relative links and added them to the link check.
- Defined the tracked App Store screenshot set as release-candidate marketing compositions, preserved that manifest through regeneration, and made its non-device evidence boundary explicit.

## Remaining evidence and product gates

1. Install build `2026082801` and verify the restored journey on the intended device before calling it visually or experientially verified.
2. Obtain Mike's selection/design approval before implementing capture recovery, any onboarding behavior change, or a new Home presentation.

## Privacy and authority

No raw audio, transcript, note text, feedback text, email, credential, or raw user/session identifier was inspected or recorded. No provider, model, policy, pricing, limit, onboarding, App Store submission, deployment, or public state changed.
