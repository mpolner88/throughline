# Owned Discovery Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and deploy the selected fast, indexable owned product surface that proves the full voice-to-agent loop and sends qualified visitors to an attributable App Store page.

**Architecture:** Research, copy, proof, SEO, and QA are frozen in `marketing/discovery/owned-surface/` before the static site changes. The approved implementation preserves the existing low-complexity `docs/` hosting pattern, adds real current-build media under a dedicated asset directory, and uses named App Store campaign links.

**Tech Stack:** Static HTML/CSS, current-build MP4/WebP media, campaign links, semantic HTML, JSON-LD, local HTTP server, browser screenshots.

**Spec:** `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`

## Global Constraints

- Mike selected the owned static discovery build and deployment on 2026-08-27. The owned-surface worker may modify its explicitly assigned site files; the root coordinator deploys only after the declared QA passes.
- Public copy must use verified claims and cannot state “fastest” as fact without approved comparative evidence.
- Real UI proof uses the current public build and synthetic data; generated media cannot impersonate app behavior.
- The page must describe MCP as owner-scoped and read-only and avoid unverified native-integration claims.
- App Store actions use named campaign links and respect Apple's reporting thresholds.
- Mobile and desktop layouts must have no overlap, clipped text, or decorative card nesting.

## File Map

- Create `marketing/discovery/owned-surface/baseline.md`: current site and funnel baseline.
- Create `marketing/discovery/owned-surface/information-architecture.md`: selected page hierarchy and interaction contract.
- Create `marketing/discovery/owned-surface/copy-deck.md`: claim-annotated final copy.
- Create `marketing/discovery/owned-surface/proof-storyboard.md`: exact current-build capture plan.
- Create `marketing/discovery/owned-surface/seo-map.csv`: intent-to-page and metadata map.
- Create `marketing/discovery/owned-surface/build-brief.md`: approved implementation contract.
- Create `marketing/discovery/owned-surface/evidence-manifest.md`: dated source ledger.
- Create `marketing/discovery/owned-surface/decision-summary.md`: selected design and Mike gate.
- Create `marketing/discovery/owned-surface/acceptance-checklist.md`: research/build/release checks.
- Create `marketing/discovery/owned-surface/blockers.md`: missing proof, decisions, or external state.
- Modify after approval `docs/index.html`: public product surface.
- Create after approval `docs/assets/discovery/throughline-proof-poster.png`: first-frame proof image.
- Create after approval `docs/assets/discovery/record.png`: recording proof.
- Create after approval `docs/assets/discovery/structure.png`: structured note/to-do proof.
- Create after approval `docs/assets/discovery/agent-read.png`: agent retrieval proof.
- Keep `docs/assets/discovery/throughline-proof.mp4` blocked until inspected source capture exists.

---

### Task 1: Establish The Owned-Surface Baseline

**Files:**
- Create: `marketing/discovery/owned-surface/baseline.md`
- Create: `marketing/discovery/owned-surface/evidence-manifest.md`
- Create: `marketing/discovery/owned-surface/acceptance-checklist.md`
- Create: `marketing/discovery/owned-surface/blockers.md`

**Interfaces:**
- Consumes: current `docs/index.html`, product/marketing canon, accepted proof and demand artifacts.
- Produces: dated baseline and build gates for Tasks 2-5.

- [ ] **Step 1: Write acceptance checks first**

Define exact checks for first-viewport comprehension, proof completeness, claim status, synthetic data, App Store attribution, metadata, accessibility, responsive layout, performance, support/privacy links, and deployment approval.

- [ ] **Step 2: Record the current page structure**

Run:

```bash
rg -n "<title>|description|<h1>|<video|apps.apple.com|Privacy|Support" docs/index.html
```

Expected: current title/support copy exists; product proof, App Store action, and video are absent.

- [ ] **Step 3: Record available proof and attribution inputs**

List accepted proof-factory artifacts, current App Store campaign links, product screenshots, connection documentation, and all missing current-build capture.

- [ ] **Step 4: Establish measurement labels**

Define page session, proof play/completion if instrumented, App Store click, first-time download, aggregate download-to-auth proxy, and downstream first value. Mark unavailable instrumentation as a coverage gap.

