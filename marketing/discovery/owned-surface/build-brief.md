# Owned discovery surface build brief

**Decision:** approved static implementation, 2026-08-27.

## Files and assets

- `docs/index.html`: main page with image-backed full-bleed hero, three-step proof, workflow/trust, resources, footer.
- `docs/voice-to-task-list/index.html`: differentiated task-output page with its own image-backed full-bleed hero, mechanics, trust, resources, footer.
- `docs/assets/discovery/throughline-proof-poster.png`, `record.png`, `structure.png`, `agent-read.png`: 1284x2778 copies of the approved public App Store PNGs.
- `docs/assets/discovery/throughline-proof.mp4`: blocked; no source video exists, so no video element is used.

## HTML contract

- Semantic `header`, `nav`, `main`, `section`, `figure`, and `footer` landmarks.
- One `h1` per page; descriptive alt text for every product image.
- Main page includes canonical, robots, Open Graph, Twitter metadata, and `SoftwareApplication` JSON-LD with only public product facts.
- Page metadata uses the canonical GitHub Pages URL. The App Store CTA uses exactly `https://apps.apple.com/app/apple-store/id6774304241?pt=128635316&ct=website-aug26&mt=8`.
- Header and footer link to the GitHub-hosted agent connection guide, local privacy and support pages, and the attributed App Store URL.

## Presentation contract

- White and near-white grounds, near-black text, cool gray rules, and sparse `#2563EB` actions.
- No gradient, orb, floating section card, oversized empty hero, external dependency, JavaScript, or generated product UI.
- The approved public PNG proof is clipped into the image-backed hero composition without a gradient or text card. Static `px` font sizes change only at explicit media-query breakpoints; no `vw` typography is used.
- `prefers-reduced-motion: reduce` removes transitions; focus styles remain visible.
