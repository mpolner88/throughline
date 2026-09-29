# September split: reconciliation plan

Verified **2026-09-28**. Status: **Phase 2 approved on 2026-09-28 for `codex/reconcile-september-base` and its new pull request only; no merge or feature implementation.**

## Scope and decisions

Preserve the August local engineering foundation, operating guides, and design work; reconcile the two newer main commits; produce a reviewable integration branch and pull request only after approval. The approved plan is preserved below; the Phase 2 execution receipt records the completed local integration and its verification limits.

Mike confirmed on September 28:

- Capture recovery (`TL-CAP-001`) comes first; running list (`TL-TASK-001`, PR #2) follows.
- Candidate B, **“The recorder holds it”**, is selected. The [capture handoff](../handoffs/2026-09-28-home-capture-recovery.md) remains `selected_pending_codex_feasibility_review`. Its feasibility review is a separate task; preservation does not promote it to ready or authorize implementation.
- Phase 2 approval covers only the reconciled branch and its new PR. Posting the PR #2 review and asking Claude for a design review each require their own go-ahead.
- Merge to main, force-push, branch deletion, deployments/migrations, new deployment/TestFlight workflows, secrets, automations, behavior flags, and Apple changes remain outside this authorization.

Read in order: repository guide; [current state](../CURRENT_STATE.md); [product](../PRODUCT.md); [tandem daily agreement and September gate](../AGENT_TANDEM.md); [foundation slice](../slices/operating-foundation-cleanup.md); [workflow](../WORKFLOW.md); [metrics](../../product/metrics.md); [backlog](../../product/backlog.json); [return audit](2026-09-28-return-audit.md), followed by component sources/runbooks. Three Codex scouts performed read-only history, backend, and iOS comparisons; this is **not a Claude review receipt**.

## Phase 2 approval additions

Mike explicitly accepted first-time public repository publication of current state, product charter, workflow, backlog, and metrics. Push only the named branch and open its PR; do not merge.

Preserve Claude's handoff and assets byte-identically, including `docs/handoffs/2026-09-28-home-capture-recovery.md` at SHA-256 `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c`. Record decisions in the backlog, decision log and reconciliation evidence, not by editing that handoff. Its feasibility review follows Phase 2 against the committed revision. Claude must make any later requested handoff edit.

After opening the PR, provide exact active-checkout migration and Claude Code/Codex project-path steps as a separately approved action. Do not perform that migration during Phase 2.

## Frozen starting point

| Source | Exact identity / observation |
| --- | --- |
| Local branch | `codex/core-quality-system` |
| Local HEAD | `1ec0cbbd7699bda2c5e2bb646a6ebfb31c8f21b7` |
| Remote main | `fd85d0183719ac119d2c12a64435ef846faa3a0d` |
| Divergence | 49 local commits ahead, 2 main commits behind |
| Main commits to reconcile | `1770db3`, `fd85d01` |
| [PR #1](https://github.com/mpolner88/throughline/pull/1) | Open draft; head `1f58561417f634216438ab83b2157661bec1fdaf` |
| [PR #2](https://github.com/mpolner88/throughline/pull/2) | Open; head `55973a48ed1c2ef4db01fb0e7b485fb8e9a92e73`; prior checks green, no GitHub review receipt |
| Dirty tree before this plan | 53 tracked modifications; 3,856 untracked files; nothing staged |
| Detailed untracked split | 3,628 under `tmp/`; 228 elsewhere, including Claude's new handoff assets |
| Repository visibility | Public. Pushing publishes all reachable commits and blobs, not only the final diff. |

Evidence: dated local status, Git ancestry/blob comparisons and live GitHub remote/PR reads during Phase 1; full private receipts accompany the recovery inventory. [Return audit](2026-09-28-return-audit.md) is the previous audit snapshot; counts here supersede its earlier file counts. No runtime deployment or Apple state was changed or newly claimed by this reconciliation pass.

## Safety copy and restore test

20,639 regular files, 1,777,041,753 bytes (1.78 GB), including the complete Git directory and all untracked/ignored regular files. The separate restored copy matched the snapshot by SHA-256, file size, type and permission mode; source/snapshot/restore comparisons, HEAD and dirty-status comparisons all passed. Restored Git object integrity (`git fsck --full --no-reflogs`) passed, and the restored Git worktree resolves to the independent restore location. User-only recovery parent permissions (`0700`, owner checked, ACL removed) were verified. An initial comparison detected Git index cache-byte drift; all 367 staged entries matched. The earlier copied index was retained privately, only the backup index was refreshed, and the final full byte comparisons then passed. The only excluded runtime object was `.git/fsmonitor--daemon.ipc`, a live Unix socket with no recoverable file payload; Git recreates its IPC endpoint. No regular file was excluded. Source remained unchanged through verification. This verifies file recovery, not a running-process or full macOS metadata/system-image restore.

The private recovery location is intentionally absent from repository files. Full path inventories, hashes, restore instructions and verification receipts live with that private recovery copy. It contains secrets and ignored private material and must never be pushed or synced. This is protection against mistakes on this Mac; it is **not** protection against losing the Mac, and is not a Time Machine or external backup.

## Every-path disposition and privacy screen

The private `path-dispositions.csv` contains one exact row for **all 3,909 pre-existing changed paths**, including all 3,628 temporary paths, plus rows for the two new Phase 1 plan artifacts. Each row states group, disposition, proposed commit, and preparation. The [publishable path manifest](2026-09-28-reconciliation-paths.csv) enumerates all **255 proposed existing commit files**, their pre-sanitization SHA-256, and exact commit group. The `sha256` column identifies the inspected Phase 1 source; `preservation_sha256` records the sanitized bytes prepared for C1–C7. Later canonical decision updates are separately identified in C9. The two new plan artifacts are named separately under C7.

| Group | Changed paths | Disposition |
| --- | ---: | --- |
| Evaluation and lineage | 76 | Commit reviewed source/tests/contracts; synthetic fixtures only |
| iOS | 9 | Commit existing August client/model/project/privacy changes and tests |
| Measurement | 12 | Commit evolved measurement gate/reporting/dashboard definitions |
| Operating foundation | 60 | Commit portable governance/evidence; sanitize listed private references first |
| Design and marketing | 122 | Commit 98; retain 24 historical audit/output files privately |
| Temporary/private | 3,630 | Keep outside Git: 3,628 `tmp/` files and two `.orig`/`.rej.orig` remnants |
| **Total** | **3,909** | **255 commit; 3,654 keep private outside Git; 0 unresolved path choices** |

“Keep private outside Git” is a disposition, not a move or deletion performed on the source. The full originals are retained in the recovery copy; the current checkout remains intact. All **16,132 ignored files** are separately inventoried and preserved privately, never selected for staging. Exclude `tmp/`, `.throughline/`, `*.orig`, `*.rej`, `.env*` other than a reviewed example, caches, raw evidence, signed builds, and local configuration from the integration copy and Git. Existing tracked files need an explicit named-path decision; ignores do not protect already tracked content.

Screening covered every proposed file: text pattern checks plus semantic review of docs/source/fixtures, and visual/provenance/metadata review of all **35 proposed PNGs** (23 capture handoff, six August design audit, six App Store compositions). The selected mock is static and explicitly synthetic; August previews match built-in samples; marketing assets match the static generator. This is privacy screening, not design acceptance, capture feasibility, device verification, or forensic image analysis. Historical `product/audits/` and `output/` evidence remains private pending a separate need/review.

Required preparation before any commit/publication:

1. `docs/app-store-readiness.md`: remove App Review account email at inspected lines 65 and 103; use role descriptions for contact addresses in this operational report. Preserve exact account detail privately. No password was reproduced or changed.
2. `design-qa.md`: remove personal-machine/clipboard paths at inspected lines 172, 202 and 203 and references to withheld historical media; preserve portable findings.
3. `design-qa-signin-provider.md`: replace clipboard path/opaque clipboard identifier with a portable provenance description.
4. `docs/evidence/2026-09-28-return-audit.md`: replace personal checkout/alias locations with portable location descriptions before staging.
5. `scripts/verify-evaluation-edge-storage-canary.test.mjs`: replace the personal home-directory test input with `/home/example/throughline-evaluation-edge-canary-test.json` and rerun its focused test. Mike explicitly added this to Phase 2.

No matching private-key, provider-token or JWT literal was found in the proposed text. Synthetic UUIDs, test credentials, code field names, and the explicitly synthetic audio placeholder are test data, not sampled user evidence. Provider function-deployment UUIDs in rollout evidence identify deployed functions, not users or sessions. The privacy-policy parity check is useful but is **not** a secrets or private-content scanner.

History screening additionally covered **49 commits, 513 objects and 243 blobs**, including five binary blobs, reachable from local HEAD but not locally known remote refs. No matching private key/provider token/JWT, audio, signed archive, signing credential, or `.env` path was found. The preview email in `AppState.swift` is in the Debug preview session and already present in remote main; PostHog test identifiers are synthetic fixture constants. Three discovery screenshots are byte-identical to public main; the other binaries are vendor font/logo assets. Existing App Review email literals also already occur on main: sanitizing the new report prevents further repetition, but does not erase published history. This review does not certify that existing public history contains no private information. Re-scan the entire proposed push range before publishing; any newly discovered private history blocks push and requires a separately approved history-safe plan—editing only HEAD cannot remove earlier blobs.

## Component reconciliation

| Component | Local working foundation | Main / PR #1 / PR #2 | Plan |
| --- | --- | --- | --- |
| Evaluation lineage / immutable revisions | Frozen inference contract; processing lineage, immutable edits and owner evaluation lifecycle | Main and PR #2 lack that foundation | Preserve local contracts/modules/migrations together |
| Backend privacy / retention | Contribution eligibility, artifact deletion, retention claims/reconciliation | PR #2 retains older mutable recording paths and adds incompatible automatic feedback candidates | Keep local; reject inferred consent/full-output truth |
| Measurement | Schema-v2 attribution, pseudonymous bridge, evolved database gate | PR #1 largely incorporated; PR #2 starts from older attribution | Preserve local; verify PR #1 equivalence |
| iOS | Current revision propagation, disclosed preview/save/withdraw, event attribution | PR #2 adds task-first Home/Notes split without preserving those local interfaces | Preserve local app; defer running-list UX and endpoints |
| Quality tooling | Plumbing-only reports and isolated private corpus machinery | PR #2 adds timeframe scoring but older generic pass/fixture promotion | Preserve truthful quality boundary; version later additions |
| Operating guides | Canonical sources, Claude/Codex tandem, handoff and slice gates | Root guides and tandem absent on main/PR #2 | Publish reviewed guides in base; future workers verify exact base |
| Discovery / marketing | Newer local slice evidence and assets | Main has two equivalent-content discovery commits | Preserve newer local evidence; record main ancestry with a normal merge |
| Deployment / TestFlight automation | Manual release evidence and explicit authority | PR #2 introduces workflows lacking full local release gates | Defer workflows; no dispatch, secrets or release actions |

### Exact twelve overlapping dirty paths

Disposition is for this preservation base; “combine later” means future running-list work after capture recovery, never importing PR #2 wholesale now.

| Path | Disposition | Reason / later treatment |
| --- | --- | --- |
| `core/extraction-pipeline.mjs` | Keep local | Frozen production inference contract must survive; PR timeframe/shared normalizer requires deliberately versioned later combination. |
| `supabase/functions/api/index.ts` | Keep local | Retain revision, eligibility, retention, owner and measurement interfaces; later combine reviewed task routes against those contracts. |
| `evals/score-extraction.mjs` | Keep local | Retain explicit plumbing-only result; combine timeframe scoring later without pretending it proves real-audio quality. |
| `evals/README.md` | Keep local | Preserve owner-only private corpus policy; reject automatic full-output labeling/tracked private-fixture promotion. |
| `docs/hosted-backend.md` | Keep local | Preserve current operational/retention/canary gates; add task contract documentation later. |
| `ios/Throughline/Views/HomeView.swift` | Keep local | PR Home/Notes replacement omits current evaluation behavior and is deferred product work. |
| `ios/Throughline/Services/UploadClient.swift` | Keep local | Preserve currentRevisionID, evaluation preview/save/withdraw and schema-v2 attribution; task methods can be ported later. |
| `ios/Throughline/Models/ThroughlineNote.swift` | Keep local | Preserve currentRevisionID; PR timeframe/presentation changes need later API/model alignment. |
| `ios/Throughline.xcodeproj/project.pbxproj` | Keep local | Preserve evaluation/attribution references and resources; do not import PR 1.1.0/build settings. Source version is not proof of latest Apple build. |
| `package.json` | Keep local | Preserve docs/privacy/private-corpus/plumbing commands; reconcile PR contract/task tooling later. |
| `docs/app-store-readiness.md` | Keep local, sanitized | PR has stale release/privacy claims; retain local evidence distinctions. |
| `scripts/generate-app-store-screenshots.mjs` | Keep local | PR copy adds unsupported superlatives and running-list claims; no new screenshot campaign in this slice. |

PR #2's missing August work was largely absent from its starting main. These are incompatibilities with the local foundation, **not a claim that Claude intentionally deleted it**. No path warrants keep-PR for the capture-first preservation base. The exact PR head remains retained remotely for later selective combination; this plan does not discard its work.

## PR #2 preservation and later review findings

**PR #2 does not preserve the full deployed August foundation as an integration replacement.** Ancestry or green PR checks alone cannot establish compatibility.

| Severity / area | Evidence at PR head | Required disposition |
| --- | --- | --- |
| P1 lineage / revisions / API | API lines 545–558 mutate/persist the recording; local readiness/evaluation/current-revision interfaces are absent | Keep local immutable edit and owner interfaces; contract-test any added task mutations |
| P1 evaluation eligibility | API lines 575–605 turn changed notes/task moves into full-output candidates with `should_remember: true` | Reject automatic consent/truth; preserve explicit revision/field-bound owner contribution contract |
| P1 retention / deletion | API lines 1111–1155 delete recording/audio and select audio by age without local artifact lifecycle | Preserve retention claims, protected audio and linked private-artifact deletion |
| P1 measurement / privacy | API lines 259–271 use older event intake; lines 610–612 log recording identifier/raw error | Preserve schema-v2 ownership/attribution and bounded content-safe errors |
| P1 task identity | `core/task-list.mjs` lines 374–403 merges by normalized text and ORs completion across occurrences | Rework identity semantics before adoption; a synthetic reproduction hid today's new open task when yesterday's same-text task was completed, including after reopening |
| P1 extraction contract | PR `extraction-contract.mjs` adds `timeframe`; local frozen recursive schema forbids extra fields | Version prompt/schema/normalizer together with compatibility tests; avoid mechanical merger |
| P2 quality claims | PR scorer lines 642–661 emits generic pass; eval/backend docs encourage old inferred fixture promotion | Preserve plumbing-only qualification and private benchmark provenance |

Main and PR #2 each contain only four older migrations. Six local migrations (two already committed measurement migrations plus four dirty evaluation/retention/reconciliation migrations), the shared lineage/evaluation/measurement modules, private-artifact deletion Edge, and corpus/isolation machinery must survive as a set. Preserving only the twelve overlapping files is insufficient.

PR #2 workflow inspection also found no complete internal-only release contract: TestFlight export lacks `testFlightInternalTestingOnly`, ends at upload, and does not verify processing/group assignment/rollback. Its Supabase workflow runs contract checks without the full local privacy/lineage/canary gates. Defer both; do not dispatch them.

These are local review findings for the plan, not a GitHub review and not a Claude design review. Later PR #2 work should start from the reviewed base after capture recovery, apply selected changes in bounded commits, and re-run contracts/identity/privacy tests. Rebasing or replacing the existing remote PR branch is a later exact action; no force-push is authorized.

## PR #1 and the two newer main commits

All nine PR #1 paths exist locally. These five are byte-identical in both local HEAD and working tree:

- `supabase/migrations/20260817180709_measurement_attribution.sql`
- `supabase/migrations/20260818061933_measurement_privilege_hardening.sql`
- `supabase/tests/measurement_attribution_baseline_test.sql`
- `supabase/tests/measurement_attribution_test.sql`
- `supabase/tests/measurement_privilege_hardening_test.sql`

The workflow plus `scripts/preview-branch-contract.mjs`, its test, and `scripts/verify-measurement-database.mjs` evolved locally. Four of PR #1's six commits are patch-equivalent to local HEAD; its head is not an ancestor. **Recommendation: provisionally superseded.** Verify the consolidated measurement gate, retain replacement evidence in the new PR, then recommend closure. Do not merge the older implementation or close/comment on PR #1 in this phase.

For main, all six changed files in `1770db3` match the working tree; 81 of 82 changed files in `fd85d01` match. The sole difference is `docs/slices/discovery-growth.md`, where local fields/rollback evidence are newer. Preserve local bytes for that file after comparing both sides. Commit boundaries differ, so do not blindly cherry-pick both commits. Use an ordinary ancestry-preserving merge in an isolated integration checkout after local preservation commits; inspect every conflict and the resulting diff against both parents. No blanket “ours” resolution. Verify both `1770db3` and `fd85d01` are ancestors before using “shared base.”

## Proposed Phase 2 execution and bounded commits

Proposed branch: **`codex/reconcile-september-base`**, from exact local HEAD above. First recheck source drift, remote heads, approval and private recovery receipt. Require main and both PR heads to match the frozen identities; if they changed, refresh the comparisons and obtain approval for any expanded scope before integration/publication. Use an isolated, real local checkout with its own Git directory outside iCloud for integration (a linked worktree whose common Git directory remains in Documents is insufficient), seeded with only the preserved HEAD ancestry; copy only named reviewed files. Do not import local hooks, credential settings, private configuration, unnecessary refs or private working files. Any build-only local configuration must be freshly prepared inside the isolated build copy and excluded from Git. The original dirty checkout stays intact. This is distinct from migrating/repointing the user's active project.

Each C1–C7 entry's **complete named path list** is in the linked path manifest; filter its `commit` column, never stage a directory recursively or use `git add .`/`git add -A`. Sanitize only the named documents before copying/staging. Re-scan exact staged bytes and inspect the staged diff before every commit.

| Order | Bounded commit | Named-path scope / count | Verification intent |
| --- | --- | --- | --- |
| C1 | Preserve inference/evaluation tooling | 37 paths in manifest: `core/`, `evals/`, selected evaluation/private-feedback scripts, `package.json` | Frozen inference identity; synthetic plumbing; isolated corpus and feedback boundaries |
| C2 | Preserve hosted lineage, retention and privacy | 46 paths: selected `supabase/`, legacy local deletion service, lockfile, hosted/privacy runbooks and parity checks | API/shared/deletion tests; preserve all ten migration files; no migration/deployment |
| C3 | Preserve iOS revision and evaluation support | 9 paths: project, model, UploadClient, Home, evaluation contract/tests, privacy manifest, resolved packages | Isolated Simulator build and focused Swift contract checks |
| C4 | Preserve measurement and reporting | 12 paths: measurement workflow/verifier/query/report/dashboard plus metrics | Measurement/preview/report tests; SQL equivalence and gate review |
| C5 | Preserve selected design handoff and exploration | 51 paths: `docs/handoffs/`, `mockup/capture-durability/`, `mockup/next-iterations/`, other named mocks/brand/audit assets | Asset hashes, synthetic content, correct selected-but-not-ready status; no feasibility or implementation |
| C6 | Preserve marketing research and assets | 41 named marketing/App Store/research/generator paths | Content/claim provenance; no posting, upload, campaign or publication of assets beyond repository inclusion |
| C7 | Preserve operating foundation and evidence | 59 existing paths plus this plan and its public path manifest | Canonical links/backlog/authority; listed sanitization; explicit ignore rules for private/temp/reject artifacts |
| C8 | Reconcile main ancestry | Normal merge of `fd85d01`; conflicts only among paths identified by actual merge | Preserve verified equivalent contents and newer local discovery slice; confirm both main commits are ancestors |
| C9 | Record integration decisions and verification | `decision-log.md`, `product/backlog.json`, `docs/CURRENT_STATE.md`, this plan | Append September decisions; TL-CAP-001 first, selected B pending separate feasibility, TL-TASK-001 next; record exact new revision, checks and pending peer review |

C9 must preserve backlog schema/dependencies and leave capture unbuilt; update the next-portfolio-decision field consistently. Do not create a new product backlog or mark the draft handoff ready. Existing historical evidence remains dated; new local checks are not replacements for deployment/device evidence.

C1–C7 are dependent preservation groupings, not claims that every intermediate commit builds independently: for example, package scripts in C1 reference tools introduced in C2/C4/C7. Fully verify the complete C7/C8 tree and the final C9 tree after any verification-affecting changes.

After checks, inspect branch diff/history against refreshed main and prepare the new PR as **integration candidate; peer review pending**. Approved Phase 2 may push only `codex/reconcile-september-base` and open that PR; do not use `--all`, `--mirror`, automatic tag publication, or merge. Do not call it a completed reviewed shared base until both main commits are incorporated, required checks pass and required review receipts exist. Approval to publish the base does not authorize posting the PR #2 review or contacting Claude.

## Verification gates

Run in the isolated integration copy, with private logs outside Git and production credentials excluded:

1. `npm run docs:verify` and `npm run privacy:check`; `git diff --check`; staged/publication-range content and credential review. Check the handoff's declared asset checksums. Confirm excluded files and recovery locations are absent from staged blobs and history being newly published.
2. Node tests: `node --test core/*.test.mjs scripts/*.test.mjs evals/*.test.mjs evals/lib/*.test.mjs services/private-artifact-delete/*.test.mjs`. Use synthetic data. Private adapter tests spawn Deno and write synthetic temporary directories; deletion-service tests bind ephemeral loopback ports. Permit these local operations in the isolated copy without weakening the adapter sandbox. Do not invoke production canary/rollout/report commands merely because similarly named test files exist.
3. Deno API and support tests: `deno test --config supabase/functions/api/deno.json --allow-env supabase/functions/api supabase/functions/_shared supabase/functions/private-artifact-delete`. The inspected tests need environment access and mocked fetches, not blanket network/read/run permission; do not broaden permissions merely to force a pass. No production network credentials or live provider calls; use pinned dependencies/lockfiles. Report environment/dependency failures separately from assertion failures.
4. iOS: isolated copy, known Simulator destination, derived data outside the source checkout, signing disabled. Run `xcodebuild -project ios/Throughline.xcodeproj -scheme Throughline -destination 'generic/platform=iOS Simulator' -derivedDataPath <isolated-derived-data> CODE_SIGNING_ALLOWED=NO build` with reviewed local configuration. If configuration generation is required, keep it only in the isolated copy. Exercise existing Swift contract tests through their supported harness; do not claim a Simulator build exercises owner behavior on a device.
5. Verify measurement SQL file hashes and review the consolidated database verifier. The Node unit tests do not prove migration execution. Any disposable local database check must use an isolated local database; hosted migrations/canaries remain gated. If local database runtime is unavailable, record that gap explicitly before recommending PR #1 closure.
6. Final source identity: remote heads refreshed, named-path inventory reconciled, no new private blobs, both newer main commits ancestors, full test/build results recorded. A failure is a stop-to-fix/report gate, not permission to deploy or weaken privacy requirements.

Tool availability checked September 28: Node `v26.7.0`, Deno `2.9.5`, Xcode `26.3` (`17C529`). CI currently pins Node 22; use that version for CI parity when available, or record the local version difference explicitly. No dependency/runtime installation occurred.

The direct source Git-integrity attempt was inconclusive because of the filesystem timeout documented below; do not label it passed.

Phase 1 itself ran docs verification (**19 backlog items, 47 checked Markdown files**) and privacy-policy parity: both passed. The selected handoff checksum file matched all 24 referenced assets (23 PNGs and the selected mock). All 255 candidate source hashes remained unchanged at the final planning check. Post-write checks also passed: `git diff --check`, every relative link in this plan, exact two-file Phase 1 delta, zero staged files, and unchanged hashes for all 255 pre-existing candidate files. Full Node/Deno/Simulator integration checks are planned for Phase 2, not claimed complete. Source comparisons and the isolated synthetic task-identity reproduction support the specific findings above, not merged-runtime correctness.

## iCloud checkout risk and recommended location

Historical Phase 1 recommendation; the approved migration is now complete as recorded in the [review integration follow-up](#review-integration-follow-up). The following risk assessment is retained as history.

**Recommend moving the active checkout out of iCloud before sustained multi-agent engineering.** The current convenient code-folder entry resolves to the same Documents checkout; changing the visible path alone does not solve this.

Apple documents that Desktop/Documents files sync between devices, that deletion propagates, and that local downloads can be removed ([Apple guidance](https://support.apple.com/en-ie/109344)). Git stores coordinated objects, refs, index and other repository state in multiple files ([Git repository layout](https://git-scm.com/docs/gitrepository-layout)). **Engineering inference:** ordinary per-file cloud sync is not a Git transaction protocol; hydration delays, concurrent devices and conflict copies can interrupt tools or expose inconsistent repository state. A direct source `git fsck --full --no-reflogs` during this phase exited 128 with `fatal: mmap failed: Operation timed out`; it could not complete the source integrity check. This is observed filesystem-access failure, not proof of corruption and not proof that iCloud alone caused it. The independently restored copy's integrity result is recorded above; a successful restore check does not erase this source-location failure.

Proposed later migration: a real nonsymlink directory such as `~/code/throughline-local`, outside Desktop/Documents and other sync roots. Stop writers for the copy, preserve the existing checkout, verify working-file hashes/Git status/HEAD, update the Codex and Claude project paths, and only then consider changing the old alias. Keep separate owned worktrees from the reconciled base after its common Git directory is outside iCloud. Do not disable global iCloud, delete the old checkout, replace its alias, or change project/automation registrations in Phase 1. Migration/repointing is a separately identified action; Phase 2 can use an isolated unsynced integration checkout without silently relocating the active project.

## Risks, ownership and stopping point

- **Privacy:** the five approved sanitizations are complete; exact final history must pass the publication screen. Backup contents never enter a remote or tracked report.
- **Source drift:** additional Claude or Codex edits after the snapshot require a supplemental verified backup and refreshed path hashes; no overwriting concurrent work.
- **Integration:** stale PR interfaces are incompatible with the local foundation; real task identity, schema/version and consent changes need deliberate later work.
- **Quality evidence:** structural tests and green CI do not establish voice-note quality or capture reliability; no new benchmark or feasibility verdict is made here.
- **Review:** independent Codex inspection is not mutual Claude/Codex review. Record `peer_review_pending` until exact-revision Claude review is authorized and received.
- **Recovery:** same-disk copy is limited protection; disk capacity, source availability and restore verification are explicit prerequisites.

Historical Phase 1 closeout: Phase 1 produced this plan and exact-path inventory, with the original branch/HEAD intact. The final working-tree delta for this phase is exactly two new files: this plan and its public path manifest; pre-existing files are unchanged. Backup/restore and checks are recorded above. No staging, commits, integration, publishing, PR comments, Claude contact, feature work, release or service changes occurred. Mike subsequently approved Phase 2 with the additions recorded above; the following receipt supersedes this historical stopping point.


## Phase 2 execution receipt

**Verified:** 2026-09-28. **Status:** integration candidate; `peer_review_pending`. Mike authorized publication of the named branch and its new PR only. The publication receipt and final documentation-commit SHA will be in that PR; this receipt does not claim a main merge or peer-review completion.

| Step | Exact commit | Result |
| --- | --- | --- |
| C1 | `9139206e746b36e7a6f400ac2b8fa4f11b58e686` | Preserve frozen inference and private evaluation tooling |
| C2 | `32c5da06bdcfcce2052af860dfdf7b4ae82b45b7` | Preserve hosted lineage retention and privacy foundation |
| C3 | `c482d787d41d0793ae717cc3548b7a3eed9895cd` | Preserve iOS revision and evaluation support |
| C4 | `8b6f3501fa065afa80f6a7e9854ed63c8bb95d47` | Preserve measurement attribution and reporting gates |
| C5 | `127c4a54d5d8623e8b2b0706690079dbd390e1db` | Preserve selected capture design handoff and explorations |
| C6 | `a9989e31f6973e97a431949c6d21e97778397d77` | Preserve marketing research and reviewed assets |
| C7 | `664a03bfcbee939ff3d1b12f715b9b663deeb5c4` | Preserve operating foundation and reconciliation evidence |
| C8 | `a743aac555b7e59e25bc55c7a0659864ed02c548` | Reconcile newer main ancestry while retaining the August foundation |

C8's tree is byte-identical to C7's tree. The single add/add conflict in `docs/slices/discovery-growth.md` retained the newer local backlog/slice-phase fields and August 28 rollback evidence after both sides were compared. Both main commits are ancestors. No product code changed during reconciliation. C9 changes only this receipt, `decision-log.md`, `product/backlog.json` and `docs/CURRENT_STATE.md`; it records Mike's selection and pending review gates. The path manifest's `preservation_sha256` column intentionally identifies C1–C7 bytes, before C9 canonical updates.

All five approved sanitizations were applied before preservation commits. The personal test path became `/home/example/throughline-evaluation-edge-canary-test.json`. All 33 protected design/handoff/mock files matched their inspected source hashes, and the selected handoff remains `0aab1100c7e5070d951142eeef5880498ef7760882650a53beff77ba412ad60c`. Its 24 declared asset checksums match. The handoff was not edited to record these decisions.

| Check | Result and boundary |
| --- | --- |
| Documentation foundation | PASS before and after C9: 19 backlog items; 47 checked Markdown files. |
| Privacy-policy parity | PASS before and after C9; this check is not a secret scanner. |
| Complete Node suites | PASS: 156/156 on Node 26.7.0. CI uses Node 22; local version difference disclosed. |
| Requested canary test | PASS: 13/13 after the neutral-path replacement; included in the complete Node total, not additional coverage. |
| Deno API/shared/deletion suites | PASS: 80/80 on Deno 2.9.5, frozen dependency lock, environment-only runtime permission, mocked provider calls. |
| Isolated iOS build | PASS: unsigned Release, generic iOS Simulator, arm64 and x86_64, Xcode 26.3 (17C529); neutral build-only configuration and separate DerivedData. This is not signed/device/TestFlight evidence. |
| Swift contracts | PASS: four executables covering evaluation coding/copy, note action items, product-event coding and attribution. |
| PR #1 SQL equivalence | PASS: five named SQL files byte-identical to PR head `1f58561417f634216438ab83b2157661bec1fdaf`. |
| Local database replay | NOT RUN: Docker socket absent and local PostgreSQL/Supabase database endpoints unavailable. No services started. New PR's existing isolated database CI is the next execution gate; PR #1 remains only provisionally superseded. |
| Whitespace | New edited tracked diffs pass. Preservation staging identified inherited Markdown hard breaks, template spacing and final blank lines; retained deliberately, including immutable `docs/handoffs/README.md`. These warnings are not represented as a clean full-range whitespace result. The new CSV uses LF endings. |
| Privacy/publication | Every candidate screened; final reachable history is re-screened before the exact branch push. Only named approved paths were staged. Private runtime logs and recovery locations remain outside Git. |

Backend checks initially encountered sandbox loopback/dependency access restrictions; the same tests passed with the required local socket/public dependency access, without loading production credentials. The iOS build needed local Simulator service access; its retry passed, with only the AppIntents metadata warning that no AppIntents dependency was present. No assertion was waived. The iOS source manifest hash is `8d9903c53b3d934f246497847448544725a82c6c065e8e64db98706f5c875f2c`; the pinned resolved-package file is `eae239dd13431df4df93d751ec78cdc5f17bb1146adb7f36945f604cf0d4e04e`. Private logs retain the detailed receipts.

**What remains:** publish only the approved branch/new draft PR after final checks; obtain the separately authorized peer-review receipts; perform capture feasibility as a separate task against the committed revision. No PR #1 closure, PR #2 comment/review, Claude contact, feature implementation, deployment, release, automation, flag or active-checkout migration is included. After PR creation, give Mike a concrete separate migration plan including both tools' project paths.


## Review integration follow-up

Verified 2026-09-28. This follow-up supersedes the earlier future publication/migration/peer-review stopping points without rewriting the historical execution record.

- Phase 2 was published as draft [PR #3](https://github.com/mpolner88/throughline/pull/3), reconciliation commit `bda1058947397b7bf1b908a0a682eb3966868a54`. The approved current-operation policy and its decision record advanced the branch to `372178b2b68d81691e8228443dacfebeec989e00`.
- Mike subsequently approved and completed the nonsynced active-checkout migration at `bda1058`; the active checkout is `throughline-local`, with a real independent Git directory. Saved Codex folder selection completed; Claude's actual review names this checkout and `372178b`. The old checkout, shortcut, separate reconciliation reference checkout and private recovery stay preserved. Private filesystem paths remain in the local migration receipt, outside Git. No active automation was resumed or repointed.
- Ignored `.throughline/`, `.superpowers/`, `supabase/.temp` and `supabase/.branches` were left in the old checkout. No recreation is needed now. Preserve private feedback and historical reports; regenerate new reporting/task state as needed; re-establish CLI linkage only in a later authorized operation.
- Claude's exact-base [review](2026-09-28-claude-reconciliation-capture-review.md) is complete. Codex's [R1–R17 disposition and revision-2 re-review](2026-09-28-codex-capture-rereview.md) records remaining defects and source-only verification limits. The candidate is reviewed with named gates; main merge is not approved.
- The frozen revision-2 handoff/assets/Claude receipt are preserved byte-identically. D1/D2 are accepted in the decision log. The capture handoff still needs C1–C6 resolution; Claude sets readiness only after exact re-review. Private Evaluation remains deferred. [R8/R9](2026-09-28-main-merge-decisions.md) await Mike's decisions, with no consent or site-config changes in this task.

Preservation commit: `602b75d33746ad11c5fcdb4b4f1f81d181d772b3` contains exactly the 20 reviewed Claude files, byte-identical to the supplied review target. The separate canonical-review commit contains exactly seven files: `decision-log.md`, `docs/CURRENT_STATE.md`, `docs/AGENT_TANDEM.md`, `product/backlog.json`, this reconciliation plan, `docs/evidence/2026-09-28-codex-capture-rereview.md` and `docs/evidence/2026-09-28-main-merge-decisions.md`. Its exact revision is the commit containing this receipt; final push identity is checked against PR #3 before closeout.

| Integration check | Result |
| --- | --- |
| Path, branch and starting HEAD | PASS: expected active physical checkout, named PR #3 branch, exact `372178b2b68d81691e8228443dacfebeec989e00` before changes. |
| Four supplied review/design hashes | PASS before review and after integration; no Claude-file edits by Codex. |
| Approved policy hashes | PASS: both unchanged; no policy edit. |
| Full asset manifest | PASS: 38/38 (mock plus 37 PNGs). |
| Prior image preservation | PASS: 21 prior PNGs byte-identical to `372178b`; two authorized discard PNGs revised and 14 new PNGs integrated. |
| Foundation docs verifier | PASS: 19 backlog items, 47 checked Markdown files; additional evidence links checked separately. |
| Privacy parity | PASS; parity alone is not a secret scanner. |
| Relative file/heading links | PASS: 232 links across changed Markdown at the final review pass. |
| Publication screen | PASS on changed text for credential/token/email/raw-identity/personal-path patterns, with synthetic mock-text review and three representative PNGs visually inspected. Existing neutral example-home fixture references were inspected and allowed. No raw user content introduced; this is not a claim of exhaustive image OCR or a new entire-history secret audit. |
| Named-path scope and whitespace | PASS: 20 Claude files plus seven Codex documentation files; no executable app/backend diff; new tracked/staged whitespace checks pass. |
| Runtime/build/database/device checks | NOT RUN in this documentation/design review; earlier checks retain their original source identity. Full evaluation replay and capture/device behavior remain unverified. |

The C1–C6 findings, complete disposition-file paths, exact preservation commit and accepted D1/D2 decisions were returned to the existing Claude Code design session on 2026-09-28. Delivery was visibly confirmed in the app and Claude acknowledged receipt-only, read-only review. No writing pass or readiness change was requested during integration. Any subsequent revision must receive its own hashes and re-review.

No feature implementation, policy edit, PR comment, PR #1/#2 change, main merge, deployment, migration execution or Apple action is included.
