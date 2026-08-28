# Discovery Model Routing

This file maps Mike's model aliases to work shape. The underlying provider model IDs and prices stay in the private queue-runner configuration so prompts remain portable.

## Routing Table

| Alias | Effort | Use | Do not use for |
| --- | --- | --- | --- |
| `5.6-sol` | `high` | root coordination, cross-stream decisions, ambiguous strategy, final integration, sensitive claim review | repetitive research collection, bulk transformations |
| `5.6-terra` | `high` | workstream leads, implementation plans, platform gap analysis, creative direction, difficult copy or review | mechanical inventories that Luna can perform |
| `5.6-terra` | `medium` | bounded audits, routine implementation, focused synthesis with frozen inputs | unresolved policy, authority, or canonical conflicts |
| `5.6-luna` | `medium` | source gathering, classification, prospect fit evidence, metadata candidates, repurposing, checklist QA | final judgment, public claims, experiment conclusions |
| `5.6-luna` | `low` | schema validation, file inventory, deterministic formatting, link collection | analysis with material ambiguity |

## Cost Policy

1. Route a job to the least expensive tier that can meet its acceptance contract.
2. Split expensive reasoning from inexpensive production. Terra freezes the rubric, Luna applies it, and Terra reviews exceptions.
3. Do not ask five models for competing opinions when one owner and one reviewer can settle the work.
4. Cache current-source research in a dated evidence manifest so downstream workers reuse it.
5. Derive many channel assets from one approved proof kernel instead of regenerating the thesis for every format.
6. Escalate only the ambiguous fragment, not the entire job.

## Sol Triggers

Move only the disputed decision to `5.6-sol/high` when:

- canonical sources conflict;
- a worker cannot distinguish shipped behavior from planned behavior;
- comparative, privacy, safety, directory, or integration claims are ambiguous;
- platform requirements imply product or authentication changes;
- two workstreams want overlapping file ownership;
- experiment results are below readiness floors or point in opposite directions;
- Mike needs a bounded options packet.

## Terra Triggers

Use `5.6-terra/high` for:

- one complete workstream plan;
- a platform or App Store readiness audit;
- information architecture or conversion narrative;
- a full proof-kernel package;
- creator-seeding strategy and individualized briefing;
- a test design with metrics, guardrails, and stop conditions;
- implementation or review whose failure would be publicly visible.

Use `5.6-terra/medium` when the inputs, schema, and expected output are already frozen.

## Luna Triggers

Use `5.6-luna/medium` for:

- collecting first-party source links and dates;
- mapping search language, creator fit evidence, or community rules;
- applying an existing scoring rubric;
- transforming an approved script into platform-native candidates;
- assembling metadata or asset inventories;
- running visual, link, claim-status, and format checklists.

Use `5.6-luna/low` only for deterministic checks with no interpretive conclusion.

## Review Pairing

| Producer | Reviewer | Required when |
| --- | --- | --- |
| Luna | Terra lead | output influences public copy, targeting, or prioritization |
| Terra | Evidence and Learning Auditor | output makes a current claim or experiment recommendation |
| Terra lead | Sol director | output crosses workstreams or reaches a Mike gate |
| Sol director | Mike | output requires product/design taste, submission, spend, publish, or external action |

## Context Budget

Each worker receives:

- the workstream prompt;
- the design spec;
- the one workstream plan;
- only the canonical and prior-output files listed in `inputs`;
- the exact `write_scope` and `acceptance` contract.

Do not inherit the whole coordinator conversation. If a user decision is essential, quote it in the job's `decision_context`.

## Private Runner Configuration

The queue runner resolves aliases outside git, for example:

```json
{
  "5.6-sol": "private-provider-model-id",
  "5.6-terra": "private-provider-model-id",
  "5.6-luna": "private-provider-model-id"
}
```

Tracked files must never contain provider credentials, billing identifiers, private endpoints, or secret model configuration.
