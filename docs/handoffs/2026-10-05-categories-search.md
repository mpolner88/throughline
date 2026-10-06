---
handoff_id: "2026-10-05-categories-search"
project_name: "Categories and search — an index that writes itself"
backlog_id: "TL-KNOW-001"
slice_brief: "docs/evidence/2026-10-05-categories-search-candidates.md"
tandem_stage: "selected_pending_codex_feasibility_review"
handoff_revision: 1
base_revision: "8b30dd8"
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

**Stage note.** This is revision 1.
- Mike selected Candidate B on 2026-10-05.
- `selected_pending_codex_feasibility_review` is a hold, not a new canonical stage. The tandem table requires a Codex feasibility review before `handoff_ready`.
- Claude sets `handoff_ready` only after that review is recorded below and its findings are resolved. Until then this document is not implementation authority, and build entry is Mike's separate decision.

**Base.** Prepared on the shared local `codex/running-list` branch at `8b30dd8ac3e2847b542189e588d1905e0b3071be`.
- The app source there is unchanged since `d7f2676`, the source of Running List 1.0.5 (2026100502), which [CURRENT_STATE](../CURRENT_STATE.md) records as WAITING_FOR_REVIEW. Apple state was not refreshed for this handoff.
- Source line references below are at `8b30dd8`.
- The brief, candidates and feasibility questions are in the [candidates record](../evidence/2026-10-05-categories-search-candidates.md).

## Current

- Home has the wordmark, a `notes` button and the gear. `notes` swaps the running list for `notesContent` inside the same Home view, so the recorder and capture tray stay mounted (RL7). Source: [HomeView.swift:173](../../ios/Throughline/Views/HomeView.swift:173).
- Notes is one chronological `LazyVStack` of full `CapturedCard`s. It has no search and no grouping, and the card eyebrow shows `type · time` without a date ([HomeView.swift:573](../../ios/Throughline/Views/HomeView.swift:573)). The bar reads "‹ Back" and "Notes".
- Extraction already returns `people`, `projects`, `tags` and `centersOfBalance` for every ready note ([ThroughlineNote.swift:164](../../ios/Throughline/Models/ThroughlineNote.swift:164)). The app shows only the life-area pills on cards.
- The connected agent can already search all of this through the MCP `search` tool ([memory-tools.ts:503](../../supabase/functions/_shared/memory-tools.ts:503)). The person cannot.
- People, projects and tags cannot be edited ([api/index.ts:3665](../../supabase/functions/api/index.ts:3665)).

## User problem

Getting back to something you said more than a week ago is hard. Mike's direction (decision log, 2026-09-30): categories are assigned automatically from what was said, and one search finds both notes and to-dos.

## Evidence

| Evidence | Provenance |
| --- | --- |
| [today](../../mockup/categories-search/current/today-light-sim.png), [notes](../../mockup/categories-search/current/notes-light-sim.png) and [note sheet](../../mockup/categories-search/current/source-light-sim.png) captures | Simulator, iPhone 17 Pro, iOS 26.3, Debug build of `8b30dd8`, synthetic preview data, light |
| `HomeView.swift`, `RunningListView.swift`, `RunningListProjection.swift`, `ThroughlineNote.swift`, `UploadClient.swift`, `api/index.ts`, `_shared/memory-tools.ts` | Source at `8b30dd8` |
| Extraction prompt and labeled fixtures | Synthetic fixtures only: tags often repeat a project, and people are 0–1 per note |

**Gaps.**
- There is no physical-device, TestFlight or production evidence.
- There is no production fill rate or distinct-label count (Q8).
- There is no retrieval instrumentation.
- The 1.0.5 build in App Review is not inspected here.

## Canonical fit

- Text first and quiet. Home gains no chrome, and the new surfaces live one level inside Notes.
- Labels display as said. Nothing is invented, renamed or merged across different words.
- To-dos stay the running-list row, with the same completion, ••• and source label.
- Existing tokens only. Blue is kept for links, Show/Hide and Save; the match highlight uses the pill tint.
- Copy uses "notes" and "to-dos", lowercase section labels, and no exclamation marks.

## Candidates

