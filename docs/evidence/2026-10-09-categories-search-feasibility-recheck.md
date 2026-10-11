# Categories and search — Codex feasibility re-review

**Reviewer:** Codex. **Verification date:** 2026-10-09. **Scope:** local source and frozen-design review of TL-KNOW-001, handoff revision 2. This report is the only file written.

**Verdict: `changes_requested`.** The selected experience remains technically feasible. Revision 2 supplies the previously missing atomic Edit and durable suppression architecture, but its evaluation-note behavior still contradicts the actual client route. The executable oracle and several state rules also need correction or explicit qualification before Claude sets `handoff_ready`. Findings: **0 blocking / 4 material / 2 minor**. These are handoff findings, not failures of an implementation that has not been authorized.

Mike's October 5 Candidate B selection stands. Build entry remains unapproved. **One next action: Claude revises the handoff and affected frozen references to resolve CR1–CR6, then returns that exact revision for Codex re-review.**

## Reviewed identity and verification boundary

| Item | Verified identity/result |
| --- | --- |
| Checkout | `/Users/mikepolner/code/throughline-local`, local `codex/running-list` |
| Reviewed commit and HEAD | `5933728fcdcff238c6ced3c346fadf62cd482e10` |
| Parent | `6b0cbbe64bb3816f2ac45650a649e7236308c85b` |
| Handoff | `docs/handoffs/2026-10-05-categories-search.md`, revision 2 |
| Handoff SHA-256 | `a8d93fb8190f430c422af2707ea34d7c0c6bd809d48e4db4e31eea0634424bad` |
| Frozen mock SHA-256 | `e91dbfd549800f768f4d984320b83ee574070e79ab7cc96e9113952998f3b50c` |
| `verify-rules.mjs` SHA-256 | `2513757484eda1e65517c924e6b27d17bd4eb66ce302bcda08d3deb618f9b8b5` |
| `SHA256SUMS.txt` SHA-256 | `32f1db1eac05609191a6f6dc03fdafafd4dd33d21392aff7354dceb55b4d8c9d` |
| Ancestry | `git merge-base --is-ancestor 5933728fcdcff238c6ced3c346fadf62cd482e10 HEAD` passed; HEAD is exactly the target |
| Asset verification | `shasum -a 256 -c SHA256SUMS.txt` in the asset directory: **34/34 passed**, comprising the mock, runner and 32 screens |
| Supplied oracle checks | `node docs/handoffs/assets/2026-10-05-categories-search/verify-rules.mjs`: **128/128 passed** |

All file:line references below are to this exact commit. **H** means `docs/handoffs/2026-10-05-categories-search.md`; **M** means `docs/handoffs/assets/2026-10-05-categories-search/selected-mock.html`. The prior review is [the October 5 feasibility report](2026-10-05-categories-search-feasibility.md).

Canonical sources were read in repository order: current state, product, brand decisions, candidates brief and selected handoff, workflow, metrics, backlog, then relevant architecture, iOS, hosted-backend, agent-connect and running-list runbooks. `docs/AGENT_TANDEM.md` and the prior review supplied the inherited gates. Two read-only Codex agents checked backend and client contracts; Codex integrated and verified their source evidence. This is a Codex review of Claude's design, not a Claude implementation-review receipt.

The initial untracked paths were `docs/evidence/2026-10-08-claude-interaction-final-review.md` and `docs/evidence/assets/2026-10-08-interaction-final-review/`. They were left untouched. No implementation, staging, commit, push, distribution build, upload, remote service request or database operation occurred. **Q8 was not run.** Previously dated release/runtime claims were not refreshed.

## CS1–CS11 dispositions

“Resolved” below means the design contract answers the earlier finding; it does not mean the proposed feature is implemented or verified on a device.

