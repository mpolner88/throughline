# Categories and search — Codex feasibility review

**Reviewer:** Codex. **Verification date:** 2026-10-05. **Scope:** local, read-only source and frozen-design review for TL-KNOW-001; this report is the only file written by this review.

**Verdict: changes requested before `handoff_ready`.** Candidate B is technically feasible without changing extraction, provider/model, or onboarding. Revision 1 does not yet define a safe removal contract or all of the loading, task, and recording interactions it promises. Findings: **2 blocking, 8 material, 1 minor**. These are handoff-readiness findings, not implementation failures. Mike's Candidate B selection stands; build entry remains unapproved.

**Next owner/action:** Claude resolves CS1–CS11 in handoff revision 2, including explicit dispositions for deferred evidence. Codex then re-reviews the changed contract; Mike retains the subsequent build-entry decision.

## Reviewed identity and evidence boundary

| Item | Verified identity/result |
| --- | --- |
| Local checkout | `/Users/mikepolner/code/throughline-local`, branch `codex/running-list` |
| Reviewed commit and initial HEAD | `6e1768ba65f7870433dfb2770d3c0aab445e4c90` |
| Parent | `8b30dd8ac3e2847b542189e588d1905e0b3071be` |
| Handoff | `docs/handoffs/2026-10-05-categories-search.md`, revision 1 |
| Handoff SHA-256 | `26def2dd4ce186ac9eed005267ba3457fc8ad724d07506620123f5244e6e7554` |
| Frozen mock | `docs/handoffs/assets/2026-10-05-categories-search/selected-mock.html` |
| Mock SHA-256 | `85170e3c8bced2c4c0a109e10b8af72098896c339c9fcfd71366db938f12808e` |
| Asset manifest SHA-256 | `dd41db4581215c381d3f190e7792a142095e28b3048d75c37639922bb29b5d31` |
| Required ancestry check | `git merge-base --is-ancestor 6e1768ba65f7870433dfb2770d3c0aab445e4c90 HEAD` passed; initial HEAD was exactly the target |
| Required asset check | `shasum -a 256 -c SHA256SUMS.txt`, run in the asset directory, passed all 29 entries: mock plus 28 screens |

Canonical sources were read in repository order: current state, product, brand decisions, the candidates record as the named slice brief, workflow, metrics, backlog, and relevant architecture/iOS/backend/agent runbooks. The running-list brief and `docs/AGENT_TANDEM.md` supplied the inherited interaction and review boundaries. Current runtime/release statements in those documents remain dated prior evidence; no remote state was refreshed.

The checkout initially contained an unrelated modification to `ios/Throughline/Views/HomeView.swift`. During review, concurrent edits also appeared in the Xcode project, `RunningListView.swift`, `CaptureTrayView.swift` and `TodoRowsEditor.swift`, plus new swipe-related source/test/script files and `HomeLayoutBudget.swift`. None is part of this review. Home and the affected running-list references below were read/rechecked with `git show 6e1768b:<path>`; **all source line references in this report mean the pinned commit, not the changing worktree**. No implementation, staging, commit, push, build, upload, or service request was performed.

Two read-only Codex scouts inspected backend contracts and iOS behavior; Codex integrated and checked their evidence. This is the requested Codex review of Claude's design, not a Claude implementation-review receipt.

## Findings

### CS1 — blocking — Remove must join the actual versioned Edit transaction

**Evidence:** The handoff proposes `assertCurrentMutationFields` at `docs/handoffs/2026-10-05-categories-search.md:358`. Current clients instead enter the `task_contract_version == 1` branch before that helper (`supabase/functions/api/index.ts:1304–1328`). `validateTaskEdit` excludes labels (`supabase/functions/api/tasks.ts:96–109`), and the database edit branch compares `expected_task_revision` and writes supported content/task fields (`supabase/migrations/20260930231946_running_list_occurrences.sql:259–301`). Records with a current evaluation revision are explicitly rejected at lines 223–225. The evaluation correction mask excludes labels, and content corrections can create contributions (`supabase/functions/_shared/note-revisions.ts:8–18`, `:109–126`, `:157–181`).

The failure promise also needs correction: handoff line 315 says a failed removal “saves nothing,” but the editor durably freezes the request before dispatch (`ios/Throughline/Services/TaskCoordinator.swift:297–306`), retains uncertain dispatched saves (`:443–500`), and retries edits only when Save is tapped (`:367–370`). A lost response does not prove the server saved nothing.

**Proposed resolution:** Specify one owner-authorized, removal-only metadata operation included atomically with the whole Edit Save. Freeze its request/response fields, expected task and metadata versions, mutation identity, and stale-version rejection. Preserve occurrence IDs and distinguish label-only edits from task changes. Reject additions/renames/unknown label targets. Use the same durable request for retries; a known rejected transaction applies nothing, while an unknown outcome remains pending/frozen with the existing recovery controls. Cancel may discard an undispatched draft, not undo a possibly committed request. Explicitly specify unsupported/evaluation-lineage records: preserve existing restrictions and show a truthful unavailable state unless a separately reviewed compatible path is defined. Do not route label removals into evaluation eligibility, alter immutable snapshots, or activate TL-EVAL-001.