Gallery: [candidates.html](../../mockup/categories-search/candidates.html) (SHA-256 `8e9f05e9fb385feb3ccf85fce3eed8c322b458d2e5512ecebb1ad73eb7fbc826`). Its renders are in [mockup/categories-search/screens/](../../mockup/categories-search/screens/), listed in its [SHA256SUMS.txt](../../mockup/categories-search/SHA256SUMS.txt).

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
- Clarifications Claude made while freezing. None changes the selected idea, and each is shown in the frozen mock.
  1. The candidate said page to-dos inherit their note's categories. The page now lists only open to-dos whose own words contain the label, which is what the candidate frame showed. The section is left out when none qualify.
  2. The placement tag (today, this week, later, done) is a neutral tag. Blue stays reserved for the shipped date markers.
  3. Source labels use the shipped running-list time format. "last said" and page spans use a day-level form.
  4. Quotation marks are used only for transcript text. A summary fallback is unquoted.
  5. The index is ordered by kind section, then last said, then count, then label.
  6. Each section shows five entries, then the shipped Show/Hide control.
  7. All notes is today's card list unchanged, except that the eyebrow gains the date.
- Rejected alternatives:
  - A: categories become secondary to a search box.
  - C: "work" is too coarse, it is the least grounded in what was said, and it adds Home chrome.

## Selected experience

Frozen target: [selected-mock.html](assets/2026-10-05-categories-search/selected-mock.html). Use `?only=<frame>` for one frame, with `&theme=dark`, `&ax=1` (larger text) and `&w=375&h=667`. All data is synthetic. "Now" in the mock is Monday, October 5, 9:41 AM.

### Entry

- Home is unchanged. `notes` opens Notes on the index, not the card list.
- Notes stays inside Home, as today. The recorder and capture tray stay mounted at every level of Notes (RL7).
- The bar reads "‹ Back" and "Notes" at every level. Back goes up one level, and from the index it returns Home. Search belongs to the index level, so Back while searching clears the query and returns Home.

### Index (`index`, `index-long`, `thin`)

From the top:
1. The search field: "Search notes and to-dos".
2. A status line when one applies (loading, offline or error).
3. Sections, each shown only if it has entries:
   - `people`
   - `projects`
   - `topics`
4. An `all notes` row with the total count.
5. The foot: "Things you've mentioned once are on their note and in search."

Each entry row is a button with:
- the label as said, wrapping and never truncated;
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
- `open to-dos {n}`: running-list rows, each with its placement tag and source label. The section is left out when there are none.
- `where you said it`: every note in the entry, newest first. Each shows a source button "{note title} · {source time}" that opens the note sheet, then a two-line excerpt with the label highlighted.

On the page, a to-do row behaves exactly as it does in the running list. Completing one shows the shipped done state and Undo in place. The row leaves the open list the next time the page is opened.

### Search (`results`, `once`, `none`)

- Tapping the field focuses it, raises the keyboard, shows Cancel, and hides the recorder while the keyboard is up.
- Results update as you type.
- Clear (the ⓧ, 44 pt target) empties the field and keeps focus.
- Cancel clears the field, dismisses the keyboard and returns to the index.
- Dismissing the keyboard keeps the query and its results, with Cancel still shown.

Results are grouped in this order. Each group appears only if it has matches.
1. `in your index`: up to three matching entries, in index order. The row's second line reads "{kind} · {n} notes · last said {day}".
2. `to-dos {n}`: matching to-dos as running-list rows. Open to-dos come first, by placement (today, then this week, then later), then done. Within each, the newest note comes first.
3. `notes {n}`: matching notes, newest first. Each row shows:
   - the title and source time;
   - an excerpt: the summary if it matches; otherwise the matching transcript sentence in quotes, "…{sentence}."; otherwise the summary;
   - "about {up to three labels}", joined with " · ".

Query words are highlighted wherever they start a word, using the pill tint.

When nothing matches, the screen shows "Nothing matches "{query}"." and "Search looks through your notes, what you said, and your to-dos." The field stays focused.

### All notes (`all-notes`, `processing`)

- The heading "all notes" sits over "{n} notes".
- Below it is today's `CapturedCard` list, unchanged in behavior (discard, grade, to-do toggles, opening the sheet). The one change: the eyebrow reads "{type} · {source time}" in the running-list format.
- Pull to refresh stays.
- A note still processing shows the shipped card with the shipped `ProcessingStatusRow` copy.

### Note sheet and Edit (`note`, `edit`)

**The note sheet** gains one row under the title: an "about" eyebrow followed by the note's labels as chips, in the order people, projects, topics.
- If the label has an index entry, tapping its chip dismisses the sheet and opens that page, opening Notes first if needed.
- Otherwise, tapping it opens Notes search with the label as the query (`once`).
- A note with no labels has no row.