| Prior finding | Outcome | Reason and source evidence |
| --- | --- | --- |
| **CS1 — atomic versioned Edit** | **Partially resolved** | H:273–294 now specifies removal-only validation, task and label versions, durable identity, same-body replay, changed-body rejection, atomicity and truthful unknown outcomes. Existing frozen-save recovery is a sound base (`ios/Throughline/Services/TaskCoordinator.swift:297–306`; `ios/Tests/TaskCoordinatorTests.swift:370–410`). However, H:256 incorrectly asserts that evaluation-linked notes use the evaluation correction path. Home actually calls ordinary task Edit, which rejects those notes. **CR1**. |
| **CS2 — durable suppression/effective reads** | **Resolved** | H:296–306 explicitly requires the separate owner/recording overlay, serialized writes, deletion cascades, every app/MCP effective read, preserved reprocessing guards and suppression-preserving rollback. This addresses replaceable extraction (`supabase/migrations/20260930231946_running_list_occurrences.sql:331–346`) and currently raw agent labels/search (`supabase/functions/_shared/memory-tools.ts:489–520`). Both hosted and local MCP must be covered in implementation, as detailed below. |
| **CS3 — keys, folding, kinds and ties** | **Resolved** | H:278–279, :322–338 and M:420–492 define `label-key-v1`, invalid keys, suppression before folding across kinds, folded-child removal provenance, owner-wide kind, spelling precedence and final key tie-break. Synthetic removal and cross-kind suppression probes agree. Distinct-note input handling still needs the oracle boundary correction in **CR4**; the suppression identity and kind decisions themselves are explicit. These derived keys must remain separate from existing task identities (`ios/Throughline/Models/ThroughlineNote.swift:87–101`). |
| **CS4 — exact executable oracle** | **Partially resolved** | The supplied 128 checks pass. Most-important matching, accent ranges, sentence selection, empty keys, failed-note title-only behavior and static-illustration boundaries are repaired (H:174, :310–366; M:434–577). Independent probes still expose a distinct-term excerpt disagreement and undeclared identity/time input assumptions. Some advertised rules remain outside the extracted oracle. **CR4**. The native model's `isProcessing` is still not the proposed positive ready predicate (`ThroughlineNote.swift:268–270`). |
| **CS5 — loading/coverage/performance** | **Partially resolved** | H:368–391 now requires progressive publication, full enumeration beyond 1,000, safe partial failure/deletion behavior, ordered merges, owner/query generations and a measurable Release-device gate. Those explicitly replace current serial loading (`ios/Throughline/Services/UploadClient.swift:691–704`) and capped listing (`supabase/functions/api/index.ts:3143–3166`). No-cache retry still contradicts the explicit non-gesture retry promise. **CR3**. |
| **CS6 — row reuse/history/recovery** | **Partially resolved** | H:393–405 correctly uses full stable occurrences, pending overlay, inherited recovery, completion-in-place/Undo and stable result positions. `TaskCoordinator.swift:515–525` supplies full occurrences, whereas `RunningListProjection.swift:167–171` drops old completions. H:205 still conflicts with late task arrival at H:386, and row admission during a visit needs an exact rule. **CR2**. |
| **CS7 — routes, focus and recording** | **Partially resolved** | H:407–428 resolves the retained Home stack, tray budget, Back/Cancel/chip routes, focus, hidden captures and keyboard/Stop rules. These preserve the source lifecycle at `ios/Throughline/Views/HomeView.swift:76–90` and hidden-recording filters at :239–244 and :268–272. The literal sign-out/deletion destination conflicts with `AppState.swift:138–155`; clarify the outer authentication boundary. **CR5**. |
| **CS8 — cache/derived lifetime** | **Resolved** | H:650–662 explicitly limits index/query state to owner/generation-bound memory, documents the existing UserDefaults cache and defers protection migration without claiming it is verified. Source confirms retained owner caches at `ios/Throughline/AppState.swift:138–155`, :179–196, and a protected-file precedent at `ios/Throughline/Services/TaskStore.swift:108–132`. Deferral is a recorded limitation, not a protection guarantee. |
| **CS9 — events/metric** | **Resolved** | H:624–643 defines bounded lifecycle events, excludes passive updates and unacknowledged removals, and extends deliberate `note_opened` with surface, age and label exposure. The revised removal-per-labeled-open denominator is explicit. Current opens have no such properties (`HomeView.swift:247–260`); the ingestion vocabulary/properties must be extended (`supabase/functions/_shared/product-event-contract.ts:8–43`, :211–228). Canonical metric definition and reconciled coverage remain future requirements, not measured outcomes. |
| **CS10 — usefulness/evidence** | **Resolved** | H:99–104 and :673–680 explicitly separate structural feasibility from semantic usefulness and defer Q8 as optional build-entry evidence. Existing extraction fields/empty defaults support display (`core/inference-contract.mjs:83–94`, :404–429, :637–647; `ThroughlineNote.swift:262–265`). Neither these fields nor synthetic fixtures prove reliable fill, grounding or useful repetition. |
| **CS11 — hit areas** | **Partially resolved** | H:430–434 makes native 44×44 authoritative, uses one source/excerpt button, and requires placement in the combined accessibility label. Current row controls already have enlarged targets (`ios/Throughline/Views/RunningListView.swift:397–423`, :474–484). Short-label mock chips/related links still lack a guaranteed minimum width. **CR6**, minor; no native failure is claimed. |

