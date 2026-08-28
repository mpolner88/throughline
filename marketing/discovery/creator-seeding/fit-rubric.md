# DISC-04 Fit Rubric

**Prepared:** 2026-08-27
**Status:** `planned` selection contract for a maximum 12-person review cohort.

## Scoring Contract

Score each dimension from 0 to 3 using dated public evidence only. `proof_score` and `trust_score` count twice. `risk_score` is inverted: 3 means low observed outreach risk and 0 means high risk. The maximum weighted total is 24.

`weighted_total = topic_score + audience_score + workflow_score + (2 * proof_score) + (2 * trust_score) + risk_score`

| Dimension | 0 = | 1 = | 2 = | 3 = |
| --- | --- | --- | --- | --- |
| Topic recency | No relevant public evidence. | Relevant evidence older than 12 months. | Relevant evidence from the last 6-12 months. | Relevant dated evidence within six months. |
| Audience overlap | Public work is unrelated to individual agent, voice, or knowledge workflows. | Adjacent productivity or general technology audience. | Repeated overlap with one qualified audience. | Clear public focus on qualified individual builders, voice workflows, or personal knowledge. |
| Workflow authenticity | No evidence of a concrete workflow. | General opinion only. | Describes a real tool or repeatable workflow. | Shows or explains a concrete capture, structure, retrieval, or agent workflow. |
| Proof compatibility | The verified Throughline proof cannot answer the apparent audience question. | Only the broad voice-note claim fits. | Structured-note or personal-knowledge proof fits. | The exact synthetic record -> structured note -> read-only retrieval proof fits. |
| Trust | Unclear provenance or undisclosed promotional pattern. | Limited public provenance. | Consistent public technical or workflow material. | First-party technical/workflow material with clear boundaries or disclosures. |
| Outreach risk | Prohibited, unavailable, or clearly inappropriate route. | Material conflict, paid-placement-only signal, or unclear terms. | Public relevance is present but relationship or commercial terms need close review. | Public educational/workflow context with no observed disqualifier; individual approval still required. |

## Disqualifiers

Exclude a candidate before scoring when public evidence shows any of the following:

- `DQ-CONFLICT`: direct product conflict that makes an independent pilot implausible.
- `DQ-PAID-ONLY`: coverage contingent on undisclosed or unapproved paid placement.
- `DQ-GIVEAWAY`: mass-giveaway or engagement-exchange pattern.
- `DQ-UNRELATED`: no qualified audience or workflow fit.
- `DQ-UNDISCLOSED`: repeated undisclosed promotion or material-connection concern.
- `DQ-NO-EVIDENCE`: no dated public fit evidence.
- `DQ-ROUTE`: an available route violates platform rules or requires activity outside this slice.

Only aggregate exclusions belong in tracked artifacts. Do not retain a rejected person's direct-contact details or correspondence.

## Review Rules

- Keep the review cohort at 12 or fewer people; diversity of audience lens is a tie-breaker, not a quota.
- A score is a reproducible fit screen, not a prediction of coverage, audience size, conversion, or goodwill.
- `0` on a required dimension is a review stop unless Mike documents a narrower reason to inspect it.
- Public profile/page URLs identify the evidence source only. A later outreach route must be separately approved and compliant.
- The durable public message is `Voice notes your agent can read.` Do not use comparative wording.

## Verification

`rg -n "0 =|1 =|2 =|3 =|Disqualifier|maximum 12|Mike|No send" marketing/discovery/creator-seeding/fit-rubric.md marketing/discovery/creator-seeding/pilot-brief.md`

Expected result: all anchors and the authority boundary are present. No send is authorized by this rubric.
