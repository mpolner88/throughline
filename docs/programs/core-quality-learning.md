# Core Quality and Learning Program

**Status:** Active program brief  
**Verified baseline:** 2026-08-17; see [current state](../CURRENT_STATE.md) for evidence strength and re-verification requirements.

## Problem

Throughline must turn an individual's spoken thought into a trustworthy, durable structured note and actionable to-dos that their AI agent can read. Current evidence shows that feedback is stored but not consumed, processed records lack immutable transcription/extraction lineage and exact model or prompt attribution, and the current extraction evaluator self-copies expected output when no predictions are supplied. The recorded usage counts are privacy-safe, aggregate repository assertions, not independent proof of current provider state or a decision-grade public cohort.

## Target outcome

Make quality changes evidence-backed, reversible, and traceable: a user receives reliable transcription and extraction, corrections become safely usable learning signals, and each promoted change has an honest evaluation, recorded lineage, canary result, and rollback path.

## Locked decisions

- Throughline serves an individual capturing personal thoughts while driving, walking, or thinking. It is not a meeting recorder, team-transcription product, or generic audio archive.
- The user who recorded a note is the only human evaluator for that note. Mike does not review examples; there is no employee, contractor, or external-review queue.
- Feedback automation validates, deduplicates, classifies, and quarantines user feedback. Ambiguous labels are excluded from promotion evidence and automated learning until classification can occur without inventing a label.
- Onboarding is unchanged by this program.
- The recorded limits are a 30-second onboarding demo and a five-minute authenticated client cap per recording. A ten-minute daily allowance is intended but not implemented or enforced.
- Premium recording limits up to 15 minutes and evaluation credits remain backlog-only. They are not program milestones or implementation commitments.
- Establish a measurement baseline before setting lift targets or changing a quality control.

## Authority

Mike decides what enters build, reviews product/design taste and judgment, and sets priority. Agents own baseline inspection, options, specifications, plans, implementation, verification, routine reversible rollout, measurement, and documentation.

Within an approved reversible slice, agents may implement and roll out routine reversible work without another approval. Provider, base-model, data-use policy, pricing, recording-limit, onboarding, and App Store submission changes still require Mike's explicit approval.

## Automated learning flow

1. Accept only consented, privacy-safe feedback metadata and corrections through the feedback intake.
2. Validate structure and provenance, deduplicate equivalent submissions, and classify the signal automatically.
3. Quarantine ambiguous, malformed, conflicting, or unsupported labels; do not use them for training, evaluation, or promotion.
4. Convert eligible classified signals into versioned evaluation or personalization candidates without exposing raw content in tracked artifacts.
5. Evaluate a proposed prompt, schema, normalizer, or model configuration against declared controls and holdouts with immutable input/output lineage.
6. Promote only a passing candidate through a reversible canary; retain the control and rollback evidence.

## Promotion gates

Safe prompt, schema, and normalizer changes may auto-promote only when declared gates pass for quality, critical errors, reliability, latency, cost, canary behavior, lineage, and rollback. A candidate that fails or lacks traceable evidence remains out of promotion. Changes to an approval-bound authority class follow the workflow approval path before rollout.

## Program metrics

This program uses the canonical definitions in [product metrics](../../product/metrics.md). Its operating measures are:

- transcription and extraction quality, including critical-error rate and missed-action rate;
- evaluation integrity and lineage coverage, including the share of results with independent predictions rather than self-copied expected output;
- processing reliability, latency, and cost per successful recording;
- feedback intake health: validation, deduplication, classification, quarantine, and eligible-signal rates; and
- canary performance and rollback readiness against the declared control.

Interpret product activation and retention only under their documented cohort definitions and readiness floors. Do not turn mixed, unmatched, or insufficient-volume aggregates into an outcome claim.

## Initial bounded slices

Each slice follows [the workflow](../WORKFLOW.md), links its evidence/release manifest, and uses [the backlog](../../product/backlog.json) for priority.

| Slice | Bounded purpose |
| --- | --- |
| `measurement-attribution` | Reconcile populations and establish traceable processing and quality measurements. |
| `evaluation-truth-and-lineage` | Replace self-copying evaluation behavior with independent predictions and immutable lineage. |
| `transcription-challenger` | Compare a transcription candidate to the declared control within the approved authority path. |
| `extraction-contract-and-missed-actions` | Define and measure extraction correctness, especially unsupported and missed actions. |
| `agentic-feedback-learning` | Automate safe feedback validation, deduplication, classification, quarantine, and candidate generation. |
| `capture-recovery` | Make capture and upload recovery measurable and reliably reversible. |
| `personalization` | Develop account-private, typed preferences with traceable consent and controls. |

## Non-goals

- Changing onboarding, provider, base model, data-use policy, pricing, recording limits, or App Store submission state.
- Implementing premium recording limits, subscriptions, evaluation credits, or evaluation-credit accounting.
- Treating stored feedback as already-consumed learning evidence.
- Creating a manual example-review or promotion queue for Mike or any other reviewer.
- Tracking raw audio, transcripts, note text, feedback text, emails, credentials, or raw user/session identifiers in program artifacts.

## Related records

- [Current state](../CURRENT_STATE.md)
- [Product charter](../PRODUCT.md)
- [Workflow and authority](../WORKFLOW.md)
- [Product metrics](../../product/metrics.md)
- [Prioritized backlog](../../product/backlog.json)
- [Superseded historical design](../superpowers/specs/2026-08-16-core-quality-learning-system-design.md)
