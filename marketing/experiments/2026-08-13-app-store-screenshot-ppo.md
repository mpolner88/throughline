# App Store screenshot Product Page Optimization test

## Experiment contract

- ID: `20260813-app-store-all-structured-todos-mcp-01`
- Status: `submitted_for_review`
- App: Throughline: AI Voice Notes
- Storefront: United States, English (U.S.)
- Test type: Apple Product Page Optimization
- Allocation: 50% control, 50% treatment
- Maximum duration: 90 days
- Change isolation: screenshots only; do not change the icon, subtitle, description, keywords, price, or onboarding while interpreting this test

## Hypothesis

Leading with the two concrete outcomes—structured to-dos from voice and an MCP-readable source for an AI agent—will make the product easier to understand and increase App Store conversion versus the current screenshot set.

## Variants

### Control

The live App Store product page as of August 12, 2026 UTC.

### Treatment: Structured to-dos + MCP

Upload these six files in this order:

1. `app-store/screenshots/iphone-6.9/01-voice-to-agent.png`
2. `app-store/screenshots/iphone-6.9/02-capture-voice.png`
3. `app-store/screenshots/iphone-6.9/03-voice-to-memory.png`
4. `app-store/screenshots/iphone-6.9/04-most-important.png`
5. `app-store/screenshots/iphone-6.9/05-agent-ready.png`
6. `app-store/screenshots/iphone-6.9/06-private-control.png`

The files are `1284 x 2778`, an accepted iPhone screenshot size in App Store Connect.

## Locked pre-test baseline

Apple data complete through August 12, 2026 UTC:

| Metric | Cumulative | August 12 | August 11 |
|---|---:|---:|---:|
| Impressions | 320 | 59 | 47 |
| Product page views | 30 | 1 | 3 |
| First-time downloads | 5 | 1 | 0 |
| Official conversion rate | 2.29% | 2.44% | unavailable |

Apple's official conversion rate is the source of truth; do not recompute it from the displayed totals because Apple applies its own eligibility and privacy rules.

## Readout rules

- Primary experiment metric: Apple's Product Page Optimization conversion-rate lift and confidence result.
- Secondary pre/post metrics: impressions, product page views, first-time downloads, and official conversion rate.
- Product outcome: total newly acquired users who reach `recording_processed` within 24 hours of `auth_succeeded`.
- Reliability guardrail: do not interpret a growth result while either production canary is failing or recording failure rate is elevated.
- Minimum run: 14 complete UTC days unless Apple reports a conclusive treatment result earlier.
- Maximum run: 90 days.
- Do not stop because of an early percentage swing. At Throughline's current traffic, the test may remain underpowered; record that as inconclusive rather than naming a winner.
- Do not compare a campaign-driven traffic spike with the pre-test period as if it were screenshot lift. The randomized Apple treatment is the causal screenshot read; pre/post is directional context only.

## App Store Connect setup

- Draft created: August 13, 2026
- Reference name: `Structured To-Dos + MCP — Aug 2026`
- Treatment count: 1
- Traffic proportion: 50%
- Treatment screenshot count: 6
- Treatment screenshot order verified: `01`, `02`, `03`, `04`, `05`, `06`
- Submitted to App Review: August 13, 2026
- Review status: submitted; Apple says review can take up to 48 hours
- Current gate: wait for Apple approval, then start the test
- The test has not started.

## Acquisition measurement

Use one App Store campaign link per source. Apple campaign reporting is the channel-level source for impressions, page views, downloads, and any usage metrics Apple makes available after its privacy thresholds are met. PostHog/Supabase remain the source for product activation and retention in aggregate.

The six campaign links are recorded in `marketing/experiments/app-store-campaign-links.csv`. Apple only displays a campaign in analytics after at least five individual Apple Accounts install the app from that campaign link.

Channel-specific `recording_processed` attribution is currently a coverage gap: an App Store campaign link does not reliably carry its campaign token into an installed app. Do not fabricate per-channel activation. Until a privacy-safe attribution mechanism is implemented, evaluate a channel with both its Apple-attributed downloads and the cohort-wide activation rate over the same period.

## Decision labels

- `scale`: treatment is conclusively better and reliability is healthy.
- `keep-control`: control is conclusively better.
- `inconclusive`: neither variant reaches a reliable result by 90 days.
- `invalid`: overlapping metadata/product changes or a reliability incident make the comparison uninterpretable.