**`NoteEditForm`** gains an `about` section after to-dos. Each label is a row with:
- the label;
- its kind in small secondary text;
- a "Remove" button (44 pt).

Removing a label:
- After Remove, the row shows the label struck through, "{kind} · removed" and "Undo".
- The foot reads: "Chosen from what you said. Removing one takes this note off that page, here and for your agent."
- Save commits and Cancel discards.
- Labels cannot be added or renamed.

After a Save that removes a label:
- Counts are recomputed, and an entry with fewer than two notes leaves the index.
- A page that is already open stays until Back. It closes only if its entry has no notes left.
- The note can still be found by the words in its transcript and summary. Only the label is gone.

### Rules

These are exact. The mock implements each one in its script.

1. **Sources.** Only the `people`, `projects` and `tags` of ready notes are used. `centersOfBalance` stays on card pills only and is neither indexed nor searched. A processing note has no labels and matches search by title only.
2. **Key.** Matching uses a normalized key:
   - lowercase;
   - diacritics removed;
   - every run of characters other than letters and digits becomes one space;
   - trimmed.

   Display uses the spelling from the most recent note.
3. **Folding within a note.** A tag is not shown when its key's words form a contiguous whole-word run inside a person's or project's key on the same note. For example, "pricing" next to "pricing page" is shown once, as "pricing page". Duplicate keys on one note appear once.
4. **Kind.** If a key is used as more than one kind anywhere, it takes the first in this order: person, project, topic.
5. **Threshold.** An entry exists when its key appears on two or more distinct ready notes.
6. **Index order.** By kind section, then last said (newest first), then note count (highest first), then label (localized, case-insensitive).
7. **Page to-dos.** These are the open to-dos on the entry's notes whose own text contains the label's words as a contiguous whole-word run. They are ordered by placement (today, then this week, then later), then newest note.
8. **Comes up with.** Other index entries that share at least one note, ordered by shared notes (most first), then index order. At most three.
9. **Excerpt.** The first that applies:
   1. the transcript sentence containing the label, quoted, with the label highlighted;
   2. else the transcript sentence containing one of the label's words of four or more letters, quoted, with that word highlighted;
   3. else the summary sentence containing the label, unquoted;
   4. else the summary's first sentence, unquoted and unhighlighted.

   Excerpts are clamped to two lines.
10. **Search matching.** The query is split into normalized words. An item matches when every query word is the start of some word in it.
    - Index entries match on their label.
    - To-dos match on their own text, open and done.
    - Notes match on title, summary, most important, transcript and labels.

    Search runs on the phone over cached notes and tasks, and works offline.
11. **Placement tag.** A neutral tag reads today, this week, later or done, taken from the running-list projection. A shipped marker, such as "moved Tue" or "tomorrow", keeps its shipped style and comes before the tag. A done row shows only "done".
12. **Times.** The source label uses `RunningSourceTimes.format`, for example "drive in · 8:15 AM". "last said" and page spans use a day-level form:
    - today;
    - yesterday;
    - a short weekday ("Fri") for dates within the last seven days;
    - otherwise "Sep 26".

### Navigation and gestures

- Pages and all notes push within Notes.
- Back is the required path back. A system edge swipe is acceptable only if the chosen container provides it without breaking the mounted recorder.
- No new gesture is introduced. Running-list row swipes work wherever the row appears.

### Non-gesture alternatives

- Every control is a button with a 44 pt target: entry rows, links, chips, Show/Hide, Clear, Cancel, Remove and Undo.
- Row actions keep the shipped ••• menu and VoiceOver custom actions.

### Exact copy

