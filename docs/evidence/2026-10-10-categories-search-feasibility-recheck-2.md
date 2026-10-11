# Categories and search — Codex feasibility re-review 2

**Reviewer:** Codex. **Verification date:** 2026-10-10. **Scope:** local, review-only feasibility re-review of TL-KNOW-001, handoff revision 3. This is the only repository file written by this review.

**Verdict: `feasible`.** Claude may record this receipt, record the two minor clarifications below under the existing script authority, and set `handoff_ready`. All CR1–CR6 findings and the remaining CS1, CS4, CS5, CS6, CS7 and CS11 concerns are resolved at the design-contract level. There are **0 blocking / 0 material / 2 minor new findings**. Neither minor finding requires a different selected behavior: the executable oracle already decides it. This is not native/backend implementation acceptance.

Mike's October 5 Candidate B selection stands. **Build entry remains unapproved. Q8 stays deferred and unrun.** One next action: Claude records this review and CT1–CT2's oracle-preserving clarifications in the handoff and marks it `handoff_ready` for Mike's separate build-entry decision.

## Identity and review boundary

| Item | Verified identity/result |
| --- | --- |
| Checkout and branch | `/Users/mikepolner/code/throughline-local`, local `codex/running-list` |
| Reviewed revision / initial HEAD | `49500c7ea1f7bc931a8fdf31a8ffc0dabc87994b` |
| Parent | `5933728fcdcff238c6ced3c346fadf62cd482e10` |
| Handoff | `docs/handoffs/2026-10-05-categories-search.md`, revision 3 |
| Handoff SHA-256 | `2c03b764bf73f3a164484775fa63bcd20868ea8fa121a228a9bde5e6862af0d5` |
| Frozen `selected-mock.html` SHA-256 | `4c5842ef138243a5c9a595247c45dc30abe6d8a46ba3eacc69d7203ceadf2ee1` |
| `verify-rules.mjs` SHA-256 | `b36b740c008b423db26ad62e10858be6fe1b8aa34d01c8e505536463626913a5` |
| `SHA256SUMS.txt` SHA-256 | `3989702d389edbb3ce0ef3a81191665726b31c895b2042a81679abd2b7aa83b2` |
| Revision 2 review | [October 9 receipt](2026-10-09-categories-search-feasibility-recheck.md), SHA-256 `583454ecbbff45ded3b72b9ba3f9ce8e752ddbd690b99e55ecbe1b05b07fa95c` |
| Ancestry | `git merge-base --is-ancestor 49500c7ea1f7bc931a8fdf31a8ffc0dabc87994b HEAD` passed before review and before writing |
| Asset integrity | `shasum -a 256 -c SHA256SUMS.txt` in the asset directory: **34/34 passed**, including all 32 screens |
| Supplied oracle verifier | `node docs/handoffs/assets/2026-10-05-categories-search/verify-rules.mjs`: **194/194 passed**, 189 vectors in 18 groups plus five calendar checks |
| Screen changes | Git comparison with the parent confirms only `edit-locked-light-390x844.png` and `error-empty-light-390x844.png` changed among the 32 screens; the other 30 are byte-identical |

References below are to the reviewed revision. **H** = [handoff](../handoffs/2026-10-05-categories-search.md). **M** = [frozen mock](../handoffs/assets/2026-10-05-categories-search/selected-mock.html). `H:371` and `M:701–704`, for example, mean those files and lines at `49500c7`.

Canonical sources were read in the repository's order: current state, product, brand decisions, relevant brief/handoff and program context, workflow, metrics, backlog, then architecture and relevant iOS, running-list, hosted-backend and agent-connect runbooks. `docs/AGENT_TANDEM.md` and the October 9 re-review supplied the inherited review gates. Two read-only Codex agents inspected independent backend and iOS paths; the coordinator checked their evidence and ran the oracle/native probes. This is Codex's review of Claude's design, not a Claude implementation review.

