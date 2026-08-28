# Intent Map

Checked: 2026-08-27. Scores are evidence-weighted prioritization, not keyword volume, rank, or forecast. `Traffic potential` remains unknown without App Store Search, Apple Ads, or search-console data.

| Intent family | Audience/job | Evidence and observed language | Product relevance | Proof strength | Observed recurrence | Competition signal | Conversion continuity | Traffic potential | Rank | Destination |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| Voice to task list | A person turns a spoken plan into usable next actions while moving | Throughline explicitly promises structured to-dos; public competitors repeatedly use voice-to-tasks, task cards, reminders, and actionable plans. Source: [Throughline](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241), [VoiceTasks](https://apps.apple.com/us/app/voice-to-do-list-voicetasks/id6782167685), checked 2026-08-27. | 3 | 3 | 3 | 3 | 3 | unknown | 1 | Default page; first owned-search page |
| Voice notes for AI agents | An agent user wants captured spoken context available for later read-only retrieval | Throughline listing and connection guide explicitly describe agent-readable notes through owner-controlled MCP. Agent-name queries are not independently observed. Source: [Throughline](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241), [agent connection](../../../docs/agent-connect.md), checked 2026-08-27. | 3 | 3 | 2 | 1 | 3 | unknown | 2 | Agent/MCP custom page; technical owned page |
| Durable voice memory / personal knowledge | A person wants usable structured context rather than an audio archive | Throughline promise and public listing support durable notes plus agent reading; competitor language uses searchable libraries, linked notes, and organization. Source: [product charter](../../../docs/PRODUCT.md), [Voice Inbox AI](https://apps.apple.com/us/app/voice-inbox-ai/id6760556777), checked 2026-08-27. | 3 | 2 | 2 | 2 | 2 | unknown | 3 | Technical owned page after proof exists |
| Voice capture while walking, driving, or thinking | A person needs capture when typing is impractical | Product charter names driving, walking, and thinking; public competitor language also names driving and walking. Source: [product charter](../../../docs/PRODUCT.md), [Tudo](https://apps.apple.com/us/app/tudo-ai-voice-to-do-planner/id6757683912), checked 2026-08-27. | 3 | 2 | 2 | 2 | 2 | unknown | 4 | Default page creative and broad owned page |
| MCP notes / MCP memory | A technical user seeks a personal MCP source | The remote MCP endpoint and read-only tools are repository-documented; no App Store autocomplete or volume evidence was collected. Source: [agent connection](../../../docs/agent-connect.md), checked 2026-08-27. | 3 | 3 | 1 | 1 | 2 | unknown | 5 | Agent/MCP custom page only after proof review |

## Excluded Intent

- `meeting recorder`, `meeting transcription`, `team transcription`, and generic `AI productivity`: product mismatch or excessive ambiguity.
- Reminders, calendar sync, automatic task writes, multi-app integrations, native Claude/ChatGPT/Codex/Cursor integrations: unsupported or not verified as current product behavior.
- Agent-name landing-page permutations: unobserved demand and thin-content risk. A named-agent workflow can be a single technical section only where the user-operated MCP setup is accurately demonstrated.

## Evidence Method And Limits

Source: public US App Store listing and named public competitor listings. Checked: 2026-08-27. App Store autocomplete/search results could not be inspected through a reliable public interface in this workstream; mark it **Unavailable**. Public listing language is an `observed_signal`, not a claim about market demand or competitor performance.

Selected direction: prioritize `voice to task list` as the broad acquisition entry, then reveal agent-readable context as the differentiated proof. Keep `MCP` out of a broad first-frame search promise and use it after the concrete outcome. This direction is a **hypothesis** pending first-party query and product-page evidence.