| Where | Copy |
| --- | --- |
| Bar | ‹ Back · Notes |
| Field placeholder | Search notes and to-dos |
| Field buttons | Cancel · Clear search (accessibility label) |
| Index sections | people · projects · topics |
| Index row | {label} / last said {day} / {count} |
| More row | {n} more people (projects, topics; singular for one: 1 more person) · Show / Hide |
| All notes row | all notes {count} |
| Index foot | Things you've mentioned once are on their note and in search. |
| Thin index | Nothing has come up twice yet. / When a person, project or topic appears in two notes, it gets its own page here. |
| Page | person / project / topic (eyebrow) · {label} · {n} notes · {first} to {last} · comes up with {A} · {B} · {C} |
| Page sections | open to-dos {n} · where you said it |
| Result groups | in your index · to-dos {n} · notes {n} |
| Result index row | {kind} · {n} notes · last said {day} |
| Result note row | about {label} · {label} · {label} |
| No results | Nothing matches "{query}". / Search looks through your notes, what you said, and your to-dos. |
| Placement tags | today · this week · later · done |
| All notes header | all notes / {n} notes |
| Note sheet | about (eyebrow) + label chips |
| Edit section | about · Remove · Undo · {kind} · removed |
| Edit foot | Chosen from what you said. Removing one takes this note off that page, here and for your agent. |
| Loading | Loading notes · results so far |
| Offline | Offline · searching what's on this phone |
| Refresh error | Couldn't refresh notes · searching what's on this phone |
| No notes (unchanged) | Your notes will appear here. |
| Processing (unchanged) | Shipped `ProcessingStatusRow` copy |

Use typographic apostrophes and quotation marks, as in the mock.

### Motion

- Push and pop use the system transitions.
- Show/Hide uses `easeInOut(duration: 0.2)`, or no animation under Reduce Motion, as `earlierSection` does.
- Nothing else is animated.

### Haptics/audio

None are added. Completing a row keeps the shipped feedback.

## State and accessibility coverage

| State | Expected presentation and behavior | Verification |
| --- | --- | --- |
| Loading | After sign-in, the index and search use the notes that have arrived, under "Loading notes · results so far". The index grows as the rest load. | `loading` |
| Empty | No notes: the shipped "Your notes will appear here." and no field. Notes but nothing repeated: the thin index. | `empty`, `thin` |
| Error/retry | A failed refresh keeps everything on the phone working, under "Couldn't refresh notes · searching what's on this phone". Pull to refresh retries. A failed label removal saves nothing and keeps the edit form open with the shipped save-error behavior. | `error`; engineering tests |
| Offline/degraded | The index, pages and search run on cached notes and tasks, under "Offline · searching what's on this phone". A label removal follows the shipped edit-save rules. | `offline` |
| Permission denied | No new permission. The recorder and AI states are as shipped. | n/a |
| Long/localized content | Labels, titles and excerpts wrap; labels are never truncated; excerpts are clamped to two lines. German-length strings wrap. | `index-long`, `ax` screens |
| Light and dark appearance | Existing tokens only. The highlight uses the pill tint. | `*-dark-390x844.png` |
| Dynamic Type | Semantic styles. At accessibility sizes the count and chevron stay trailing and top-aligned, rows grow, and chips wrap. | `*-ax-light-390x844.png` (about 135% scale; full sizes need a device check) |
| VoiceOver/focus order | See the list below this table. | VoiceOver pass on device |
| Reduce Motion | Push and pop as the system provides; Show/Hide has no animation. | Reduce Motion pass on device |

**VoiceOver and focus order.**
- Focus moves from Back, to Notes, to the field (a search element), to the status line, and then through the sections in order.
- Section labels are headers, read with their counts.
- An index row is one element, for example "Sam, person, 2 notes, last said today".
- Show reads "Show 2 more people", and Hide reads "Hide 2 more people".
- The page header reads its kind, label, count and span. Each "comes up with" link is a button.
- A "where you said it" row is one button: title, time, excerpt.
- To-do rows keep the shipped grouping and custom actions, with the placement tag added after the marker.
- Note-sheet chips are buttons named after their label.
- In Edit, Remove reads "Remove {label}" and Undo reads "Undo removing {label}".
- Highlighted text is not announced separately.

## Production mapping

- Existing components to reuse:
  - the running-list task row and its menu, VoiceOver actions and swipe;
  - `RunningSourceTimes.format`;
  - the running-list projection for placement;
  - the `earlierSection` Show/Hide pattern;
  - `CapturedCard`, `ProcessingStatusRow`, `NoteDetailSheet` and `NoteEditForm`;
  - `Eyebrow`, `Pill` and the `Theme` tokens.
