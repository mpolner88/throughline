# Throughline Documentation Operating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one coherent, tracked source-of-truth system for Throughline's product, current runtime, decision authority, slice workflow, measurement, and releases without changing product behavior.

**Architecture:** Root `AGENTS.md` is the entry point and routes each kind of work to a single canonical document. Durable product intent, verified current state, current architecture, workflow, backlog/metrics, bounded program briefs, implementation plans, and immutable release manifests remain separate so facts and aspirations cannot silently overwrite one another. Existing historical documents are preserved with explicit archival or supersession pointers instead of being deleted.

**Tech Stack:** Markdown, JSON, Git, existing Node.js repository checks.

## Global Constraints

- Mike decides what enters build, reviews product/design taste and judgment, and sets priority.
- Agents own baseline inspection, options, specifications, plans, implementation, verification, routine reversible rollout, measurement, and documentation.
- The user who recorded a note is the only human evaluator; there is no Mike, employee, contractor, or external-review queue.
- Safe prompt, schema, and normalizer changes may auto-promote only after declared quality, critical-error, reliability, latency, cost, canary, lineage, and rollback gates pass.
- Provider, base-model, data-use policy, pricing, recording-limit, onboarding, and App Store submission changes require Mike's explicit approval.
- Current recording facts are: 30-second demo; authenticated client cap of five minutes per recording; intended ten-minute daily allowance is not implemented or enforced and must never be described as live.
- Longer premium recordings up to 15 minutes and evaluation credits remain backlog-only.
- Do not change onboarding in this plan.
- Throughline serves an individual speaking while driving, walking, or thinking; it turns voice into structured notes and to-dos readable by the user's AI agent. It is not a meeting recorder or team-transcription product.
- Never put raw audio, transcripts, note text, feedback text, emails, credentials, or raw user/session identifiers in tracked reports, analytics, fixtures, or release manifests.
- Preserve all unrelated dirty-worktree changes. Stage only the files named by the current task.
- The submitted 1.0.4 build source is not reproducible from a committed tree; document that gap without claiming it is fixed.
- Do not edit or stage `docs/product-learning-loop.md` or `docs/app-store-readiness.md` in this plan because both contain pre-existing uncommitted 1.0.4 work. Consolidate them only after the release-provenance slice preserves that source.

---

### Task 1: Repository Entry Point and Authority Workflow

**Files:**
- Create: `AGENTS.md`
- Create: `docs/WORKFLOW.md`

**Interfaces:**
- Consumes: the Global Constraints in this plan and the existing `decision-log.md`, `product/metrics.md`, `product/backlog.json`, and `docs/superpowers/specs/` conventions.
- Produces: the required repository read order, canonical-source map, authority matrix, and slice lifecycle that every later task follows.

- [ ] **Step 1: Create the repository read order and source-of-truth map**

  Write `AGENTS.md` with this required sequence: `docs/CURRENT_STATE.md`; `docs/PRODUCT.md`; the relevant program/slice brief; `docs/WORKFLOW.md`; `product/metrics.md`; `product/backlog.json`; then component runbooks. State that current-state facts must include a verification date and evidence link, historical documents cannot override canonical sources, and a dirty checkout must be inspected before staging.

- [ ] **Step 2: Encode the authority matrix**

  In `AGENTS.md`, record the exact Mike/agent responsibilities from Global Constraints. State that routine reversible work inside an approved slice does not need another approval, while provider/base-model/data-policy/pricing/limits/onboarding/App Store submission changes do.

- [ ] **Step 3: Define the slice lifecycle**

  Write `docs/WORKFLOW.md` with these states and owners: `baseline` (agent); `candidate` (agent options); `selected` (Mike); `design_approved` (Mike taste/judgment); `planned` (agent); `building` (agent); `canary` (agent within authority); `measuring` (agent); `closed` or `iterate` (agent evidence, Mike reprioritization). Require one user problem, evidence, one primary metric, guardrails, non-goals, authority class, rollback, and evidence/release manifest per slice.