## New findings

### CR1 — material — Evaluation-note Edit is described as a route Home does not use

**Evidence:** H:256 says edits on a note with `currentRevisionID != nil` follow the evaluation correction path; the new locked-frame annotation repeats this at M:897–898. Current Home prepares every editor through `runningList.prepareEditor` (`ios/Throughline/Views/HomeView.swift:117`) and saves through `runningList.saveEditor` (:476–478). The coordinator requires `expectedTaskRevision` and creates an ordinary task request (`ios/Throughline/Services/TaskCoordinator.swift:247–249`, :297–299). The API dispatches that request to ordinary Edit (`supabase/functions/api/index.ts:1305–1313`), whose RPC rejects `current_note_revision_id != null` (`supabase/migrations/20260930231946_running_list_occurrences.sql:223–225`).

The evaluation-capable `UploadClient.updateRecording` method exists (:742–752), but this Home save route does not call it. Ordinary detail can return before the mutation restriction (migration :218 versus :223–225), so rendering an Edit form is not proof its Save is supported. Existing route tests deliberately keep ordinary Edit separate from evaluation (`supabase/functions/api/tasks_routes_test.ts:106–139`).

**Proposed resolution:** Correct the handoff and locked-frame annotation to preserve the actual unsupported ordinary-Edit behavior. Specify the visible unavailable/error state for evaluation-linked records and keep Remove unavailable. Do not promise a working evaluation content-save route. If Claude intends to make that route work, describe it as separate scope for Mike rather than implicitly introducing it here: evaluation corrections can create contributions (`supabase/functions/_shared/note-revisions.ts:157–180`), and their editable mask excludes labels (:8–14). No TL-EVAL activation or eligibility change is authorized.

### CR2 — material — Page-open omission conflicts with independently arriving tasks

**Evidence:** H:205 omits the to-do section when no rows qualify “at page open.” H:386 instead requires sections to appear when tasks arrive, and H:504 says independently loaded parts show what has arrived. H:398–403 retains rows completed during a visit and forbids movement-based reordering, but does not define where newly qualifying rows join that stable order. Opening a page before its task snapshot creates two different permitted outcomes.

**Proposed resolution:** Define the visit's displayed set explicitly: current qualifying open occurrences plus completed-in-place occurrences retained for that visit. Omit the section only while that union is empty. Late qualifying tasks create the section; give newly admitted IDs a deterministic insertion rule that preserves existing row positions. Keep Undo visible at open count zero. Specify removal on confirmed deletion or loss of source-note membership, and distinguish a new page visit from revealing an existing page on Back. Preserve the inherited parent error/pending behavior and result-position rule. This is presentation state over `TaskCoordinator.occurrences`, not a new task identity or mutation contract.

