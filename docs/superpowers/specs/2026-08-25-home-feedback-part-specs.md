# Home feedback: individual part specifications

**Status:** Parts 1, 4, and 5 were delivered on 2026-08-27, rejected in owner review, and rolled back to the preceding Home presentation in internal build `2026082801` on 2026-08-28. Parts 2, 3, and 6 remain candidates; no Home candidate is currently approved for build.
**Prepared:** 2026-08-25
**Backlog:** `TL-TASK-001` and `TL-AGENT-001`
**Program:** [Core Quality and Learning](../../programs/core-quality-learning.md)
**Verified input:** [sanitized private-feedback intake](../../evidence/2026-08-25-home-feedback-specification-intake.md) and [current state](../../CURRENT_STATE.md)

## Goal

Turn one private TestFlight feedback submission into independent, testable product parts without bundling a broad home-screen redesign or changing the extraction contract prematurely. Each part can be selected, built, verified, rolled back, and measured on its own.

## Part map

| Build order | Part | User value | Boundary | Dependency |
| --- | --- | --- | --- | --- |
| 1 | [Honest carryover](2026-08-25-home-feedback-01-honest-carryover.md) | Stops the app from claiming recency or incompletion it cannot prove | Presentation and source binding | None for the neutral first step |
| 2 | [Dependable top-task selection](2026-08-25-home-feedback-04-dependable-top-task-selection.md) | Gives the top section a clear, defensible organizing rule | Presentation projection | Existing typed to-do fields |
| 3 | [Task-card hierarchy](2026-08-25-home-feedback-05-task-card-hierarchy.md) | Makes the action scannable and moves detail into supporting text | Presentation only | Part 2 selection contract |
| 4 | [Task interactions](2026-08-25-home-feedback-06-task-interactions.md) | Makes complete, edit, and delete predictable and safe | iOS plus task mutation contract | Stable task identity |
| 5 | [Time-horizon navigation](2026-08-25-home-feedback-02-time-horizon-navigation.md) | Lets a user focus on today, this week, or later | Task information architecture | Stable identity and typed date rules |
| 6 | [Home agent entry](2026-08-25-home-feedback-03-home-agent-entry.md) | Makes the voice-to-agent promise actionable without hiding Settings | Contextual entry point only | Agent-use measurement coverage |

The build order is dependency-aware, not a claim that later parts matter less. Parts 1–3 are presentation-first and can improve semantic honesty quickly. Parts 4–5 must not ship on the current text-matched mutation identity. Part 6 is independent and remains read-only in agent scope.

## Shared contracts

- Raw audio, transcript, note text, task text, feedback text, and raw identifiers never enter tracked evidence, analytics, fixtures, or release manifests.
- A non-action `most_important` insight never becomes a checkable task.
- Display formatting never becomes mutation identity. Task changes target a stable server task ID within a source recording.
- The source note remains reachable from every surfaced task.
- All visible controls have a minimum 44 by 44 point interaction target and non-gesture VoiceOver alternatives.
- Presentation uses the existing quiet monochrome system, electric-blue action color, sentence case, medium-or-lighter weights, 0.5-point borders, and current card radius from [brand decisions](../../../throughline-brand-decisions.md) and `Theme`.
- No part changes provider, base model, production prompt bytes, extraction schema, data-use policy, onboarding, pricing, recording limits, App Store submission, or public release.

## Shared success and guardrails

The canonical product outcome remains the `TL-TASK-001` primary metric: newly activated users who revisit or complete an extracted task within seven days. Existing `note_opened`, `note_edited`, and `action_item_toggled` events provide workflow-depth evidence. New view or mutation events are diagnostic until added to [the metrics contract](../../../product/metrics.md).

Shared guardrails are task-mutation failure rate, ambiguous-target rejection, task extraction correction rate, accidental parent-note deletion, accessibility-action availability, and cohort/sample coverage. Internal TestFlight behavior must remain separate from public App Store outcomes.

## Authority and next decision

These records complete the requested specification work. On 2026-08-26 Mike selected and design-approved Parts 1, 4, and 5 for build; [the implementation plan](../plans/2026-08-26-home-feedback-first-slice.md) governed that slice. Owner review rejected the resulting presentation, and the reversible rollout was recovered through [the 2026-08-28 rollback](../../evidence/2026-08-28-home-ui-rollback.md). Parts 1, 4, and 5 are no longer active; Parts 2, 3, and 6 remain unselected candidates. A later Home change requires a new bounded selection and product/design review.