- Files likely affected (Codex owns the final list):
  - [HomeView.swift](../../ios/Throughline/Views/HomeView.swift):
    - `notesContent` (173) becomes the index root with a stack inside Notes;
    - `topBar` (143) Back pops one level;
    - the `CapturedCard` eyebrow (573);
    - the `NoteDetailSheet` about row (809);
    - the `NoteEditForm` about section (1333);
    - the recorder hides while the keyboard is up.
  - [RunningListView.swift](../../ios/Throughline/Views/RunningListView.swift): a placement-tag variant of the row, used outside the tabs.
  - New, names suggested:
    - `Models/NotesIndex.swift`, a pure, testable module for key, labels, folding, index, page to-dos, comes up with, excerpt, search and day form;
    - `Views/NotesIndexView.swift`, `Views/NotesEntryPage.swift` and `Views/NotesSearchResults.swift`;
    - tests under `ios/Tests/`.
  - [UploadClient.swift](../../ios/Throughline/Services/UploadClient.swift) `listNotes()` (691) and [api/index.ts](../../supabase/functions/api/index.ts) `assertCurrentMutationFields` (3665): a removal-only edit of `people`, `projects` and `tags`, with the expected version.
  - [_shared/memory-tools.ts](../../supabase/functions/_shared/memory-tools.ts): the agent sees the corrected labels.
- New assets/tokens: none. SF Symbols `magnifyingglass`, `xmark.circle.fill` and `chevron.right`, plus the existing `chevron.left`.
- Data/API assumptions:
  - Ready notes carry the three label arrays (already decoded).
  - Notes, with their transcripts, and tasks are cached on the phone.
  - No server search, no extraction change.
- Invariants Codex must preserve:
  - Notes stays inside Home with the recorder and capture tray mounted.
  - The running-list row behaves identically everywhere, with occurrence identity preserved.
  - The app never invents, adds, renames or merges labels across different keys.
  - Processing notes are not indexed.
  - The owner-bound cache is never shown to another account.
  - Analytics stay content-free.
  - Card life-area pills are unchanged.
  - No prompt, schema, provider or model change.
  - A removal is stored as a suppression of that label on that note, not a deletion, so it can be restored on rollback (Q2, Q3).
- Deliberately open implementation choices:
  - the stack container;
  - when the index is computed (on change or incrementally) and whether typing is debounced, within the acceptance timing;
  - whether normalization is mirrored on the server for the agent (Q4);
  - the storage protection of the cache (Q6).

## Acceptance

- Behavioral checks:
  1. `notes` opens the index. Back returns Home with the same running-list tab. A capture saving in the tray keeps going at every level.
  2. Two notes naming "Sam" make a Sam entry under people, with count 2 and "last said today". One note naming "Marcus" makes no entry, but searching "marcus" finds it.
  3. A note with project "pricing page" and tag "pricing" shows "pricing page" once on its sheet and in the index.
  4. "Pricing Page" in a newer note and "pricing page" in an older one make one entry, spelled "Pricing Page". "Café" and "cafe" are one key.
  5. Seven people with two notes each show five, then "2 more people · Show". Show reveals the other two, and Hide collapses them again.
  6. A page shows kind, count, span, up to three "comes up with" links, only the open to-dos naming the label, and every note with the excerpt rule applied. A topic never said in a transcript shows an unquoted summary line.
  7. Completing a to-do on a page or in results completes the same occurrence in the running list, and Undo restores it. ••• moves it, and the source label opens its note.
  8. Typing "sam" shows Sam under in your index, then matching to-dos with open ones first by placement, then notes newest first.
  9. Typing "sam annual" matches only items containing both words. "dentst" shows the no-results copy with the field still focused.
  10. Clear keeps focus. Cancel returns to the index. The recorder hides while the keyboard is up and returns when it is dismissed.
  11. On the note sheet, a chip with an entry opens its page, and a chip said once opens search with the label as the query.
  12. Edit, Remove, then Save: the note leaves that page, and an entry left with one note leaves the index. Undo before Save keeps it, and Cancel saves nothing. The agent's `search` no longer returns that label for that note. The transcript words still match.
  13. Reprocessing a note does not bring back a removed label (Q3).
  14. In airplane mode, the index, pages and search work, and the offline line shows.
  15. A processing note appears in all notes with the shipped status, is not counted in the index, and matches search by title only.
  16. All notes keeps every card behavior, and its eyebrow shows the date in the running-list format.
- Visual comparison views and sizes: the 28 frozen screens in [screens/](assets/2026-10-05-categories-search/screens/):
  - every frame in light at 390×844;
  - index, page, results, all notes and edit in dark;
  - index, page, results and all notes at larger text;
  - index, page and results at 375×667.
- Automated tests:
  - unit tests on the pure module for every rule above, including the day-form boundaries (today, yesterday, 6 days and 7 days ago, older) and removal recompute;
  - backend tests for the removal-only edit, the version conflict, suppression surviving reprocessing, and the agent projection.