- [ ] **Step 4: Define urgent and hybrid paths**

  Document that urgent reliability/security repairs may bypass design review only when the reason, scope, rollback, and verification are recorded. Document the automatic prompt/schema/normalizer promotion gates verbatim from Global Constraints and the quarantine path for ambiguous user labels.

- [ ] **Step 5: Self-review Task 1**

  Confirm the files contain no tool-specific Claude/council chain, no recurring Mike implementation review, and no contradictory second source of backlog or metrics truth.

- [ ] **Step 6: Commit Task 1**

  Run `git diff --check -- AGENTS.md docs/WORKFLOW.md`, stage only those two files, and commit with message `docs: define Throughline operating workflow`.

### Task 2: Verified Current State and Current Architecture

**Files:**
- Create: `docs/CURRENT_STATE.md`
- Create: `docs/ARCHITECTURE.md`
- Modify: `docs/hosted-backend.md`

**Interfaces:**
- Consumes: inspected iOS 1.0.4 source, deployed Supabase/Groq configuration evidence, August 17 aggregate production baseline, and Task 1's canonical-source rules.
- Produces: date-stamped operational reality and a factual runtime/data-flow map; component runbooks link here rather than restating architecture.

- [ ] **Step 1: Write current release and runtime facts**

  Create `docs/CURRENT_STATE.md` dated August 17, 2026. Record public 1.0.3, uploaded/TestFlight 1.0.4 build 2026081602, the lack of independent local proof for every App Store Connect state beyond upload, Supabase API, Groq `whisper-large-v3-turbo`, Groq `openai/gpt-oss-120b`, JSON-object extraction mode, 30-second demo, five-minute authenticated client cap, absent ten-minute daily enforcement, and unchanged onboarding.

- [ ] **Step 2: Record the privacy-safe usage baseline and caveats**

  Record 536 mixed events/76 sessions/five signed-in users; 12 durable processed recordings; six authenticated recordings across four users; eight feedback rows across five recordings from two reviewers; 28 action toggles concentrated in two users; zero edits; zero active MCP tokens. Explicitly say test/internal traffic is not yet marked and the 20% activation calculation is not a valid public baseline because event versions and `surface` coverage differ.

- [ ] **Step 3: Record known system gaps**

  Include: feedback is stored but not consumed; edits overwrite originals; no immutable transcription/extraction lineage; no exact model or prompt hash attribution; the current eval check self-copies golden output; events and durable-recording counts conflict; product cost ledger absent; submitted source not fully committed.

- [ ] **Step 4: Write the current architecture**

  Create `docs/ARCHITECTURE.md` describing SwiftUI capture/auth/event queue; Supabase Edge API; Storage/Postgres; Groq transcription/extraction; structured-note normalization; feedback/edit/action APIs; first-party event storage and PostHog analysis copy; read-only MCP. Link to exact current modules and distinguish current from target architecture.

- [ ] **Step 5: Convert hosted-backend documentation into a runbook**

  Keep commands, environment variables, deployment, canary, and retention operations in `docs/hosted-backend.md`. Add a top-level pointer to `docs/ARCHITECTURE.md`, remove claims that conflict with current state, and add a last-verified field.

- [ ] **Step 6: Self-review and commit Task 2**

  Check every live claim against code or captured production evidence; run `git diff --check -- docs/CURRENT_STATE.md docs/ARCHITECTURE.md docs/hosted-backend.md`; stage only these files; commit with message `docs: capture current Throughline system state`.

### Task 3: Durable Product Charter and Historical Boundaries

**Files:**
- Create: `docs/PRODUCT.md`
- Modify: `throughline-product-spec-v0.md`
- Modify: `agentic-product-workflow.md`
- Modify: `agent-prompts.md`

**Interfaces:**
- Consumes: Mike's origin story and non-goals plus Task 1's canonical-source map.
- Produces: one durable product charter and explicit noncanonical pointers on overlapping legacy documents.