**Concurrent work:** the checkout started exactly at the target. Another session advanced HEAD to `bba98bb8fd01e28a3f3c73027932f1dfa66016b6`, a direct descendant whose only committed change is the Xcode project's build number. Reviewed handoff, assets and application/backend source stayed unchanged. Later unrelated working edits appeared in `docs/CURRENT_STATE.md`, `product/backlog.json`, the October 6/8 interaction evidence, and a new October 10 interaction-delivery receipt. They were left untouched and are outside this review. The original untracked October 8 Claude review and its asset directory were also left untouched. No checkout reset, staging, commit, push, app/distribution build, upload, remote service request or database operation was performed by this review. Historical live/release claims were not refreshed.

## CR1–CR6 outcomes

“Resolved” means the handoff resolves the prior design finding. It does not mean the proposed feature exists or its runtime checks have passed.

| Finding | Outcome | Reason and source evidence |
| --- | --- | --- |
| **CR1 — evaluation-record Edit** | **Resolved** | H:277–284 and :317 now preserve the actual ordinary-Edit refusal. Home prepares and saves through `runningList` (`ios/Throughline/Views/HomeView.swift:117`, :476–479); the coordinator constructs the ordinary task request (`ios/Throughline/Services/TaskCoordinator.swift:297–306`); the API dispatches it before the evaluation branch (`supabase/functions/api/index.ts:1304–1328`). The RPC rejects an evaluation revision (`supabase/migrations/20260930231946_running_list_occurrences.sql:223–225`). The 409 mapping (`supabase/functions/api/tasks.ts:198–201`) becomes generic `.server`, not `.conflict` (`ios/Throughline/Services/TaskTransport.swift:115–121`), hence the shipped failure copy and an editable form after rejection (`ios/Throughline/Models/TaskOccurrence.swift:140–146`; `TaskCoordinator.swift:488–500`; `HomeView.swift:929`, :1113–1117). Labels have no Remove; no removal is sent; an injected removal is rejected whole. There is no new save route. The revised frozen screen shows the refusal, locked-label foot and privacy link. |
| **CR2 — page visit, late arrivals and zero count** | **Resolved** | H:226, :367–376 and :434–447 define the ordered display set, deterministic admission, retained completion/Undo at count 0, current state after remote edits/moves, removal on deletion or loss of note membership, and push versus Back lifetime. `visitRows` implements those transitions (M:710–724); independent probes confirmed them. The full pending-overlay collection exists at `TaskCoordinator.swift:515–525`; Home's projection deliberately drops older completions (`ios/Throughline/Models/RunningListProjection.swift:166–170`), so it is correctly excluded as the page/search input. This is presentation state, not another task identity or mutation contract. CT2 only clarifies a tie-break in the shared order. |
| **CR3 — no-cache retry and empty state** | **Resolved** | H:417–427, :513, :536 and :557 require Try again with no field, including empty offline cache, and preserve failure on a failed retry. Only complete enumeration/detail merging with zero notes yields the empty state. The inspected `error-empty` PNG and M:1126–1127 include Try again. Current serial loading (`ios/Throughline/Services/UploadClient.swift:691–704`) and error handling (`HomeView.swift:426–436`) establish the implementation work still needed, not a contradiction in the revised contract. |
| **CR4 — exact oracle and input boundaries** | **Resolved, with minor clarifications CT1–CT2** | Distinct-term scoring uses a set (M:750–759); accepted-first note deduplication applies to index, pages and grouped search (M:593–619, :728, :764–770); instant parsing/order, local civil dates and elapsed age are separate (M:778–819). All six prior counterexamples are corrected. `todoOrder`, `pageTodos`, `visitRows`, `entryNotes`, `spanOf`, `related` and `searchAll` are now inside RULES, with collection vectors. H:406 explicitly requires native parser/provenance handling and reporting differences. CT1 records the actual Foundation acceptance differences; CT2 identifies one omitted prose tie-break. The existing oracle resolves both without a new product decision. |
| **CR5 — account-change destination** | **Resolved** | H:461 and :548 reset the inner Notes stack and owner-derived data, then defer to the existing outer router. `ios/Throughline/AppState.swift:138–147` clears the session and chooses onboarding; deletion calls that path (:150–155). No authentication/onboarding change is promised. |
| **CR6 — native target authority / mock approximation** | **Resolved** | H:476–477 explicitly require non-overlapping native 44×44 pt targets for short and wrapped labels and disclose narrower mock approximations. Chips now have 44 px minimum width (M:174–175); related links' five-pixel expansion remains explicitly approximate (M:145–146). This closes the inaccurate mock-parity claim. It does not establish native hit-test, VoiceOver or physical-device acceptance. |