### CS2 — blocking — Suppression needs durable storage and one effective read projection

**Evidence:** Suppression and reprocessing durability are required at handoff lines 374 and 396, but there is no such store/projection in this revision. Extraction replaces `structured_note` (`supabase/functions/api/index.ts:1664–1666`, `:1769–1772`), and processing persistence replaces the recording payload (`supabase/migrations/20260930231946_running_list_occurrences.sql:331–346`). Capture re-extraction is currently rejected (`api/index.ts:823–831`), as is enrolled re-extraction with existing structure (migration lines 219–221); these guards are not suppression persistence. MCP returns stored labels unchanged and includes them in search (`supabase/functions/_shared/memory-tools.ts:489–520`).

**Proposed resolution:** Persist an owner/recording-bound suppression overlay outside replaceable extraction output, keyed by normalized key plus normalization version. Retain original labels; serialize removal against processing and other edits; cascade on recording/account deletion. Apply the effective projection before all relevant app and agent reads, including both agent search text and returned structured labels. Retain current reprocessing prohibitions. Test permitted processing replacement synthetically without opening a new live reprocessing path. Rollback hides the UI while keeping suppressions enforced; restoring labels must be an explicit, versioned restoration, not an automatic consequence of deploying an old client. Clarify “no schema change” as **no extraction-schema change**: additive storage/API contracts are necessary. A label-only agent search contribution disappears, but transcript/summary words can still return the note, as handoff line 216 already allows.

### CS3 — material — Define suppression identity before folding and cross-kind precedence

**Evidence:** The mock folds tags and deduplicates keys across fields (`docs/handoffs/assets/2026-10-05-categories-search/selected-mock.html:283–305`), while Edit operates on those displayed labels (`:458–465`). The handoff's Remove behavior does not say what happens to hidden duplicates or folded children (`docs/handoffs/2026-10-05-categories-search.md:202–216`).

**Proposed resolution:** Apply suppressions before folding; suppress the same key across all kinds on that note, so a removed person cannot immediately reappear as a project with the same key. Have Claude explicitly confirm the narrow behavior for a differently keyed folded tag: removing synthetic project “pricing page” allows its unsuppressed tag “pricing” to become visible. If removal should suppress that tag too, name and retain that provenance explicitly. Define empty-key rejection, equal-timestamp display-spelling ties, a stable final sort tie-break, and whether sheet/edit kinds use note-local or global precedence. Use one versioned key specification with shared Swift/server test vectors. Keep folding as a derived projection; do not rewrite extraction output or substitute task-text normalization.

### CS4 — material — The executable mock is not yet an exact oracle for the prose rules

**Evidence:** Handoff line 220 says the script implements every exact rule. However, its excerpt loop examines `[n.said]`, the entire transcript, rather than transcript sentences (`selected-mock.html:325–333`); search omits most-important fields (`:338–347`); highlighting uses normalized terms against raw text (`:353–361`); and `labelsOf` admits an empty normalized key (`:288–290`). The script's fixtures do not implement readiness filtering, suppression, or actual navigation/save interactions. Native `isProcessing == false` also includes terminal failures, so it is not a ready predicate (`ios/Throughline/Models/ThroughlineNote.swift:268–270`).

**Local synthetic probes:** Executed the frozen script's pure functions in a Node VM without DOM rendering or network. A second-sentence label match returned the whole two-sentence transcript; `cafe` matched but did not highlight synthetic `Café`; a most-important-only term returned zero notes; a punctuation-only label produced one empty key. These are rule counterexamples, not a native test suite.

**Proposed resolution:** Claude aligns script and prose in revision 2. Define sentence selection, prefix highlighting with offsets back to original Unicode text, Unicode/diacritic behavior beyond the basic combining-mark range, all searched fields, and empty/punctuation-only query behavior. Add most-important-only, multi-sentence, mixed-field multiword, accent, duplicate, and invalid-key fixtures. Define ready as a positive status/structure predicate; specify legacy nil-status and failed-note behavior separately. Recommended default: processed structured notes are indexed; pending/failed notes are title-only searchable; legacy nil-status eligibility requires an explicit compatibility rule. Identify static illustrations as such instead of implying executable coverage for mutations or lifecycle behavior.

### CS5 — material — Loading, cached coverage, and search performance need a bounded data contract

**Evidence:** `UploadClient.listNotes()` performs one list request plus serial detail requests, publishing only after every detail succeeds (`ios/Throughline/Services/UploadClient.swift:691–704`). Home publishes the completed array and only sets its refresh error for an empty cache (`ios/Throughline/Views/HomeView.swift:362–385`), unlike handoff lines 313–316. The server list caps at 1,000 and exposes no continuation in this path (`supabase/functions/api/index.ts:3143–3166`). Decorating each note repeatedly scans task occurrences (`ios/Throughline/Services/TaskCoordinator.swift:172–194`).

