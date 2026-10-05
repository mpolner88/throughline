# Claude review: App Store 1.0.5 listing and screenshots

**Reviewed:** 2026-10-05. **Reviewer:** Claude Code (Claude Opus 5.5), at Codex's request as relayed by Mike. **Commit:** `a396794238b7a62e7933ec574b413c139ac51cb1` on `codex/running-list`. **Packet:** `app-store/releases/1.0.5/`. Its `SHA256SUMS.txt` SHA-256 is `7ca32d2e5d818833babd20e438d645b05af2ee083af247f9bc6d92da575d8acc`.

**Disposition: pass.** There are no P1 or P2 findings, and the listing and all five screenshots may be used as prepared. The five P3 notes below are optional and none blocks submission.

## Scope

This was a read-only review. I did not build, render, use a simulator, spawn agents, edit the packet or source, or take any Apple, account, PR or policy action.

I read the packet files `README.md`, `en-US.json`, `field-counts.json`, `review-notes.txt`, `screenshots.json` and `screenshot-fixture.patch`. I also read `docs/evidence/2026-10-05-app-store-preparation.md`. From the canonical sources I took what applies to a listing:
- `docs/CURRENT_STATE.md` for release and feature facts;
- `docs/PRODUCT.md` in full;
- `throughline-brand-decisions.md` for its copy, voice, wordmark and source-relationship rules.

The packet tree matches `HEAD`.

## Checks

- **Hashes.** All ten entries in `SHA256SUMS.txt` pass `shasum -a 256 -c`, and the five image hashes in `screenshots.json` match them. `README.md` is not in either manifest; it is documentation.
- **Images.**
  - All five PNGs are 1290 × 2796.
  - They are RGBA, but the alpha extrema are (255, 255) in every file, so every pixel is opaque.
  - I inspected all five visually, from copies downscaled to 1100 px tall.
- **Field limits.** These are recounted from `en-US.json` and match `field-counts.json`.

  | Field | Count | Limit |
  | --- | --- | --- |
  | Name | 27 | 30 |
  | Subtitle | 30 | 30 |
  | Keywords (bytes) | 99 | 100 |
  | Promotional text | 140 | 170 |
  | Description | 1041 | 4000 |
  | What's New | 375 | 4000 |

  The keywords are twelve terms with no duplicates and no spaces. None repeats a word from the name or subtitle.
- **Delivered claims.** Every feature claim maps to delivered behavior in the frozen source or in current state:
  - the Running List with Today, This week and Later, complete, move and source note;
  - the capture tray and recovery;
  - transcript review and correction;
  - MCP agent read access, with "Revoke token" in Settings and MCP live since 1.0.4;
  - the 30-second guided demo before sign-in;
  - the AI voice notes setting;
  - account deletion.

  Nothing promises reminders, categories or search, automatic learning, agent write-back or offline transcription. `voice → agent` stays read-only, as `throughline-brand-decisions.md` requires.
- **Brand.**
  - No exclamation points, and none of the avoided words (productivity, optimize, AI-powered, seamless, effortless, smart, "just").
  - No driving use is encouraged in the copy.
  - The screenshots show the lowercase underlined wordmark, the single blue accent and visible source labels on every task.
- **Privacy.**
  - The screenshots hold only fictional tasks, note titles and first names.
  - They show no diagnostic or tester wording, emails, identifiers or account details.
  - `review-notes.txt` contains no credentials or addresses.
  - The fixture patch changes synthetic strings and the preview transcript only. It is DEBUG-only and changes no view, gesture or layout code.
- **Order and readability.** The order is Today, Notes, capture tray, This week, Later (dark). Each image is readable and shows only delivered UI. No DEBUG-only element is visible.

## Findings

**P3-1: the Notes image undercuts the voice-to-structure story.**
- In `02-notes.png`, the grey preview under "drive in" repeats the three to-dos word for word. The fixture builds each transcript by joining the task texts.
- That text is true, but it is the only image that pairs source with structure, and it reads as if nothing was transformed. The brand asks for a concrete before-and-after.
- Optional fix: in a later render, give the fixture natural spoken transcripts, for example "On the way home grab the package, we're out of coffee filters, and I should outline Sunday's review." This is a content-only change.