## Previously partial CS items

| Finding | Revision 3 outcome | Why it closes |
| --- | --- | --- |
| **CS1 — atomic versioned Edit** | **Resolved** | CR1's unsupported evaluation-save claim is gone. H:301–318 and :603–604 preserve one transaction, independent label freshness, unchanged task revision/occurrence IDs for label-only Save, exact-body replay and durable uncertain outcomes. Current recording updates always increment task revision (migration :77–85), and ordinary Edit writes/projects the recording (:299–301), so the explicit separate label-only path is necessary and feasible. |
| **CS4 — executable oracle** | **Resolved at the contract level** | CR4's six probes now agree; full collection operations are in RULES and tested. CT1–CT2 are minor adapter/documentation qualifications under the existing script authority, not missing selected behavior. Native and server parity remain acceptance work. |
| **CS5 — loading, coverage and performance** | **Resolved** | CR3 adds the missing explicit retry. H:421–432 retain progressive publication, non-deletion on incomplete reads, freshness/owner/query guards, enumeration beyond 1,000 and the Release-device 200 ms p95 gate. Current API listing is capped (`api/index.ts:3143–3166`); the handoff explicitly requires replacing that limitation. No performance result is claimed. |
| **CS6 — row reuse/history/recovery** | **Resolved** | CR2 supplies the missing visit contract. H:436–448 preserves full occurrence history, stable IDs, inherited pending/error/sign-in behavior and result-position retention. Shared row extraction must preserve pending support from `RunningListProjection.swift:166`, :195, refreshed callbacks/equality at `ios/Throughline/Views/RunningListView.swift:222–234`, :317–326, and Home's separate settlement at :256–282. |
| **CS7 — routes, focus and recorder** | **Resolved** | CR5 preserves onboarding. H:453–472 retains Home/capture coordination during pushes, correct Notes tray budgeting, hidden-capture filtering, owner-generation invalidation, keyboard/Stop behavior and no AI-consent prompt from search. Source boundaries remain `HomeView.swift:76–90`, :239–244 and :268–272. |
| **CS11 — hit areas** | **Resolved** | CR6 distinguishes the enforceable native 44×44 requirement from the reference's CSS approximation. New native controls still require runtime checking; existing enlarged row targets are a reuse precedent (`RunningListView.swift:397–423`, :474–484). |

CS2, CS3, CS8, CS9 and CS10 were already resolved in the October 9 receipt. Revision 3 does not reopen their design decisions; the relevant preservation checks are recorded below.

## New findings

### CT1 — minor — Foundation parsing success is broader than the oracle's known-time contract

**Evidence:** H:401 calls rule 12's input the shape the shipped parser reads; H:406 appropriately anticipates differences and forbids silent rule changes. `UploadClient.swift:274–282` uses two `ISO8601DateFormatter` configurations without strict full-input/date validation. M:778–788 instead rejects invalid dates, nonmatching syntax and out-of-range time/offset values. The existing `createdAtDate` fallback also discards parse-failure provenance (`UploadClient.swift:239–240`), while `ThroughlineNote.createdAt` is non-optional (`ios/Throughline/Models/ThroughlineNote.swift:144–146`).

The exact parser function body was extracted from source and executed via Swift stdin, changing only its declaration from a private static method to a top-level function. Environment: Apple Swift 6.2.4, arm64 macOS 26.6.2 (25G83). Twenty string inputs from the instant vectors were exercised, plus five additional synthetic inputs. Five supplied inputs expected to be unknown were accepted. A further trailing-text probe was accepted too:

| Synthetic input | Oracle | Local Foundation parser |
| --- | --- | --- |
| `2026-02-30T09:41:00Z` | Unknown | `2026-03-02T09:41:00.000Z` |
| `2026-10-05T24:00:00Z` | Unknown | `2026-10-06T00:00:00.000Z` |
| `2026-10-05T09:41:00+0200` | Unknown | `2026-10-05T07:41:00.000Z` |
| `2026-10-05T09:41:00+24:00` | Unknown | `2026-10-05T07:41:00.000Z` |
| `2026-10-05T09:41:00z` | Unknown | `2026-10-05T09:41:00.000Z` |
| `2026-10-05T10:00:00Zsuffix` | Unknown | `2026-10-05T10:00:00.000Z` |