**Proposed resolution:** Make cached, partially refreshed, complete, failed, and offline states explicit. Prefer a bounded/paginated snapshot or bounded-concurrency detail loading with progressive owner-bound publication; never delete cached notes because a detail failed or a capped/partial enumeration omitted them. Version/order merges so an old detail cannot overwrite a newer save or suppression. Define what “all notes” counts when only the cached window is available, including owners with more than 1,000 notes. Precompute tokens and note-to-occurrence maps on content/version changes, search off the main actor, cancel stale queries, and publish only for the current owner and query generation. A persistent incremental search database is not justified yet. Proposed warm-search gate: p95 input-to-visible-results at most 200 ms in a Release build on a named supported physical iPhone with 1,000 synthetic notes, no dropped input, and smooth scrolling. Measure cold loading, rebuilds, memory, and long-transcript/task-heavy cases separately; this review makes no latency claim.

### CS6 — material — Reusing the row requires a history-capable projection and recovery behavior

**Evidence:** The running-list projection intentionally omits completions from before today (`ios/Throughline/Models/RunningListProjection.swift:167–171`); handoff search includes all open and done tasks (lines 178 and 245). `TaskCoordinator.occurrences` retains the pending overlay (`ios/Throughline/Services/TaskCoordinator.swift:515–525`). The reusable-looking row/actions/time helpers are private (`ios/Throughline/Views/RunningListView.swift:312–353`), while sign-in/error/offline UI and completion settlement live in the parent (`:61–71`, `:249–284`). The tab's 600 ms settlement differs from the handoff page's retention until reopening (handoff line 166).

**Proposed resolution:** Extract the shared row/support components and occurrence-to-row formatting without changing shipped Home behavior. Search the full authorized occurrence collection, retaining its stable ID, recording ID, version, deletion filters, pending state, and completion history; never rebuild identity from text or array position. Carry the parent action/error/sign-in handling into pages/results. Maintain a page-visit set for completed-in-place rows and define how counts, Undo, movement, and refresh affect it. Claude must specify search completion/reordering and Undo placement as well. Preserve refreshed/cleared callbacks, equality optimization, source navigation, and non-gesture actions. Existing tests are useful bases, not proof for new contexts (`ios/Tests/TaskCoordinatorTests.swift:206–215`, `:340–362`; `ios/Tests/RunningListRowSupportTests.swift:23–38`).

### CS7 — material — Navigation must preserve RL7 and an accessible Stop action

**Evidence:** Home currently swaps its content while retaining the recorder as a sibling and foreground lifecycle at the Home level (`ios/Throughline/Views/HomeView.swift:32–81`). The bottom region contains the tray, permission/storage notices, and record/stop button (`:229–264`, `:290–318`). Handoff lines 170 and 393 hide the recorder whenever the keyboard appears, without defining what happens if recording is already active or whether the tray also hides. Navigation is currently only a Boolean (`HomeView.swift:143–156`), whereas the handoff adds nested pages and sheet-to-page/search routes.

**Proposed resolution:** Put the Notes route stack inside retained Home content; keep Home, its capture coordinator, selected running-list tab, and tray mounted. Do not trigger Home disappearance/foreground shutdown on an inner push. Claude specifies focus behavior during preparing/recording/finishing; recommended behavior is to defer search keyboard focus until recording stops, preserving the existing Stop control. Name exactly what is hidden for an idle search, including tray/notice visibility. Define Back/Cancel/Clear, return from result/page/note sheet, query restoration, cyclic related-page links, and focus restoration after a page loses its final note. Preserve the capture-hidden recording filters (`HomeView.swift:193–227`) across all new surfaces and cancel routes/results on account changes. This is interaction clarification, not authority to redesign recording or AI consent.

### CS8 — material — Cache protection and derived-data lifetime must be explicit

**Evidence:** Full Codable notes, including transcripts, are stored in owner-keyed UserDefaults (`ios/Throughline/AppState.swift:179–196`; `ios/Throughline/Models/ThroughlineNote.swift:251–265`). The owner-key hash namespaces records; it does not encrypt their contents. This path has no explicit file-protection/backup-exclusion settings. Sign-out clears displayed notes while deliberately retaining owner caches (`AppState.swift:138–147`); account deletion removes the owner's cache (`:150–155`). TaskStore already uses atomic protected files with backup exclusion (`ios/Throughline/Services/TaskStore.swift:108–132`).

**Proposed resolution:** Start with an in-memory, owner/generation-bound derived index and query; clear them on sign-out/account transition/deletion and reject late prior-owner results. Do not persist queries or add a second transcript database implicitly. Document the actual existing cache boundary without claiming it is either explicitly encrypted by the app or publicly readable. Prefer consolidating note-cache storage under the existing protected-file pattern during approved implementation, with verified read-back before retiring migrated data and defined locked-device/corrupt-cache behavior. If deferred, record that explicit protection/backup behavior remains unverified. A local storage hardening choice does not itself require new provider/data-use approval; a new destination, retention purpose, or policy promise would.

