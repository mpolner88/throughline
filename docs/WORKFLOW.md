# Throughline Slice Workflow

This workflow governs bounded product slices. It complements the canonical-source map in `AGENTS.md`; it does not create a second source of backlog or metrics truth.

## Required Slice Record

Each slice records:

- one user problem;
- evidence;
- one primary metric;
- guardrails;
- non-goals;
- authority class;
- rollback; and
- an evidence/release manifest.

Metrics definitions and interpretation remain in `product/metrics.md`; priority remains in `product/backlog.json`.

## Lifecycle

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

## Urgent Repairs

An urgent reliability or security repair may bypass design review only when its reason, scope, rollback, and verification are recorded in the slice evidence or release manifest. The bypass does not expand authority for provider, base-model, data-use policy, pricing, recording-limit, onboarding, or App Store submission changes.

## Hybrid Learning and Promotion

Safe prompt, schema, and normalizer changes may auto-promote only after declared quality, critical-error, reliability, latency, cost, canary, lineage, and rollback gates pass.

The user who recorded a note is the only human evaluator; there is no Mike, employee, contractor, or external-review queue. Ambiguous user labels are quarantined automatically: they are excluded from promotion evidence and automated learning until they can be classified without inventing a label. Quarantine is not a request for a recurring human review queue.
