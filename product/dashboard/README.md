# Throughline founder dashboard

The dashboard is a private, self-contained HTML snapshot generated from:

- `.throughline/product-learning/latest.json` for canonical product usage and quality metrics.
- `product/dashboard/external-snapshot.json` for aggregate App Store and production-canary status.
- `product/metrics.md` for KPI definitions and readiness floors.

Generate it with:

```bash
npm run product:dashboard
```

The output is `.throughline/dashboard/index.html`. It contains only aggregate metrics—never user identifiers, recordings, transcripts, note content, feedback text, or credentials.

Before a recurring review, refresh the canonical report with `npm run product:weekly`, update the aggregate external snapshot from verified sources, and regenerate the dashboard.