### CR3 — material — No-cache refresh failure still has no explicit retry action

**Evidence:** H:376, :467 and :490 preserve only the shipped pull-down instruction for a no-cache failure. H:385 says Try again and pull to refresh both retry; H:430–432 requires non-gesture alternatives. The new `error-empty` frame at M:915–916 and its inspected PNG have no Try again button. H:384 also sends an empty offline cache to this state. The user most dependent on initial loading therefore lacks the promised explicit retry.

**Proposed resolution:** Preserve the no-field state and shipped error text, and add the 44-point Try again button to no-cache failure, including empty offline coverage. Align the state/copy tables, accessibility order and frozen frame. Retrying offline may remain offline; it must not manufacture an empty-library success. This does not change the approved recorder or consent behavior.

### CR4 — material — The claimed exact oracle still has disagreements and undefined input boundaries

**Evidence:** H:310–316 makes `RULES-BEGIN` through `RULES-END` the exact oracle and shared parity set. The following independent synthetic probes ran in Node by extracting only that section. All text, identifiers and dates in the probes are synthetic.

| Probe | Observed oracle result | Prose requirement or missing precondition |
| --- | --- | --- |
| Query `alpha alpha beta gamma`; transcript `Alpha. Beta gamma.`; ready note with unrelated summary | Excerpt selects `Alpha.` | H:361 and M:566–567 say **most distinct terms**. `Beta gamma.` contains two distinct terms; `Alpha.` contains one. M:572 counts duplicate query terms, producing a tie and choosing the earlier sentence. |
| Pass the same ready note ID twice, with one label | `buildIndex` creates an entry with count 2 | H:336 says two **distinct** notes. M:477–480 appends/counts IDs without deduplication. A unique-note input projection could prevent this, but that precondition is not specified or checked by the oracle. |
| Same-key spellings at `2026-10-05T10:00:00+02:00` and `2026-10-05T09:00:00Z` | Spelling from the first, chronologically older instant wins | H:337 says most recent note. M:474 and :481 compare timestamp strings. This needs canonical instant inputs, not arbitrary wire ISO strings. |
| `ageBucket('2026-09-01T08:00:00Z', '2026-10-05T09:00:00Z')` | `unknown` | M:596 appends another `Z`. H:642 requires elapsed age; the helper accepts an undocumented offsetless representation, unlike API timestamps parsed at `UploadClient.swift:274–282`. |
| Under `TZ=America/Los_Angeles`, offsetless local `2026-11-01T00:30` → `2026-11-02T00:00` | `under_1_day`; actual elapsed interval is 24.5 hours | Treating local wall times as UTC at M:596 loses the fall-back hour. Local civil dates are suitable for day labels but not elapsed age. |
| Los Angeles day form for `2026-10-05T02:00:00Z` at `2026-10-05T16:00:00Z` | `today` | H:365 requires phone-local calendar dates, for which this is `yesterday`. M:586 slices the input's date without converting it. An explicit local-date adapter would resolve this boundary. |

The timestamp probes identify an **oracle input-contract gap**, not a demonstrated bug in a future Swift implementation. The current Swift note model already stores `createdAt` as `Date` (`ThroughlineNote.swift:144–148`). The supplied day vectors use offsetless civil strings; they do not establish correctness for wire timestamps, elapsed-time DST boundaries, or a native adapter.

There is also a coverage overstatement: full page-to-do collection/order, related-entry overlap/ranking, and grouped search live outside `RULES-END`, in gallery code at M:707–726. The vectors' `todos` cases exercise only `todoNames` (M:618), not those collection operations. This is executable gallery behavior, but it is not in the pure section extracted by `verify-rules.mjs`.

**Proposed resolution:** Deduplicate terms for distinct-term excerpt scoring and add the counterexample. Enforce distinct note membership, or explicitly require and test a canonical unique-note input map. Freeze separate input contracts for normalized instants, local calendar dates and elapsed-age timestamps; add offset, DST, timezone and same-instant spelling/order vectors at that adapter boundary. Move the promised collection rules into the pure oracle with vectors, or narrow the claim and explicitly identify their separate acceptance oracle. Preserve the script as authority until Claude revises it; Codex must not silently substitute a different algorithm during implementation.