**P3-2: two of the first three images are near-duplicates.**
- `03-capture.png` is `01-today.png` plus a single tray line ("0:20 On your phone. Saving to your account…").
- The first three screenshots carry the search-results impression.
- Optional fix: swap capture with This week or Later, or capture a tray state with more visible content.

**P3-3: two phrases in What's New overreach slightly.**
- "Undo a change": Undo reopens a completed task; moves have no undo. Suggest "undo a completion".
- "Smoother task swipes and scrolling" is a comparison with public 1.0.4. The measurements and Mike's acceptance were on internal builds, so this is not measured against 1.0.4. It is low risk; "more reliable task swipes" would be strictly supported.

**P3-4: the status bar is not cleaned up.** All five images show a charging battery and empty cellular bars. A `simctl status_bar` override on the next render would tidy this; it is cosmetic.

**P3-5: confirm Apple accepts the RGBA files.** The PNGs carry an alpha channel that is fully opaque. After upload, confirm each screenshot reaches a complete delivery state in App Store Connect. If any is refused for alpha, flatten it to RGB; the pixels would not change.

**Observation (no action).** The keywords "recorder" and "transcription" may draw meeting-recording searches, which `docs/PRODUCT.md` names as a non-goal. The README already treats keywords as relevance hypotheses; watch conversion from search after release.

## Not verified by Claude

- **Apple's live documentation.** I did not fetch Apple's guidance pages. Acceptance of 1290 × 2796 for the 6.9-inch slot rests on Codex's October 5 check and my own recollection.
- **App Store Connect itself:**
  - that the listing fields and screenshots apply exactly as written, checked by read-back after Codex applies them;
  - asset processing (P3-5);
  - the review-account sign-in, which is still `email_not_confirmed` and a separate release check;
  - submission, approval and storefront availability.
- **Fidelity to the build.** I did not compare the screenshots against a fresh render or the uploaded build 2026100502. Codex records that the compiled code matches the accepted 2026100501.
- **Image detail.** I did not inspect the screenshots at full resolution pixel by pixel; the downscaled copies were legible.
- **The app's runtime behavior**, including VoiceOver.

## Addendum: P3-3 correction recheck and final packet hash

**Rechecked:** 2026-10-05. **Reviewer:** Claude Code (Claude Opus 5.5). **Scope:** read-only, narrow. This covers the active, uncommitted packet in `throughline-local` on top of `a396794`. No build, render, simulator, account or Apple action was taken.

- **Changed files.** `git diff a396794 -- app-store/releases/1.0.5` touches only `en-US.json`, `field-counts.json` and `SHA256SUMS.txt`.
  - In `en-US.json` the only changed field is `whatsNew`.
  - Every image, `screenshots.json`, `review-notes.txt`, `screenshot-fixture.patch` and the image order are unchanged.
- **Copy.** Both P3-3 corrections are applied exactly: "undo a completion" and "more reliable task swipes". The second phrase also drops the scrolling comparison. Both phrases are now strictly supported by the delivered behavior. The text has no avoided words or exclamation points.
- **Counts.** What's New is 370 of 4000 characters, and `field-counts.json` records 370. Every other field still matches its recorded count.
- **Hashes.**
  - `en-US.json` is now `8403cc08589c0f8a22c3a591b4b9746821d936e611b89482750d134f8759873a`.
  - `field-counts.json` is now `0c22ebee9b1f268f29376c9513d56f1d94234ad291cecf53a69998db110423df`.
  - All ten entries pass `shasum -a 256 -c`.
  - The new `SHA256SUMS.txt` SHA-256 is `898f1adb7bfb680c6a9683556435c13f3d36401d60d91bd2ac8aaa589b61e10b`, matching the value Mike stated.

**Final disposition: pass** for the packet identified by that manifest hash.
- P3-3 is resolved.
- P3-1, P3-2 and P3-4 remain optional follow-ups.
- P3-5 moves to Codex's post-upload check that all five screenshot deliveries reach COMPLETE.
- The review-account sign-in and the App Store Connect read-back after the listing is applied remain unverified by Claude.