### CS9 — material — Proposed events do not yet define the retrieval metric or guardrails

**Evidence:** The six proposed event names/properties are at handoff lines 425–433. The ingestion vocabulary is closed and lacks them (`supabase/functions/_shared/product-event-contract.ts:8–43`, `:63–113`, `:245–257`); unknown names are rejected (`supabase/functions/api/index.ts:522–528`). Unknown properties are stripped (`product-event-contract.ts:211–228`). Search/retrieval remains future coverage in `product/metrics.md:127`. An index result is not a note open, and none of the proposed events supplies the “note shown” denominator for label-removal rate.

**Proposed resolution:** Freeze event lifecycle and bounded enum/boolean values before instrumentation. Distinguish search start, index-entry navigation, deliberate note/source opening, abandonment, and server-acknowledged removal; do not count a toggle, rerender, draft Remove, rejected save, or navigation to an index entry as an old-note retrieval. Add a content-free note-exposure denominator or revise the correction-rate definition. Define the primary metric in the canonical metrics file in the later approved change, including activation anchor, cohort, observation window, age boundary, deduplication, and incomplete/offline coverage. Keep raw query/label text and raw note/task/user/session identifiers out of analytic properties and reports. Retain the existing authorized first-party identity envelope and server pseudonymization instead of inventing another tracking identity (`ios/Throughline/Services/UploadClient.swift:560–566`; `supabase/functions/_shared/posthog.ts:84–123`).

### CS10 — material — Label usefulness and index size remain evidence gaps

**Evidence:** The production prompt asks for directly mentioned people/projects and grounded topical tags (`core/inference-contract.mjs:83–94`), but normalization permits empty arrays (`:404–429`, `:637–647`). Topical tags are not guaranteed verbatim speech. The handoff acknowledges absent production fill/distinct-label evidence (`docs/handoffs/2026-10-05-categories-search.md:59–63`).

**Proposed resolution:** Record Q1 as structurally feasible, with semantic reliability and production shape unverified. Preserve empty/thin/no-label states; interpret “as said” as unchanged extracted spelling, not a new guarantee of verbatim or correct extraction. Q8 remains pending with the query/operator below. Count-only evidence can measure availability/sprawl, not label correctness. Claude should state whether the aggregate is a readiness prerequisite or explicitly deferred evidence for Mike's eventual build decision. Do not quietly change extraction to make the index denser, or claim the index will stay small from synthetic fixtures.

### CS11 — minor — Reference hit areas conflict with the 44-point contract

**Evidence:** Handoff line 264 requires 44-point targets. The mock sets Clear height to 40, sheet chips to 34, and page source controls to a 22-pixel minimum (`selected-mock.html:97`, `:173`, `:147`). Its page excerpt is outside the source button (`:442–445`), unlike the required single VoiceOver button (handoff line 330). At the pinned app revision, the task source tap area has no minimum frame (`ios/Throughline/Views/RunningListView.swift:470–475`).

**Proposed resolution:** Make the native 44-point rule authoritative and align the reference hit-area/accessibility annotations in revision 2. Expand invisible hit regions or use full-row buttons without changing visual density; avoid nested-button conflicts. Explicitly add placement to the running row's accessibility label because children are ignored (`RunningListView.swift:448–457`). The 135% mock scale is an illustration, not proof of Dynamic Type, VoiceOver, contrast, or Switch Control.

## Q1–Q8 answers

| Question | Answer and evidence |
| --- | --- |
| **Q1 — fill without extraction changes** | The fields already exist and decode with empty defaults (`ThroughlineNote.swift:262–265`; `core/inference-contract.mjs:404–429`). Rendering them needs no extraction change. Reliable fill, groundedness, repetition, and useful density are not established. See CS10; Q8 cannot assess semantics. |
| **Q2 — removal, versions, revisions, evaluation, agent** | Extending `assertCurrentMutationFields` alone is insufficient. Current Edit uses `validateTaskEdit` and task-revision RPCs, while evaluation corrections have a distinct mask and eligibility path. Specify atomic suppression metadata, owner checks, expected versions, receipt replay, and projection to app/MCP; leave evaluation truth/eligibility unchanged. CS1–CS2 contain the source chain. |
| **Q3 — surviving reprocessing** | Not guaranteed today. Use a durable overlay outside fresh extraction output, with transactional concurrency and explicit restoration. Existing reprocessing rejections remain. CS2 gives replacement and guard evidence. |
| **Q4 — where normalization/folding runs** | Pure local computation is appropriate for offline index/search. Mirror the versioned key/suppression semantics on the server for validation and effective app/MCP reads; mirror folding if the “same labels” promise includes folded display labels. Share synthetic parity vectors, not duplicated informal algorithms. Existing MCP tokenization differs (`memory-tools.ts:249–271`, `:584–588`, `:661–666`); do not silently change its whole search algorithm or life-area coverage. CS3–CS4 must resolve exact edges first. |
| **Q5 — 1,000 notes/N+1** | Feasible in principle, unbenchmarked. Current cold refresh is up to 1,001 serial HTTP requests and cannot publish progressive arrivals. Cache tokens on content changes, use cancellable background filtering and lazy results, then measure the proposed 200 ms p95 warm-search gate. Persistent incremental indexing is not yet necessary evidence. CS5–CS6 cover loading, bounded library coverage, and done history. |
| **Q6 — transcript storage** | Search need not add storage or processors. UserDefaults already holds transcripts with owner namespacing, but this source does not establish explicit protection/backup settings. Use an ephemeral derived index, owner invalidation, and a separately verified protected-file migration if selected. CS8. |
| **Q7 — content-free events** | Feasible through the existing queue and first-party ingestion/PostHog sanitization, after updating closed name/property/enum contracts and tests. No proposed event is accepted today. Use the lifecycle proposal below; metric availability remains pending. CS9. |
| **Q8 — count-only aggregate** | **Pending; not executed, no service contacted.** Codex is the proposed operator in a later explicitly authorized read-only pass. The exact baseline query below returns only counts plus fixed field names, with per-owner computations grouped into anonymous count-shape distributions. It requires no label/content export. It does not prove final normalized/folded index size or semantic accuracy. |

