# Throughline ASO and traffic plan

Date: August 14, 2026

## What is being tested now

The submitted screenshot Product Page Optimization test is a randomized Apple experiment: 50% control and 50% treatment. Apple's treatment conversion and confidence are the causal read. A pre/post comparison is only supporting context because traffic mix changes over time.

Do not change the icon, name, subtitle, description, keywords, screenshots, price, or onboarding while interpreting the screenshot test. Once Apple approves the treatment, start it and let it run for at least 14 complete UTC days unless Apple reports a conclusive result earlier. If it remains underpowered at 90 days, label it inconclusive.

## Priority order

### P0 — Generate qualified App Store traffic

1. Launch the owned Throughline X account.
2. Use the `x-organic-aug26` App Store campaign link on download-oriented posts.
3. Publish three proof-oriented posts per week and two learning/conversation posts per week.
4. Log every post in `marketing/experiments/experiment-ledger.csv`.
5. Judge the channel on Apple-attributed downloads plus cohort-wide activation, not clicks alone.

Apple campaign reporting becomes visible only after at least five people download through that campaign link. Until then, report the channel as below threshold rather than zero-performing.

### P1 — Finish the screenshot experiment cleanly

- Start the approved 50/50 test.
- Primary metric: Apple Product Page Optimization conversion-rate lift and confidence.
- Guardrails: production canaries, crash rate, and recording failure rate.
- Secondary context: impressions, product-page views, downloads, and official conversion rate before and during the test.
- Do not attribute an acquisition spike to screenshots; randomization separates the screenshot effect from traffic growth.

### P1 — Prepare two intent-matched custom product pages

Build these after the screenshot test is running and the X channel can plausibly send at least five downloads to a page:

1. **Structured to-dos** — for personal productivity and voice-note traffic. Lead with “Voice notes in. Clear to-dos out.”
2. **Agent memory through MCP** — for technical and agent-builder traffic. Lead with “Your voice notes, readable by your agent.”

Each page should have a unique campaign URL and channel-specific screenshots. Custom product pages can be matched to App Store search keywords, but each page must clear Apple review and needs enough downloads for useful reporting.

### P2 — Metadata test after the screenshot test

Do not change metadata during the live screenshot experiment. For the next app version:

- Keep the first sentence concrete: voice note → structured to-dos → agent-readable memory.
- Audit the 30-character app name and subtitle as a combined search-and-conversion surface.
- Use the 100-character keyword field for distinct search terms not already present in the name/subtitle.
- Remove competitor product names and trademarks from the keyword field.
- Avoid duplicated words, plurals of existing keywords, category names, and the word “app.”
- Use promotional text for conversion messaging and current news; it does not affect search ranking.

Candidate search-intent groups to validate before submission:

- Capture: voice memo, dictation, speech to text
- Output: task list, to do list, action items, notes organizer
- Knowledge: personal knowledge, memory, ideas
- Agent: AI assistant, MCP

The final keyword string should be selected from current search demand and competitive difficulty, not stuffed with every candidate.

## Decision framework

| Layer | Source of truth | Decision |
|---|---|---|
| Traffic | Apple campaign analytics | Which channel creates first-time downloads? |
| Store conversion | Apple PPO | Which screenshot set converts better? |
| Activation | Supabase/PostHog aggregate funnel | Do acquired users reach a processed recording within 24 hours? |
| Retention | Mature activated-user cohorts | Do users return on days 2–7? |

At current scale, traffic creation is the operating priority. ASO conversion improvements still matter, but even a meaningful relative conversion lift produces few incremental users when impressions and product-page visits are sparse.

## Official references

- Apple Product Page Optimization: https://developer.apple.com/app-store/product-page-optimization/
- Apple custom product pages: https://developer.apple.com/app-store/custom-product-pages/
- Apple campaign links: https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links
- Apple product-page metadata: https://developer.apple.com/app-store/product-page/