- [ ] **Step 1: Write the durable product charter**

  Create `docs/PRODUCT.md` with: the driving-to-work safety problem; voice capture while driving/walking/thinking; Obsidian-style durable knowledge; the promise `voice → structured notes and to-dos → readable AI agent`; the core recording/transcription/extraction/user-review/learning loop; target individual; non-goals of meetings, team transcription, and generic audio archive; principles of speed, trustworthy structure, traceability, portability, and quiet disclosure. Link visual/voice authority to `throughline-brand-decisions.md`.

- [ ] **Step 2: Mark the v0 product spec historical**

  Add a short archival banner to `throughline-product-spec-v0.md` saying it is retained for history and that `docs/PRODUCT.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, and active program briefs now govern. Do not rewrite the historical body.

- [ ] **Step 3: Mark tool-specific workflow documents noncanonical**

  Add concise supersession banners to `agentic-product-workflow.md` and `agent-prompts.md` pointing to `AGENTS.md` and `docs/WORKFLOW.md`. Preserve historical content below the banner.

- [ ] **Step 4: Record the deferred dirty-file consolidation**

  In the historical-boundaries section of `docs/PRODUCT.md`, state that `docs/product-learning-loop.md` remains a noncanonical, pre-existing dirty release artifact until the release-provenance slice preserves it; current workflow, metrics, and backlog truth already live in their canonical files. Do not modify or stage the dirty file in this task.

- [ ] **Step 5: Self-review and commit Task 3**

  Confirm `docs/PRODUCT.md` contains no live release, model, pricing, or metric facts; run `git diff --check` on the four Task 3 files; stage only those files; commit with message `docs: establish durable Throughline product charter`.

### Task 4: Core Quality Program Brief and Locked Decisions

**Files:**
- Create: `docs/programs/core-quality-learning.md`
- Modify: `docs/superpowers/specs/2026-08-16-core-quality-learning-system-design.md`
- Modify: `decision-log.md`

**Interfaces:**
- Consumes: approved hybrid-learning design, current baseline, and Tasks 1–3.
- Produces: one active program brief, a historical pointer for the superseded large draft, and append-only decision records.

- [ ] **Step 1: Create the active program brief**

  Write `docs/programs/core-quality-learning.md` with problem, target outcome, verified baseline, locked decisions, authority, automated learning flow, promotion gates, program metrics, non-goals, and links to bounded slices. State that user feedback is validated, deduplicated, classified, and quarantined automatically; Mike does not review examples.

- [ ] **Step 2: Define the initial bounded slices**

  List: `measurement-attribution`; `evaluation-truth-and-lineage`; `transcription-challenger`; `extraction-contract-and-missed-actions`; `agentic-feedback-learning`; `capture-recovery`; `personalization`. Keep premium recording limits and evaluation credits as backlog-only, not program milestones.

- [ ] **Step 3: Preserve the superseded draft**

  Add a clear status banner to `docs/superpowers/specs/2026-08-16-core-quality-learning-system-design.md` pointing to the active program brief. State which assumptions were superseded: manual reviewer/promotion, 60-second authenticated limit, and built-now credits. Preserve the old text for history.

- [ ] **Step 4: Append locked decisions**

  Append dated entries to `decision-log.md` for: target user/non-goal; user-only reviewer; hybrid authority; unchanged onboarding; current 30-second demo and five-minute per-recording limit; intended but unenforced ten-minute daily allowance; premium up-to-15-minute and credits backlog-only; baseline-first rule; Mike's three responsibilities; automatic implementation/rollout authority within approved reversible slices.

- [ ] **Step 5: Self-review and commit Task 4**

  Search the active brief for `60-second`, `manual review`, `Mike reviews examples`, and credit-ledger implementation language; remove any conflict. Run `git diff --check` on the three Task 4 files; stage only those files; commit with message `docs: revise core quality learning program`.

### Task 5: Product Operations and Immutable Release Evidence

**Files:**
- Modify: `product/README.md`
- Modify: `product/metrics.md`
- Modify: `product/backlog.json`
- Create: `docs/releases/README.md`
- Create: `docs/releases/TEMPLATE.md`
- Create: `docs/releases/2026-08-16-ios-1.0.4-2026081602.md`

**Interfaces:**
- Consumes: the current aggregate baseline, existing backlog, local Xcode upload receipt, Task 1 workflow, and Task 2 current-state facts.
- Produces: tracked product operations, refreshed priorities, and an immutable release-evidence pattern.

- [ ] **Step 1: Narrow the product operations README**

  Make `product/README.md` the operational guide for canonical Supabase evidence, PostHog analysis copies, report commands, privacy rules, baseline thresholds, and evidence-to-backlog updates. Link workflow rather than duplicating it.

- [ ] **Step 2: Correct metric interpretation rules**

  Update `product/metrics.md` to require separate `internal` and `external` populations once measurement cohorts exist; keep current mixed results labeled non-decision-grade; require event-to-durable-recording reconciliation for processing outcomes; add coverage for feedback deduplication and agent-ready answer rate.

- [ ] **Step 3: Refresh the canonical backlog**

  Update `product/backlog.json` timestamp and evidence. Add ordered items for measurement attribution, honest eval/lineage, transcription challenger, extraction contract/missed actions, and agentic feedback learning. Keep existing unrelated items and explicitly leave premium limits and credits in evidence/backlog states. Ensure valid JSON and no raw content or identifiers.

- [ ] **Step 4: Create the release-manifest contract**

  Write `docs/releases/README.md` and `TEMPLATE.md` defining immutable fields: product/version/build; source commit/tree and dirty-state caveat; archive/upload evidence; App Store/TestFlight state with evidence strength; backend function version/hash; migrations; provider/model/config identifiers without secrets; canaries/tests; decision/rollback; known gaps.

- [ ] **Step 5: Capture build 1.0.4 evidence**

  Create `docs/releases/2026-08-16-ios-1.0.4-2026081602.md`. Record that local archive evidence proves successful Apple upload on August 16/17, 2026; current repo documentation asserts processing/TestFlight/submission state; exact submitted source is not reproducible from a clean commit; the archive receipt lives under `/private/tmp` and is ephemeral. Do not claim more than evidence supports.

- [ ] **Step 6: Record the deferred mutable-checklist consolidation**

  In the 1.0.4 release manifest, state that `docs/app-store-readiness.md` contains pre-existing uncommitted release work and will be reduced to a current checklist only after the release-provenance slice preserves it. Do not modify or stage the dirty file in this task.

- [ ] **Step 7: Validate and commit Task 5**

  Run `node -e 'JSON.parse(require("fs").readFileSync("product/backlog.json","utf8")); console.log("valid backlog json")'`, `npm run product:weekly:test`, and `git diff --check` on the Task 5 files. Stage only those files and commit with message `docs: track product evidence and release provenance`.

### Task 6: Whole-Foundation Verification

**Files:**
- Verify only; modify only files from Tasks 1–5 if verification exposes a defect.

**Interfaces:**
- Consumes: all documentation-foundation tasks.
- Produces: a clean canonical read path and evidence that the foundation is internally consistent.

- [ ] **Step 1: Validate canonical links and JSON**

  Resolve every relative link added by Tasks 1–5. Parse `product/backlog.json`. Confirm every canonical artifact named by `AGENTS.md` exists and is tracked.

- [ ] **Step 2: Search for active contradictions**

  Search canonical files for claims that authenticated recordings are currently 60 seconds, the ten-minute daily cap is enforced, credits are being built now, Mike reviews evaluation examples, onboarding should change, or current extraction feedback already trains/improves the model. Historical documents modified by this plan may contain those claims only below an explicit supersession banner. The two explicitly deferred dirty release documents remain noncanonical until the provenance slice.

- [ ] **Step 3: Run repository checks**

  Run `npm run product:weekly:test`, `npm run extraction:test`, and `git diff --check`. Record the exact results in the task report.

- [ ] **Step 4: Review the staged scope**

  Run `git status --short` and confirm no unrelated app, screenshot, marketing, or generated-output files are staged by this plan.

- [ ] **Step 5: Commit verification fixes if needed**

  If verification required changes, stage only files named in this plan and commit with message `docs: verify operating system consistency`. If no changes were required, do not create an empty commit.
