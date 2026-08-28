# Proof Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one evidence-led weekly proof kernel that turns a current Throughline workflow into a master demo, channel-native derivatives, creator material, and a measurable learning record.

**Architecture:** A Terra editorial lead freezes one audience/promise/proof/CTA before production. Luna handles bounded research, prompt assembly, and derivative transformations; Terra owns story, real-product capture, claim review, and the accepted-select boundary. Structural completion and release readiness are separate states.

**Tech Stack:** Markdown campaign artifacts, current iOS screen capture, synthetic demo data, MP4/WebP/PNG outputs, model-agnostic image/video providers, app-content-studio validation, experiment ledger.

**Spec:** `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`

## Global Constraints

- One kernel has one audience, one promise, one proof, one CTA, and one material test variable.
- Use current-build product capture and synthetic data; generated media cannot impersonate the UI.
- Never retain personal content, notifications, tokens, credentials, emails, or raw identifiers in media or tracked artifacts.
- Verify current provider access, cost, commercial rights, disclosure, and provenance before generating or spending.
- Do not clone a voice, publish, schedule, or call an uninspected export finished.
- “Fastest” remains a hypothesis unless comparative evidence and Mike approval exist.

## File Map

- Create `marketing/discovery/proof-factory/kernel-brief.md`: selected audience/story/test contract.
- Create `marketing/discovery/proof-factory/claim-register.md`: claim status and source ledger.
- Create `marketing/discovery/proof-factory/story-package.md`: exact master narrative and hooks.
- Create `marketing/discovery/proof-factory/production-plan.md`: synthetic data, shots, capture, and edit.
- Create `marketing/discovery/proof-factory/generation-plan.md`: provider-neutral support-asset prompts and rights/cost gates.
- Create `marketing/discovery/proof-factory/distribution-pack.md`: channel-native derivative drafts.
- Create `marketing/discovery/proof-factory/creator-kit.md`: creator-facing proof and trial workflow.
- Create `marketing/discovery/proof-factory/edit-review.md`: hard-fails, quality score, and direct-inspection record.
- Create `marketing/discovery/proof-factory/results-retro.md`: empty-results-safe measurement template.
- Create `marketing/discovery/proof-factory/evidence-manifest.md`: dated public/repository evidence.
- Create `marketing/discovery/proof-factory/decision-summary.md`: selected kernel and Mike gate.
- Create `marketing/discovery/proof-factory/acceptance-checklist.md`: structural and release checks.
- Create `marketing/discovery/proof-factory/blockers.md`: missing proof, rights, exports, or approval.
- Create after creative approval `marketing/discovery/proof-factory/assets/source/`: current-build source capture.
- Create after creative approval `marketing/discovery/proof-factory/assets/generated/`: labeled generated support candidates.
- Create after creative approval `marketing/discovery/proof-factory/assets/exports/`: reviewed derivative exports.

---

### Task 1: Freeze The Weekly Kernel Contract

**Files:**
- Create: `marketing/discovery/proof-factory/kernel-brief.md`
- Create: `marketing/discovery/proof-factory/evidence-manifest.md`
- Create: `marketing/discovery/proof-factory/acceptance-checklist.md`
- Create: `marketing/discovery/proof-factory/blockers.md`

**Interfaces:**
- Consumes: canonical product/marketing sources, current public signals, prior experiment ledger.
- Produces: one frozen kernel consumed by Tasks 2-5.

- [ ] **Step 1: Write structural and release checks first**

Separate `structural_ready` from `release_ready`. Structural checks cover complete briefs, claims, shots, derivatives, experiment IDs, and gates. Release checks additionally require real exports, direct inspection, privacy/rights/originality review, and Mike approval.

- [ ] **Step 2: Gather audience signals**

Collect dated public questions, objections, phrasing, and format patterns. Paraphrase creator language; do not copy exact hooks, layouts, likeness, or signature devices.

- [ ] **Step 3: Select the kernel**

Choose one target audience, one real situation, one tension, one promise, one current-product proof loop, one CTA, one experiment ID, and one material variable. Record rejected alternatives and why they are weaker now.

- [ ] **Step 4: Establish baseline metrics**