Passing independent controls confirm that the main revision 1 repairs work: second-sentence page excerpt selection, accented whole-word highlighting, most-important-only search, punctuation-only invalid keys, failed-note title-only search, and folded-parent removal expansion. These six controls passed; the six counterexamples/boundary probes above produced the stated discrepancies. The supplied **128/128** result remains valid for its existing vectors.

### CR5 — minor — Account changes must preserve the outer authentication route

**Evidence:** H:417 and :502 say sign-out and account deletion return Home. Current `AppState.clearSession` clears data and sets `route = .onboarding` (`ios/Throughline/AppState.swift:138–147`); account deletion calls it (:150–155). H:427 promises unchanged sign-in controls.

**Proposed resolution:** Say that Notes' internal route stack resets to its root and all owner-derived state is cleared, while the existing outer account/onboarding router determines the visible screen. A signed-in account switch may show Home; sign-out/deletion retain their existing authentication destination. The present wording is not approval for an onboarding change.

### CR6 — minor — Short mock labels do not guarantee 44-point width

**Evidence:** H:432 says the mock CSS follows the native minimum. M:145–146 adds only five pixels of horizontal hit expansion to related links. M:174–175 expands chip height but not width. Neither rule guarantees 44 pixels across a valid one-character label. Clear and the single source/excerpt button are corrected (M:97, :147).

**Proposed resolution:** Give those reference targets a minimum 44×44 effective hit area with non-overlapping hit regions, including short and wrapped labels, or explicitly annotate the remaining mock limitation. Native 44×44 remains authoritative. This is a reference-contract caveat; no native hit-test or device failure was observed.

## Engineering feasibility and preservation requirements

These are requirements for a later approved implementation, not additional numbered findings or permission to change source now.

