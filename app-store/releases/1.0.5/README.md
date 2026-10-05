# Throughline 1.0.5 — App Store release packet

**Prepared:** 2026-10-05 after Mike accepted TestFlight 2026100501 and explicitly requested ASO, upload and public release. **Candidate:** 1.0.5 (2026100502), source `d7f26769a7c28e0bcfed50b8ae0ba61fb4fd6044`. Product code and compiled machine code match the accepted internal build. The public archive restores the existing anon sign-in configuration omitted by the preceding isolated internal archive; no key was created or changed.

## Current status

The verified public package has been uploaded. Submission remains pending two concrete checks: Claude's exact listing/image review (the Mac is locked and Claude CLI is signed out), and a confirmed App Review account (the saved credentials return `email_not_confirmed`). These are verification dependencies, not a request for another release approval. Mike's latest instruction already authorizes the release and accurate ASO work. [Preparation receipt](../../../docs/evidence/2026-10-05-app-store-preparation.md).

## Exact listing

[English metadata](en-US.json), [field counts](field-counts.json), [review notes without credentials](review-notes.txt). Keep the name **Throughline: AI Voice Notes**; subtitle **Turn thoughts into to-do lists** emphasizes the outcome. Refined keywords focus on transcription, dictation, task organization and brainstorming. Claims cover delivered functionality only. No reminders, categories/search, automatic learning, agent task execution or offline transcription are promised. Category, price, regions, support/marketing/privacy URLs remain as configured.

Limits: name 27/30 characters; subtitle 30/30; keywords 99/100 ASCII bytes; promo 140/170; description 1041/4000; What's New 375/4000. Apple's [product-page guidance](https://developer.apple.com/app-store/product-page/), [search guidance](https://developer.apple.com/app-store/search/) and [field reference](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) were checked October 5. Keyword choices are relevance hypotheses, not measured search-volume/ranking gains. Promotional text does not improve search ranking.

## Native screenshot set

Order: Today, saved Notes, capture tray while saving, This week, Later in dark mode. All five are unaltered native captures at 1290 × 2796, accepted in Apple's current [6.9-inch specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/). [Screenshot manifest](screenshots.json), [checksum manifest](SHA256SUMS.txt). They replace the historical marketing compositions, which depicted old UI and reminders.

The isolated simulator uses the exact public source plus the [content-only DEBUG fixture patch](screenshot-fixture.patch). This replaces diagnostic wording with fictional everyday examples; it changes no view, gesture, style, layout or shipping behavior. The patch is excluded from the public archive. Previews are absent from Release. No raw user note, recording, feedback, account or session content is used. Two initial captures were still launch screens and were replaced after rendering; all five final images were visually inspected by Codex. Claude's review remains pending.

## Release and measurement

Use automatic release after Apple approval, as already configured and authorized. Upload, VALID processing, build selection, submission, approval and storefront availability are separate facts. Keep existing review credentials private. Preserve the public 1.0.4 listing until Apple approves the new version; do not change policy, backend, extraction, providers, pricing, limits or Private Evaluation.

After public availability, compare App Store search-source impressions, page views and downloads over matched observation windows. Low volume and the simultaneous product update prevent attributing change to copy alone. This is not an A/B test or proven ASO lift.