Record current available channel/product metrics without invented values. Define hold/completion, qualified reply, App Store click, first-time download, aggregate download-to-auth proxy, first value, and first-MCP-use coverage gap.

- [ ] **Step 5: Verify one-variable discipline**

Run:

```bash
rg -n "Audience:|Situation:|Promise:|Proof:|CTA:|Experiment ID:|Material variable:" marketing/discovery/proof-factory/kernel-brief.md
```

Expected: each label appears with one selected value.

- [ ] **Step 6: Commit the kernel contract**

```bash
git add marketing/discovery/proof-factory/kernel-brief.md marketing/discovery/proof-factory/evidence-manifest.md marketing/discovery/proof-factory/acceptance-checklist.md marketing/discovery/proof-factory/blockers.md
git commit -m "docs: define Throughline proof kernel"
```

### Task 2: Write The Claim-Safe Master Story

**Files:**
- Create: `marketing/discovery/proof-factory/claim-register.md`
- Create: `marketing/discovery/proof-factory/story-package.md`

**Interfaces:**
- Consumes: Task 1 kernel, product truth, current app/MCP behavior.
- Produces: approved narrative contract for production and derivatives.

- [ ] **Step 1: Register every external claim**

Use columns `ID | Claim | Status | Source | Checked | Allowed wording | Prohibited implication | Visual proof`. Status values are `verified`, `needs-verification`, `internal-only`, and `do-not-use`.

- [ ] **Step 2: Write the master story spine**

Define the first-frame outcome, spoken setup, recording, structured note/to-dos, agent retrieval, trust boundary, and App Store CTA. Deliver the promise inside the opening seconds rather than starting with product history.

- [ ] **Step 3: Write controlled hook options**

Provide three complete hooks that vary only the declared material variable. Select one default. Keep body, proof, and CTA stable.

- [ ] **Step 4: Map every beat to proof**

For every beat record duration, spoken line, on-screen text, source claim ID, visual change, and transition reason.

- [ ] **Step 5: Run the claim scan**

Run:

```bash
rg -n -i "fastest|best|only|native integration|writes|takes action|customer|users love" marketing/discovery/proof-factory/story-package.md marketing/discovery/proof-factory/claim-register.md
```

Expected: any match is explicitly marked `needs-verification`, rejected, or supported by current evidence.

- [ ] **Step 6: Commit the story contract**

```bash
git add marketing/discovery/proof-factory/claim-register.md marketing/discovery/proof-factory/story-package.md
git commit -m "docs: write claim-safe Throughline proof story"
```

### Task 3: Plan Current-Build And Generated Asset Production

**Files:**
- Create: `marketing/discovery/proof-factory/production-plan.md`
- Create: `marketing/discovery/proof-factory/generation-plan.md`

**Interfaces:**
- Consumes: Task 2 story and visual/provider systems.
- Produces: exact source-capture and optional support-generation jobs.

- [ ] **Step 1: Define the synthetic demo dataset**

Use a fictional spoken plan with no real names, projects, addresses, accounts, or private events. Record the exact expected structured title, summary, and to-dos so capture continuity can be checked.

- [ ] **Step 2: Create the source shot list**

For each shot specify device/build, orientation, duration, app state, user action, expected UI, crop-safe area, caption, redaction, audio, and acceptance condition. Include record, processed result, and agent read.

- [ ] **Step 3: Define provider-neutral support shots**

Use generated media only for contextual transitions or diagrams. For each job specify purpose, immutable prompt version, aspect ratio, continuity references, prohibited elements, candidate count, cost cap, rights check, disclosure, and accepted-select owner.

- [ ] **Step 4: Freeze provider selection gates**

Require a current provider access check, current price, commercial-use terms, training/data-use posture, watermark/provenance behavior, and Mike approval before any Higgsfield, Gemini, Firefly, Runway, or other call.

- [ ] **Step 5: Validate asset coverage**

Run:

```bash
rg -n "current build|synthetic|record|structured|agent read|redaction|cost cap|commercial|accepted select" marketing/discovery/proof-factory/production-plan.md marketing/discovery/proof-factory/generation-plan.md
```

Expected: real proof and optional support media are separately complete.

- [ ] **Step 6: Commit the production package**