- **Atomic Edit:** The revised removal-only request is feasible through the ordinary owner-authorized transaction. Validate displayed parent targets and their exact folded-key expansion against the accepted note/label version; reject arbitrary injected keys, additions, renames and unsupported key versions. Preserve removal provenance, including a folded key shared by multiple removed parents. Same-identity replay must return the original result before treating the now-suppressed keys as invalid new removals. Known rejection applies nothing; dispatched unknown state retains the exact frozen request across relaunch. Cancel cannot undo an uncertain write.
- **Independent versions:** A label-only Save must not replay the whole task edit. The current client always sends content/todos (`TaskCoordinator.swift:297–299`), the edit RPC writes/projects the recording (migration :299–300), and every recording UPDATE increments task revision (:77–85). Use independent label state/versioning and carry freshness through all response/cache paths; `TaskStore.apply` currently checks only task and snapshot versions (:95–105). Preserve occurrence IDs and avoid unnecessary occurrence-version changes. Mixed edits advance the applicable versions atomically. Existing frozen-replay tests at `ios/Tests/TaskCoordinatorTests.swift:418–452` are useful foundations, not label-contract evidence.
- **Effective projection:** Keep original extraction and immutable evaluation snapshots separate from outward effective labels. Do not globally filter the raw `readRecording` used by writes (`supabase/functions/api/index.ts:2519–2532`) and then persist that filtered structure. Cover ordinary list/detail, task-note envelopes, upload/poll/save responses and caches, plus every agent read. Hosted MCP loads raw records at `supabase/functions/mcp/index.ts:226–235`. Local stdio has a separate loader and memory implementation (`backend/mcp-stdio-server.mjs:153–154`; `backend/storage/supabase-store.mjs:134–138`; `backend/memory-tools.mjs:522`, :539–541). The implementation map must include both. Folding remains display-only; agent labels remain effective but unfolded. Do not otherwise replace MCP search semantics or life-area coverage.
- **Processing, deletion and rollback:** Keep capture re-extraction rejection (`api/index.ts:823–831`) and enrolled re-extraction rejection (migration :219–221). Exercise replacement/suppression races synthetically. Recording/account deletion must remove the overlay through owner-bound cascades without weakening existing artifact cleanup. Rollback must use a compatible backend that still applies suppressions, with UI hidden; an old unfiltered backend is not a valid rollback. Restoring labels remains an explicit versioned operation, with no restore UI added here.
- **Loading and row reuse:** Complete enumeration and ordered merge are substantive API/client work, but feasible without extraction changes. Partial/capped detail work cannot prove deletion. Notes/tasks can arrive independently. Reuse shared row formatting, mutation/error/sign-in support, refreshed callbacks and equality behavior (`RunningListView.swift:222–234`, :317–326), while keeping Home's current settlement behavior. Apply capture-hidden and owner-generation filters before indexing, routing or exposing occurrences. CR2 must settle visit membership first.
- **Ready/data adapters:** Port the positive ready predicate rather than negating `isProcessing`. Use actual extracted fields in the rule adapter: `UploadClient.displayNote` can manufacture display-only status tags for missing structure (:243–270), and `throughlineNote` creates summary fallbacks (:204–212). Those presentation fallbacks must not silently become extracted labels or change the legacy raw-summary readiness rule. Preserve valid timestamp provenance for the diagnostic age bucket; the existing `createdAtDate` fallback to `Date()` (:239–240) cannot establish a known original age.
- **Routes/recording:** Retain Home and its capture coordinator during all inner pushes. Idle software-keyboard focus hides the named bottom region; hardware-keyboard focus does not. Preparing/recording/finishing disables search focus and preserves Stop, keeps the query and restores no automatic keyboard focus. Search must not request AI consent. Keep Back, Cancel, sheet dismissal/chip routing, zero-member page pops and accessible focus restoration owner-bound. CR5 clarifies the outer route only.
- **Cache:** Accept the explicitly deferred protected-file migration. The existing cache gap remains an implementation-evidence limitation if deferred; the new derived index and queries remain memory-only. An optional protected-file migration needs failure-safe read-back and old-data retirement checks, not a new data destination or data-use approval.
- **Events:** The proposed lifecycle is feasible. Keep a search visit distinct from query replacements; index navigation alone is not old-note retrieval; task completion is not source opening. Emit acknowledged displayed-label removals once, excluding folded children and replay acknowledgements. Extend `note_opened` with the bounded surface/age/boolean contract and preserve existing first-party identity handling and PostHog pseudonymization (`supabase/functions/_shared/posthog.ts:84–123`). Test the closed vocabulary, unknown-property stripping and queue/retry behavior together. Define the final metric in `product/metrics.md` before reporting it, including activation anchor, cohort/window, deduplication, unsupported clients and offline/clock coverage. Removal per labeled note-open is an exposure-normalized count, not a percentage bounded by 100%; one open can yield multiple removals. Client age remains diagnostic until reconciled.

The 200 ms p95 warm-search gate at H:387 is measurable after naming the supported physical iPhone, Release configuration, query workload and 1,000-note synthetic fixture shape. It does not yet have a result. Cold load, rebuilds and memory are explicitly measured but ungated. More-than-1,000 enumeration correctness is a separate requirement; passing the 1,000-note performance workload cannot waive it.

## Q1–Q8 dispositions

