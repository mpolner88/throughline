---
handoff_id: "YYYY-MM-DD-surface-short-name"
backlog_id: "TL-AREA-000"
slice_brief: "docs/slices/example.md"
tandem_stage: "design_brief"
created_on: "YYYY-MM-DD"
verified_on: "YYYY-MM-DD"
design_agent: "Claude Code"
implementation_agent: "Codex"
decision_owner: "Mike"
authority: "design_only"
selected_candidate: null
selection_record: null
owned_paths: []
---

# UI Design Handoff: <surface and outcome>

Follow [the Claude Code + Codex tandem workflow](../AGENT_TANDEM.md). Replace every placeholder; do not leave an empty section disguised as complete.

## Current

- What the user experiences now:
- Verification date:
- Evidence type: physical device / TestFlight / simulator / public listing / source inspection
- Evidence links:
- Known evidence gaps:

## User problem

- One problem:
- Who experiences it:
- Why it matters now:

## Evidence

- Decision-ready evidence:
- Assumptions:
- Unknowns:

## Canonical fit

- Product principles:
- Brand/design principles:
- Relevant decisions:
- Backlog state:
- Slice phase:

## Candidates

### Candidate A — <name>

- Core idea:
- Mock source:
- Inspected screenshot:
- Strengths:
- Risks:

### Candidate B — <name>

- Core idea:
- Mock source:
- Inspected screenshot:
- Strengths:
- Risks:

### Candidate C — <name>

- Core idea:
- Mock source:
- Inspected screenshot:
- Strengths:
- Risks:

## Selection

- Selected candidate:
- Mike's exact selection record:
- Required revisions:
- Rejected alternatives and why:

Do not set `tandem_stage: handoff_ready` until this section is complete.

## Selected experience

- Entry:
- Primary flow:
- Exit:
- Navigation and gestures:
- Non-gesture alternatives:
- Exact copy:
- Motion:
- Haptics/audio:

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | | |
| Empty | | |
| Error/retry | | |
| Offline/degraded | | |
| Permission denied | | |
| Long/localized content | | |
| Light and dark appearance | | |
| Dynamic Type | | |
| VoiceOver/focus order | | |
| Reduce Motion | | |

## Production mapping

- Existing components to reuse:
- Files likely affected:
- New assets/tokens:
- Data/API assumptions:
- Invariants Codex must preserve:
- Deliberately open implementation choices:

## Acceptance

- Behavioral checks:
- Visual comparison views and sizes:
- Automated tests:
- Build commands:
- Physical-device checks:

## Measurement and safety

- Primary metric:
- Guardrails:
- Privacy/data boundary:
- Non-goals:
- Authority class:
- Rollback target and procedure:

## Codex handoff

- Exact committed handoff revision:
- Codex-owned paths:
- Required evidence manifest:
- Unresolved blockers:
- Next gate:

## Mutual review receipts

- Codex feasibility reviewer and date:
- Exact selected handoff revision reviewed:
- Technical findings and resolution:
- Claude implementation reviewer and date:
- Exact implementation revision and visual/behavior evidence reviewed:
- Design, interaction, accessibility, and failure-state findings and resolution:
- Remaining unverified checks or `peer_review_pending`:
- Next owner and one next action:

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