### Q7 event and metric proposal for the next contract

- `notes_index_opened`: once on deliberate entry to Notes, not on recomputation.
- `notes_entry_opened {kind, via}`: `kind = person | project | topic`, `via = index | link | chip | search`; entry navigation only.
- `notes_search_started`: once when a visit first has a nonempty normalized query; focusing an empty field is not a search. Clear/retyping remains the same search visit until Cancel/Back/exit.
- `notes_search_result_opened {group, note_age_bucket}`: deliberate activation only. `group = index | todo | note`; an index destination uses `not_applicable`. A task qualifies only when its source note is opened, not when completed. Suggested age enums: `under_1_day`, `1_to_7_days`, `over_7_days`, `unknown`, `not_applicable`; exactly seven elapsed days is not “older than seven days.”
- `notes_search_abandoned {had_results}`: once when leaving a started search without activating a result, not for every query replacement or keyboard dismissal. Opening an index result prevents this navigation-abandonment event but still does not qualify as note retrieval. Specify background/process-termination loss as unobserved coverage.
- `note_label_removed {kind}`: after acknowledged durable Save, once per newly suppressed displayed key; no event for draft Remove/Undo/Cancel or rejected/uncertain writes. Replayed acknowledgements must not double count.

The primary measure should count distinct activated users with an intentional note/source open older than seven days via these retrieval surfaces, within a defined reporting window and cohort. Page/all-notes/chip-driven retrieval needs an equivalent content-free note-open qualification, not just search-result events. A new note-exposure event, or a revised denominator, is needed for removals per note shown. These are recommendations for `product/metrics.md`, not a competing canonical metric definition or measured outcome. Existing first-party identity joins stay inside that boundary; no extra raw identifiers are added to properties/PostHog. Device-derived age is diagnostic until the chosen qualification and offline-clock limitations are reconciled.

### Q8 exact baseline query — pending

**Operator:** Codex, in a future read-only pass authorized to contact the database. Execute in a read-only transaction with a bounded timeout. Validate against a local synthetic schema before remote execution. Do not log intermediate CTEs, bind private identifiers into tracked SQL, or return labels/owner identifiers. This pass has neither executed nor database-validated the query.

**Population and interpretation:** authenticated owners with at least one recording; all statuses counted for coverage, processed records with a structured object used for field fill. Arrays are type-checked. Nonblank string labels are trimmed and deduplicated per note; distinct/repeated labels use exact spelling with `C` collation. Each result row groups owners with identical count shapes, preserving per-owner distribution without returning an owner key. Empty-array and missing/wrong-type coverage are distinguishable. Life areas are measured only as a diagnostic field, not proposed for phone search. All data remains inside the database except counts and the four fixed field names.

