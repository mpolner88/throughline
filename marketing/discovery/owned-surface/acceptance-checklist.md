# Owned discovery surface acceptance checklist

**Checked:** 2026-08-27

## Scope and evidence

- [x] Decision record says `approve`, includes 2026-08-27, and lists the exact static scope.
- [x] Copy separates verified current facts, repository assertions, hypotheses, planned work, and blockers.
- [x] Only the three accepted public 1.0.4 screenshots are used for PNG proof.
- [x] Internal 1.0.5 is not represented as public proof.
- [x] No raw audio, transcript, note text, feedback, credential, token, or identifier is introduced.

## Implementation requirements

- [x] Main and task pages are semantic, distinct, useful, indexable, and have an App Store CTA.
- [x] Each page links to agent connection, support, privacy, and the exact website campaign URL.
- [x] Main page includes canonical, robots, Open Graph, Twitter, and `SoftwareApplication` JSON-LD metadata.
- [x] CSS has visible keyboard focus and a reduced-motion rule; the pages need no JavaScript.
- [x] The first viewport contract includes product, category, outcome, CTA, real proof, and next-section hint.

## Verification record

- [x] Local HTTP status and asset checks returned `200` for both product pages, privacy, support, and the hero PNG.
- [x] Source requirement and forbidden-claim scans passed; no public `fastest`, native-integration, or write-back claim is shipped.
- [x] PNG dimensions are `1284x2778`; scoped `git diff --check` passed.
- [x] Playwright passed at true `390x844`, `768x1024`, `1440x900`, and `1728x1117` viewports for both pages, with loaded images, one H1, valid JSON-LD, visible keyboard focus, working internal links, exact viewport width, no horizontal overflow, no hero collision, and the next section beginning at `812.5px` mobile and `856px` elsewhere.
- [x] Deployment: Pages build `1179780269` reports `built` from commit `1770db3`; public home, task page, campaign CTA, and hero image passed postflight.