Valid tested offsets, leap day and fractional inputs agreed, including truncation of `.123456` and `.9999` to milliseconds. Offsetless examples stayed rejected. These are local macOS Foundation results, not proof of every supported iOS runtime.

**Concrete proposed resolution:** Claude should clarify that the new rule adapter validates the entire original timestamp against rule 12's grammar and date/time/offset ranges before treating Foundation's result as known. Keep the strict oracle and preserve known/unknown provenance through models and caches; do not change the shared shipped parser or infer validity merely from non-nil `Date`. Carry these cases into the later native regression vectors and test the actual supported iOS parser path. Invalid and fallback values must yield unknown ordering/day/age information. No source/test change is made in this review.

**Disposition:** non-blocking compatibility clarification explicitly anticipated by H:406. The stricter behavior is already selected by the oracle; it requires no new product or authority decision. The permissive parser predates revision 3; this is newly verified integration evidence, not a newly introduced native bug.

### CT2 — minor — To-do ordering has an undocumented source-note-ID tie-break

**Evidence:** H:371 lists placement, source creation instant, position within the note and to-do ID. M:701–704 calls `newer` before position and to-do ID; `newer` (M:597–599) also compares source-note IDs in descending code-point order when instants tie, including when both times are unknown. That extra comparison affects page order, late-row insertion and grouped search. It is now part of the revision 3 collection oracle but is absent from the prose order.

**Synthetic reproduction:** two source notes `a` and `z` have the same instant (`2026-10-05T09:00:00Z` and `2026-10-05T11:00:00+02:00`). Each has an open Today to-do matching synthetic label `alpha`: `task-a` has position 0 on note `a`; `task-z` has position 9 on note `z`. `todoOrder` returns `task-z, task-a`. Comparing position immediately after the tied instant, as the prose sequence suggests, would return `task-a, task-z`. Giving both notes unknown times produces the same discrepancy. Same-note position and final to-do-ID comparisons behave as documented.

**Concrete proposed resolution:** align H:371 with the script: after source instant, compare source-note ID descending by code point, then position in that note, then to-do ID ascending. Add same-instant/different-note and both-unknown vectors. No script behavior needs to change. If Claude prefers a different order, change prose and oracle together and obtain an affected-scope re-review rather than having Codex silently substitute an algorithm.

**Disposition:** non-blocking prose omission. H:342 explicitly makes the deterministic script authoritative, so this receipt records that exact tie-break for implementation. It does not reopen CR2's visit membership/retention resolution.

## Independent oracle checks

Probes extracted only `RULES-BEGIN` through `RULES-END` with Node, as the supplied runner does. Inputs were synthetic and held in memory; no probe file or fixture was added. **28 checks ran: 26 agreed with the documented/authoritative behavior; two exposed the single CT2 prose omission.** This does not change the valid supplied 194/194 result.

| Probe group | Result |
| --- | --- |
| Original CR4 examples | Repeated query terms select the sentence with two distinct terms; a repeated note ID cannot create a two-note entry; offset-aware spelling uses the truly newer instant; wire timestamps yield the proper age bucket; fall-back elapsed time is 24.5 hours and falls in `1_to_7_days`; Los Angeles civil dates give `yesterday` for an instant on the prior local day. All agreed. |
| Additional time controls | Spring-forward elapsed time of 22.5 hours is `under_1_day`; equal instants use the documented spelling tie-break. Agreed. |
| To-do order | Same-note position and final to-do ID agreed. Equal-time different notes and both-unknown source times exposed CT2. |
| Visit transitions | Empty snapshot; late arrival creates the section; all displayed rows become done with count 0; Undo preserves position; a new visit drops done rows; changed text stays; deletion and lost note membership remove rows; new admission preserves existing relative order. Agreed. |
| `entryNotes` and `spanOf` | First accepted duplicate record only; newest-first order; one local-day span; unknown dates excluded; all-unknown span is null. Agreed. `spanOf` was called with `entryNotes`' ordered output, as in M:847–849. |
| `searchAll` and `related` | Duplicate-note results excluded; non-ready note searches only title; punctuation yields no groups; related entries rank by overlap, then existing index order, limited to three. Agreed. |