| Question | Re-review disposition |
| --- | --- |
| **Q1 — label fill** | Structurally feasible with existing fields; semantic correctness, reliable fill and useful repetition remain unverified. “As said” is unchanged extracted spelling, not a new verbatim guarantee. No extraction change is needed for the selected rendering. |
| **Q2 — correction path** | Ordinary atomic suppression is feasible. Evaluation-linked Edit needs CR1's truthful restriction; no evaluation correction activation is implied. |
| **Q3 — reprocessing** | The separate overlay and serialization contract resolves persistence in principle. Prove synthetic replacement and rollback parity later; preserve current live-path prohibitions. |
| **Q4 — rule location** | Phone index/folding/search plus server normalization/suppression is feasible. Resolve CR4 and port the exact agreed vectors; folding stays display-only. |
| **Q5 — performance** | Defined prospective gate, unmeasured. Complete progressive loading and independent row arrival need implementation and CR2/CR3 clarification. |
| **Q6 — cache** | Explicitly deferred, with the current boundary and verification gap accurately recorded. No new transcript store or persisted query is permitted by this design. |
| **Q7 — events** | Lifecycle and exposure denominator are sufficiently specified for engineering planning. Final bounded wire acceptance/tests and canonical metric definition remain future work; no retrieval instrumentation or reconciled metric is claimed. |
| **Q8 — production shape** | **Deferred evidence for Mike's build-entry decision; unrun and not a `handoff_ready` prerequisite.** The prior count-only SQL was neither executed nor database-validated here. It requires a separately authorized read-only database pass and local synthetic validation first. Raw count shapes do not establish final normalized/folded index size or label correctness. No labels or identifiers should be exported. |

## Completed checks, remaining checks and recommendations

Completed locally on 2026-10-09: exact HEAD/parent/ancestry and four hash checks; all 34 manifest entries; the supplied 128-vector runner; twelve independent synthetic oracle probes documented above; source/model/migration/test inspection; and visual inspection of the four new frozen screens (`edit-locked`, `edit-unconfirmed`, `search-recording`, `error-empty`). The screens are static illustrations, not runtime evidence. Repository foundation verification passed: `npm run docs:verify` reported **19 backlog items and 49 checked Markdown files**. Report-only scope and whitespace were checked at closeout.

Remaining unverified:

- Revised oracle corrections, explicit adapters, Swift/server parity and the collection-level vectors; calendar, locale, timezone, DST and duplicate-input handling.
- All new storage/API behavior: removal-only validation, label-only version independence, mixed atomic rollback, changed-body/repeated receipt handling, stale merges, unknown outcomes, evaluation restrictions, owner isolation, processing races, cascades and every app/MCP projection.
- Progressive loading beyond 1,000 notes, failed/stale details, account changes during work, independently arriving tasks, page visits/Undo, completion history, source disappearance and callback lifetime.
- Cache protection/backup properties on an actual device, and any optional migration/recovery behavior.
- Event contract implementation, deduplication, exposure/age/cohort reconciliation and the canonical retrieval metric.
- Native rendering of all frozen targets, largest Dynamic Type, VoiceOver, Reduce Motion, non-gesture paths, software/hardware keyboard, Stop/tray visibility, nested swipe/scroll behavior and physical-device Release performance.
- Q1 semantic usefulness and Q8 database evidence. No native/backend suite, simulator, app build, physical device benchmark, database query or remote/runtime/release verification was run in this pass.

Recommendations only; no other document was edited:

1. Claude records this receipt and CR1–CR6 in a revised handoff, updates affected mock/vector/screens and freezes new hashes. Preserve Candidate B and unapproved build entry.
2. After that review, update `docs/CURRENT_STATE.md` with the verification date, local-only scope and evidence link, and refresh TL-KNOW-001's stale next action in `product/backlog.json` without marking build approved. Append the selection/review disposition to `decision-log.md` only where missing; preserve prior decisions.
3. In the later approved instrumentation slice, define retrieval, abandonment and label-removal interpretation in `product/metrics.md`, the sole metric-definition source. Keep pending coverage distinct from zero outcomes.

No extraction prompt/schema/normalizer, provider/model, destination, data-use policy, pricing, recording limit, onboarding or App Store change is required to resolve these findings. Making evaluation content editing work (CR1), changing the signed-out destination (CR5), improving density by changing extraction, adding another search processor or widening retention would cross the current scope and require Mike's applicable explicit approval. This review authorizes none of those actions.

**Closeout: `changes_requested`; 0 blocking / 4 material / 2 minor. One next action: Claude resolves CR1–CR6 in the handoff and returns the exact revision for re-review.**
