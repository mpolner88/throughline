# Product operations

This directory holds Throughline's canonical product metrics and prioritized backlog. It turns privacy-safe evidence into bounded product work; it does not retain user content or duplicate slice governance. For the required slice record, authority classes, and lifecycle, see [the workflow](../docs/WORKFLOW.md).

## Evidence and analysis

- **Canonical first-party evidence:** Supabase. The private report reads its aggregate product data and is the source for readiness and missing-coverage findings.
- **Interactive analysis copies:** PostHog. Use it to explore instrumented behavior, but confirm a decision with the privacy-safe Supabase report when its event coverage or population differs.
- **Acquisition:** App Store Connect. Until an install-to-account join exists, download-to-auth is a same-window acquisition proxy, not a matched-user conversion rate.

Run the report and its focused test from the repository root:

```bash
npm run product:weekly
npm run product:weekly:test
```

Reports are written to the ignored `.throughline/product-learning/` directory. They must stay aggregate and content-safe: never commit audio, transcripts, note or feedback text, email addresses, credentials, or raw user/session identifiers.

## Interpretation and backlog updates

1. Check the report's population, event coverage, and readiness before interpreting a movement.
2. Keep `internal` and `external` cohorts separate as soon as attribution exists. Until then, label mixed data non-decision-grade.
3. Reconcile event processing counts against durable recordings before using processing outcomes for a decision.
4. Add or refresh the relevant [backlog item](backlog.json) with a dated, aggregate evidence summary, dependencies, authority, one primary metric, guardrail, and next action.
5. Preserve the existing array order unless Mike changes priority; never treat order as automatic authorization. Work an item only through its dependencies, decision gate, approved slice, and evidence/release manifest.

The initial interpretation floors are five newly signed-in users for activation and five mature activated users for retention; decision-grade reporting starts at 20 for each. These are readiness floors, not statistical-significance claims. Definitions, cohort rules, and guardrails are canonical in [metrics.md](metrics.md).
