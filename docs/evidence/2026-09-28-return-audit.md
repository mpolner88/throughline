# Throughline return audit — September 28, 2026

**Current:** Work is split between a substantially dirty local August checkout, remote main, and a newer September Claude cloud pull request. Public iOS remains 1.0.4; the latest internal build remains 1.0.5 (2026082801). The desired design/engineering split already existed locally, but its guidance was not in the cloud branch.

**Evidence:** Read-only local Git/source inspection, live GitHub metadata and checks, Claude desktop session inspection, Codex project/chat and automation inspection, App Store Connect UI, Supabase management metadata and aggregate queries, and a fresh aggregate product report. Verified on **2026-09-28**. This audit does not establish physical-device acceptance or independent real-audio model quality.

**Next gate:** Preserve and reconcile the local work with PR #2 into one reviewed shared base before resuming overlapping implementation. Then bring Mike a short choice between the existing capture-recovery candidate and the running-list product direction, informed by the engineering review. No product priority is changed by this audit.

**Authority:** Mike requested the audit and centralized Claude-design/Codex-engineering workflow with mutual review. This pass changes documentation only. No merge, push, deployment, build upload, policy/model/provider/credential change, automation resumption, or product implementation occurred.

## The main finding

The bottleneck is not a missing process document. There is already a detailed workflow, product charter, backlog, design language, quality program, and release procedure. The operating failure is that they are not shared durably across execution environments. The local operating foundation and substantial deployed-foundation source remain uncommitted, while Claude cloud developed a broad replacement on remote main without those files. More automation would currently accelerate incompatible states.

## Where the work is

