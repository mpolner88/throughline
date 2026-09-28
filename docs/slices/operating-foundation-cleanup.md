# Operating Foundation Cleanup Slice

**Backlog state:** `closed`
**Slice phase:** `closed`
**Selected:** 2026-08-29 by Mike's direction to clean up before accelerating
**Closed:** 2026-08-29 after canonical, navigation, history, and tracked-asset checks passed
**Backlog:** `TL-OPS-002`
**Evidence:** [2026-08-29 repository, experience, and workflow audit](../evidence/2026-08-29-repository-experience-workflow-audit.md)

## User problem

Throughline's repository and product experience cannot accelerate safely when current truth, slice progress, next actions, and authority gates can be interpreted differently across canonical records.

## Baseline

The audit found one invalid backlog state, stale internal-build actions, outdated architecture language, ambiguous internal-TestFlight authority, broken canonical navigation, and no automated foundation check. The experience audit also found that capture durability and truthful saved/agent-readable state are more urgent than another Home redesign.

## Outcome

Make the repository answer four questions consistently—Current, Evidence, Next gate, and Authority—while preserving the user's dirty work and separating product recommendations from approved implementation.

## Primary metric

`npm run docs:verify` passes with zero missing canonical files, broken/absolute local links on the canonical surface, invalid backlog items, missing dependencies, or dependency cycles.

## Guardrails

- Preserve every unrelated dirty or untracked file; do not stage, commit, revert, or delete it.
- Keep runtime, product, release, and metric claims within their evidence boundaries.
- Keep raw audio, transcript, note text, feedback text, emails, credentials, and raw user/session identifiers out of tracked artifacts.
- Do not change provider, base model, data-use policy, pricing, recording limits, onboarding, App Store submission, or public state.

## Non-goals

- Implementing capture recovery or changing onboarding behavior.
- Designing or rebuilding Home.
- Enabling evaluation behavior, private materialization, or provider execution.
- Publishing, deploying, submitting, releasing, or cleaning the entire dirty checkout.

## Authority

Mike selected repository/process cleanup before acceleration. Agents own this reversible documentation and validation work. Product/design selection for capture recovery or Home, and all standing approval-bound classes, remain Mike-owned.

## Rollback

Revert only the files named by this slice. The verifier is read-only and makes no repair automatically. Existing dirty work remains untouched.

## Acceptance

- Canonical perspectives and the two-level status model are defined once in `docs/WORKFLOW.md`.
- The root README leads through the canonical read path with repository-relative links.
- Active backlog and slice projections no longer use undeclared or superseded state.
- Architecture reflects the deployed flags-off foundation without claiming real-user lineage coverage or an independent quality result.
- Superseded foundation detail is outside the current snapshot, and the measurement row reflects the completed production rollout.
- Marketing/operator navigation is repository-relative and checked without making those files canonical.
- The tracked screenshot set records its generator, review boundary, and release-manifest requirement.
- The dated audit distinguishes source inspection, repository evidence, and unverified device/live experience.
- `npm run docs:verify` and `git diff --check` pass for the bounded cleanup.