The gallery now delegates collection behavior to the pure functions. Static illustrations still do not simulate saving, loading, navigation or recording (H:184); visual inspection of the two changed PNGs verifies their specified static content only. Search-result position retention across mutations remains native presentation acceptance work over `searchAll`'s freshly ordered query results (H:448), not behavior proven by these pure vectors.

Local closeout checks passed: `npm run docs:verify` reported **19 backlog items and 49 checked Markdown files**; the new report's relative links, required finding rows and whitespace passed a separate read-only check. The four target SHA-256 values were rechecked unchanged. The foundation verifier's count is its configured coverage, not a claim that it checks every evidence Markdown file.

## Production mapping, measurement and preservation

The expanded mapping is feasible against the reviewed source and carries the October 9 engineering requirements forward:

- **Raw storage versus effective reads:** H:598 names ordinary list/detail, task-note envelopes, upload/poll/save responses and caches. Preserve the raw read used by writes (`api/index.ts:2519–2532`); filter outward copies, never persist filtered extraction or immutable evaluation snapshots. Apply suppression before display folding and keep agent labels unfolded (H:325–329). The ordinary list currently returns metadata rather than full labels (`api/index.ts:3155–3166`); all actual content envelopes and any future expanded list still need the shared projection.
- **Both MCP paths:** H:599–600 correctly names the hosted loader (`supabase/functions/mcp/index.ts:226–235`) and shared response/search functions (`supabase/functions/_shared/memory-tools.ts:489–520`), plus the separate local stdio entry (`backend/mcp-stdio-server.mjs:152–155`), Supabase loader (`backend/storage/supabase-store.mjs:134–138`) and memory implementation (`backend/memory-tools.mjs:512–543`). The local entry also selects a file-backed path. Both must receive effective labels; do not fix only hosted search, only returned arrays, or only one local storage mode. Preserve existing MCP search semantics and life-area coverage; phone search's exclusion of life areas is not authority to change MCP behavior.
- **Atomicity and freshness:** H:603–604 requires overlay/version storage outside the recording row, label-only Save without replaying the full task edit, exact accepted-parent/folded-child validation, shared folded-key provenance and replay recognition before validating already-suppressed keys. Carry label freshness through every response/cache merge; current `ios/Throughline/Services/TaskStore.swift:95–105` only gates task/snapshot versions. Existing frozen-replay and stale-receipt tests (`ios/Tests/TaskCoordinatorTests.swift:370–452`) are useful foundations, not proof of the new label transaction.
- **Processing, deletion and rollback:** preserve capture re-extraction refusal (`api/index.ts:823–831`) and enrolled re-extraction refusal (migration :219–221), owner-bound overlay cascades and existing artifact cleanup. Exercise synthetic replacement/serialization races. Rollback must retain a suppression-aware backend (H:607); hiding UI or installing an older client cannot restore labels. There is no restore UI in this slice.
- **Ready and time adapters:** H:605–606 explicitly excludes invented display fallbacks. Existing fields already support the feature (`core/inference-contract.mjs:112–115`, :250–255; `ThroughlineNote.swift:262–265`). Use actual extraction and the positive ready predicate, not `!isProcessing` (`ThroughlineNote.swift:268–270`) or summary/status fallbacks (`UploadClient.swift:204–212`, :243–270). CT1 preserves raw timestamp validity alongside `Date`.
- **Events:** H:601 and :687–698 require bounded lifecycle events, deliberate opens, one search visit across query replacements, and acknowledged displayed-label removals once; folded children/replay acknowledgements are excluded. Current event names (`supabase/functions/_shared/product-event-contract.ts:8–43`), allowed keys (:63–113), allowed values/boolean handling (:301–314) and stripping (:211–228) all require coordinated extension. Swift currently sends string properties (`UploadClient.swift:495–507`), while boolean handling also accepts string `true`/`false`; freeze the wire representation and aggregate interpretation together. Preserve first-party identity handling and PostHog pseudonymization (`supabase/functions/_shared/posthog.ts:84–123`).
- **Measurement:** H:682 now correctly defines removals per labeled note-open as an **exposure-normalized count**, not a percentage capped at 100%. H:697 computes age from elapsed instants; exactly seven days is `1_to_7_days`, invalid/fallback/future time is `unknown`, and clock reconciliation remains necessary. Deliberate `note_opened` is the exposure/retrieval event; an index-page open or task completion is not a note open. The canonical metric still needs its activation anchor, qualifying retrieval surfaces, cohort/window, deduplication, supported-client coverage and offline/clock treatment in `product/metrics.md` before reporting. Its current future-coverage statement (:127) remains appropriate. No measurement or outcome claim follows from this review.

