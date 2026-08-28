# DISC-04 Blockers

**Checked:** 2026-08-27

| ID | Status | Blocker | Evidence | Required resolution | Owner |
| --- | --- | --- | --- | --- | --- |
| B-01 | `resolved` | The selected owned-site destination is publicly root-verified. | [Baseline postflight](../_run/baseline.md); Pages build `1179780269` | Recheck after future destination changes. | Root coordinator |
| B-02 | `blocked` | Current-build synthetic proof export has not been directly inspected for this seeding packet. | [Creator kit](../proof-factory/creator-kit.md) is `planned` | Inspect the real current-build synthetic proof and confirm the claim/visual boundary. | Proof Factory / root coordinator |
| B-03 | `blocked` | Creator-specific attribution requires a future approved Apple campaign label or refreshed verified campaign destination. | [Attribution map](../demand-capture/attribution-map.md) | Mike approves the exact source, label, and destination after availability is verified. | Mike |
| B-04 | `blocked` | Detailed r/modelcontextprotocol and r/PKMS rules were not visible from direct anonymous rule-page inspection. | [Community map](community-map.md) | Mike approves a current local-rule check or moderator question before any contribution. | Mike |
| B-05 | `planned` | No exact public outreach route, compensation arrangement, or rights agreement is defined for any row. | [Outreach drafts](outreach-drafts.md) | Mike approves each item individually before a route or terms are considered. | Mike |
| B-06 | `blocked` | First MCP tool use remains a measurement coverage gap. | [Metrics](../../../product/metrics.md) | Do not report it as zero or use it as the pilot outcome; retain it as unavailable. | Product measurement |

## No-Workaround Rule

Missing proof, local rules, terms, or attribution is not permission to substitute an unverified link, generic campaign token, inferred rule, or unapproved incentive. The destination blocker is resolved; every remaining gate still defers the corresponding action.
