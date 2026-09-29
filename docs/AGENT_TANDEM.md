# Throughline Claude Code + Codex Tandem

This is the canonical interoperability workflow for product-design work performed with Claude Code and implementation/release work performed with Codex. It uses repository artifacts as the shared contract; it does not create a second source of product, design, backlog, metric, or runtime truth.

## Daily working agreement

Reaffirmed by Mike on **2026-09-28**: Claude owns front-end design; Codex owns production implementation, complex engineering, reliability, and voice-note quality; each reviews the other's work. This is a role and process decision, not selection of a new product feature. The [return audit](evidence/2026-09-28-return-audit.md) records the current adoption gaps.

- **One shared repository, one active product slice.** Start from a reconciled, committed base and name the exact branch, revision, slice, writer, owned paths, next action, and evidence. Keep those fields in the existing handoff or slice record; do not create another backlog or dashboard.
- **Default surfaces:** use the Codex desktop Throughline project for engineering and coordination, and Claude Code in the desktop app for design. Claude CLI is an interchangeable way to work on the same assigned local checkout. This is a recommended entry point, not an application-setting change. A cloud session is an isolated worker: it does not inherit local uncommitted files, so verify its remote base and supplied guidance before assigning work.
- **Separate writers:** Claude changes mockups, selected design specifications, and design assets. Codex changes production app/backend code and tests. Use separate worktrees after the shared base is reconciled. Neither writer edits the other's files opportunistically. A review is read-only until the assigned writer accepts the finding.
- **Codex reviews Claude before implementation:** validate feasibility, source-of-truth behavior, data contracts, failure/recovery states, accessibility, privacy, and testability of the candidate and selected handoff. Technical review informs Mike's selection; it does not make the selection. Record the final selected handoff revision before build.
- **Claude reviews Codex before internal release:** inspect the exact implementation revision and synthetic/redacted visual evidence against the selected design, including state, copy, interaction, and accessibility behavior. For engineering-only changes, review observable behavior and the proposed failure cases without inventing UI work. Codex remains responsible for engineering tests, device/build evidence, and release integrity.
- **Review receipt:** record reviewer, exact reviewed commit (or precommit file hashes), scope, findings, severity, disposition, and any unverified checks in the existing handoff/evidence. Fix or explicitly resolve material findings and re-review changed scope. A green CI job, self-review, or a second Codex agent is not evidence that Claude reviewed the work; the reverse also applies. If the other tool is unavailable, record `peer_review_pending` and the concrete next action.
- **Close the loop:** Codex integrates only owned, reviewed files, records source identity and appropriate checks, delivers within existing authority, and updates current state/backlog evidence. Mike tests the actual build and decides product acceptance. Keep public release under the existing exact approval rules.

The sequence is: **Mike names the problem → Claude designs → Codex checks feasibility → Mike selects → Claude freezes the handoff → Codex implements and verifies → Claude reviews the result → Codex delivers within authority → Mike uses the build.** Engineering-only slices enter at a bounded Codex plan and receive Claude review of user-visible behavior before delivery; they do not need three visual candidates when no design decision is involved.

At each session end, leave one short handoff in the existing slice/evidence: **what changed; exact revision and location; what passed; what remains; who acts next.** Do not leave work state solely in a chat. Commit only the bounded content-safe files after inspecting the dirty checkout; pushing/publishing and all other authority boundaries remain as documented.

### Re-entry gate for the September split

