# Apple Ads Decision Packet

Checked: 2026-08-27. **Activation: not_performed. Spend: 0.** This is an unactivated planning packet. Apple Ads supports search-results campaigns with ad groups, keyword/negative-keyword controls, audience settings, and custom-product-page ad variations. See [Apple Ads campaigns](https://ads.apple.com/app-store/help/campaigns/0005-create-campaigns), [ad groups](https://ads.apple.com/app-store/help/ad-groups/0017-understand-and-create-ad-groups), and [negative keywords](https://ads.apple.com/app-store/help/keywords/0060-use-negative-keywords).

## Preconditions

- Mike approves the exact total cap, daily cap, territory, start/end dates, destination, account use, and activation.
- A current App Store Connect read confirms the product page or approved CPP destination.
- A fresh Apple Ads account estimate informs bids; every bid and cost is **hypothesis** until then.
- A campaign token/destination pairing is recorded before activation.

## Smallest Test Design

Campaign: `DISC05-ADS-001`; placement: US search results; duration: seven calendar days after activation or until the approved total cap is exhausted, whichever is first.

Proposed total cap: `$150` maximum. Proposed daily cap: `$25` maximum. These are planning hypotheses, not an authorization or expected cost.

| Ad group | Match/search setting | Candidate terms | Destination | Why |
| --- | --- | --- | --- | --- |
| `exact-voice-tasks` | exact match; Search Match off | `voice to do list`; `voice tasks`; `voice notes to tasks` | default page initially; CPP-B only after approval | Best continuity with current product proof. |
| `discovery-qualified` | Search Match on; no seeded keywords | Discovery only | same destination as exact group | Learn qualified adjacent language without mixing it into exact read. |

Negative keywords: `meeting recorder`; `meeting transcription`; `team transcription`; `dictation keyboard`; `calendar sync`; `reminder app`; named competitor terms. Start as exact negatives and expand only from an Apple Ads search-term report. Their relevance is a hypothesis until live data exists.

Do not buy agent-name or `MCP` terms in the first paid test: their query demand and ad relevance are unverified. Test them only after the agent/MCP CPP and proof are approved.

## Readout And Stop Rules

Primary metric: Apple Ads first-time downloads by ad group.

Platform diagnostic: product-page conversion and Apple Ads search-term relevance.

Quality guardrail: same-window aggregate new `auth_succeeded` and non-demo first value where cohort coverage and readiness permit; never describe either as matched channel attribution. Recording reliability must remain healthy.

Data caveat: Apple privacy thresholds can suppress campaign/product-page data. Suppressed data is unavailable, not zero. No current bids, CPT, CPA, spend, impression, tap, conversion, or estimate exists in this packet.

Stop rule: stop or do not activate for missing destination/campaign attribution, irrelevant search terms, approved cap exhaustion, App Store rejection, product reliability failure, privacy-threshold-only reporting, or no useful qualified signal at the seven-day review. Do not raise a cap or bid without a separate Mike decision.

Mike approval: required for budget, account action, keyword/bid configuration, campaign activation, and spend.

External actions not taken: no Apple Ads account was opened or changed; no campaign, ad group, keyword, negative, bid, budget, destination, report, or spend was activated.