```sql
WITH owners AS (
  SELECT auth_user_id,
         count(*) AS total_notes,
         count(*) FILTER (WHERE processing_status = 'processed') AS processed_notes
  FROM public.throughline_recordings
  WHERE auth_user_id IS NOT NULL
  GROUP BY auth_user_id
), ready AS (
  SELECT auth_user_id, id, structured_note
  FROM public.throughline_recordings
  WHERE auth_user_id IS NOT NULL
    AND processing_status = 'processed'
    AND jsonb_typeof(structured_note) = 'object'
), kinds(field) AS (
  VALUES ('people'::text), ('projects'), ('tags'), ('centers_of_balance')
), field_rows AS (
  SELECT r.auth_user_id, r.id, k.field,
         coalesce(jsonb_typeof(r.structured_note -> k.field) = 'array', false) AS is_array,
         CASE WHEN jsonb_typeof(r.structured_note -> k.field) = 'array'
              THEN r.structured_note -> k.field ELSE '[]'::jsonb END AS values_json
  FROM ready r CROSS JOIN kinds k
), labels AS (
  SELECT DISTINCT f.auth_user_id, f.id, f.field,
         btrim(e.value #>> '{}') COLLATE "C" AS label
  FROM field_rows f
  CROSS JOIN LATERAL jsonb_array_elements(f.values_json) e(value)
  WHERE jsonb_typeof(e.value) = 'string'
    AND btrim(e.value #>> '{}') <> ''
), fill AS (
  SELECT f.auth_user_id, f.field,
         count(*) AS ready_notes,
         count(*) FILTER (WHERE f.is_array) AS notes_with_array,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM labels l
           WHERE l.auth_user_id = f.auth_user_id
             AND l.id = f.id AND l.field = f.field
         )) AS notes_with_labels
  FROM field_rows f
  GROUP BY f.auth_user_id, f.field
), repetitions AS (
  SELECT auth_user_id, field, label, count(*) AS note_count
  FROM labels
  GROUP BY auth_user_id, field, label
), label_counts AS (
  SELECT auth_user_id, field,
         count(*) AS distinct_raw_labels,
         count(*) FILTER (WHERE note_count >= 2) AS repeated_raw_labels
  FROM repetitions
  GROUP BY auth_user_id, field
), shapes AS (
  SELECT k.field, o.total_notes, o.processed_notes,
         coalesce(f.ready_notes, 0) AS ready_notes,
         coalesce(f.notes_with_array, 0) AS notes_with_array,
         coalesce(f.notes_with_labels, 0) AS notes_with_labels,
         coalesce(l.distinct_raw_labels, 0) AS distinct_raw_labels,
         coalesce(l.repeated_raw_labels, 0) AS repeated_raw_labels
  FROM owners o CROSS JOIN kinds k
  LEFT JOIN fill f ON f.auth_user_id = o.auth_user_id AND f.field = k.field
  LEFT JOIN label_counts l ON l.auth_user_id = o.auth_user_id AND l.field = k.field
)
SELECT field, total_notes, processed_notes, ready_notes,
       notes_with_array, notes_with_labels,
       distinct_raw_labels, repeated_raw_labels,
       count(*) AS owners_with_shape
FROM shapes
GROUP BY field, total_notes, processed_notes, ready_notes,
         notes_with_array, notes_with_labels,
         distinct_raw_labels, repeated_raw_labels
ORDER BY field, total_notes, processed_notes, ready_notes,
         notes_with_array, notes_with_labels,
         distinct_raw_labels, repeated_raw_labels;
```

Fill rate is `notes_with_labels / ready_notes`, undefined when the denominator is zero. Schema evidence: `supabase/migrations/0001_throughline_memory.sql:4–17`, `supabase/migrations/20260516173641_user_accounts_and_mcp_tokens.sql:13–14`, and label contract `core/inference-contract.mjs:112–115`.

Raw distinct counts bound potential label volume but **raw repeated counts are not the final index count**: case/diacritics can combine labels, while folding/suppression can remove memberships. Do not substitute PostgreSQL `lower`/`unaccent` for the frozen Unicode rule without parity tests. After CS3–CS4 are resolved, an exact normalized/folded count-only projection can be reviewed and executed inside the database boundary if actual index-size evidence is required. No labels should be downloaded to compute it. Owners without recordings and legacy unauthenticated rows are outside this query's population; results are shape evidence, not public-cohort outcomes.

## Feasibility of every selected rule

References below use **H** = `docs/handoffs/2026-10-05-categories-search.md`, **M** = its frozen `assets/2026-10-05-categories-search/selected-mock.html`. These remain revision-1 references.

