---
handoff_id: "2026-10-05-categories-search"
project_name: "Categories and search — an index that writes itself"
backlog_id: "TL-KNOW-001"
slice_brief: "docs/evidence/2026-10-05-categories-search-candidates.md"
tandem_stage: "selected_pending_codex_feasibility_review"
handoff_revision: 2
prior_revision: "1, committed in 6e1768b, SHA-256 26def2dd4ce186ac9eed005267ba3457fc8ad724d07506620123f5244e6e7554"
feasibility_review: "docs/evidence/2026-10-05-categories-search-feasibility.md"
base_revision: "6b0cbbe"
created_on: "2026-10-05"
verified_on: "2026-10-05"
design_agent: "Claude Code"
implementation_agent: "Codex"
decision_owner: "Mike"
authority: "design_only"
selected_candidate: "B — An index that writes itself"
selection_record: "Mike, 2026-10-05, Claude Code session: \"I choose candidate B (an index that writes itself).\""
product_decisions: "Mike, 2026-10-05: selected Candidate B. Build entry is not approved."
owned_paths:
  - "docs/handoffs/2026-10-05-categories-search.md"
  - "docs/handoffs/assets/2026-10-05-categories-search/"
  - "mockup/categories-search/"
  - "docs/evidence/2026-10-05-categories-search-candidates.md"
---

# UI Design Handoff: Categories and search — an index that writes itself

Follow [the Claude Code + Codex tandem workflow](../AGENT_TANDEM.md).

