# Categories and search — design candidates (TL-KNOW-001)

**Verified:** 2026-10-05. **Author:** Claude Code (design only). **Tandem stage:** `candidates_ready`, then `awaiting_mike_selection`. On 2026-10-05 Mike selected **Candidate B**: "I choose candidate B (an index that writes itself)." The [handoff](../handoffs/2026-10-05-categories-search.md) is held at `selected_pending_codex_feasibility_review`. **Backlog:** TL-KNOW-001 (`collecting_evidence`, depends on TL-DATA-001). No production app, backend, prompt, schema or release file was changed. Codex reviewed handoff revision 1 on 2026-10-05 and requested changes ([review](2026-10-05-categories-search-feasibility.md)). Codex re-reviewed revision 2 on 2026-10-09 and requested changes again ([re-review](2026-10-09-categories-search-feasibility-recheck.md)). Codex found handoff revision 3 feasible on 2026-10-10 ([re-review 2](2026-10-10-categories-search-feasibility-recheck-2.md)). Revision 4 records its two minor clarifications and is `handoff_ready`. Build entry is not approved. See [Codex feasibility questions](#codex-feasibility-questions).

- Checkout: `throughline-local`, branch `codex/running-list`, HEAD `8b30dd8ac3e2847b542189e588d1905e0b3071be`. There are no `ios/`, `supabase/` or `core/` changes since `d7f2676`, which is the app source of the submitted Running List 1.0.5 (2026100502, WAITING_FOR_REVIEW per [CURRENT_STATE](../CURRENT_STATE.md)). Apple state was not refreshed here.
- Candidates: [mockup/categories-search/candidates.html](../../mockup/categories-search/candidates.html), SHA-256 `8e9f05e9fb385feb3ccf85fce3eed8c322b458d2e5512ecebb1ad73eb7fbc826`. Use `?only=<frame>` for one frame, plus `&theme=dark`, `&ax=1` for larger text, and `&w=375&h=667`.
- Assets: [SHA256SUMS.txt](../../mockup/categories-search/SHA256SUMS.txt) covers 43 entries: the page, 3 current-flow captures and 39 reference renders.

## Design brief

**User problem.** Getting back to something you said more than a week ago is hard.
- Notes is one chronological list of full cards. It has no search, no grouping, and no date on the cards (the eyebrow shows `type · time` only).
- Extraction already returns people, projects, topic tags and five life areas for every note, but the app never shows them, apart from the life-area pills on cards.
- The connected agent can already search all of this through the MCP `search` tool. The person cannot.
- Mike's direction (decision log, 2026-09-30): categories are assigned automatically from what was said, and one search finds both notes and to-dos.

**Current-flow evidence** (labelled by provenance):

| Evidence | Provenance | Shows |
| --- | --- | --- |
| [today-light-sim.png](../../mockup/categories-search/current/today-light-sim.png) | Simulator, iPhone 17 Pro, iOS 26.3, Debug build of `8b30dd8`, synthetic preview (`--throughline-preview-home --throughline-preview-running=today`), light | Home running list; "notes" is the only route to older notes |
| [notes-light-sim.png](../../mockup/categories-search/current/notes-light-sim.png) | Same, `=notes` | Flat list of full cards, newest first, time-only eyebrow |
| [source-light-sim.png](../../mockup/categories-search/current/source-light-sim.png) | Same, `=source` | Note sheet; extracted labels are not shown |
| `HomeView.swift` `notesContent`, `CapturedCard`; `RunningListView.swift` | Source at `8b30dd8` | `LazyVStack` of cards; no search; running-list row = circle, text, optional marker, underlined source label |
| `UploadClient.listNotes()`, `AppState` cache, `TaskStore` | Source | All notes (transcripts included) and tasks are held on the phone, so search on the device and offline is feasible |
| `api/index.ts` `assertCurrentMutationFields` | Source | People, projects, tags and areas are not editable today |
| `_shared/memory-tools.ts` `searchableText()` | Source | Agent search covers transcript, summary fields, to-dos and all labels, and returns the matched line |
| `core/inference-contract.mjs`, `evals/prompts/extract-note-v0.md`, labeled fixtures | Source, synthetic fixtures | Tags often repeat a project (e.g. "pricing" next to "pricing page"); "profession" is on about 14 of 16 fixtures; 0–1 people per note |

**Gaps.**
- There is no physical-device, TestFlight or production evidence.
- The preview harness has empty label fields, so the current area pills could not be observed in a capture.
- There is no production fill rate or distinct-label count for any field. Claude did not query production. See question Q8.
- There is no search or retrieval instrumentation yet (`product/metrics.md`, future coverage).

**Canon fit.** Text first, quiet, one blue accent, no new chrome on Home except candidate C's single icon. Labels shown as said. To-dos stay the running-list row. Copy uses "to-dos" and "notes".

**Metric.** Activated users who retrieve and open a note older than 7 days. Funnel: note saved → note retrieved → note reused.

**Guardrails.** Search abandonment rate; manual metadata correction rate. Analytics must stay content-free: no query text and no label names.

**Non-goals.**
- Manual tagging, renaming, merging, folders or saved searches.
- Semantic or embedding search.
- Server-side search.
- Changes to extraction prompt, schema, provider or model.
- Changes to the running list, recorder, capture tray, AI controls or grading.

**Authority.** Mike selects. Implementation is Codex's. Any extraction, data-use or onboarding change would need Mike's explicit approval, and no candidate requires one.

**Rollback.** Each candidate is additive UI over existing fields. Hiding the new surfaces restores today's Notes list. Correction writes (A, B, C) are the one durable effect: removed labels would need to stay restorable through Edit.

## Rules every candidate keeps

1. Categories come only from fields extraction already returns. Labels display as said; matching ignores case.
2. Within one note, a topic tag that equals, or is contained word-wise in, a named project or person on that note is shown once, as the named label.
3. A category appears once it occurs in two or more notes. A label used once is still on its note and in search.
4. Every category view shows where you said it: a transcript excerpt, falling back to the summary.
5. A to-do is found by its own words and inherits its note's categories. In results it is the running-list row: completion, ••• and source label all work. A placement pill (today, this week, later, done) is added because results span tabs.
6. There is one field, "Search notes and to-dos". Search runs on the phone over cached notes and tasks: title, summary, most important, transcript, labels and to-do text, open and done. Results come in two groups: to-dos first, then notes. A note matched only in its transcript shows that sentence in quotes, with the match highlighted.
7. Library rows show a date.
8. The recorder stays as shipped and is hidden while the keyboard is up.
9. Correction is a Remove button (44 pt) in the existing Edit form with Undo until Save. The footnote states that the agent sees the same result. No gesture is required anywhere.

## Candidates

| | A — Search the library | B — An index that writes itself | C — Five life areas, search from Home |
| --- | --- | --- | --- |
| Entry | "notes" opens Notes with search at top | "notes" opens an index (people, projects, topics) with search at top | Search icon in the Home top bar; Notes keeps an area filter |
| Categories | Named people, projects and topics, as one-tap chips ("you keep coming back to") | Same labels, grouped by kind, each with a page | The five fixed areas (profession shown as "work") |
| Category view | Scoped search: token in field, open to-dos, "where you said it" | Topic page: count and span, "comes up with" links, open to-dos, "where you said it" | Filtered list: open to-dos, then notes |
| Correction | Remove only | Remove only; last note removed drops the entry | Toggle any of five (add and remove) |
| Day one | Works from the first note; topics appear after repeats | Index is empty until something repeats ("Nothing has come up twice yet.") | Areas present from the first note |
| Strength | One entry point, mirrors the agent's search, smallest new surface | Most durable knowledge-base feel; best for people and projects | Calm, closed set, never sprawls; search reachable from Home |
| Risk | Categories feel secondary | Visible duplicates and label sprawl; thin early; most new screens | "work" covers most notes (fixtures about 14 of 16), so it is coarse; least literally "what was said"; Home gains chrome |
| Frames | `a-library` `a-results` `a-topic` `a-note` `a-edit` `a-none` `a-empty` `a-offline` | `b-index` `b-page` `b-results` `b-note` `b-edit` `b-thin` `b-none` `b-offline` | `c-home` `c-results` `c-notes` `c-area` `c-note` `c-edit` `c-none` `c-offline` |

Shared frames: `s-loading` and `s-processing`.

**Recommendation: A.**
- It works from the first note and keeps a single entry point.
- It matches what the agent already searches.
- Its scoped topic view already behaves like B's page without a separate index that can sprawl.
- B is the stronger choice if Mike wants Throughline to feel like a knowledge base; its page could later sit behind A's chips.
- C is safest visually but least grounded, given how coarse "work" is.

This was a recommendation, not a selection. Mike selected B; the recommendation is kept here as history.

## State and accessibility coverage

| State | A | B | C | Notes |
| --- | --- | --- | --- | --- |
| Loading after sign-in | `s-loading` | same line | same line | "Loading notes · results so far" |
| Processing note | `s-processing` | same | same | No labels until ready; matches title only |
| Empty (no notes) | `a-empty` | `b-thin` | Annotation (shipped empty copy kept) | "Your notes will appear here." kept |
| No results | `a-none` | `b-none` | `c-none` | "Nothing matches “…”." plus where search looked |
| Offline | `a-offline` | `b-offline` | `c-offline` | "Offline · searching what’s on this phone" |
| Refresh error | Copy | Copy | Copy | "Couldn’t refresh notes · searching what’s on this phone" |
| Signed out | Annotation | Annotation | Annotation | As today; owner-bound cache never shown to another account |
| Permission | n/a | n/a | n/a | No new permission |
| Long content | Two-line clamp on excerpts; labels wrap | Rows wrap | Area chips wrap to two rows | |
| Dark | `a-results`, `a-library` | `b-page`, `b-index` | `c-results`, `c-notes` | `*-dark-390x844.png` |
| Larger text | `a-library`, `a-results` | `b-index` | `c-notes` | `*-ax-light-390x844.png` (about 135% scale; full AX sizes need device check) |
| Small phone | `a-results` | `b-index` | `c-home` | `*-light-375x667.png` |
| VoiceOver | Field is a search element; result groups are headers with counts; each to-do row keeps the shipped grouping and custom actions; highlighted text is not announced separately | Index rows read "label, kind, n notes, last said …" | Area chips are toggle buttons with selected state | |
| Reduce Motion | No animation added | Push navigation only | Tabs-to-field swap is instant | |
| Non-gesture paths | All controls are buttons; Cancel and Clear (44 pt) | Same | Same | No swipe is introduced |

## Codex feasibility questions

1. **Q1 Categories without extraction change.** Confirm that people, projects, tags and centers are populated reliably enough to display with no prompt or schema change.
2. **Q2 Correction path.** Removing a label requires extending `assertCurrentMutationFields`. How does it interact with note revisions, Private Evaluation (TL-EVAL-001) and the agent's projection?
3. **Q3 Reprocessing.** If a note is reprocessed, does a removed label stay suppressed?
4. **Q4 Folding rule.** Is the within-note tag/project/person folding rule (Rule 2) deterministic enough to specify exactly, and should it run on the client or the server?
5. **Q5 Performance.** Search on the device over up to 1000 cached notes with transcripts, given today's N+1 detail loading. Is incremental indexing needed?
6. **Q6 Privacy of the cache.** Transcripts are cached in UserDefaults. Does search change the storage expectation, for example a move to file protection?
7. **Q7 Analytics.** Content-free events for search started, result opened (note age bucket) and abandoned, and for label removed. These are needed for the metric and guardrails.
8. **Q8 Data shape.** A count-only aggregate per owner of field fill rates and distinct labels. This decides whether A's threshold of two notes and B's index stay small. Codex runs it; no content leaves the database.

## Next

Mike selected B on 2026-10-05. The contract is the [handoff](../handoffs/2026-10-05-categories-search.md) and its frozen target, [selected-mock.html](../handoffs/assets/2026-10-05-categories-search/selected-mock.html), with 32 reference screens and executable rule vectors. That handoff records the clarifications Claude made while freezing.

- Codex reviewed revision 1 for feasibility and answered Q1–Q8 ([review](2026-10-05-categories-search-feasibility.md)). It requested changes, with 2 blocking, 8 material and 1 minor finding.
- Revision 2 of the handoff addressed CS1–CS11 and recorded a disposition for each question.
- Codex re-reviewed revision 2 ([re-review](2026-10-09-categories-search-feasibility-recheck.md)). It requested changes, with 0 blocking, 4 material and 2 minor findings (CR1–CR6).
- Revision 3 of the handoff resolved CR1–CR6.
- Codex re-reviewed revision 3 ([re-review 2](2026-10-10-categories-search-feasibility-recheck-2.md)) and found it `feasible`, with 0 blocking, 0 material and 2 minor findings (CT1–CT2).
- Revision 4 of the handoff records CT1–CT2 as Codex proposed and sets `handoff_ready`. Codex confirmed revision 4 with no findings ([confirmation](2026-10-10-categories-search-rev4-confirmation.md)). Q8 is deferred evidence for Mike's build-entry decision, and running it needs Mike's authorization.

Next:
1. Mike decides build entry.
2. If Mike approves build, Codex implements handoff revision 4 and Claude reviews the implementation against it.
