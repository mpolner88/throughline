# Owned discovery surface blockers

**Checked:** 2026-08-27

| Item | Status | Evidence | Required follow-up | Effect on this static build |
| --- | --- | --- | --- | --- |
| Inspected motion proof | `blocked` | [asset inventory](../_run/asset-inventory.md) confirms no accepted MP4. | Capture record -> structure -> read-only retrieval with the approved synthetic dataset, redact, and visually inspect before use. | No `throughline-proof.mp4`; static image proof proceeds. |
| Browser visual QA | `verified_current` | Root Playwright passed at `390x844`, `768x1024`, `1440x900`, and `1728x1117`; public mobile and desktop postflight also passed after Pages build `1179780269`. | Recheck after future page or asset changes. | No deployment blocker. |
| Website campaign live-account verification | `repository_assertion` | `website-aug26` is marked ready in the tracked campaign CSV. | Root rechecks Apple account state before interpreting attribution. | The approved exact URL is used; no metric claim is made. |
| Search performance data | `blocked` | [owned search portfolio](../demand-capture/seo-portfolio.md) marks demand, impressions, and clicks unavailable. | Collect first-party search data after publication before expanding the page set. | No traffic or rank promise. |