**Stage note.** This is revision 2.
- Mike selected Candidate B on 2026-10-05.
- Codex reviewed revision 1 for feasibility on 2026-10-05 and requested changes: 2 blocking, 8 material and 1 minor finding ([review](../evidence/2026-10-05-categories-search-feasibility.md)). This revision resolves each one. The [revision 2 changes](#revision-2-changes) table maps them.
- The stage stays `selected_pending_codex_feasibility_review` until Codex re-reviews this revision. Claude sets `handoff_ready` only after that re-review is recorded below and any new findings are resolved.
- This document is not implementation authority. Build entry is Mike's separate decision.

**Base.** Prepared on the shared local `codex/running-list` branch at `6b0cbbe64bb3816f2ac45650a649e7236308c85b`.
- Revision 1 was committed in `6e1768b`. After it, the interaction repair (`231755e`, with corrections through `6b0cbbe`) changed Home and the running-list row: a UIKit swipe recognizer that checks scroll views from the touch it receives (`64ed72c`), 44 pt targets, a tray height budget that reserves the list-tab height only outside Notes (`cfa7578`), and Back and Notes stacked at accessibility text sizes. This design inherits all of it. That repair is not released.
- Running List 1.0.5 (2026100502) is in App Review per [CURRENT_STATE](../CURRENT_STATE.md). Apple state was not refreshed for this handoff.
- iOS view line references below are at `6b0cbbe`. The other cited service, model and backend files are unchanged since `6e1768b`, so the review's line references still hold for them.
- The brief, candidates and original questions are in the [candidates record](../evidence/2026-10-05-categories-search-candidates.md).

## Revision 2 changes

| Finding | Resolution in this revision | Where |
| --- | --- | --- |
| CS1 (blocking) Remove must join the versioned Edit transaction | Remove is staged in the Edit draft and goes with Save in one atomic, removal-only, versioned, idempotent request. A known rejection applies nothing. An unknown outcome keeps the shipped frozen state, which survives relaunch. Cancel discards only an undispatched draft. Records with an evaluation revision show their labels without Remove. | [Edit contract](#edit-contract), frames `edit`, `edit-unconfirmed`, `edit-locked` |
| CS2 (blocking) Durable suppression and one effective projection | A suppression overlay stored outside extraction output, keyed by note and `label-key-v1` key. One effective projection serves every app and agent read. Rollback hides the UI and keeps suppressions enforced. "No schema change" now reads "no extraction-schema change". | [Suppression and the effective labels](#suppression-and-the-effective-labels) |
| CS3 Suppression identity, folding, kinds, ties | Suppression applies before folding, in every kind. Removing a person or project also suppresses the topics folded into it, with that provenance stored. Empty keys are invalid. Spelling and sort ties are fully ordered. Kinds are owner-wide. | [Rules](#rules) 2–6, [Edit contract](#edit-contract) |
| CS4 The mock is not an exact oracle | The mock's rules section is now the executable oracle, checked by 123 synthetic vectors plus 5 calendar checks (`node verify-rules.mjs`, 128 in all). Sentences, highlights, all searched fields, empty queries and the ready predicate are defined. Frames the script does not simulate are marked "static illustration". | [Rules](#rules), [verify-rules.mjs](assets/2026-10-05-categories-search/verify-rules.mjs) |
| CS5 Loading, cached coverage, performance | Explicit cached, loading, complete, refresh-failed (with and without cache) and offline states. Loading is progressive and never deletes. Counts are provisional while loading. The whole library is enumerated, with no silent cap. A visible Try again. A 200 ms p95 warm-search gate. | [Loading and refresh](#loading-and-refresh), frames `loading`, `error`, `error-empty`, `offline` |
| CS6 Reusing the row | The row is the shared running-list row over the full occurrence collection, including done history. Each page visit keeps a set of rows completed in place, with Undo. Moves update the tag without reordering. Results keep their positions until the query changes. Placement is in the accessibility label. | [To-do rows outside the running list](#to-do-rows-outside-the-running-list) |
| CS7 RL7 and an accessible Stop | The Notes route stack lives inside Home. Exactly what hides while typing is named. Search pauses while recording, so the keyboard never covers Stop. Back, Cancel, return and focus rules. Account changes return Home. Capture-hidden filters hold everywhere. Search never asks for AI consent. | [Navigation and routes](#navigation-and-routes), [Recording and the keyboard](#recording-and-the-keyboard), frame `search-recording` |
| CS8 Cache protection and derived data | The index and queries are in memory only and owner-bound. The existing cache boundary is documented. Protected-file migration is deferred and the gap is recorded. | [Data and privacy](#data-and-privacy) |
| CS9 Events and the metric | A frozen event lifecycle with bounded values. `note_opened` gains `surface`, `note_age_bucket` and `has_labels`, and serves as both the retrieval qualification and the exposure denominator. Codex defines the metric in `metrics.md`. | [Measurement and safety](#measurement-and-safety) |
| CS10 Label usefulness and index size | Q1 is structurally feasible, with semantics unverified. "As said" means unchanged extracted spelling. Q8 is deferred evidence for Mike's build-entry decision, not a prerequisite for `handoff_ready`. | [Evidence](#evidence), [Codex handoff](#codex-handoff) |
| CS11 Hit areas | The native 44 pt rule is authoritative. The mock now gives Clear, chips, source buttons and links 44 pt targets. Each "where you said it" row is one button. | [Non-gesture alternatives](#non-gesture-alternatives) |

The four new frames are `edit-locked`, `edit-unconfirmed`, `search-recording` and `error-empty`. The `error` frame gained Try again. The other 27 screens are pixel-identical to revision 1.

## Current

- Home has the wordmark, a `notes` button and the gear. `notes` swaps the running list for `notesContent` inside the same Home view, so the recorder and capture tray stay mounted (RL7). Source: `notesContent`, [HomeView.swift:217](../../ios/Throughline/Views/HomeView.swift:217).
- Navigation inside Home is one Boolean. The bar reads "‹ Back" and "Notes", stacked at accessibility text sizes since `231755e` (`topBar`, [HomeView.swift:176](../../ios/Throughline/Views/HomeView.swift:176)).
- Notes is one chronological list of full `CapturedCard`s ([HomeView.swift:627](../../ios/Throughline/Views/HomeView.swift:627)). It has no search and no grouping. The card eyebrow shows `type · time` without a date.
- Loading: `UploadClient.listNotes()` makes one list request, then a detail request per note in series, and publishes only after every detail succeeds ([UploadClient.swift:691](../../ios/Throughline/Services/UploadClient.swift:691)). The server list caps at 1,000 with no continuation (`api/index.ts:3143–3166`). Home shows its refresh error ("Couldn't refresh your notes. Pull down to try again.", [HomeView.swift:436](../../ios/Throughline/Views/HomeView.swift:436)) only when nothing is cached.
- Extraction already returns `people`, `projects`, `tags` and `centersOfBalance` for processed notes ([ThroughlineNote.swift:164](../../ios/Throughline/Models/ThroughlineNote.swift:164)). The arrays may be empty. The app shows only the life-area pills on cards.
- Edit goes through the `task_contract_version == 1` branch (`api/index.ts:1304–1328`), validated by `validateTaskEdit`, which has no labels (`api/tasks.ts:96–109`). The edit RPC compares `expected_task_revision` (`20260930231946_running_list_occurrences.sql:259–301`) and rejects records with a current evaluation revision (`:223–225`).
  - The editor freezes the request durably before dispatch and keeps an uncertain save across relaunch (`TaskCoordinator.swift:297–306`, `:443–500`).
  - While frozen, fields are read-only, Close replaces Cancel, and the form shows "Couldn't confirm the save. Tap Save to try again." ([HomeView.swift:943](../../ios/Throughline/Views/HomeView.swift:943), [:1088](../../ios/Throughline/Views/HomeView.swift:1088)).
  - A version conflict also makes the fields read-only and shows Close.
- The connected agent can search all labels through the MCP `search` tool and receives the stored labels unchanged (`_shared/memory-tools.ts:489–520`). The person cannot.
- People, projects and tags cannot be edited.

## User problem

Getting back to something you said more than a week ago is hard. Mike's direction (decision log, 2026-09-30): categories are assigned automatically from what was said, and one search finds both notes and to-dos.

## Evidence

| Evidence | Provenance |
| --- | --- |
| [today](../../mockup/categories-search/current/today-light-sim.png), [notes](../../mockup/categories-search/current/notes-light-sim.png) and [note sheet](../../mockup/categories-search/current/source-light-sim.png) captures | Simulator, iPhone 17 Pro, iOS 26.3, Debug build of `8b30dd8`, synthetic preview data, light. They predate `231755e`, which changed hit areas and the accessibility-size bar, not this layout. |
| Source listed under [Current](#current) | Source at `6b0cbbe`, backend unchanged since `6e1768b` |
| [Codex feasibility review](../evidence/2026-10-05-categories-search-feasibility.md) of revision 1 | Codex, 2026-10-05, local read-only source and design review at `6e1768b`, with four synthetic probes of the revision 1 script |
| [Rule vectors](assets/2026-10-05-categories-search/verify-rules.mjs) | Claude, 2026-10-05: 128 of 128 synthetic checks pass against the mock's rules section in Node, with no network |
| Extraction prompt and labeled fixtures | Synthetic fixtures only: tags often repeat a project, and people are 0–1 per note |

**Gaps.**
- There is no physical-device, TestFlight or production evidence.
- Q1: label fill is structurally feasible because the fields exist and decode. Whether they are reliably filled, grounded and repeated is unverified. Topics are extracted, not guaranteed verbatim. "As said" in this design means the extracted spelling, unchanged. It is not a promise that the extraction is correct or verbatim.
- Q8: production label counts are unknown. Codex's count-only query is written but not run. Its disposition is under [Codex handoff](#codex-handoff).
- There is no retrieval instrumentation.
- The 1.0.5 build in App Review is not inspected here.

## Canonical fit

- Text first and quiet. Home gains no chrome, and the new surfaces live one level inside Notes.
- Labels display as extracted. Nothing is invented, renamed or merged across different words.
- To-dos stay the running-list row, with the same completion, swipe, ••• and source label.
- Existing tokens only. Blue is kept for links, Show/Hide, Try again and Save. The match highlight uses the pill tint.
- Copy uses "notes" and "to-dos", lowercase section labels, and no exclamation marks.

## Candidates

Gallery: [candidates.html](../../mockup/categories-search/candidates.html) (SHA-256 `8e9f05e9fb385feb3ccf85fce3eed8c322b458d2e5512ecebb1ad73eb7fbc826`). Its renders are in [mockup/categories-search/screens/](../../mockup/categories-search/screens/), listed in its [SHA256SUMS.txt](../../mockup/categories-search/SHA256SUMS.txt). The candidates are unchanged in revision 2.

### Candidate A — Search the library

- Core idea: "notes" opens Notes with search at the top. Named people, projects and topics appear as chips under "you keep coming back to", and each opens a scoped search.
- Mock source: `candidates.html?only=a-library` (and `a-results`, `a-topic`, `a-note`, `a-edit`, `a-none`, `a-empty`, `a-offline`).
- Inspected screenshot: [a-library-light-390x844.png](../../mockup/categories-search/screens/a-library-light-390x844.png).
- Strengths: one entry point; works from the first note; mirrors the agent's search; smallest new surface.
- Risks: categories feel secondary.

### Candidate B — An index that writes itself (selected)

- Core idea: "notes" opens an index of people, projects and topics that come up in two or more notes. Each entry has a page, search sits at the top, and all notes is one row down.
- Mock source: `candidates.html?only=b-index` (and `b-page`, `b-results`, `b-note`, `b-edit`, `b-thin`, `b-none`, `b-offline`).
- Inspected screenshot: [b-index-light-390x844.png](../../mockup/categories-search/screens/b-index-light-390x844.png).
- Strengths: the most durable knowledge-base feel; best for people and projects; every page shows where you said it.
- Risks: visible duplicates and label sprawl; thin at first; the most new screens.

### Candidate C — Five life areas, search from Home

- Core idea: a search icon in the Home bar, and Notes filtered by the five fixed life areas, with "profession" shown as "work".
- Mock source: `candidates.html?only=c-home` (and `c-results`, `c-notes`, `c-area`, `c-note`, `c-edit`, `c-none`, `c-offline`).
- Inspected screenshot: [c-home-light-390x844.png](../../mockup/categories-search/screens/c-home-light-390x844.png).
- Strengths: calm; a closed set that never sprawls.
- Risks: "work" covers most notes (about 14 of 16 fixtures), so it is coarse; it is the least literally "what was said"; Home gains chrome.

## Selection

- Selected candidate: B, an index that writes itself.
- Mike's exact selection record: 2026-10-05, "I choose candidate B (an index that writes itself)."
- Claude recommended A, and Mike chose B. He also asked what "A with B's pages" meant. Claude explained it as A's chips opening B's pages, and that hybrid was not selected.
- Required revisions: none from Mike.
- Clarifications Claude made while freezing revision 1. None changes the selected idea, and each is shown in the frozen mock.
  1. The candidate said page to-dos inherit their note's categories. The page now lists only open to-dos whose own words contain the label, which is what the candidate frame showed. The section is left out when none qualify.
  2. The placement tag (today, this week, later, done) is a neutral tag. Blue stays reserved for the shipped date markers.
  3. Source labels use the shipped running-list time format. "last said" and page spans use a day-level form.
  4. Quotation marks are used only for transcript text. A summary fallback is unquoted.
  5. The index is ordered by kind section, then last said, then count, then label.
  6. Each section shows five entries, then the shipped Show/Hide control.
  7. All notes is today's card list unchanged, except that the eyebrow gains the date.
- **Claude decisions in revision 2 that Mike may override.** Each answers a feasibility finding. None has Mike's selection yet, and each can change without reopening the candidate choice.
  1. Removing a person or project also removes the topics that were folded into it on that note. Otherwise "pricing" would appear the moment "pricing page" is removed (CS3).
  2. Search pauses while a recording is being prepared, recorded or finished, so the keyboard never covers Stop (CS7).
  3. A label takes one kind across all notes, so its chip, Edit row, page and results agree (CS3).
  4. Highlights cover whole words, not just the typed prefix (CS4).
  5. "last said" uses the weekday for dates two to seven days ago, which matches the shipped source-time boundary. Dates in another year add the year (rule 12).
  6. An ellipsis does not end a sentence. Abbreviations such as "Dr." do end one, which can split a quote early (rule 9).
  7. A failed refresh shows a visible Try again as well as pull to refresh (CS5).
  8. Notes with a Private Evaluation revision show their labels without Remove, and say so (CS1).
- Rejected alternatives:
  - A: categories become secondary to a search box.
  - C: "work" is too coarse, it is the least grounded in what was said, and it adds Home chrome.

## Selected experience

Frozen target: [selected-mock.html](assets/2026-10-05-categories-search/selected-mock.html). Use `?only=<frame>` for one frame, with `&theme=dark`, `&ax=1` (larger text) and `&w=375&h=667`. All data is synthetic. "Now" in the mock is Monday, October 5, 9:41 AM.

The mock's rules section is executable and is the oracle for [Rules](#rules). Frames marked "static illustration" show a state that the script does not simulate: `index-long`, `edit`, `edit-locked`, `edit-unconfirmed`, `search-recording`, `loading`, `offline`, `error`, `error-empty` and `processing`. Saving, loading, recording and navigation are described here, not simulated there.

### Entry

- Home is unchanged. `notes` opens Notes on the index, not the card list.
- Notes stays inside Home, as today. The recorder and capture tray stay mounted at every level of Notes (RL7).
- The bar reads "‹ Back" and "Notes" at every level, stacked at accessibility text sizes as shipped.

### Index (`index`, `index-long`, `thin`)

From the top:
1. The search field: "Search notes and to-dos".
2. A status line when one applies (loading, offline or refresh failed).
3. Sections, each shown only if it has entries:
   - `people`
   - `projects`
   - `topics`
4. An `all notes` row with the count of notes on the phone.
5. The foot: "Things you've mentioned once are on their note and in search."

Each entry row is a button with:
- the label in its display spelling, wrapping and never truncated;
- "last said {day}" on the line below;
- the note count, trailing;
- a chevron.

Tapping the row opens the entry's page.

Each section shows its first five entries. More than five adds a row reading "{n} more people" (or projects, topics), with "Show" in blue. Expanded, the section shows all entries and the row reads "Hide". This follows the shipped `earlierSection` control. The state lasts while Notes stays open and is not persisted.

When notes exist but nothing repeats yet, the index shows only:
- the field;
- "Nothing has come up twice yet." with "When a person, project or topic appears in two notes, it gets its own page here.";
- the all notes row.

### Entry page (`page`, `page-quiet`)

From the top:
- The kind as an eyebrow: person, project or topic.
- The label as the title.
- "{n} notes · {first day} to {last day}". When both are the same day, only that day is shown.
- "comes up with {A} · {B} · {C}". Each name is a blue link that opens that entry's page. The line is left out when there is none.
- `open to-dos {n}`: running-list rows, each with its placement tag and source label. The section is left out when there are none at page open.
- `where you said it`: every note in the entry, newest first. Each is one button: "{note title} · {source time}" over a two-line excerpt with the label highlighted. Tapping it opens the note sheet.

### Search (`results`, `once`, `none`)

- Tapping the field focuses it and shows Cancel. What hides while typing is under [Recording and the keyboard](#recording-and-the-keyboard).
- Results update as you type.
- Clear (the ⓧ) empties the field and keeps focus.
- Cancel clears the field, dismisses the keyboard and returns to the index.
- Dismissing the keyboard keeps the query and its results, with Cancel still shown.
- A query with no terms (empty, spaces or punctuation only) behaves as an empty field: the index shows and no results do.

Results are grouped in this order. Each group appears only if it has matches.
1. `in your index`: up to three matching entries, in index order. The row's second line reads "{kind} · {n} notes · last said {day}".
2. `to-dos {n}`: matching to-dos as running-list rows. Open to-dos come first, by placement (today, then this week, then later), then done. Within each, the newest note comes first.
3. `notes {n}`: matching notes, newest first. Each row shows:
   - the title and source time;
   - an excerpt by rule 10;
   - "about {up to three labels}", joined with " · ".

Matching words are highlighted as whole words, using the pill tint.

When nothing matches, the screen shows “Nothing matches “{query}”.” and "Search looks through your notes, what you said, and your to-dos." The field stays focused.

### All notes (`all-notes`, `processing`)

- The heading "all notes" sits over "{n} notes", the notes on the phone.
- Below it is today's `CapturedCard` list, unchanged in behavior (discard, grade, to-do toggles, opening the sheet). The one change: the eyebrow reads "{type} · {source time}" in the running-list format.
- Pull to refresh stays.
- A note still processing, or one whose processing failed, shows the shipped card with the shipped `ProcessingStatusRow` copy.

### Note sheet (`note`)

The note sheet gains one row under the title: an "about" eyebrow followed by the note's effective labels as chips, in the order people, projects, topics, each in its owner-wide kind.
- If the label has an index entry, tapping its chip dismisses the sheet and opens that page (see [routes](#navigation-and-routes)).
- Otherwise, tapping it opens Notes search with the label as the query (`once`).
- A note with no effective labels has no row.

### Edit (`edit`, `edit-locked`, `edit-unconfirmed`)

`NoteEditForm` gains an `about` section after to-dos and before the transcript. Each label is a row with:
- the label;
- its owner-wide kind in small secondary text;
- a "Remove" button.

Removing a label:
- After Remove, the row shows the label struck through, "{kind} · removed" and "Undo". Nothing is sent yet.
- The foot reads: "Chosen from what you said. Removing one takes this note off that page, here and for your agent."
- Save sends the removals with any other edits in one request (the [Edit contract](#edit-contract)). Cancel discards the draft.
- Labels cannot be added or renamed. Nothing asks you to add labels.

**A note with a Private Evaluation revision** (`currentRevisionID != nil`, `edit-locked`): its edits follow the evaluation correction path, which does not accept labels.
- The section lists the labels without Remove.
- The foot reads: "Chosen from what you said. Labels on this note can’t be removed."
- The shipped "How we treat recordings" link stays where it is.
- No label change is routed into evaluation correction or eligibility.

**An unknown outcome** (`edit-unconfirmed`): the shipped frozen state, unchanged.
- The form shows "Couldn't confirm the save. Tap Save to try again."
- Fields, Remove and Undo are read-only. Close replaces Cancel.
- Save retries the same request. The state survives relaunch.

After an acknowledged Save that removes a label:
- Counts, "comes up with", chips, excerpts and search are recomputed from the acknowledged state. A later refresh that predates it cannot bring the label back (see [Loading and refresh](#loading-and-refresh)).
- An entry with fewer than two notes leaves the index.
- A page that is already open stays until Back. If its entry has no notes left, it closes (see [routes](#navigation-and-routes)).
- The note can still be found by the words in its transcript and summary. Only the label is gone.

### Edit contract

This is the product contract. Codex freezes the wire fields and names.

1. **One transaction.** Save sends a single request carrying the content and to-do edits, if any, and the label removals. The request is applied whole or not at all.
2. **Removal only.** A removal names `label-key-v1` keys (`key_version: 1`). Each key must currently be effective on that note. Additions, renames, empty keys, keys not on the note and unknown key versions reject the whole request.
3. **What one Remove sends.** One key for a topic. For a person or project, its key plus the keys of the topics folded into it on that note (rule 4). Each folded key records the key it was removed with, so a later restoration can find it.
4. **Versions.** The request carries the expected task revision, as today, and the note's expected label version. Either being stale rejects the whole request.
   - A label-only Save changes the label version only. The task revision and every occurrence ID stay the same.
   - A mixed Save changes both, atomically.
5. **Identity and retries.** The request has the existing durable mutation identity.
   - The same identity with the same body returns the original result.
   - The same identity with a different body is rejected.
   - Retries resend the same frozen request.
6. **Outcomes.**
   - Acknowledged: the form closes as today.
   - Known rejection: nothing is applied. The form stays open with the draft, including staged removals, and the shipped save error.
   - Version conflict: nothing is applied. The shipped conflict state stays: its message, read-only fields and Close. After Close and reopening, the note shows its current labels.
   - Unknown outcome: the shipped frozen state above. It is never shown as saved or as not saved.
7. **Cancel** discards only a draft that has not been dispatched. It never undoes a request that may have committed.
8. **Evaluation records.** For a note with an evaluation revision, Remove is unavailable, as above. Label removal never changes evaluation eligibility, alters an immutable snapshot, creates a contribution or activates TL-EVAL-001.
9. **Events.** `note_label_removed` is sent only after acknowledgement (see [Measurement and safety](#measurement-and-safety)).

### Suppression and the effective labels

- **Storage.** A removal is stored as a suppression in an overlay outside the replaceable extraction output. Each row is bound to the owner and the recording and holds the key, the key version and the key it was removed with. The original extracted labels are kept.
- **Serialization.** Writing a suppression is serialized against processing and other edits of the same note.
- **Deletion.** Suppressions are deleted with their recording and with the account.
- **One effective projection.** Effective labels are the extracted labels minus every suppressed key, in every kind (rule 3). The same projection is applied before every app read (list, detail, cache refresh) and every agent read (MCP search text and the returned structured labels).
  - A note no longer matches the agent's search through a suppressed label alone. Its transcript and summary words still match.
  - Folding (rule 4) is display only. The agent receives effective labels unfolded.
- **Reprocessing.** The existing reprocessing prohibitions remain. If a permitted replacement of the extraction ever happens, suppressions still apply, because they are keyed by normalized key, not by array position. Codex tests that replacement with synthetic data, without opening a new live reprocessing path.
- **Rollback** hides the index, pages, search, chips and the about section. Suppressions stay enforced. Restoring a label is a separate, explicit, versioned operation. Deploying an old client never restores one. This design has no restore UI.
- **Scope of change.** No extraction-schema, prompt, provider or model change. The overlay, the removal request and the effective read projection are additive storage and API contracts.

### Rules

These are exact. The rules section of [selected-mock.html](assets/2026-10-05-categories-search/selected-mock.html) (between `RULES-BEGIN` and `RULES-END`) implements each rule as pure functions. The `rule-vectors` block in the same file holds the synthetic test vectors. Run them with:

```bash
node docs/handoffs/assets/2026-10-05-categories-search/verify-rules.mjs
```

It runs 128 checks and exits 1 on any failure. There are 123 vectors covering keys, queries, the ready predicate, sentences, day forms, age buckets, labels, index, removal, search, both excerpt kinds, highlights and page to-dos. The gallery runs the same 123 and shows the pass count on load. The script adds 5 independent weekday checks against the platform calendar. These vectors are the shared parity set for the Swift module and for the server's key normalization. Where this prose and the script disagree, the script is the oracle and the disagreement is a handoff defect to report.

1. **Ready.** A note is ready when its status is `processed`. A legacy note with no status is ready when it has a non-empty summary or any label.
   - Pending (uploaded, needs transcript, needs extractor) and failed (transcription, extraction, processing) notes are not ready.
   - A note that is not ready has no labels, is not counted in the index, matches search by title only and shows no excerpt.
   - Only `people`, `projects` and `tags` are labels. `centersOfBalance` stays on card pills only and is neither indexed nor searched.
2. **Key (`label-key-v1`).**
   - Original words are maximal runs of letters, digits and marks (General Category L, N and M).
   - Each word is lowercased with the locale-independent default case mapping, with final sigma mapped to sigma. It is then decomposed with NFKD, every mark is stripped, and it is split on anything that is still not a letter or digit.
   - A key is all the parts joined by single spaces.
   - An empty key is invalid. It is never indexed, matched, removed or suppressed.
   - Display uses the original spelling. A key is never used as task or note identity.
3. **A note's labels.** From a ready note's raw labels, in this order:
   1. Drop empty keys.
   2. Drop every suppressed key, in every kind.
   3. Fold topics (rule 4).
   4. Keep one label per key: the first by kind (people, then projects, then topics), then by array order.
4. **Folding.** A topic is not shown when its key's words form a contiguous run inside the key of a person or project that remains on the same note. For example, "pricing" next to "pricing page" is shown once, as "pricing page". If that project is suppressed but its topic is not, the topic appears. A Remove therefore suppresses both (the Edit contract, item 3).
5. **Kind.** A key takes one kind across the owner's notes: the first of person, project and topic that it has on any note after rule 3. Chips, Edit, pages and results all show this kind.
6. **Index.**
   - An entry is a key on two or more distinct ready notes. Count notes, not array entries.
   - Its spelling comes from the most recent note. Ties go to the higher-precedence field, then the earlier place in that field, then the greater note ID by code point.
   - Order: kind section; last said, newest first; note count, highest first; label, localized and case-insensitive; key, by code point.
   - Show/Hide shows five entries per section.
7. **Page to-dos.** The open to-dos on the entry's notes whose own text contains the label's key as a run of whole words. They are ordered by placement (today, then this week, then later), then newest note. A to-do does not qualify only because its note has the label.
8. **Comes up with.** Other index entries that share at least one note, ordered by shared notes (most first), then index order. At most three.
9. **Page excerpt.**
   - **Sentences.** A sentence ends after a run of `.`, `!` or `?` (with any closing quotes or brackets) when whitespace or the end of the line follows; after `。`, `！` or `？` wherever they fall; and at every line break. An ellipsis (`…`, or two or more periods) does not end a sentence. Neither do semicolons or colons.
   - **Selection.** The first that applies:
     1. the transcript sentence containing the label's key as a run of whole words, quoted, label highlighted;
     2. else the transcript sentence containing one of the key's words of four or more characters, quoted, that word highlighted;
     3. else the summary sentence containing the label, unquoted, label highlighted;
     4. else the summary's first sentence, unquoted and unhighlighted;
     5. else no excerpt. Nothing is invented.
   - **Window.** When the first highlight is the 13th word or later, the excerpt starts four words before it, after "…".
   - **Quotes.** Quoted text opens with "“…" and closes with its own end punctuation, or "." if it has none, then "”".
   - Excerpts are clamped to two lines visually. The accessibility element keeps the whole text.
10. **Search.**
    - A query's terms are the parts of its words under rule 2. Every term must be the start of some word part in the item.
    - Index entries match on their label.
    - To-dos match on their own text, open and done, including completions from before today.
    - Ready notes match on title, summary, most important, transcript and effective labels together. A note matches when every term appears somewhere across those fields. Life areas are never searched.
    - Notes that are not ready match on title only.
    - Search runs on the phone over cached notes and tasks, and works offline.
    - **Highlight.** Each whole original word with a part that starts with a term is highlighted. Ranges are offsets into the original text, so "cafe" highlights "Café".
    - **Note result excerpt.** The first that applies: the summary, if it contains every term; else the transcript sentence with the most distinct terms, earliest on ties, quoted; else the most-important item with the most terms; else the summary. Windowing and quoting follow rule 9.
11. **Placement tag.** A neutral tag reads today, this week, later or done, taken from the running-list placement logic. A shipped marker, such as "moved Tue" or "tomorrow", keeps its shipped style and comes before the tag. A done row shows only "done".
12. **Times.**
    - The source label uses the shipped running-list source format, for example "drive in · 8:15 AM".
    - "last said" and page spans use a day form from calendar dates in the phone's current time zone, never 24-hour intervals: today; yesterday; the short weekday ("Fri") for two to seven days ago; otherwise "Sep 26", with ", 2025" added for another year. A future date uses the date form.
    - Production uses the locale's formats. The form is recomputed on calendar, time zone, locale and day changes.

### Loading and refresh

| State | When | Index and search | Status line |
| --- | --- | --- | --- |
| Cached | Notes are on the phone and no refresh is running | Built from the cache | None |
| Loading | A refresh is running | The cache plus everything that has arrived. Counts are provisional and the index grows. | "Loading notes · results so far" |
| Complete | The whole library has been enumerated and every detail merged | Complete | None |
| Refresh failed, with cache | Any refresh failure while notes are on the phone | Built from the cache | "Couldn’t refresh notes · searching what’s on this phone" and a Try again button |
| Refresh failed, no cache | Nothing is on the phone | No field | The shipped "Couldn't refresh your notes. Pull down to try again." (`error-empty`) |
| Offline | No network | Built from the cache | "Offline · searching what’s on this phone" |
| No notes | Known to be zero after a complete refresh | No field | The shipped "Your notes will appear here." (`empty`) |

- Publication is progressive. Notes appear as their details arrive. Codex chooses pagination or bounded-concurrency detail loading.
- A failed detail, a partial enumeration or a capped list never deletes a cached note. Notes are removed only after a complete enumeration says they are gone, or when the person deletes them.
- Merges are versioned. An older detail or list response never overwrites a newer save or suppression.
- The whole library is enumerated, including owners with more than 1,000 notes. The 1,000-row cap in the current list path is not a design limit. Until enumeration completes, the Loading line stays and counts are provisional.
- An empty offline cache is not proof of no notes, so it shows the no-cache error, not "Your notes will appear here."
- Try again and pull to refresh both retry. Try again is a 44 pt button.
- Tasks load on their own. Pages and results show the task snapshot that is available, and to-do sections appear when tasks arrive.
- **Performance gate.** In a Release build on a named supported physical iPhone with 1,000 synthetic notes (including long transcripts and a task-heavy set): p95 time from input to visible results of at most 200 ms with a warm index, no dropped or delayed keystrokes, and smooth scrolling.
  - Tokens and the note-to-occurrence map are precomputed when content or versions change.
  - Search runs off the main actor. A stale query is cancelled.
  - Results are published only for the current owner and query generation.
  - Cold load, index rebuild and memory are measured and reported separately. They are not gated.

### To-do rows outside the running list

- Pages and results use the shared running-list row: the same view, actions, swipe recognizer (from `231755e`), ••• menu, source label and VoiceOver actions. Codex extracts it from `RunningListView` without changing Home's running list.
- Rows come from the full authorized occurrence collection, with stable occurrence ID, recording, version, deletion filters, pending overlay and completion history. They never come from the running-list projection, which drops completions from before today, and never from text or array position.
- Sign-in, error and pending handling from the running-list parent apply on pages and in results.
- **On a page**, each visit keeps a set of rows completed in place.
  - Completing a row shows the shipped done state and Undo in place. The row stays where it is until the page is left. It does not settle away after 600 ms as it does in the running list.
  - The `open to-dos {n}` count shows the rows still open. It goes down on completion and back up on Undo.
  - Moving a row with ••• updates its tag in place. Rows are not reordered during the visit.
  - A refresh during the visit updates rows in the set but does not remove them. A deleted to-do or note leaves.
  - On the next visit, completed rows are gone.
- **In results**, completing a row shows the done state and Undo in place. Rows keep their positions and group counts until the query changes. Done rows still match, so they stay.
- **Accessibility label.** The row's combined label gains the placement tag after any marker, for example "Send Marcus the metrics doc. today. From drive in, 8:15 AM." Codex keeps the shipped label's order and adds the tag.

### Navigation and routes

- Notes is a route stack inside the retained Home content. Home, its capture coordinator, the selected running-list tab and the tray stay mounted. An inner push never triggers Home's disappearance or foreground shutdown. Every Notes level counts as Notes for the tray budget, so the list-tab reserve from `cfa7578` applies only to the running list.
- Levels: index (with its search state) → entry page, all notes or (from search) a page → further pages. "comes up with" links push another page and may cycle. Each push is one level.
- Back pops one level. From the index, Back returns Home. While searching at the index, Back clears the query and returns Home.
- **Returning.** Back from a page opened from results returns to the results with the query, results and scroll position kept. Focus returns to the row that was opened.
- **Note sheet.** Closing the sheet returns focus to the control that opened it.
  - A chip with an entry dismisses the sheet, then pushes that page onto the current Notes stack. If Notes is not open (the sheet came from a running-list source label), it opens Notes at the index first.
  - A chip without an entry dismisses the sheet, returns to the index and searches for the label. The field is not focused, so no keyboard rises.
- **An entry that loses its notes.** A page whose entry drops below two notes stays open until Back. A page whose entry reaches zero notes pops one level, and focus moves to that level's first heading.
- **Account changes.** On sign-out, account switch or account deletion, every Notes route, query, result and derived index is cleared, and the screen returns Home. Results that arrive late for a previous owner are dropped.
- **Capture-hidden notes.** Notes that Home hides from Notes while their capture is still in the tray (`HomeView.swift`, the capture-hidden recording filters) are hidden from the index, pages and search too, until Notes would show them.
- **Gestures.** No new gesture is introduced. Back is the required path. A system edge swipe is acceptable only if the chosen container provides it without breaking the mounted recorder. Running-list row swipes work wherever the row appears. The recognizer checks scroll views from the touch it receives (`64ed72c`), so rows must be rechecked against vertical scrolling inside each new scroll container.

### Recording and the keyboard

- **Idle, typing with the software keyboard up:** the whole bottom region hides, which is the tray, the permission and storage notices, and the recorder. It returns when the keyboard is dismissed. With a hardware keyboard and no software keyboard, nothing hides.
- **Recording (preparing, recording or finishing, `search-recording`):** the field shows "Search is paused while recording" and cannot take focus, so the keyboard never covers Stop. The bottom region stays as shipped. The index, pages and existing results still work.
  - If a recording starts while the field has focus, the keyboard is dismissed and the bottom region returns. Any query is kept.
  - When recording ends, the field accepts focus again, but focus is never moved into it.
- Search never starts a recording and never shows the AI consent prompt. Microphone, AI opt-out, Agree and record, storage and sign-in controls are unchanged.
- Capture processing continues through every page, sheet and search.

### Non-gesture alternatives

- The native 44 pt minimum is authoritative. Every new control has at least a 44 pt hit area: entry rows, "comes up with" links, chips, Show/Hide, Clear, Cancel, Try again, Remove, Undo, and the "where you said it" rows. Hit areas grow invisibly where the visual is smaller. The mock's CSS follows this.
- Each "where you said it" row is one button containing its source line and excerpt. It contains no nested buttons.
- Row actions keep the shipped ••• menu and VoiceOver custom actions.

### Exact copy

| Where | Copy |
| --- | --- |
| Bar | ‹ Back · Notes |
| Field placeholder | Search notes and to-dos |
| Field while recording | Search is paused while recording |
| Field buttons | Cancel · Clear search (accessibility label) |
| Index sections | people · projects · topics |
| Index row | {label} / last said {day} / {count} |
| More row | {n} more people (projects, topics; singular for one: 1 more person) · Show / Hide |
| All notes row | all notes {count} |
| Index foot | Things you’ve mentioned once are on their note and in search. |
| Thin index | Nothing has come up twice yet. / When a person, project or topic appears in two notes, it gets its own page here. |
| Page | person / project / topic (eyebrow) · {label} · {n} notes · {first} to {last} · comes up with {A} · {B} · {C} |
| Page sections | open to-dos {n} · where you said it |
| Result groups | in your index · to-dos {n} · notes {n} |
| Result index row | {kind} · {n} notes · last said {day} |
| Result note row | about {label} · {label} · {label} |
| No results | Nothing matches “{query}”. / Search looks through your notes, what you said, and your to-dos. |
| Placement tags | today · this week · later · done |
| All notes header | all notes / {n} notes |
| Note sheet | about (eyebrow) + label chips |
| Edit section | about · Remove · Undo · {kind} · removed |
| Edit foot | Chosen from what you said. Removing one takes this note off that page, here and for your agent. |
| Edit foot, evaluation record | Chosen from what you said. Labels on this note can’t be removed. |
| Edit, unknown outcome (unchanged) | Couldn't confirm the save. Tap Save to try again. · Close |
| Edit, privacy link (unchanged) | How we treat recordings |
| Loading | Loading notes · results so far |
| Offline | Offline · searching what’s on this phone |
| Refresh failed, with cache | Couldn’t refresh notes · searching what’s on this phone · Try again |
| Refresh failed, no cache (unchanged) | Couldn't refresh your notes. Pull down to try again. |
| No notes (unchanged) | Your notes will appear here. |
| Processing (unchanged) | Shipped `ProcessingStatusRow` copy |

Use typographic apostrophes and quotation marks, as in the mock. Where shipped copy is marked unchanged, keep the shipped string exactly.

### Motion

- Push and pop use the system transitions.
- Show/Hide uses `easeInOut(duration: 0.2)`, or no animation under Reduce Motion, as `earlierSection` does.
- The row keeps its shipped Reduce Motion behavior.
- Nothing else is animated.

### Haptics/audio

None are added. Completing a row keeps the shipped feedback.

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | Progressive and provisional, under "Loading notes · results so far" (see [Loading and refresh](#loading-and-refresh)). | `loading` |
| Empty | Known zero notes: the shipped "Your notes will appear here." and no field. Notes but nothing repeated: the thin index. | `empty`, `thin` |
| Error/retry | With cache: everything keeps working, under the refresh-failed line, with Try again and pull to refresh. Without cache: the shipped error and no field. A label Save follows the [Edit contract](#edit-contract) outcomes. | `error`, `error-empty`, `edit-unconfirmed`; engineering tests |
| Offline/degraded | The index, pages and search run on cached notes and tasks, under the offline line. Task actions keep their durable pending, error and sign-in behavior. A label Save is frozen and dispatched under the shipped rules, never shown as saved early. | `offline` |
| Permission denied | No new permission. Microphone, AI and storage states are as shipped, and search over existing notes stays available. | n/a |
| Long/localized content | Labels, titles and excerpts wrap; labels are never truncated; excerpts are clamped to two lines. Long unbroken tokens and German-length strings wrap. | `index-long`, `ax` screens |
| Light and dark appearance | Existing tokens only. The highlight uses the pill tint. Contrast of highlight, disabled, pending and pressed states is checked natively in both. | `*-dark-390x844.png`; device check |
| Dynamic Type | Semantic styles. At accessibility sizes the bar stacks as shipped, the count and chevron stay trailing and top-aligned, rows grow, and chips wrap. | `*-ax-light-390x844.png` (about 135% scale, an illustration only); device check at the largest sizes |
| VoiceOver/focus order | See the list below this table. | VoiceOver pass on device |
| Reduce Motion | Push and pop as the system provides; Show/Hide has no animation. | Reduce Motion pass on device |
| Recording while searching | The field is paused; the bottom region and Stop stay. | `search-recording` |
| Evaluation-record edit | Labels shown without Remove; the locked foot; the shipped privacy link. | `edit-locked` |
| Unknown save outcome, including relaunch | The shipped frozen state; Save retries the same request. | `edit-unconfirmed`; engineering test across relaunch |
| Version conflict | Nothing applied; the shipped conflict state with Close. | Engineering test |
| Owner change | Routes, queries, results and the index cleared; Home shown; late results dropped. | Engineering test |
| Deleted or stale source note | Its rows leave pages and results on recompute. A source label for a missing note behaves as it does in the running list. | Engineering test |
| Notes and tasks loading separately | Each part shows what has arrived. | Engineering test |
| Entry count 2 → 1 → 0 | At 1, the page stays until Back and the entry leaves the index. At 0, the page pops and focus moves to the heading. | Engineering test |
| Hardware keyboard | Nothing hides. | Device check |
| Capture processing during navigation | The tray keeps saving at every level and through sheets. | Device check |

**VoiceOver and focus order.**
- Focus moves from Back, to Notes, to the field (a search element), to the status line and its Try again, and then through the sections in order.
- Section labels are headers, read with their counts.
- An index row is one element, for example "Sam, person, 2 notes, last said today".
- Show reads "Show 2 more people", and Hide reads "Hide 2 more people".
- The page header is one element reading its kind, label, count and span. Each "comes up with" link is a separate button.
- A "where you said it" row is one button: title, time, then the whole excerpt.
- To-do rows keep the shipped grouping and custom actions, with the placement tag in the label.
- Note-sheet chips are buttons named after their label.
- In Edit, Remove reads "Remove {label}" and Undo reads "Undo removing {label}". Locked labels are plain text.
- The paused field reads "Search is paused while recording" and is marked disabled.
- Highlighted text is not announced separately.
- Live result updates never move focus.
- Focus is restored after a sheet closes, after Cancel (to the field), after Back (to the opened row), and after a page pops at zero notes (to the heading).

## Production mapping

- Existing components to reuse:
  - the running-list task row with its menu, VoiceOver actions and swipe recognizer (`RunningRowSwipeGesture.swift`), extracted as described above;
  - the running-list source time format and placement logic;
  - the `earlierSection` Show/Hide pattern;
  - `CapturedCard`, `ProcessingStatusRow`, `NoteDetailSheet`, `NoteEditForm` and `RecordingPrivacyLink`;
  - `Eyebrow`, `Pill` and the `Theme` tokens.
- Files likely affected (Codex owns the final list):
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift):
    - `notesContent` (217) becomes the index root of a route stack inside Notes;
    - `topBar` (176): Back pops one level;
    - the `CapturedCard` eyebrow (627);
    - the `NoteDetailSheet` about row (872);
    - the `NoteEditForm` about section (1399), between `TodoRowsEditor` and the transcript, with the locked and frozen modes;
    - the bottom region's keyboard and recording rules.
  - [RunningListView.swift](../../ios/Throughline/Views/RunningListView.swift): extract the row and its support helpers for shared use, and add the placement tag and its accessibility text.
  - [TaskCoordinator.swift](../../ios/Throughline/Services/TaskCoordinator.swift): label removals join the frozen Edit request (297–306) and the uncertain-save recovery (443–500).
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) `listNotes()` (691): progressive, versioned, non-deleting, complete enumeration.
  - [AppState.swift](../../ios/Throughline/AppState.swift): owner invalidation of the derived index.
  - New, names suggested:
    - `Models/NotesIndex.swift`, a pure module that passes the rule vectors;
    - `Views/NotesIndexView.swift`, `Views/NotesEntryPage.swift` and `Views/NotesSearchResults.swift`;
    - tests under `ios/Tests/`, including a port of the rule vectors.
  - Backend:
    - [api/index.ts](../../supabase/functions/api/index.ts), in the `task_contract_version == 1` edit branch (1304–1328), and [api/tasks.ts](../../supabase/functions/api/tasks.ts), alongside `validateTaskEdit` (96–109): the removal list, the label version and the rejections;
    - a new additive migration for the overlay and the extended edit RPC (the current one is in `20260930231946_running_list_occurrences.sql:259–301`), with owner checks and deletion cascades;
    - the effective projection on every list and detail read;
    - [_shared/memory-tools.ts](../../supabase/functions/_shared/memory-tools.ts) (489–520): MCP search text and returned labels use the effective projection;
    - [_shared/product-event-contract.ts](../../supabase/functions/_shared/product-event-contract.ts): the new events and properties.
- New assets/tokens: none. SF Symbols `magnifyingglass`, `xmark.circle.fill` and `chevron.right`, plus the existing `chevron.left`.
- Data/API assumptions:
  - Processed notes carry the three label arrays, which may be empty.
  - Notes with their transcripts, and tasks, are cached on the phone.
  - No server search. No extraction change.
  - Additive storage and API contracts for the overlay, the removal request and the projection.
- Invariants Codex must preserve:
  - Notes stays inside Home with the recorder and capture tray mounted.
  - The running-list row behaves identically everywhere, with occurrence identity preserved.
  - The app never invents, adds, renames or merges labels across different keys.
  - Notes that are not ready are not indexed.
  - The derived index and results are never shown to another account.
  - Analytics stay content-free.
  - Card life-area pills are unchanged.
  - No prompt, extraction-schema, provider or model change.
  - Original extracted labels are retained. Removals are suppressions.
  - Evaluation eligibility, snapshots and TL-EVAL-001 are untouched.
- Deliberately open implementation choices:
  - the stack container;
  - pagination versus bounded-concurrency detail loading;
  - when the index is rebuilt and whether typing is debounced, within the performance gate;
  - the wire names of the removal request and label version;
  - whether note-cache storage moves to the protected-file pattern in this slice (see [Data and privacy](#data-and-privacy)).

## Acceptance

- Behavioral checks:
  1. `notes` opens the index. Back returns Home with the same running-list tab. A capture saving in the tray keeps going at every level.
  2. Two notes naming "Sam" make a Sam entry under people, with count 2 and "last said today". One note naming "Marcus" makes no entry, but searching "marcus" finds it.
  3. A note with project "pricing page" and tag "pricing" shows "pricing page" once on its sheet and in the index.
  4. "Pricing Page" in a newer note and "pricing page" in an older one make one entry, spelled "Pricing Page". "Café" and "cafe" are one key, and "cafe" highlights "Café".
  5. Seven people with two notes each show five, then "2 more people · Show". Show reveals the other two, and Hide collapses them again.
  6. A page shows kind, count, span, up to three "comes up with" links, only the open to-dos naming the label, and every note with the excerpt rule applied. A topic never said in a transcript shows an unquoted summary line.
  7. Completing a to-do on a page keeps it in place with Undo until the page is left, and the count drops. Undo restores both. It completes the same occurrence in the running list. ••• moves it without reordering, and the source label opens its note.
  8. Typing "sam" shows Sam under in your index, then matching to-dos with open ones first by placement, then done ones including completions from before today, then notes newest first.
  9. Typing "sam annual" matches only items containing both words, across fields. "dentst" shows the no-results copy with the field still focused. "!!!" shows the index.
  10. Clear keeps focus. Cancel returns to the index. While idle with the software keyboard up, the tray, notices and recorder hide, and they return when it is dismissed. While recording, the field is paused and Stop stays visible.
  11. On the note sheet, a chip with an entry opens its page, and a chip said once opens search with the label as the query.
  12. Edit, Remove, then Save: the note leaves that page, and an entry left with one note leaves the index. Undo before Save keeps it, and Cancel saves nothing. The agent's `search` no longer returns that note through that label. The transcript words still match.
  13. Removing "pricing page" also suppresses its folded "pricing", and neither reappears after relaunch, refresh or a synthetic extraction replacement.
  14. A label-only Save keeps the task revision and every occurrence ID. A mixed Save applies both or neither. A stale version applies nothing.
  15. A Save whose response is lost shows the frozen state, survives relaunch, and a retry with the same request is applied once.
  16. A note with an evaluation revision shows its labels without Remove, and the locked foot.
  17. In airplane mode, the index, pages and search work, and the offline line shows. A failed refresh with cache shows Try again, and it retries.
  18. A failed detail during refresh deletes no cached note. An older response never restores a removed label.
  19. A pending or failed note appears in all notes with the shipped status, is not counted in the index, and matches search by title only.
  20. All notes keeps every card behavior, and its eyebrow shows the date in the running-list format.
  21. Signing out from a page returns Home, and the next account sees none of the previous index or results.
- Visual comparison views and sizes: the 32 frozen screens in [screens/](assets/2026-10-05-categories-search/screens/):
  - every frame in light at 390×844;
  - index, page, results, all notes and edit in dark;
  - index, page, results and all notes at larger text;
  - index, page and results at 375×667.
- Automated tests:
  - the Swift pure module passes a port of all rule vectors, plus time-zone, daylight-saving, midnight and locale cases for the day form;
  - backend tests for removal-only validation, additions, renames and unknown keys rejected, version conflict, atomic mixed Edit, repeated identity with the same and changed body, unknown-outcome retry, evaluation records, removal racing processing, deletion cascade, suppression surviving a synthetic extraction replacement, and the effective projection in every app and MCP read;
  - server key normalization passes the `keys` vectors;
  - analytics contract tests for the new names, properties and values.
- Build commands: `npm run ios:build` and `npm run ios:build:device`, from an isolated copy of the tree.
- Timing: the [performance gate](#loading-and-refresh).
- Physical-device checks:
  - a Release build to judge typing and scrolling feel (Debug is not valid for feel);
  - a VoiceOver pass;
  - the largest accessibility text size at small-phone width;
  - the keyboard, recorder and Stop handoff, including a hardware keyboard;
  - row swipes against vertical scrolling on pages and results;
  - offline.

## Measurement and safety

- **Primary metric:** activated users who retrieve and open a note older than seven days (TL-KNOW-001). Codex defines it in [metrics.md](../../product/metrics.md), the only metric-definition source, with its activation anchor, cohort, window, age boundary, deduplication and incomplete or offline coverage. It is reported only once instrumented and reconciled, and depends on TL-DATA-001. A note qualifies through `note_opened` with `note_age_bucket = over_7_days` from a retrieval surface.
- **Guardrails:**
  - search abandonment rate;
  - label removal rate: `note_label_removed` per `note_opened` with `has_labels = true`;
  - no lost or duplicated tasks;
  - no cross-owner reads.
- **Events.** Proposed for Codex and Mike to accept. None exists in the ingestion vocabulary yet.

  | Event | Properties | Sent |
  | --- | --- | --- |
  | `notes_index_opened` | `state`: `ready`, `thin`, `empty`, `loading`, `offline`, `refresh_failed` | Once per deliberate entry to Notes. Not on recompute or return from a page. |
  | `notes_entry_opened` | `kind`: `person`, `project`, `topic`. `via`: `index`, `link`, `chip`, `search` | Each page open. This is navigation, not retrieval. |
  | `notes_search_started` | none | Once per search visit, when the query first has a term. Clear and retyping stay in the same visit until Cancel, Back or leaving Notes. |
  | `notes_search_result_opened` | `group`: `index`, `todo`, `note`. `note_age_bucket` | On deliberate activation only. A to-do counts only when its source label opens the note, not when completed. An index result uses `not_applicable`. |
  | `notes_search_abandoned` | `had_results`: boolean | Once when a started visit ends without opening a result. Not on query replacement or keyboard dismissal. Backgrounding and termination are unobserved. |
  | `note_label_removed` | `kind` | After an acknowledged Save, once per removed displayed label. Folded topics, draft Remove and Undo, Cancel, rejected or unknown outcomes, and replayed acknowledgements are not counted. |
  | `note_opened` (existing, extended) | `surface`: `all_notes`, `entry_page`, `search`, `task_source`. `note_age_bucket`. `has_labels`: boolean | Each deliberate note-sheet open. It is the retrieval qualification and the exposure denominator. |

  - `note_age_bucket`: `under_1_day`, `1_to_7_days` (exactly seven days is included), `over_7_days`, `unknown` (missing or future time), and `not_applicable` for results that are not notes. It is computed from elapsed time on the phone and is diagnostic until reconciled with server time.
  - Events carry no query text, label names, keys or raw identifiers. They use the existing first-party identity envelope and server pseudonymization.
- **Non-goals:**
  - manual tagging, adding, renaming or merging labels, and a restore UI;
  - folders, saved searches, semantic or embedding search, and server search;
  - prompt, extraction-schema, provider or model changes;
  - running-list, recorder, tray, AI-control or grading changes beyond the rules named here;
  - Private Evaluation;
  - App Store changes.
- **Authority class:** product and design direction, selected by Mike. Build entry is not approved.
- **Rollback:** hide the index, pages, search, chips and the about section to restore today's Notes list. Suppressions stay enforced. A label is restored only by an explicit, versioned operation.

## Data and privacy

- No new processor or destination. Search runs on the phone over data already cached.
- The derived index, tokens and results live in memory only. They are bound to the owner and an account generation, cleared on sign-out, account switch and account deletion, and late results for a previous owner are dropped. Queries are never persisted.
- No second transcript store is added.
- **The existing cache boundary, as found:** full notes, including transcripts, are stored in owner-keyed UserDefaults (`AppState.swift:179–196`). The owner key namespaces records. It does not encrypt them. No explicit file protection or backup exclusion is set on that path. Sign-out keeps owner caches by design, and account deletion removes them. This design does not widen that boundary.
- **Disposition of protection (CS8): deferred.** Moving the note cache to the protected-file pattern TaskStore already uses (atomic writes, file protection, backup exclusion, with verified read-back before retiring the old data) is recommended. It is not a prerequisite for this design. If it is not done in the build slice, the implementation evidence records that explicit protection and backup behavior of the note cache remain unverified. It needs no new provider or data-use approval, because it changes neither destination nor purpose.
- Suppressed labels and original extraction stay inside the existing owner-authorized boundary. Reports, fixtures and events use synthetic content or counts only.

## Codex handoff

- **Exact committed handoff revision:** revision 2, in the commit that records it on the local `codex/running-list` branch, prepared against `6b0cbbe`. Find it with `git log -1 -- docs/handoffs/2026-10-05-categories-search.md`. The branch is not pushed.
- **Identity:** [SHA256SUMS.txt](assets/2026-10-05-categories-search/SHA256SUMS.txt) covers 34 files: the frozen mock (`e91dbfd549800f768f4d984320b83ee574070e79ab7cc96e9113952998f3b50c`), `verify-rules.mjs` (`2513757484eda1e65517c924e6b27d17bd4eb66ce302bcda08d3deb618f9b8b5`) and the 32 screens. The manifest itself is `32f1db1eac05609191a6f6dc03fdafafd4dd33d21392aff7354dceb55b4d8c9d`. Check it with `shasum -a 256 -c SHA256SUMS.txt` in the asset directory.
- **Codex-owned paths:** production app and backend files, tests, canonical documents (including the decision log, CURRENT_STATE, the backlog and metrics) and integration. Claude owns the paths in `owned_paths`.
- **Required evidence manifest:**
  - source revision;
  - tests, including the ported rule vectors;
  - simulator captures for every frozen view and size;
  - device results and the performance gate;
  - review receipts;
  - rollback target.
- **Dispositions of the original questions.**
  - Q1, extraction fill: structurally feasible, semantics unverified (CS10).
  - Q2, the correction path: resolved by the [Edit contract](#edit-contract).
  - Q3, surviving reprocessing: resolved by the [overlay](#suppression-and-the-effective-labels).
  - Q4, where rules run: index, folding and search on the phone; key normalization and suppression mirrored on the server for validation and effective reads; folding is display only. The rule vectors are the parity set.
  - Q5, performance: the [gate](#loading-and-refresh), to be measured.
  - Q6, cache protection: deferred with the gap recorded ([Data and privacy](#data-and-privacy)).
  - Q7, events: the lifecycle above, to be accepted.
  - Q8, label counts: **deferred evidence for Mike's build-entry decision.** It is not a prerequisite for `handoff_ready`. Running Codex's count-only query needs Mike's explicit authorization of a read-only database pass. Its result can show availability and sprawl, not label correctness. Nothing in this design changes extraction to make the index denser.
- **Next gate:**
  1. Codex re-reviews this exact revision for feasibility.
  2. Claude resolves any new findings and sets `handoff_ready`.
  3. Mike decides build entry, with Q8 as optional evidence.

## Mutual review receipts

- **Codex feasibility reviewer and date:** Codex, 2026-10-05. [Report](../evidence/2026-10-05-categories-search-feasibility.md).
- **Exact selected handoff revision reviewed:** revision 1 at `6e1768b`. Handoff `26def2dd4ce186ac9eed005267ba3457fc8ad724d07506620123f5244e6e7554`, mock `85170e3c…`, manifest `dd41db4581215c381d3f190e7792a142095e28b3048d75c37639922bb29b5d31`.
- **Technical findings and resolution:** changes requested, with 2 blocking, 8 material and 1 minor finding (CS1–CS11). Claude resolved each in revision 2, as listed in [revision 2 changes](#revision-2-changes). These are Claude's resolutions. Codex has not reviewed them yet.
- **Codex re-review of revision 2:** `peer_review_pending`.
- **Claude implementation reviewer and date:** pending; follows implementation.
- **Exact implementation revision and visual/behavior evidence reviewed:** pending.
- **Design, interaction, accessibility, and failure-state findings and resolution:** pending.
- **Remaining unverified checks:** every device check, the performance gate, Q1 semantics, Q8, the native rule-vector port, and every backend contract.
- **Next owner and one next action:** Codex re-reviews revision 2 for feasibility.

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
