# DISC-05 Blockers

Checked: 2026-08-27.

| Blocker | Status | Effect | Resolution owner / next verification |
| --- | --- | --- | --- |
| Fresh App Store Connect Analytics baseline is unavailable. | blocked | Cannot report current impressions, product-page views, downloads, conversion, source type, campaigns, PPO, or CPP data. | Mike/account-authorized operator: export aggregate App Analytics by named source and date window; retain only safe aggregates. |
| Recorded PPO state is historical and not freshly rechecked. | blocked | No successor PPO, metadata change, or result interpretation is safe. | Mike/account-authorized operator: inspect review/run state and current page state before selecting next App Store action. |
| Current Apple Ads estimates and search-term reports are unavailable. | blocked | No bid, cost, demand, or spend claim is valid. | Mike/account-authorized operator: obtain account estimate only after deciding whether to review the packet. |
| Accepted current-build synthetic proof capture is unavailable. | blocked | No SEO/CPP/PPO asset can accurately demonstrate the loop yet. | Owned-surface lead and proof-factory lead: deliver reviewed synthetic-data capture; Mike decides design/publication. |
| Public search autocomplete and first-party web-search data were not available in this workstream. | blocked | Query priority is product-fit ranking only; no volume/rank claim. | Owned-surface lead: add compliant first-party search evidence when accessible. |
| Apple campaign links and CPP URLs cannot be assumed or hand-authored. | blocked | Attribution map uses labels only, not invented destination URLs. | Mike/account-authorized operator: generate/reconfirm Apple links in App Store Connect before distribution. |

None of these blockers authorizes a workaround, account mutation, publication, submission, activation, or spend.