| Rule | Feasibility, implementation constraint, and required check |
| --- | --- |
| 1 — sources/readiness (H:222) | Existing fields suffice. Positively define ready/legacy/failed statuses (CS4); exclude life areas from phone labels/search; processing titles only. Test ready-to-processing/failure transitions and tray-hidden notes. |
| 2 — key/display spelling (H:223–229) | Pure deterministic projection is feasible. Freeze Unicode normalization and tie behavior, preserve original display text/ranges, never use normalized key as task identity (CS3–CS4; M:276–277, :298). |
| 3 — within-note folding (H:230) | Whole-word contiguous-run matching is straightforward (M:278–291). Suppression precedes folding; deduplicate by key per distinct note. Test token boundaries, empty keys, accents, and folded-child removal (CS3). |
| 4 — kind precedence (H:231) | Owner-local aggregate can take person, project, then topic (M:297). Recompute after effective membership changes; clarify note-local versus global kinds in chips/Edit (CS3). Never merge different keys. |
| 5 — two-note threshold (H:232) | Count distinct eligible recording identities, not array entries (M:299–305). Maintain a separate full membership map so an already-open one-note page survives; zero-note closure must pop safely and restore focus. |
| 6 — ordering (H:233) | Sort by kind, latest source timestamp, distinct-note count, localized label (M:303–305); specify deterministic ties and rebuild on locale changes. Show/Hide remains visit-local, five entries per section. |
| 7 — page to-dos (H:234) | Intersect effective note membership with open stable occurrences whose own tokens contain the full label run (M:313–316). No inherited-category-only task matches. Reuse placement calculation; retain just-completed page rows/Undo as explicitly defined (CS6). |
| 8 — comes up with (H:235) | Count shared distinct eligible notes across effective entries, excluding self, rank by overlap then index order, cap at three (M:319–321). Recompute after removal and prevent stale/empty destinations. |
| 9 — excerpts (H:236–242) | Feasible after script correction (CS4; M:325–333). Select the exact transcript sentence, then long-word fallback, then summary match/first sentence; quote only transcript text. Preserve original text and handle absent summary/transcript without fabricating a quote. Two-line visual clamp must not fragment the accessibility element. |
| 10 — search (H:243–248) | All normalized query terms must prefix some word in the same item; note terms may span the specified fields. Index entries cap at three; tasks match only own words, including historical done; notes include most important but exclude life-area-only matches. Define normalized-empty queries; use the full occurrence source and owner-bound caches (CS4–CS6). |
| 11 — placement tag (H:249) | Reuse placement/marker logic (`RunningListProjection.swift:136–143`, :177–201). Add neutral placement after the shipped marker; done suppresses other markers. Include it in VoiceOver and retain mutation/source actions, pending and error states (CS6, CS11). |
| 12 — time labels (H:250–254) | Extract/reuse the existing source formatter (`RunningListView.swift:325–349`); implement a separate day-only formatter with the same calendar/timezone/locale invalidation. Specify the 7-day boundary explicitly: current source formatter includes dates from seven calendar days ago. Test today/yesterday/6/7/8 days, midnight, DST, timezone/year changes and equal timestamps. |

Navigation is feasible with the retained Home model in CS7. All-notes card behavior can be reused from `HomeView.swift:173–190`; adding the date is a bounded presentation change. Note-sheet chips require an explicit dismissal-then-route action on the current owner/note generation. Search Clear keeps focus, Cancel clears/dismisses to index, keyboard dismissal preserves query, and index-level Back clears and returns Home; specify restoration when a result page is popped. Saving an effective removal must refresh counts, related links, chips, excerpts and search from the same accepted state, without publishing a stale full-note refresh afterward.

## State and accessibility table review

| Handoff row | Feasibility and remaining requirement |
| --- | --- |
| Loading (H:313) | Requires the progressive publication/state work in CS5. Distinguish initial no-cache loading from a truly empty library; partial counts are provisional. Task snapshot loading may finish independently. |
| Empty (H:314) | Feasible: no field only after known zero notes; otherwise thin state when no repeated eligible label. An empty offline cache is not proof of no server notes. |
| Error/retry (H:315) | Preserve cache and expose refresh error even when nonempty. Pull-to-refresh plus an accessible explicit retry action. Separate known rejected removal from uncertain dispatched Save (CS1); retain form, conflict explanation and reconciliation path. |
| Offline/degraded (H:316) | Read-only retrieval is feasible from cache. Task actions keep durable pending/error/sign-in behavior; label saves follow the frozen-request rules rather than pretending to succeed. Distinguish network loss, auth expiry, incomplete note details and local storage unavailability (CS1, CS5–CS8). |
| Permission denied (H:317) | No new permission needed. Preserve current microphone, AI opt-out/Agree-and-record, storage and sign-in controls; search existing authorized notes remains available. Do not make search trigger AI consent. |
| Long/localized content (H:318) | Native wrapping/lazy lists feasible. Check long labels, unbroken tokens, Unicode prefixes, long note titles, multi-line chips and two-line excerpts at narrow widths. Use the clarified sentence/range rules (CS4). |
| Light/dark (H:319) | Existing tokens can serve the design. Verify highlight/text/disabled/pending/pressed contrast in both appearances; the frozen pixels are targets, not native contrast evidence. |
| Dynamic Type (H:320) | Semantic fonts/scaled metrics, growing rows, wrapping chips and top-aligned trailing count/chevron are feasible. Test largest accessibility sizes at small-phone width, keyboard and large counts; 135% CSS scaling is insufficient (CS11). |
| VoiceOver/focus (H:321) | Implement the precise ordering below and test on device. Existing row ignores child accessibility elements, so placement must enter its combined label (CS11). |
| Reduce Motion (H:322) | Respect system reduced-motion navigation, disable Show/Hide animation, and preserve the row's existing reduced-motion behavior (`RunningListView.swift:434`). No extra animation/haptic/audio is required. |

Every VoiceOver subrule at H:324–334 is implementable: Back → Notes → search → status → ordered sections; header counts; combined index kind/count/date; explicit Show/Hide names; one combined page header and separate related-entry buttons; a single source/excerpt button; existing task custom actions plus placement; named chip buttons; named Remove/Undo; and no separate highlight announcements. Also specify focus restoration after sheet routing, deletion/pop, and Cancel, and avoid stealing focus on each live result update. New control hit areas must be at least 44 points and have non-swipe paths. Existing task swipe/vertical-scroll interaction needs revalidation in each new container.

