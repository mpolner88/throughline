# Throughline Slice Workflow

This workflow governs bounded product slices. It complements the canonical-source map in `AGENTS.md`; it does not create a second source of backlog or metrics truth.

## Required Slice Record

Each slice records:

- one user problem;
- evidence;
- one backlog state;
- one slice phase;
- one primary metric;
- guardrails;
- non-goals;
- authority class;
- rollback; and
- an evidence/release manifest.

Metrics definitions and interpretation remain in `product/metrics.md`; priority remains in `product/backlog.json`.

## Canonical decision perspectives

Every review, handoff, and status update answers the same four questions. Link to the canonical source instead of copying its facts into another document.

| Perspective | Question | Canonical source |
| --- | --- | --- |
| Current | What is true now, and how recently was it verified? | `docs/CURRENT_STATE.md` for dated live facts; `docs/ARCHITECTURE.md` for the current component map. |
| Evidence | What supports the claim, and is it decision-ready? | `product/metrics.md` for definitions; dated evidence or release manifests for results. |
| Next gate | What is the single next executable action or decision? | The relevant slice brief, projected into `product/backlog.json`. |
| Authority | Who may take that action, and what remains gated? | This workflow and the append-only `decision-log.md`. |

A canonical status summary uses the labels `Current`, `Evidence`, `Next gate`, and `Authority`. Runtime status, metric readiness, release status, backlog state, and slice phase must be named explicitly; do not collapse them into an ambiguous bare `status`.

## Product and design decision path

Product direction, visual judgment, and portfolio priority are related but distinct decisions. Record each one in its canonical source instead of creating a parallel strategy or roadmap document.

| Question | Canonical source | Decision owner |
| --- | --- | --- |
| Who is Throughline for, what durable outcome does it promise, and what is it not? | `docs/PRODUCT.md` | Mike for product judgment; agents maintain coherence and evidence boundaries. |
| How should Throughline look, feel, speak, and behave across surfaces? | `throughline-brand-decisions.md` | Mike for taste and design selection; agents audit, propose, specify, and verify. |
| Which feature or problem is next, and what evidence or dependency gates it? | `product/backlog.json` | Mike for priority and what enters build; agents maintain evidence, dependencies, state, and one next action. |
| What bounded candidate is selected, and how will it be built and judged? | The relevant program and slice brief | Mike selects and design-approves; agents plan, implement, verify, roll out reversibly, measure, and document within authority. |

Before a product-facing candidate enters build, its decision packet includes:

1. the user problem and evidence strength;
2. fresh current-flow evidence, including screenshots for visual work;
3. bounded options and the selected rationale;
4. the applicable product and design principles;
5. primary metric, guardrails, non-goals, state coverage, accessibility risks, and rollback;
6. the backlog state, slice phase, authority class, and Mike's selection or design-approval record.

An audit may identify drift and recommend a direction. It does not itself approve a visual target, reprioritize the backlog, or authorize implementation.

When Claude Code produces the design and Codex implements or releases it, follow [the tandem workflow](AGENT_TANDEM.md). The tandem stage is another explicit projection, not a replacement for backlog state or slice phase. The committed selected handoff is the implementation contract; agent conversation memory is not.

## Backlog state and slice phase

The backlog and slice workflow represent different levels of detail:

- `product/backlog.json` records portfolio disposition: what is prioritized and where it sits in the product queue.
- The slice brief records execution phase: what the approved slice is doing now.

Use only the backlog states declared in `product/backlog.json`. Record the slice phase separately using the lifecycle below. For new or refreshed slices, write both fields explicitly.

| Backlog state | Compatible slice phase |
| --- | --- |
| `collecting_evidence` | `baseline` |
| `ready_for_mock` | `candidate` |
| `awaiting_mock_approval` | `candidate`, `selected`, or `design_approved` |
| `approved_for_build` | `selected`, `design_approved`, `planned`, `building`, or `canary` |
| `shipped` | `canary` or `measuring` |
| `measuring` | `measuring` or `iterate` |
| `closed` | `closed` |

`iterate` returns the backlog item to the disposition justified by the new evidence. It is never a substitute for a dated next action.

## Slice phase lifecycle

| State | Owner | Exit or decision |
| --- | --- | --- |
| `baseline` | Agent | Establish the evidence-backed starting point. |
| `candidate` | Agent options | Present bounded options. |
| `selected` | Mike | Mike decides what enters build. |
| `design_approved` | Mike taste/judgment | Mike approves product/design taste and judgment. |
| `planned` | Agent | Specify scope, authority, metric, guardrails, rollback, and manifest. |
| `building` | Agent | Implement within the approved slice. |
| `canary` | Agent within authority | Run a reversible canary and record evidence. |
| `measuring` | Agent | Measure the primary metric and guardrails. |
| `closed` | Agent evidence | Close with evidence and release-manifest record. |
| `iterate` | Agent evidence, Mike reprioritization | Record evidence; Mike sets the next priority. |

Routine reversible work inside an approved slice proceeds without another approval. The following authority classes require Mike's explicit approval: provider, base-model, data-use policy, pricing, recording-limit, onboarding, and App Store submission changes.

After a bounded internal iteration is already selected and verified, agents may upload and assign an internal-only build to the existing `Internal QA` group under the 2026-08-25 decision record. That standing authority does not cover external TestFlight distribution, a new tester population, App Store submission or review, public release, privacy-policy publication, or a change to any other approval-bound surface.

## Foundation gate

At baseline and before closing a documentation or product-operations slice:

1. Inspect the dirty checkout and declare the files owned by the slice. Never clean or stage unrelated work.
2. Run `npm run docs:verify` to check canonical navigation and backlog integrity.
3. Re-read the four canonical perspectives above and resolve high-severity contradictions before accelerating the next slice.
4. Record remaining gaps as dated evidence, not as implied healthy state.

## Urgent Repairs

An urgent reliability or security repair may bypass design review only when its reason, scope, rollback, and verification are recorded in the slice evidence or release manifest. The bypass does not expand authority for provider, base-model, data-use policy, pricing, recording-limit, onboarding, or App Store submission changes.

## Hybrid Learning and Promotion

Safe prompt, schema, and normalizer changes may auto-promote only after declared quality, critical-error, reliability, latency, cost, canary, lineage, and rollback gates pass.

The user who recorded a note is the only human evaluator; there is no Mike, employee, contractor, or external-review queue. Ambiguous user labels are quarantined automatically: they are excluded from promotion evidence and automated learning until they can be classified without inventing a label. Quarantine is not a request for a recurring human review queue.