- [ ] **Step 5: Verify no existing site change**

Run:

```bash
git diff -- docs/index.html docs/assets
```

Expected: no diff created by this task.

- [ ] **Step 6: Commit the baseline**

```bash
git add marketing/discovery/owned-surface/baseline.md marketing/discovery/owned-surface/evidence-manifest.md marketing/discovery/owned-surface/acceptance-checklist.md marketing/discovery/owned-surface/blockers.md
git commit -m "docs: baseline owned discovery surface"
```

### Task 2: Lock Information Architecture And Conversion Copy

**Files:**
- Create: `marketing/discovery/owned-surface/information-architecture.md`
- Create: `marketing/discovery/owned-surface/copy-deck.md`

**Interfaces:**
- Consumes: Task 1, proof-factory decision summary, demand intent map, claims/message files.
- Produces: selected page contract used by proof, SEO, and implementation tasks.

- [ ] **Step 1: Select one first-viewport contract**

Specify literal brand/category heading, outcome support line, current-build proof media, one App Store action, and visible hint of the next mechanics section at `390x844` and `1440x900`.

- [ ] **Step 2: Define the full page sequence**

Use this order: outcome and proof; record/structure/agent mechanics; concrete workflows; read-only trust; connection/support; final App Store action. Do not use floating page-section cards.

- [ ] **Step 3: Write one selected copy deck**

Write exact title, description, H1, support line, CTA, proof captions, mechanics headings/body, compatibility wording, trust copy, and footer labels. Annotate material lines with claim status and source.

- [ ] **Step 4: Test the copy against prohibited claims**

Run:

```bash
rg -n -i "fastest|best|only|seamless|native integration|write to|automate your life|meeting recorder" marketing/discovery/owned-surface/copy-deck.md
```

Expected: prohibited wording is absent or appears only in a clearly labeled rejected/hypothesis note.

- [ ] **Step 5: Review the IA/copy interface**

Confirm every section in `information-architecture.md` has exact copy and every material copy claim has one planned visual proof or source.

- [ ] **Step 6: Commit the selected narrative**

```bash
git add marketing/discovery/owned-surface/information-architecture.md marketing/discovery/owned-surface/copy-deck.md
git commit -m "docs: define owned discovery narrative"
```

### Task 3: Lock Proof, Search, And Attribution

**Files:**
- Create: `marketing/discovery/owned-surface/proof-storyboard.md`
- Create: `marketing/discovery/owned-surface/seo-map.csv`
- Create: `marketing/discovery/owned-surface/build-brief.md`

**Interfaces:**
- Consumes: Tasks 1-2, accepted proof kernel, demand attribution map.
- Produces: exact media and metadata contract for the approved implementation.

- [ ] **Step 1: Storyboard the proof loop**

Define each shot's current-build version, synthetic input, UI state, duration, crop, caption, redactions, transition, source claim, and acceptance check. Show record, structured result, and agent read.

- [ ] **Step 2: Map search intent to a compact page set**

Create CSV columns `page_id,path,primary_intent,audience,proof,title,description,canonical,cta,campaign_label,status`. Keep one main page plus only distinct, evidence-supported future pages.

- [ ] **Step 3: Define attribution behavior**

Select the named App Store campaign-link label for the main CTA and define how future proof/creator pages receive separate labels. Do not expose private provider configuration.

- [ ] **Step 4: Write the build brief**

Specify exact HTML sections, asset filenames, aspect ratios, alt text, video fallback, reduced-motion behavior, semantic landmarks, JSON-LD type, Open Graph fields, canonical URL, icon buttons/tooltips where applicable, and no-JavaScript fallback.

- [ ] **Step 5: Validate cross-artifact names**

Run:

```bash
rg -n "throughline-proof|record.png|structure.png|agent-read.png|campaign|canonical|application/ld\+json" marketing/discovery/owned-surface
```

Expected: the build brief, storyboard, and SEO map use the same names.

- [ ] **Step 6: Commit the implementation contract**

```bash
git add marketing/discovery/owned-surface/proof-storyboard.md marketing/discovery/owned-surface/seo-map.csv marketing/discovery/owned-surface/build-brief.md
git commit -m "docs: lock owned surface proof and attribution"
```

### Task 4: Record Mike's Design Decision

