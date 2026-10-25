# Throughline Plus offer surfaces — design candidates (TL-PREM-001)

**Verified:** 2026-10-25. **Author:** Claude Code (design only). **Tandem stage:** `candidates_ready`, then `awaiting_mike_selection`. **Backlog:** TL-PREM-001 (`collecting_evidence`, slice phase `baseline`). The Phase 0 decisions in the [brief](../slices/premium-subscription.md#phase-0--mike-only) (price, recording limit, processor and priority) are not yet recorded. These candidates are the brief's Phase 1b design work. Selecting one does not approve those decisions or build entry. No production app, backend, prompt, schema, pricing or release file was changed.

- Checkout: `throughline-local`, branch `claude/paid-tier-scope`, HEAD `5afdb3f79787a99da098eea12e01dc77662194a0`. There are no `ios/`, `supabase/` or `core/` changes since `eabb79c`.
- Candidates: [mockup/plus-offer/candidates.html](../../mockup/plus-offer/candidates.html), SHA-256 `c756c3ada56b27cf48206dd78a70c2a119354eb0523d5e5d731bec112803685a`. Use `?only=<frame>` for one frame, plus `&theme=dark`, `&ax=1` for larger text, `&w=375&h=667`, and `&check=1` to report clipped containers in the page title.
- Assets: [SHA256SUMS.txt](../../mockup/plus-offer/SHA256SUMS.txt) covers 63 entries: the page, 3 current-flow captures and 59 reference renders.

## Design brief

**User problem.** Throughline needs one honest way to offer longer recordings. The offer must:
- state the single difference (5 → 30 minutes) and the price;
- meet Apple guideline 3.1.2;
- never interrupt capture.

Today a free recording stops at 5:00 and saves with no message. Someone talking on a drive may not notice that the rest went unrecorded.

**Current-flow evidence** (labelled by provenance):

| Evidence | Provenance | Shows |
| --- | --- | --- |
| [home-light-sim.png](../../mockup/plus-offer/current/home-light-sim.png) | Simulator, iPhone 17 Pro, iOS 26.3.1, Debug build of `eabb79c` source, synthetic preview (`--throughline-preview-home --throughline-preview-populated-home --throughline-preview-running=today`), light | Home running list; the recorder reads "Agree and record" before AI consent |
| [recording-light-sim.png](../../mockup/plus-offer/current/recording-light-sim.png) | Same build, `--throughline-preview-empty-home --throughline-preview-empty-home-recording` | Recorder reads "Stop recording", "0:18 / 5:00", "Listening… Tap when you're done" |
| [settings-light-sim.png](../../mockup/plus-offer/current/settings-light-sim.png) | Same build, `--throughline-preview-ai-settings` | Native form with lowercase section headers: account, voice notes, agent, feedback, legal. No plan section. AI shown as off |
| `HomeView.swift` `.onChange(of: recorder.elapsedSeconds)` | Source at `5afdb3f` | At `maxRecordingSeconds` the recorder calls `stopAndUploadRecording()`; there is no cap-specific message |
| `SharedComponents.swift` `AccountSettingsView` | Source | Delete account and sign out use `confirmationDialog`; the existing sections listed above |
| `CaptureTrayView.swift` | Source | "Saved to your account." and "Structuring your note…" after a recording |

**Gaps.**
- There is no physical-device, TestFlight or production evidence for these surfaces.
- Apple's purchase sheet is a system surface and is not mocked.
- Prices are placeholders. The app shows StoreKit's localized price; long localized prices are untested.
- Large-text renders use about 135% scale; full accessibility sizes need a device check.
- A hosted Terms of Use (or Apple's standard EULA link) does not exist yet. This is an owner task in the brief.

**Canon fit.** Native where trust matters: the payment sheet, Settings and confirmation dialogs. Sentence case, no exclamation points, no urgency or countdowns. Blue appears only on the primary action, links and, in candidate B, the Plus length bar. The copy uses walk and drive.

**Metric.** Eligible users who start and retain Plus, reported as counts at current scale. The funnel uses `offer_shown` (surface), `purchase_started` and `purchase_completed`.

**Guardrails.**
- Free recording-completion rate unchanged.
- Zero lost captures.
- No offer during capture.
- `offer_dismissed` stays content-free.

**Non-goals.**
- Trials, discounts or annual plans.
- Portability or any other Plus benefit.
- RevenueCat Paywalls.
- Changes to onboarding, the recorder's shape, processing, or the free limit.

**Authority.** Mike selects a candidate and the final product name. Codex implements. Price, limit, processor and data-use changes need Mike's explicit Phase 0 approval.

**Rollback.** The server switch `THROUGHLINE_PLUS_ENABLED` hides every surface, and the 5:00 cap and the Settings form return to today's behavior.

## Rules every candidate keeps

1. **One-time sheet.** It is shown once per account, recorded on the server as `plus_offer_shown_at`. It appears at the first calm moment after a processed note: Home in front, no recording in progress, no other sheet, and the new note visible. It never appears for Plus users, when the switch is off, or before a StoreKit price has loaded.
2. **Copy works for existing users.** It says "Your note is saved." and never "first note".
3. **Disclosures.**
   - The price is in the button and in a terms line: "$4.99 a month. Renews monthly until you cancel in Settings."
   - "Restore purchase · Terms of Use · Privacy Policy" are 44 pt links.
4. **One dismissal.** "Not now" and swipe down both send `offer_dismissed`, and neither changes the free limit or schedules another sheet.
5. **The cap never interrupts.** At 5:00 the recording saves exactly as today. No sheet opens at the cap.
6. **Plus changes one thing.** The recorder detail reads "/ 30:00", and a Plus recording that reaches 30:00 saves with no offer.
7. **Large text.** The sheet uses the large detent at large text sizes and on small phones. The body scrolls under pinned actions, so the price, terms and buttons stay visible.

## Candidates

| | A — Plain terms | B — Show the length | C — A note from the maker |
| --- | --- | --- | --- |
| Sheet | Fitted medium sheet: eyebrow, "Talk for up to 30 minutes.", one paragraph, terms, button | Large sheet: "Keep talking through the whole drive.", two lengths on one scale ("a thought at a red light", "the whole drive to work"), "work the same on free and Plus" | Short letter in Mike's voice: what is free, what Plus adds, "it helps me keep building Throughline", signed |
| After "Not now" | Closes | Closes | Optional one-tap reason in the same sheet: "5 minutes is enough", "Too expensive", "Maybe later", "Something else"; Skip |
| Settings | New top "plan" section: Throughline Plus row (opens the sheet), restore, "You're on free" footer | Section named "recording length" with a miniature scale; "Get 30 minutes with Plus" | Same as A |
| At the 5:00 cap | One line in the recorder's existing supporting text: "Stopped at 5:00 and saved. Plus records up to 30 minutes. See Plus" (until the next recording) | Provenance on the note itself: the card says "Stopped at 5:00, the free limit"; the note detail explains that anything after 5:00 wasn't captured, with "See Plus" | Same slot as A, in the maker's voice |
| Strength | Lowest risk and most native at the payment moment; shortest | Most persuasive; honest about truncation, and that stays with the note | Best for the second goal, learning why people pay or don't; personal and honest |
| Risk | Least memorable | New chart pattern; a long blue bar could read as the brand underline; longest sheet (scrolls at 375×667); needs a per-note "stopped at cap" field | Puts Mike's name in the product; adds a `reason` field to `offer_dismissed`; a second step after dismissal |
| Frames | `a-sheet` `a-settings-free` `a-settings-plus` `a-cap` | `b-sheet` `b-settings-free` `b-settings-plus` `b-cap` `b-cap-detail` | `c-sheet` `c-reasons` `c-cap` `c-settings-free` |

The shared frames are drawn in A's layout, and B and C use the same behavior and copy in their own sheets: `s-loading`, `s-buying`, `s-success`, `s-failed`, `s-pending`, `s-offline`, `s-recording-plus`, `s-plus-cap`, `s-ending`, `s-billing`, `s-restore-none`, `s-signed-out`, `s-unknown`, `s-delete`.

**Recommendation: A, with C's one-tap reason after "Not now".**
- A keeps the payment moment native and short, which is where trust matters most.
- C's reason tap serves the slice's second goal, learning whether and why people pay, with no content collected, and it can be separated from C's letter.
- B's note-level "stopped at 5:00" provenance is the strongest idea for honesty about truncation. Mike may want it in place of A's recorder line, but it needs a per-note field and adds a line to capped note cards.
- C's signed letter is Mike's call, since it puts his name in the product.

This is a recommendation, not a selection.

## State and accessibility coverage

| State | Frame | Copy and behavior |
| --- | --- | --- |
| Price loading | `s-loading` | Opened from Settings only: "Loading price…", button disabled. The first-note sheet waits for a price |
| Purchasing | `s-buying` | "Subscribing…" with a spinner; Not now held until Apple returns |
| User cancels in Apple's sheet | Annotation | Returns to the ready sheet with no message |
| Purchased | `s-success` | "You're on Plus." / "Each recording can now run up to 30 minutes. You can manage or cancel it any time in Settings." / Done |
| Failed | `s-failed` | "The purchase didn't go through. You haven't been charged." / Try again |
| Ask to Buy pending | `s-pending` | "Waiting for approval." Plus is not granted until approved |
| Offline | `s-offline` | "You're offline. Subscribing needs a connection." Subscribe disabled; Not now works |
| Signed out | `s-signed-out` | "Sign in to subscribe. Plus belongs to your Throughline account." |
| Status unknown | `s-unknown` | Last known status shown with "try again"; recording limits follow the server |
| Cancelled, still active | `s-ending` | "Ends 25 November. Recordings go back to 5 minutes after that." |
| Billing retry | `s-billing` | "Apple couldn't renew it. Plus stays on while Apple retries." |
| Nothing to restore | `s-restore-none` | "No Plus subscription found for this Apple Account." |
| Delete account | `s-delete` | The existing dialog adds "Deleting your account doesn't cancel Throughline Plus. Cancel it in Apple settings to stop being charged." and a Manage subscription option |
| Recording with Plus | `s-recording-plus` | "12:04 / 30:00" in the existing detail line |
| Plus reaches 30:00 | `s-plus-cap` | "Stopped at 30:00, the longest a recording can run, and saved." No offer |
| Dark | Key frames | `*-dark-390x844.png`; the sheet uses the elevated surface `#1C1C1E` |
| Larger text | Key frames | `*-ax-light-390x844.png`. Medium sheets switch to the large detent; no clipping (checked with `&check=1`) |
| Small phone | Sheets | `*-light-375x667.png`. B's body scrolls about 44 pt under pinned actions; others fit |
| VoiceOver | All | The sheet is modal and the heading is read first. The terms line is read before the button, and the button label includes the price. B's chart is one image element: "Free recordings run up to 5 minutes. Plus recordings run up to 30 minutes." C's chips are buttons in a "Reason" group. Settings rows are native cells |
| Reduce Motion | All | System sheet presentation only; the success state replaces content without animation |
| Non-gesture paths | All | "Not now" duplicates swipe-down. The legal links, See Plus and the chips are 44 pt targets |

## Questions for Mike

1. **Selection:** A, B, C, a hybrid (for example the recommendation), or none.
2. **Product name:** "Throughline Plus" is the working name.
3. **Candidate C only:** whether the letter is signed, and how.

## Codex feasibility questions

1. **F1 Calm moment.** Can Home reliably detect the conditions in rule 1? Should `plus_offer_shown_at` be written when the sheet is presented, for at-most-once delivery, or after it is seen?
2. **F2 Price gate.** Should presentation wait for the RevenueCat offering? Is the localized price and period string for "Subscribe for {price}/month" correct in every storefront?
3. **F3 Purchase results.** Map RevenueCat's results (cancelled, failed, pending, success) to `s-buying` through `s-pending`.
4. **F4 Settings status.** Which fields drive the status rows: renewal date, will-renew, billing issue? Should display follow `CustomerInfo` or the server mirror, while limits always follow the server?
5. **F5 Manage and restore.** Use the system manage-subscriptions sheet, not a URL. What are the restore result states?
6. **F6 Cap provenance (B).** Can "stopped at cap" be derived from recorded duration with no schema change, or does it need a note field?
7. **F7 Reason event (C or the hybrid).** Add a fixed `reason` enum to `offer_dismissed`, with no free text.
8. **F8 Delete dialog.** Add a Manage subscription option to the existing `confirmationDialog`.

## Next

Mike selects. After selection, Claude records it here and writes the handoff from [the template](../templates/UI_DESIGN_HANDOFF.md) with frozen assets. Codex then reviews it for feasibility (F1–F8). The Phase 0 decision-log entries need Mike's explicit approval separately.