- Build commands: `npm run ios:build` and `npm run ios:build:device`, from an isolated copy of the tree.
- Timing: on a Release build with 1,000 synthetic notes, typing never drops or delays a keystroke and results update without visible lag. Codex proposes the measured threshold (Q5).
- Physical-device checks:
  - a Release build to judge typing and scrolling feel (Debug is not valid for feel);
  - a VoiceOver pass;
  - the largest accessibility text size;
  - the keyboard and recorder handoff;
  - offline.

## Measurement and safety

- Primary metric: activated users who retrieve and open a note older than seven days (TL-KNOW-001). Codex defines it in [metrics.md](../../product/metrics.md). It is reported only once instrumented and reconciled, and depends on TL-DATA-001.
- Guardrails:
  - search abandonment rate;
  - manual metadata correction rate (label removals per note shown);
  - no lost or duplicated tasks;
  - no cross-owner reads.
- Suggested content-free events, for Codex and Mike to accept or change:
  - `notes_index_opened`
  - `notes_entry_opened {kind, via: index | link | chip | search}`
  - `notes_search_started`
  - `notes_search_result_opened {group: index | todo | note, note_age_bucket}`
  - `notes_search_abandoned {had_results}`
  - `note_label_removed {kind}`

  Events carry no query text, label names or identifiers.
- Privacy/data boundary:
  - no new processor or destination;
  - search runs on the phone over data already cached;
  - transcripts are already cached on the phone (Q6).
- Non-goals:
  - manual tagging, adding, renaming or merging labels;
  - folders, saved searches, semantic or embedding search, and server search;
  - prompt, schema, provider or model changes;
  - running-list, recorder, tray, AI-control or grading changes;
  - Private Evaluation;
  - App Store changes.
- Authority class: product and design direction, selected by Mike. Build entry is not approved.
- Rollback:
  - Hide the index, pages, search, chips and the about section to restore today's Notes list.
  - Saved removals are suppressions, so they can be restored without data loss.

## Codex handoff

- Exact committed handoff revision: revision 1, in the commit that adds this file on the local `codex/running-list` branch, whose parent is `8b30dd8`. Find it with `git log -1 -- docs/handoffs/2026-10-05-categories-search.md`. The branch is not pushed.
- Identity: [SHA256SUMS.txt](assets/2026-10-05-categories-search/SHA256SUMS.txt) covers the frozen mock (`85170e3c8bced2c4c0a109e10b8af72098896c339c9fcfd71366db938f12808e`) and the 28 screens. The manifest itself is `dd41db4581215c381d3f190e7792a142095e28b3048d75c37639922bb29b5d31`.
- Codex-owned paths: production app and backend files, tests, canonical documents (including the decision log and CURRENT_STATE) and integration. Claude owns the paths in `owned_paths`.
- Required evidence manifest:
  - source revision;
  - tests;
  - simulator captures for every frozen view and size;
  - device results;
  - review receipts;
  - rollback target.
- Unresolved blockers: [Q1–Q8](../evidence/2026-10-05-categories-search-candidates.md#codex-feasibility-questions).
  - Q1: extraction fill.
  - Q2: the correction path, revisions, TL-EVAL-001 and the agent projection.
  - Q3: suppression across reprocessing.
  - Q4: where folding runs.
  - Q5: performance at 1,000 notes and the N+1 detail load.
  - Q6: cache protection.
  - Q7: events.
  - Q8: a count-only label aggregate, which decides whether the index stays small.
- Next gate:
  1. Codex reviews this exact revision for feasibility.
  2. Claude resolves the findings and sets `handoff_ready`.
  3. Mike decides build entry.

## Mutual review receipts

- Codex feasibility reviewer and date: `peer_review_pending`.
- Exact selected handoff revision reviewed: pending. Revision 1, with asset manifest `dd41db45…`.
- Technical findings and resolution: pending.
- Claude implementation reviewer and date: pending; follows implementation.
- Exact implementation revision and visual/behavior evidence reviewed: pending.
- Design, interaction, accessibility, and failure-state findings and resolution: pending.
- Remaining unverified checks: every device check, and every production data question (Q1, Q8).
- Next owner and one next action: Codex reviews revision 1 for feasibility and answers Q1–Q8.

Do not record a review as complete until that named tool actually performs it. Changed scope requires a new receipt for the affected revision. A receipt does not replace Mike's design selection or product acceptance.
