# Throughline App Store Screenshots

**Asset class:** Intentionally tracked release-candidate marketing compositions
**Generator:** `scripts/generate-app-store-screenshots.mjs`
**Regenerate:** `npm run appstore:screenshots`
**Evidence boundary:** These are generated marketing compositions, not captures of the running iOS app. Their presence does not prove device behavior, App Store Connect upload, review, approval, or public delivery.

## iPhone

Generated at the repository's recorded `1284 x 2778` target. Re-verify Apple's current accepted sizes before any upload. Keep this manifest, `source.html`, and all six PNGs together:

1. `01-voice-to-agent.png`
2. `02-capture-voice.png`
3. `03-voice-to-memory.png`
4. `04-most-important.png`
5. `05-agent-ready.png`
6. `06-private-control.png`

`source.html` is the render source used by headless Chrome.

## Tracking and release rule

- Track this directory because the ordered images are reviewable release candidates, not disposable build output.
- Regeneration replaces the PNGs, `source.html`, and this README. Review the combined diff.
- Before release, re-check every product claim against [current state](../../../docs/CURRENT_STATE.md), record the source commit/tree and screenshot hashes in the release manifest, and obtain any required App Store approval.
- Put exploratory or rejected renders outside this directory and keep them untracked.