| Surface | Verified state | How to use it now |
| --- | --- | --- |
| Canonical local checkout | This repository on `codex/core-quality-system`, HEAD `1ec0cbbd7699bda2c5e2bb646a6ebfb31c8f21b7` (August 27) | Preserve it as the source of local August work; do not reset or clean it. |
| Short local alias | the code-folder alias resolves to this same directory | Convenient alias, not a second checkout or backup. |
| Remote main | `fd85d0183719ac119d2c12a64435ef846faa3a0d` (August 28), verified against live GitHub | Shared remote base, but missing local operating/evaluation work. |
| Claude Code desktop / cloud | **Throughline UX and specs**, Cloud, linked to open [PR #2](https://github.com/mpolner88/throughline/pull/2) | Latest completed implementation is here; it is awaiting review/merge and release prerequisites. Do not follow the chat's merge/deploy instructions before reconciliation. |
| Claude CLI / local Remote Control | **Throughline design phase A**, shown as Remote Control in desktop; local session metadata spans August 30–September 5 | Contains capture-durability candidates. Last visible continuation ended with a connection problem; no candidate selection is established. CLI and desktop access do not constitute independent copies of the project. |
| Codex desktop | Existing Throughline local project points at this checkout | Recommended engineering/integration home. No Throughline ChatGPT cloud project appeared in the available project inventory. This does not prove no separate account/workspace exists. |
| Old deployment worktree | the former temporary deployment checkout is missing; Git retains a prunable registration | Historical location only; no cleanup performed. |
| Product-health automation | **Throughline Daily Product Health** is paused, targets an archived chat, and names missing a missing legacy Documents path | It is not providing a current monitoring loop. Repair the target/path and review its production-canary scope before any separately authorized resumption. |

The Claude cloud session reported PR #2 ready for review and corrected its earlier advice about dispatching workflows before the definitions reach the default branch. Its guidance is a historical task result, not authority to merge, add secrets, or deploy during this audit.

## Uncommitted and unmerged work

At the beginning of this audit:

- **53 tracked files modified; 3,827 untracked files; zero staged changes; no stashes.**
- **3,628 untracked paths are under `tmp/`**, of which 3,622 are under `tmp/pdfs`. Excluding `tmp/`, **252 changed paths remain**: 53 modified and 199 untracked. Do not mistake the large temporary-file count for thousands of product edits, or assume every temporary file is disposable.
- Tracked diff: **6,207 added / 1,029 removed lines**, plus six changed screenshot binaries.
- Current bytes in changed files: **46,372,073** (2,425,513 tracked modified; 43,946,560 untracked). These are file sizes, not patch sizes, and exclude ignored private state.
- Local branch is **49 commits ahead / 2 behind** the live-confirmed remote main. Local `main` is 1 ahead / 2 behind. The current `codex/core-quality-system` branch name is absent from the seven remote heads.

The substantive local changes cover:

| Group | Examples | Reconciliation concern |
| --- | --- | --- |
| Evaluation and lineage | API, inference contract, immutable revisions, owner contributions, retention/deletion functions, four untracked migrations, private-evaluation machinery | Source and evidence for the August deployed foundation must survive integration. |
| iOS | Home, upload client, note model, contribution contract, privacy manifest, project file | Newer Claude changes overlap these interfaces. |
| Measurement | CI workflow, reporting and database checks, cohort/reconciliation contracts | PR #1 and older remote measurement branches also need disposition. |
| Operating foundation | AGENTS, CLAUDE, CURRENT_STATE, PRODUCT, WORKFLOW, AGENT_TANDEM, backlog, release/evidence records | Core cross-tool guidance exists only in this working tree until scoped recovery/commit. |
| Design and marketing | Capture recovery mocks, Home ideas, screenshots, brand and marketing artifacts | Preserve as proposals/evidence; presence does not establish selected product direction. |

### Open PRs

[PR #2 — Running list: spec, eval gate, timeframe extraction, task list API, iOS tabs](https://github.com/mpolner88/throughline/pull/2):

- Six Claude-authored commits September 9–12; head `55973a48ed1c2ef4db01fb0e7b485fb8e9a92e73`, base `fd85d01`; open, no longer draft.
- **52 files, +7,661 / −2,161 lines. Twelve overlap the pre-audit dirty checkout.** Overlaps include Home, the API, extraction pipeline, upload client, note model, Xcode project, package, scorer, and operational documentation.
- Includes a running-list specification/mock, Today/This Week/Later extraction, task-list behavior/API, iOS tab changes, and manual deployment/TestFlight workflows. The planned 1.1.0 build is not visible in the live Apple build list.
- At the head revision, [local contract/evaluation and Edge checks](https://github.com/mpolner88/throughline/actions/runs/34708511727) and the [simulator build](https://github.com/mpolner88/throughline/actions/runs/34708511739) passed September 12. The body statement that Swift was not compiled is superseded by that build result.
- A green conditional Groq job alone does not establish that a live provider evaluation ran or satisfies the current real-audio integrity contract.
- **Zero submitted GitHub reviews, zero inline comments, zero issue comments.** The body reports independent-agent review, but there is no GitHub review receipt proving the requested Claude/Codex mutual review.
- No Supabase-deploy or TestFlight-upload execution appeared among the 32 retained Actions runs. Their workflow files exist on the PR, but are not listed among registered default-branch workflows. This is an execution-evidence gap, not a reason to add credentials during an audit.
- **AGENTS.md, CLAUDE.md, `.claude/`, and docs/AGENT_TANDEM.md are absent from both the PR base and head.** The cloud checkout could not inherit them through Git. Equivalent conversational instructions, if any, were not established.

[PR #1 — test(measurement): run database gate in CI](https://github.com/mpolner88/throughline/pull/1) is also open: nine files, +2,337 lines, a successful August 18 check. Reconcile it against the later local measurement work before deciding whether to incorporate or close it.

Other remote heads retain historical work: `codex/measurement-structured-contract-ci-20260818`, `codex/measurement-management-query-ci`, `codex/measurement-classification-ci`, `codex/measurement-database-gate`, and `edges-app`. None was changed or removed.

GitHub's mergeable result concerns PR #2 versus remote main. It does **not** establish compatibility with this local working tree or preservation of the production evaluation foundation. This audit is an inventory and integration-risk assessment, not an exhaustive code review of PR #2.

## What is actually released and working

| Layer | September 28 evidence | Boundary |
| --- | --- | --- |
| Public iOS | [App Store Connect distribution](https://appstoreconnect.apple.com/apps/6774304241/distribution/ios/version/deliverable) shows **1.0.4 Ready for Distribution**, associated with build **2026081602**; [US listing](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241) also names 1.0.4 | Apple build association is now directly observed; exact local-source-to-signed-binary identity remains unproved. |
| Internal iOS | [TestFlight](https://appstoreconnect.apple.com/apps/6774304241/testflight) latest **1.0.5 (2026082801)**, Complete upload, Testing, Internal QA, 60 days until expiry; displayed 1 install and 13 sessions | Aggregate install/use is now observed. It does not establish Mike accepted the restored Home or completed the evaluation journey. Crash/feedback dashes are not converted into verified zeros. |
| Backend | Supabase management lists Throughline ACTIVE_HEALTHY, **API v30**, **MCP v15**, **private-artifact-delete v3**, and ten migrations through the August 23 reconciliation schedule | Metadata inventory only: no new authenticated health or recording canary, source byte-match, secret inspection, or behavior-flag attestation. |
| Quality loop | Aggregate SQL: **0 processing operations, 0 owner evaluations, 0 contributions, 0 corpus cases** currently retained | No current production corpus or learning result. Stored legacy extraction ratings are different records. |
| Recent product evidence | Fresh [aggregate report](2026-09-28-product-evidence.md), generated 17:11 UTC over preceding 35 days | Below readiness floors and not a public outcome baseline. |

The fresh report contains **192 events, 25 sessions, 3 signed-in users**, zero weekly activated users, and four matched schema-v2 outcomes, all in **unknown** cohort. A follow-up aggregate query found their distribution channel is `unknown` with internal-user classification false. Two legacy-v1 outcomes and one final durable recording without a v2 upload marker remain separate. **Public-baseline-eligible outcomes: zero.** This supersedes the August statement that there were no real schema-v2 outcomes, but does not establish public growth or failure.

The database has 19 retained recordings overall and five created in the last 35 days. There are four legacy extraction-quality responses in the reporting window and zero product-feedback submissions. Small mixed ratings are not an independent transcription/extraction benchmark. Activation 1/1 and retention 1/2 are diagnostic counts below the canonical floors, not meaningful percentage claims.

No production canary was run because it creates test activity. No raw recording, transcript, note, feedback text, account identity, credential, or individual session record is retained in this evidence.

## Voice-note improvement readiness

1. **Capture recovery remains unresolved in local source.** Audio is created in temporary storage ([AudioRecorder](../../ios/Throughline/Services/AudioRecorder.swift)); [Home](../../ios/Throughline/Views/HomeView.swift) reports upload failure without a durable outbox/replay/retry path. This is a source-confirmed risk; failure frequency and physical-device reproduction are unknown.
2. **Truthful saved state needs attention.** Failed demo promotion returns the local captured note, then [Onboarding](../../ios/Throughline/Views/OnboardingView.swift) enters Home; [AppState](../../ios/Throughline/AppState.swift) preserves local notes across refresh. A visible note is not necessarily hosted or agent-readable. Onboarding changes still require explicit selection/approval.
3. **The honest evaluation foundation exists, but no real benchmark is established.** Current metrics require complete lineage and independent predictions with at least 20 accepted full-output holdout cases. Synthetic mechanics and copied-fixture scores cannot identify a model winner.
4. **Feedback is not yet improving the system automatically.** The current source/evidence has no proven live feedback-to-candidate-to-promotion loop or decision-grade cost ledger. Changing models now would precede the evidence needed to judge the result.
5. **Reporting needs one small presentation repair.** The generator still prints activation/retention percentages below the canonical readiness floors, despite its collecting-baseline label. The linked audit copy suppresses these percentages; the generator was not changed in this documentation pass.
6. **Reconcile before choosing implementation.** PR #2 contains materially different task/extraction and API work. Review preservation of lineage, privacy, original outputs, evaluation eligibility, recovery behavior, and task identity before treating it as the new base.

The existing capture-durability mock set is ready to revisit, not redesign from scratch: [overview](../../mockup/capture-durability/overview.html), [A](../../mockup/capture-durability/candidate-a.html), [B](../../mockup/capture-durability/candidate-b.html), [C](../../mockup/capture-durability/candidate-c.html). Claude recommended B, a recovery tray above the recorder. Mike's selection is not recorded. No completed selected handoff exists in `docs/handoffs/`.

## Recovered ideas and previous conversations

The [canonical backlog](../../product/backlog.json) contains 19 items and remains dated August 29. It preserves the last portfolio decision; it is not yet reconciled with September PR #2.

| Idea | Existing source and disposition |
| --- | --- |
| Better transcription, missed-action/unsupported-action scoring, feedback learning | `TL-TRNS-001`, `TL-EXTRACT-001`, `TL-LEARN-001`, [core program](../programs/core-quality-learning.md); evidence gathering, behind honest evaluation |
| Recoverable recordings and truthful save | `TL-CAP-001`; candidates above; unselected |
| Today / This Week / Later, less crowded Home, swipe done/archive, bottom navigation | `TL-TASK-001`, [August part specifications](../superpowers/specs/2026-08-25-home-feedback-part-specs.md), and September [running-list spec in PR #2](https://github.com/mpolner88/throughline/blob/55973a48ed1c2ef4db01fb0e7b485fb8e9a92e73/docs/superpowers/specs/2026-09-09-throughline-running-list-design.md); do not conflate older rejected Home with newer unmerged work |
| Searchable knowledge/library and entities | `TL-KNOW-001`; direct retrieval evidence before graph/backlinks |
| Guided agent access and later scoped actions | `TL-AGENT-001`; current MCP read access is distinct from proposed writes |
| Cost ledger, account-private personalization | `TL-COST-001`, `TL-PERS-001`; evidence only |
| Premium longer recordings and earned recording credits | `TL-PREM-001`, `TL-CRED-001`; parked pending quality, cost, retention and policy decisions |
| Markdown/JSON export, task integration, Obsidian sync, Action Button/App Intent, audio import/Share Sheet, later Watch | [August research brief](../../product/research/2026-08-07-voice-knowledge-market/brief.md); historical ideas not selected scope |
| Growth assets and distribution | [Discovery integration report](../../marketing/discovery/_run/integration-report.md); owned-page evidence, registry/creator/community packets; prepared material is not proof of distribution or performance |

Useful Codex chats, using their current app titles: **Audit Throughline workflows**, **Improve voice quality loop**, **Design Throughline usability updates**, and **Boost app store marketing**. The usability chat stopped awaiting a visual selection. The quality chat ended with the August rollback build. The marketing chat ended with the owned discovery deployment and uncommitted mixed canonical updates. Chat modification timestamps alone are not evidence of recent engineering.

Useful Claude sessions: **Throughline design phase A** (local/Remote Control capture-recovery mocks) and **Throughline UX and specs** (cloud running-list PR). These are separate work streams, not successive revisions of one agreed handoff.

## Central workflow and concrete next actions

The canonical procedure remains [AGENT_TANDEM.md](../AGENT_TANDEM.md#daily-working-agreement), now with the requested mutual-review rules. No second roadmap or coordination dashboard was added.

1. **Codex: recover and reconcile.** Create a content-safe recovery inventory, preserve local source/evidence and needed ignored private state outside public Git as appropriate, then split bounded work into reviewed commits without sweeping in temporary/private content. Compare remote main, PR #1, PR #2 and local work by component. Establish the shared base before starting new writers; do not assume a fresh main worktree contains the local work.
2. **Codex: review the September candidate.** Produce a concrete keep/rework/defer disposition for the 12 overlapping dirty paths and the broader API/quality/privacy contracts. Determine whether the running-list implementation preserves the August deployed foundation. This is the next engineering task, not an automatic merge.
3. **Mike: pick one product slice after that comparison.** Capture recovery is the strongest source-backed reliability candidate; running list is already a substantial alternative. Reuse existing mock/spec work, show the exact candidate, and avoid parallel redesigns.
4. **Claude and Codex: execute one complete loop.** Claude designs; Codex reviews feasibility; Mike selects; Claude commits the selected handoff; Codex implements/verifies; Claude reviews the exact result; Codex delivers within existing authority; Mike uses the actual build. Record evidence and one next action in the same slice/handoff.
5. **After the loop works, simplify monitoring.** Fix the stale paused automation target and decide whether a read-only report or production canaries are wanted. A router or release bot is not the prerequisite for a good first cycle.

## Changes and validation in this pass

Owned documentation: this report and the sanitized aggregate report; README entry link; dated current-state refresh; tandem daily working agreement/review gates; handoff review-receipt fields; Claude entry guidance; appended decision record; and removal of stale evaluator instructions that assigned owner labels to agents or invoked a nonexistent `eval:check` command.

Pre-existing changes were preserved; nothing was staged or committed. These improvements are still local until the scoped reconciliation/commit step makes them available remotely. The process is documented; an actual Claude/Codex cross-review cycle has not yet been completed or automated.

- `npm run docs:verify`: baseline and closeout passed (19 backlog items, 47 checked Markdown files). The new audit's repository-relative links were also checked directly; none was missing.
- `node --test core/extraction-pipeline.test.mjs scripts/product-learning-report.test.mjs`: 19/19 passed during this audit.
- `npm run privacy:check`: passed.
- `git diff --check`: passed at closeout.
- A read-only Codex scout reviewed the documentation additions; its readiness-display and review-sequence findings were corrected. This was not Claude peer review.
- Fresh `product:weekly` report generated successfully; aggregate SQL and management reads succeeded.
- No full local iOS build or device test was run. September CI results belong to the PR head, not the dirty local tree.

## Evidence collection boundaries

Reproducible local inventory uses `git status --porcelain=v1 -uall`, `git diff --numstat`, `git worktree list --porcelain`, branch history/divergence, and file-size summaries. Remote inventory uses live `gh pr view`, reviews/comments, branch/tree, workflow and run endpoints. Supabase queries returned aggregate counts or schema/management metadata only. Apple and Claude state was observed through their UI; private screenshots/session payloads and secrets were not saved into the repository. The canonical report generator retained its temporary output privately; the linked Markdown copy contains aggregates only and suppresses below-floor activation/retention percentages.

Not verified: exhaustive filesystem/backups inventory; every chat in every account; process-level writer inventory (restricted by the local sandbox); exact deployed source bytes and active feature flags; runtime auth/recording health; physical-device behavior and owner acceptance; full PR code/security review; independent real-audio quality, costs, or public cohort outcomes. The public discovery page was not freshly verified in this pass.