## Remaining unverified checks

- Full Swift port of all 189 vectors, server key parity, native strict timestamp adapter/provenance and supported-iOS parser behavior, including CT1–CT2 regressions, locale/calendar/time-zone changes and DST. The local extracted-parser probe is not app integration or device evidence.
- New overlay schema/RPCs, atomic mixed edits, independent label-only versions, injected removals, shared folded provenance, idempotency/changed-body rejection, uncertain outcomes across relaunch, stale merges and owner isolation. Existing tests were inspected, not rerun as proof of these unimplemented contracts.
- Suppression on every app/agent read, including local file-backed and Supabase-backed stdio modes; raw-write/evaluation-snapshot separation; deletion cascades, processing races, compatible rollback and synthetic re-extraction replacement.
- Full progressive enumeration beyond 1,000, partial/stale details, independently arriving tasks, retained page visits/Back/Undo, stable search-result positions, missing source notes and row callback/pending/error behavior.
- Event contract implementation and queue/retry deduplication, canonical retrieval metric and exposure/age/cohort reconciliation. Missing measurement remains a coverage gap, not zero usage.
- Native rendering of all 32 target screens; non-overlapping 44×44 targets, largest Dynamic Type, VoiceOver focus, Reduce Motion, software/hardware keyboard, recorder/Stop/tray continuity and nested swipe/scroll behavior.
- Named physical-iPhone Release benchmark for p95 warm search at most 200 ms with the declared 1,000-note workload; separate cold-load, rebuild and memory measurements. No app build, simulator run or device benchmark occurred here.
- Existing note-cache protection/backup behavior and any optional protected-file migration, with safe read-back and retirement of old data. The deferral in H:714–715 remains a limitation.
- Q1 semantic label usefulness/fill and **Q8 production shape**. Q8 was neither run nor database-validated and remains optional evidence for Mike's build-entry decision, requiring its separate authorization. No remote/runtime/release state was verified.

## Recommendations only

1. Claude owns the handoff: record this receipt and the minor oracle-preserving CT1–CT2 clarifications, then set `handoff_ready`. Preserve Candidate B and the separate unapproved build gate. A deliberate oracle behavior change needs an affected-scope re-review.
2. In a later documentation pass, reconcile TL-KNOW-001's stale next action in `product/backlog.json` and add a dated, local-only evidence link to `docs/CURRENT_STATE.md`, coordinating with the other session's edits. Record any missing selection/review decision append-only in `decision-log.md`. None of those files was edited here.
3. In the later approved instrumentation work, define retrieval, abandonment and removal-count interpretation in `product/metrics.md`, the sole metric-definition source; keep coverage and product outcomes separate.

No extraction prompt/schema/normalizer, provider/model, destination, data-use policy, onboarding, pricing, recording-limit or App Store change is required for the reviewed design or the two minor clarifications. Making evaluation-linked content Edit work would enter separate scope because corrections can create contributions and labels are outside the editable mask (`supabase/functions/_shared/note-revisions.ts:8–14`, :157–180). Changing extraction to improve label density, adding a processor, widening retention, changing the signed-out destination or submitting a build would also require the applicable explicit approval. This receipt authorizes none of them.

**Closeout: `feasible`; 0 blocking / 0 material / 2 minor. Next action: Claude records this receipt and the oracle-preserving clarifications, then sets `handoff_ready`. Build entry remains Mike's decision.**