Additional states implied by the contract need explicit coverage: signed-out/owner-switch invalidation; unknown label-save outcome across relaunch; version conflict; stale/deleted source note; unsupported/evaluation-lineage edit; all tasks/notes still loading independently; page count dropping two → one → zero; active recording when search is requested; hardware keyboard/focus without software keyboard; and capture processing continuing through page/sheet navigation. None is established by the 28 static screens.

## Data, privacy, authority, and testability requirements

The read contract should distinguish immutable extraction truth, effective labels after suppression, metadata version, task revision/snapshot, ready status, and stable occurrence provenance. Cached and remote responses must carry enough version information to prevent older data from restoring a removed label. No normalized label key or query is an analytics identifier. Account-generation checks must cover fetching, indexing, route changes, and asynchronous result delivery.

Original extraction fields and suppressed raw values remain inside the existing owner-authorized private data boundary; reports/fixtures/events use synthetic content or counts only. The agent sees effective labels; historical evaluation references retain exact immutable content. No implicit training, new reviewed-field eligibility, contribution, or expanded retention follows from removing a label.

The proposed work needs a bounded storage/API migration and read-projection change if approved. It does **not** require changing extraction prompt/schema/normalizer, provider, base model, data-use policy, onboarding, pricing, recording limits, or App Store state. Any proposal to improve fill by changing extraction, add a processor/server semantic search, alter private-evaluation eligibility/retention, or change recording/consent behavior crosses the current scope and must return to Mike under the relevant authority gate. No such action is authorized here.

Required later verification:

- Pure synthetic rules: Unicode/ties/empty keys, dedup/folding/suppression, readiness transitions, two-note thresholds, related entries, excerpts/highlights, prefix multiword searches, done history, time boundaries and locale changes.
- Transaction/database contracts: owner isolation, additions/renames rejected, expected-version conflicts, atomic mixed Edit rollback, repeated exact receipt, same mutation with changed body, unknown-result retry, legacy/lineage handling, removal versus processing race, deletion cascade and explicit restoration.
- Projection parity: app detail/list/cache and every relevant MCP read; label-only match removed while source words still match; original extraction/revision hashes and evaluation eligibility unchanged.
- Client recovery: partial/capped fetch never implies deletion, stale response cannot overwrite a newer edit, cache/protection migration failure, owner switch during indexing, durable unknown save after relaunch, source disappearance and capture-hidden records.
- Analytics: closed vocabulary/enums, arbitrary text/identifier rejection, no query persistence, retry deduplication, exact search-visit lifecycle, exposure denominator and cohort/age coverage. Existing contract tests at `supabase/functions/_shared/product-event-contract_test.ts:82` are a baseline to extend.
- Native interaction: all frozen views/sizes; largest text, VoiceOver, Reduce Motion, Switch Control/non-gesture paths, keyboard/Stop/tray, swipe versus vertical scroll, offline and account transitions. Release-device performance uses the named dataset/device/threshold from CS5.

These are future acceptance requirements, not tests added or reported as passing in this review.

## Checks completed, remaining checks, and recommended document updates

Completed locally on 2026-10-05: checkout/ancestry and exact hash checks; all 29 manifest entries, rechecked at closeout; canonical/source/test inspection; four in-memory synthetic mock probes described in CS4; and `npm run docs:verify` (19 backlog items, 49 checked Markdown files at baseline and closeout). The report has no whitespace errors; its 11 severity-tagged findings, Q1–Q8 and 12 rule rows were checked. HEAD remained the pinned commit at closeout. No native/backend test suite, simulator, device build, performance benchmark, database query, or remote verification was run. Asset integrity does not prove native rendering or accessibility.

Still unverified: Q1 semantic/fill reliability; Q8 production shape and query execution; exact revised normalization parity; all proposed mutations/suppressions/recovery behavior; effective agent reads after removal; protected-cache properties on device; analytics reconciliation; every new native state, keyboard/recording interaction and accessibility check; and performance at 1,000 cached notes. Public release/runtime status is outside this pass.

Recommendations only, with **no edits** to the named files:

- Claude updates the handoff/mock in revision 2, records this review and each finding's disposition, and freezes new hashes. Preserve Mike's Candidate B selection and the unapproved build-entry gate.
- A subsequent canonical update should link this review from `docs/CURRENT_STATE.md` with its verification date and local-only scope; update TL-KNOW-001's stale next action in `product/backlog.json` without marking it approved for build; and record the selection in `decision-log.md` only if absent. Do not rewrite historical decisions.
- Before instrumentation, define the retrieval and correction metrics in `product/metrics.md`, the sole metric-definition source. Keep pending coverage distinct from zero outcomes.

**Closeout:** changes requested; **2 blocking / 8 material / 1 minor**. **One next action: Claude resolves the findings in revision 2.**