As of September 28, the working tree, remote main, and [Claude PR #2](https://github.com/mpolner88/throughline/pull/2) are different states. The local guides were absent from both that PR's base and head. Neither the current dirty branch nor PR #2 is an agreed consolidated source. Before new implementation, inventory and preserve local work, compare overlapping changes, and establish one reviewed base with the guides available to both tools. Do not merge the PR or run its new deployment workflows merely because its checks are green. Do not clean the dirty tree to make integration easier.

The historical split gate above was followed by preservation, reconciliation, approved nonsynced migration and Claude’s exact-base review. The [Codex disposition](evidence/2026-09-28-codex-capture-rereview.md) now owns the remaining review gates: capture contract changes and deferred evaluation defects. Mike subsequently approved the bounded [R8/R9 consent and Pages follow-up](evidence/2026-09-28-consent-pages-follow-up.md); the exact main merge remains unapproved. Do not restart the preservation process or infer a main merge.

## Current capability

Capability inventory refreshed by source/review inspection on 2026-09-28. The guides and design references below are committed on PR #3, reviewed by Claude at `372178b`; they are not merged to main. The active nonsynced checkout is `throughline-local`. Evidence: [integration receipt](evidence/2026-09-28-reconciliation-plan.md#review-integration-follow-up) and [Codex review](evidence/2026-09-28-codex-capture-rereview.md). No automatic cross-tool router is established:

| Capability | Current state | Evidence or boundary |
| --- | --- | --- |
| Product direction, visual language, backlog, and authority | Committed on the PR #3 branch | [Product charter](PRODUCT.md), [brand decisions](../throughline-brand-decisions.md), [workflow](WORKFLOW.md), and [backlog](../product/backlog.json). |
| Fresh design audit and inspected screenshots | Committed on the PR #3 branch | [2026-08-29 design audit](evidence/2026-08-29-design-direction-portfolio-audit.md) and its linked assets. |
| Claude Code project entry and repeatable UI procedure | Committed on the PR #3 branch | Root [Claude guide](../CLAUDE.md), [UI prompt](prompts/claude-code-ui-design.md), and project `/ui-handoff` skill. |
| Claude-to-Codex handoff format | Committed on the PR #3 branch | [Handoff template](templates/UI_DESIGN_HANDOFF.md) and [handoff directory rules](handoffs/README.md). |
| Private TestFlight feedback intake | Implemented locally, not a routing service | `scripts/private-testflight-feedback.mjs` stores raw material only under ignored `.throughline/feedback-intake/`; the dated [feedback intake evidence](evidence/2026-08-25-home-feedback-specification-intake.md) records the boundary. |
| Internal TestFlight delivery | Proven manually; not yet a reusable one-command pipeline | [Build 2026082801 evidence](evidence/2026-08-28-home-ui-rollback.md) and [release manifest](releases/2026-08-28-ios-1.0.5-2026082801.md). September aggregate evidence shows one install; the restored owner journey remains unverified in [current state](CURRENT_STATE.md). |
| Automatic feedback classification and dispatch | Not implemented | The routing policy below is canonical, but no background router currently invokes Claude Code or Codex. |
| App Store metadata and submission automation | Deliberately gated | Agents may prepare an exact packet. Mike must explicitly approve the exact metadata/build and separately authorize submission under [the slice workflow](WORKFLOW.md). |

Committed on PR #3 does not mean merged or approved for build. Capture revision 2 is preserved as a reviewed candidate with changes requested; Claude resolves the findings before readiness. A handoff becomes durable after its bounded files are reviewed and committed, and each later edit needs an exact-revision receipt. Raw feedback, credentials, signed archives, and temporary Apple receipts intentionally stay out of Git.

## Roles

| Participant | Owns | Does not own |
| --- | --- | --- |
| Claude Code | Fresh-flow inspection, UX critique, three bounded visual candidates, mock artifacts, brand review, and the selected-design handoff | Mike's selection, production implementation by default, release actions, or product-policy decisions |
| Codex | Dirty-state inspection, scoped production implementation, tests, builds, visual verification, backend/reliability fixes, release evidence, and approved internal delivery | Reinterpreting an approved design, changing priority, or inferring public-release approval |
| Mike | Priority, what enters build, product/design taste and selection, acceptance of the TestFlight journey, and every approval-bound decision | Routine reversible execution inside an already approved slice |

## The operating loop

Tandem stage is recorded separately from backlog state and slice phase.

| Tandem stage | Owner | Required exit evidence |
| --- | --- | --- |
| `design_brief` | Claude | User problem, fresh evidence, applicable canon, metric, guardrails, non-goals, authority, and rollback |
| `candidates_ready` | Claude | Three materially distinct, inspected candidates with complete state/accessibility coverage and an honest comparison |
| `awaiting_mike_selection` | Mike | Explicit selection or rejection; no production code changes while waiting |
| `handoff_ready` | Claude; Codex feasibility review | One selected, content-safe handoff at an exact revision, with technical review findings resolved or explicitly recorded |
| `building` | Codex | Implementation remains inside declared ownership and does not reinterpret the selected target |
| `local_verified` | Codex | Focused tests, privacy parity, docs verification, isolated builds, and visual/accessibility evidence appropriate to the slice |
| `internal_release_ready` | Codex; Claude peer review | Frozen version/build, source identity, test results, Claude review receipt, distribution scope, rollback target, and draft release manifest |
| `internal_testflight` | Codex within standing authority | Internal-testing-only upload processed and assigned only to the existing `Internal QA` group; no metadata or submission mutation |
| `owner_testing` | Mike | The exact build is installed and the intended journey is exercised; visibility in TestFlight is not journey evidence |
| `feedback_routed` | Agent tooling | A private intake item is deduplicated and projected into a content-safe route envelope |
| `owner_accepted` | Mike | Mike accepts the internal journey; this is not public-submission authority |
| `public_packet_ready` | Codex | Refreshed Apple state, exact build and metadata diff, screenshots, privacy answers, review notes, risks, rollback, and remaining evidence gaps |
| `awaiting_public_approval` | Mike | Explicit approval of the exact packet and an explicit instruction to submit |
| `submitted` | Codex within exact approval | Apple state is re-read and recorded; upload, processing, submission, approval, and public availability remain separate facts |

The normal loop is:

1. Mike names a problem or backlog item.
2. Claude works in a design-only branch or worktree and creates candidates. Codex reviews their feasibility, failure states, data contracts, privacy, and testability before they are presented for Mike's selection. Claude then stops at `awaiting_mike_selection`.
3. Mike selects one candidate and records any required changes.
4. Claude freezes the selected design in `docs/handoffs/<handoff-id>.md` with content-safe reference assets.
5. Codex checks the selected handoff for feasibility, then starts from its exact committed revision in a separate `codex/` worktree, implements it, verifies it, and records evidence. Claude reviews the resulting revision and inspected visual/behavior evidence before release readiness.
6. Once the selected slice is locally verified and Claude's implementation review is complete with material findings resolved, Codex may deliver a fresh internal-only build to the existing `Internal QA` group under the standing authority in `docs/WORKFLOW.md`.
7. Mike installs and uses that exact build. Feedback returns through the private intake boundary and is routed as described below.
8. After Mike accepts the internal journey, Codex prepares the public-release packet. It does not mutate App Store metadata or submit until Mike approves the exact packet and explicitly authorizes submission.

Do not use a chat transcript, copied summary, or “Claude said” as the implementation contract. Use the committed handoff path and its exact revision.

## Handoff contract

Every design handoff uses [the template](templates/UI_DESIGN_HANDOFF.md) and names:

- the backlog item, relevant slice, tandem stage, verification date, and evidence links;
- the selected candidate and Mike's selection record;
- current-flow and target mock references with provenance;
- exact behavior for loading, empty, error, offline, permission, long-content, light/dark, Dynamic Type, VoiceOver, Reduce Motion, and non-gesture alternatives where applicable;
- exact copy and assets;
- the source/component map and Codex-owned paths;
- acceptance tests, visual checks, metric, guardrails, non-goals, authority, rollback, and unresolved questions.

Claude may describe implementation constraints and map the selected target to existing components. Codex may choose safe internal mechanics only where the handoff deliberately leaves them open. Any visible or behavioral ambiguity goes back to Claude and Mike instead of being silently resolved.

## Private TestFlight feedback routing

Raw feedback, screenshots, crash logs, identifiers, and private paths remain in ignored local storage. Automation may emit only a content-safe envelope containing category, surface, severity, reproducibility, affected build, related slice, authority class, and whether private evidence is available.

| Route | Examples | Next step |
| --- | --- | --- |
| `ui_design` → Claude | Hierarchy, spacing, typography, visual density, copy, discoverability, navigation model, animation feel, or a requested interaction change | Return to `design_brief`. New direction still requires Mike's selection. |
| `implementation_bug` → Codex | Crash, auth, upload, processing, persistence, sync, API/data mismatch, performance regression, or selected design rendered incorrectly | Diagnose and fix within the approved slice; escalate if the repair changes product/design or another gated surface. |
| `mixed_or_ambiguous` → Mike | Feedback changes both the intended experience and implementation, lacks safe reproduction detail, or conflicts with canon | Produce a short sanitized triage packet and stop for routing/priority. |

No system should automatically send raw private evidence to a model provider. Use a redacted or content-safe screenshot only when its data-use boundary is already approved; otherwise keep the pixels private and route the structured envelope.

## Release gates

Internal TestFlight can become automatic only after all of these deterministic checks exist:

- the handoff is selected and committed;
- the source tree and owned paths are frozen in an isolated release copy;
- tests, privacy checks, docs verification, builds, visual checks, and the required peer-review receipts pass;
- the build number is new and the export is internal-testing-only;
- the runner can assign only to the existing `Internal QA` group;
- upload, processing, and group assignment are queried independently;
- resumable private state prevents an ambiguous Apple response from causing a blind retry; and
- the previous valid internal build remains the rollback target.

That runner does not yet exist in the repository. Until it does, internal delivery remains a bounded agent-run procedure with dated evidence.

Public release is intentionally not a continuation of the internal automation. After Mike accepts a TestFlight build, Codex may prepare copy, screenshots, metadata, privacy answers, and review notes. It then stops with an exact diff. A valid public command is specific—for example, “Approve the metadata packet at path Z and submit version X, build Y, to App Review.” Metadata approval and submission authority may be given in that one exact instruction, but neither is inferred from “the TestFlight build looks good.” Codex verifies and reports `uploaded`, `processed`, `selected`, `submitted`, `approved`, and `publicly available` as different states.

## Efficient adoption order

1. Review and commit the canonical foundation and this tandem contract so both tools start from the same base.
2. Use `CLAUDE.md` plus `/ui-handoff` for one small UI slice; do not add CI or hooks yet.
3. Have Codex implement that committed handoff in an isolated worktree and compare its output with the selected mock.
4. Wrap the already proven internal release procedure in a fail-closed, resumable runner with no App Store metadata/submission scope.
5. Extend the private intake with bounded crash ingestion and a content-safe deterministic router.
6. Add reviewed hooks or CI only for mechanical constraints: owned-file boundaries, tests, docs verification, privacy checks, and design-conformance reports.
7. Keep public metadata mutation and submission as separate exact-approval commands.