**Files:**
- Create: `marketing/discovery/owned-surface/decision-summary.md`
- Modify: `marketing/discovery/owned-surface/acceptance-checklist.md`
- Modify: `marketing/discovery/owned-surface/blockers.md`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: recorded `approve`, `revise`, or `defer` gate for Task 5.

- [ ] **Step 1: Prepare one selected design packet**

Include the selected narrative, desktop/mobile composition, proof frames, asset needs, claim boundaries, campaign link, and implementation cost. Include at most two rejected alternatives with reasons.

- [ ] **Step 2: Record unresolved dependencies**

Name missing current-build capture, App Store campaign link, visual choice, or hosting evidence. Do not substitute generated UI.

- [ ] **Step 3: Request one bounded decision**

Ask Mike to `approve`, `revise`, or `defer` the exact design/build brief. Record the dated response in the decision summary before Task 5.

- [ ] **Step 4: Verify the gate**

Run:

```bash
rg -n "Decision: (approve|revise|defer)|Decision date:|Approved scope:" marketing/discovery/owned-surface/decision-summary.md
```

Expected before Task 5: `Decision: approve` with date and exact scope.

- [ ] **Step 5: Commit the decision packet**

```bash
git add marketing/discovery/owned-surface/decision-summary.md marketing/discovery/owned-surface/acceptance-checklist.md marketing/discovery/owned-surface/blockers.md
git commit -m "docs: record owned surface decision packet"
```

### Task 5: Implement And Verify The Approved Static Site

**Gate:** Execute after Task 4 records `Decision: approve` for the exact files below. Mike's 2026-08-27 “Ship it” authorizes root-coordinator deployment after QA.

**Files:**
- Modify: `docs/index.html`
- Create: `docs/assets/discovery/throughline-proof-poster.png`
- Create: `docs/assets/discovery/record.png`
- Create: `docs/assets/discovery/structure.png`
- Create: `docs/assets/discovery/agent-read.png`
- Defer: `docs/assets/discovery/throughline-proof.mp4` until inspected source capture exists.
- Modify: `marketing/discovery/owned-surface/acceptance-checklist.md`

**Interfaces:**
- Consumes: approved Task 3 build brief and current-build captured media.
- Produces: locally verified static site; later hosting work consumes the exact committed files.

- [ ] **Step 1: Verify media before implementation**

Inspect every image and sampled video frame. Confirm current build, synthetic content, no notifications, no token, no identifier, correct captions, commercial rights, and exact dimensions.

- [ ] **Step 2: Implement semantic page structure**

Build the approved sections in `docs/index.html` using restrained responsive CSS, real proof media, accessible controls, stable dimensions, reduced-motion support, and direct privacy/support/connection/App Store links.

- [ ] **Step 3: Add indexing and share metadata**

Add exact title/description, canonical, Open Graph/Twitter media, robots directive, and `SoftwareApplication` JSON-LD using only verified public facts.

- [ ] **Step 4: Start the local site**

Run:

```bash
python3 -m http.server 4173 --directory docs
```

Expected: `http://127.0.0.1:4173/` serves the product page and support/privacy routes.

- [ ] **Step 5: Verify responsive and functional behavior**

Capture and inspect `390x844`, `768x1024`, `1440x900`, and `1728x1117`. Check first-viewport composition, next-section hint, media fallback, reduced motion, keyboard focus, alt text, contrast, all links, campaign URL, and no clipped/overlapping text.

- [ ] **Step 6: Verify source requirements**

Run:

```bash
rg -n "<h1|<video|poster=|prefers-reduced-motion|application/ld\+json|canonical|apps.apple.com|privacy/|support/|agent-connect" docs/index.html
```

Expected: every required element appears once in the appropriate section.

- [ ] **Step 7: Record QA evidence and hand the rollback-ready deploy packet to the root coordinator**

Update the acceptance checklist with screenshot paths, checked browsers/viewports, link result, media inspection, and `Deployment: ready for root coordinator`.

- [ ] **Step 8: Commit the locally verified site**

```bash
git add docs/index.html docs/assets/discovery marketing/discovery/owned-surface/acceptance-checklist.md
git commit -m "feat: build Throughline discovery surface"
```