```bash
git add marketing/discovery/proof-factory/production-plan.md marketing/discovery/proof-factory/generation-plan.md
git commit -m "docs: plan Throughline proof production"
```

### Task 4: Derive Channel-Native Distribution And Creator Material

**Files:**
- Create: `marketing/discovery/proof-factory/distribution-pack.md`
- Create: `marketing/discovery/proof-factory/creator-kit.md`
- Create: `marketing/discovery/proof-factory/results-retro.md`

**Interfaces:**
- Consumes: frozen Tasks 1-3.
- Produces: X, Reddit, vertical video, carousel, creator, owned-search, and measurement artifacts.

- [ ] **Step 1: Produce the exact weekly derivative set**

Write three vertical cuts, one screenshot triptych/carousel, five founder/X variants, two named-community Reddit drafts, one creator excerpt, and one owned-search concept only when the intent evidence supports it.

- [ ] **Step 2: Make each derivative native**

For every item record audience, channel, hook, asset, CTA, experiment ID, community rule/source, source proof, and why its edit/copy is native rather than a crop.

- [ ] **Step 3: Build the creator kit**

Include literal product description, who it is for/not for, proof workflow, current setup limits, synthetic trial script, claim boundaries, disclosure expectations, asset rights, and contact-through-Mike gate. Do not manufacture a testimonial brief.

- [ ] **Step 4: Build an empty-results-safe retro**

Define expected fields, reporting windows, privacy thresholds, qualitative coding, and next-action rule. Leave result fields explicitly `not_run`; do not use numeric zero for an unexecuted campaign.

- [ ] **Step 5: Validate traceability**

Run:

```bash
rg -n "Experiment ID:|Claim ID:|Channel:|CTA:|not_run|External action" marketing/discovery/proof-factory/distribution-pack.md marketing/discovery/proof-factory/creator-kit.md marketing/discovery/proof-factory/results-retro.md
```

Expected: each derivative and retro preserves the experiment/claim boundary.

- [ ] **Step 6: Commit the distribution package**

```bash
git add marketing/discovery/proof-factory/distribution-pack.md marketing/discovery/proof-factory/creator-kit.md marketing/discovery/proof-factory/results-retro.md
git commit -m "docs: build proof distribution package"
```

### Task 5: Review, Gate, And Prepare The Creative Decision

**Files:**
- Create: `marketing/discovery/proof-factory/edit-review.md`
- Create: `marketing/discovery/proof-factory/decision-summary.md`
- Modify: `marketing/discovery/proof-factory/acceptance-checklist.md`
- Modify: `marketing/discovery/proof-factory/blockers.md`

**Interfaces:**
- Consumes: Tasks 1-4 and, after approval, inspected media candidates.
- Produces: structural completion state and a separate release decision packet.

- [ ] **Step 1: Score the package**

Review product truth, story clarity, proof strength, originality, visual continuity, channel fit, accessibility, privacy, rights, attribution, and learning design. Record every hard-fail item.

- [ ] **Step 2: Mark structural state**

Set `structural_ready: yes` only when all required planning artifacts and traceability checks pass. This state does not imply media exists.

- [ ] **Step 3: Mark release state**

Set `release_ready: no` until real exports exist, exact frames/cuts are directly inspected, privacy/rights/originality checks pass, platform specifications pass, and Mike records publishing approval.

- [ ] **Step 4: Prepare one creative decision**

The decision summary gives the selected kernel, expected learning, production cost range from current provider evidence, open hard-fails, and `approve production | revise | defer`.

- [ ] **Step 5: Run final scans**

Run:

```bash
test -f marketing/discovery/proof-factory/creator-kit.md
test -f marketing/discovery/proof-factory/results-retro.md
rg -n "structural_ready:|release_ready:|External actions not taken" marketing/discovery/proof-factory/edit-review.md marketing/discovery/proof-factory/decision-summary.md
rg -n -i "authorization: bearer [a-z0-9._-]{12,}|api[_ -]?key|access[_ -]?token" marketing/discovery/proof-factory
```

Expected: complete package, explicit non-release state, and no credentials.

- [ ] **Step 6: Commit the reviewed package**

```bash
git add marketing/discovery/proof-factory
git commit -m "docs: complete Throughline proof factory plan"
```
