# Existing Demand Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare an evidence-led portfolio for ASO, App Store product pages, Apple Ads, owned search, and source attribution that captures existing voice-to-agent demand without submitting metadata or spending.

**Architecture:** A shared intent map drives every surface. Luna gathers observed listing/query evidence and maintains attribution; Terra selects metadata, creative, SEO, and paid-search hypotheses. Each experiment changes one material variable, uses a named control and campaign destination, and stops at Mike's account/spend/submission gate.

**Tech Stack:** App Store public pages, App Store Connect Analytics/campaign links, Product Page Optimization, Custom Product Pages, Apple Ads planning, static-site SEO, CSV experiment portfolio.

**Spec:** `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`

## Global Constraints

- Establish the current discovery/conversion baseline before proposing a lift target.
- Do not invent keyword volume, rank, competitor conversion, bids, cost, installs, or product-page results.
- Data below Apple's privacy thresholds is unavailable, not zero.
- Download-to-auth is a same-window aggregate proxy, not a matched-user conversion rate.
- Each test changes one material variable and records its control.
- Do not submit metadata or product pages, start Product Page Optimization, publish SEO pages, activate Apple Ads, or spend.
- Mike approves App Store changes, product-page submissions/tests, SEO publication, and Apple Ads budget/activation.

## File Map

- Create `marketing/discovery/demand-capture/baseline.md`: current listing/acquisition evidence and gaps.
- Create `marketing/discovery/demand-capture/intent-map.md`: observed query-to-audience/proof map.
- Create `marketing/discovery/demand-capture/aso-recommendation.md`: selected metadata direction and constraints.
- Create `marketing/discovery/demand-capture/product-page-portfolio.md`: default, PPO, and custom-page concepts.
- Create `marketing/discovery/demand-capture/apple-ads-plan.md`: capped unactivated campaign design.
- Create `marketing/discovery/demand-capture/seo-portfolio.md`: compact distinct owned-search pages.
- Create `marketing/discovery/demand-capture/attribution-map.md`: source/campaign/page measurement contract.
- Create `marketing/discovery/demand-capture/experiment-portfolio.csv`: one row per test.
- Create `marketing/discovery/demand-capture/evidence-manifest.md`: dated source ledger.
- Create `marketing/discovery/demand-capture/decision-summary.md`: selected first experiment and Mike gates.
- Create `marketing/discovery/demand-capture/acceptance-checklist.md`: evidence and authority checks.
- Create `marketing/discovery/demand-capture/blockers.md`: unavailable account data, proof, or approvals.

---

### Task 1: Establish The Current Demand Baseline

**Files:**
- Create: `marketing/discovery/demand-capture/baseline.md`
- Create: `marketing/discovery/demand-capture/evidence-manifest.md`
- Create: `marketing/discovery/demand-capture/acceptance-checklist.md`
- Create: `marketing/discovery/demand-capture/blockers.md`

**Interfaces:**
- Consumes: current public App Store listing, existing ASO/screenshot plans, canonical product metrics, current official Apple guidance.
- Produces: baseline and evidence labels consumed by Tasks 2-6.

- [ ] **Step 1: Write acceptance checks before analysis**

Cover listing freshness, source/date, acquisition metrics, privacy thresholds, query evidence, competitor evidence, control definitions, one-variable discipline, attribution links, downstream proxy, stop conditions, and external-action gates.

- [ ] **Step 2: Record the public listing exactly**

Capture checked date, app name, subtitle, category, visible promotional text/description, screenshots/previews, price, version, rating availability, localization, and public URL. Distinguish public evidence from App Store Connect-only data.

- [ ] **Step 3: Record available acquisition data**

Use App Store Connect as the source of truth when account access is available. Record impressions, product-page views, first-time downloads, conversion, source type, campaign/product-page coverage, and date window only as aggregates. Mark threshold-suppressed fields unavailable.

- [ ] **Step 4: Record current experiments and links**

Reconcile existing screenshot PPO, ASO traffic plan, campaign links, and experiment ledger. Preserve existing IDs; identify duplicates or links without a destination hypothesis.

- [ ] **Step 5: Verify evidence labels**

Run:

```bash
rg -n "Verified current|Repository assertion|Unavailable|Privacy threshold|First-time downloads|Aggregate proxy|External actions not taken" marketing/discovery/demand-capture/baseline.md
```

Expected: current, unavailable, and proxy states are visibly distinct.

- [ ] **Step 6: Commit the baseline**

```bash
git add marketing/discovery/demand-capture/baseline.md marketing/discovery/demand-capture/evidence-manifest.md marketing/discovery/demand-capture/acceptance-checklist.md marketing/discovery/demand-capture/blockers.md
git commit -m "docs: baseline Throughline demand capture"
```

### Task 2: Build The Observed Intent Map And ASO Recommendation

**Files:**
- Create: `marketing/discovery/demand-capture/intent-map.md`
- Create: `marketing/discovery/demand-capture/aso-recommendation.md`

**Interfaces:**
- Consumes: Task 1, public search/listing evidence, product truth and claims.
- Produces: ranked intent families and one selected metadata direction.

- [ ] **Step 1: Collect observed language**

Gather current App Store autocomplete/results, web query suggestions where legitimately available, competitor listing language, reviews/support themes at aggregate level, and community phrasing. Record source, checked date, observation method, and storefront/locale.

- [ ] **Step 2: Cluster by user job**

Start with voice notes for agents, MCP notes/memory, voice to to-do, capture while moving, and durable non-meeting transcripts. Merge only when audience, proof, and destination are genuinely the same.

- [ ] **Step 3: Score without fabricated volume**

Score `product relevance`, `proof strength`, `observed recurrence`, `competition signal`, and `conversion continuity` from 0-3 with source-backed notes. Label traffic potential `unknown` when no account/source evidence exists.

- [ ] **Step 4: Select one ASO direction**

Recommend exact name/subtitle/keyword-field/description changes only within current Apple limits verified at execution. Map every proposed term to intent evidence and product proof. Treat metadata submission as blocked on Mike.

- [ ] **Step 5: Reject thin or misleading terms**

Exclude meeting recorder, team transcription, unshipped write actions, unsupported native integrations, broad generic AI productivity, and agent-name variants that do not change intent.

- [ ] **Step 6: Verify the recommendation**

Run:

```bash
rg -n "Source:|Checked:|Product relevance:|Proof strength:|Traffic potential:|Selected direction:|Mike approval" marketing/discovery/demand-capture/intent-map.md marketing/discovery/demand-capture/aso-recommendation.md
```

Expected: evidence and selected direction are complete.

- [ ] **Step 7: Commit the intent/ASO package**

```bash
git add marketing/discovery/demand-capture/intent-map.md marketing/discovery/demand-capture/aso-recommendation.md
git commit -m "docs: map Throughline search intent"
```

### Task 3: Design App Store Product Page Experiments

**Files:**
- Create: `marketing/discovery/demand-capture/product-page-portfolio.md`

**Interfaces:**
- Consumes: Tasks 1-2 and accepted proof-factory story/assets.
- Produces: one default-page recommendation, one PPO test, and at most three custom-page concepts.

- [ ] **Step 1: Recheck current Apple capabilities**

Record current Product Page Optimization treatment limits, custom product page limits/fields/search visibility, review requirements, supported metrics, privacy thresholds, and deep-link behavior from official Apple sources.

- [ ] **Step 2: Define the default-page job**

Select one broad qualified audience, one promise, one screenshot sequence, one preview role, and one conversion action. Preserve literal product truth and avoid MCP-first jargon in the opening frame.

- [ ] **Step 3: Define one PPO test**

Keep the current product page as control. Change one material creative hypothesis: `structured to-dos first` versus `agent-readable voice memory first`, using the same icon, locale, caption style, and remaining screenshot order where Apple permits.

- [ ] **Step 4: Define up to three custom pages**

Use distinct audiences only: agent/MCP builders, voice-to-to-do users, and durable voice-memory/PKM users when intent evidence supports all three. Each page gets a unique promise, proof sequence, promotional text, keyword visibility choice, campaign destination, and downstream proxy.

- [ ] **Step 5: Define decision rules**

Do not call a winner before Apple reports sufficient data. Record the control, primary metric, confidence/data availability, product-quality guardrail, apply/stop rule, and minimum reporting caveat.

- [ ] **Step 6: Verify one-variable discipline**

Run:

```bash
rg -n "Control:|Material variable:|Primary metric:|Data caveat:|Stop rule:|Mike approval:" marketing/discovery/demand-capture/product-page-portfolio.md
```

Expected: every proposed experiment has all six fields.

- [ ] **Step 7: Commit the product-page portfolio**

```bash
git add marketing/discovery/demand-capture/product-page-portfolio.md
git commit -m "docs: design App Store product page tests"
```

### Task 4: Design The Compact Owned-Search Portfolio

**Files:**
- Create: `marketing/discovery/demand-capture/seo-portfolio.md`

**Interfaces:**
- Consumes: Task 2 intent map, Task 3 proof/page architecture, owned-surface plan.
- Produces: distinct evidence-backed page briefs for the Owned Surface Lead.

- [ ] **Step 1: Select only distinct search jobs**

Choose the smallest set whose audience question, proof, and answer differ. Use the main product page for category intent and add workflow/technical pages only when they provide original product proof.

- [ ] **Step 2: Write complete page briefs**

For each page record path, primary intent, audience question, direct answer, unique proof, title, description, H1, outline, FAQ claims, internal links, App Store campaign label, update trigger, and anti-cannibalization note.

- [ ] **Step 3: Define high-value initial candidates**

Evaluate `/voice-notes-for-ai-agents`, `/mcp-voice-notes`, and `/voice-to-task-list` against observed evidence. Select only the strongest first page and explain why the others wait.

- [ ] **Step 4: Prevent scaled thin content**

Ban agent-name page permutations unless each has a materially different setup/proof workflow. Ban competitor-comparison claims without current evidence and legal/taste review.

- [ ] **Step 5: Verify distinctness**

Run:

```bash
rg -n "Path:|Primary intent:|Unique proof:|Campaign label:|Anti-cannibalization:|Selected first page:" marketing/discovery/demand-capture/seo-portfolio.md
```

Expected: every brief is complete and one first page is selected.

- [ ] **Step 6: Commit the owned-search portfolio**

```bash
git add marketing/discovery/demand-capture/seo-portfolio.md
git commit -m "docs: design Throughline search portfolio"
```

### Task 5: Design Capped Apple Ads And Attribution

**Files:**
- Create: `marketing/discovery/demand-capture/apple-ads-plan.md`
- Create: `marketing/discovery/demand-capture/attribution-map.md`
- Create: `marketing/discovery/demand-capture/experiment-portfolio.csv`

**Interfaces:**
- Consumes: Tasks 1-4, existing campaign links, official Apple Ads/campaign guidance.
- Produces: unactivated paid-search packet and attribution contract for all five discovery streams.

- [ ] **Step 1: Recheck current Apple Ads controls**

Record official current campaign/ad-group structure, match types, Search Match behavior, negative keywords, custom product page destination support, budget controls, reporting, and account-estimate availability.

- [ ] **Step 2: Design the smallest paid test**

Create separate exact-intent and discovery ad groups. Use the strongest verified terms, explicit negatives for meeting/team/transcription-only intent, the most relevant product page, a proposed total cap, a daily cap, and a seven-day or data-readiness review point. Keep all bid/cost numbers labeled as account-estimate inputs until current data exists.

- [ ] **Step 3: Define quality and stop rules**

Use first-time download as the acquisition outcome, product-page conversion as the platform diagnostic, and aggregate auth/first-value as downstream quality proxies. Stop for irrelevant search terms, cap exhaustion, missing attribution, product failure, or weak evidence after the declared review floor.

- [ ] **Step 4: Build the attribution map**

Map website, directory, X, Reddit, creator, SEO, product page, and Apple Ads sources to experiment ID, destination, campaign label/token reference, reporting window, platform metric, downstream proxy, privacy threshold, and owner. Store token labels, not private account credentials.

- [ ] **Step 5: Build the experiment CSV**

Use columns `experiment_id,workstream,audience,source,destination,control,material_variable,primary_metric,guardrail,reporting_window,data_caveat,stop_rule,approval,status`. Set every unexecuted row to `planned`.

- [ ] **Step 6: Validate the CSV and no-spend state**

Run:

```bash
node -e "const fs=require('fs');const p='marketing/discovery/demand-capture/experiment-portfolio.csv';const rows=fs.readFileSync(p,'utf8').trim().split(/\r?\n/);const n=rows[0].split(',').length;for(const [i,r] of rows.entries())if(r.split(',').length!==n)throw new Error('column mismatch row '+(i+1));console.log(rows.length-1)"
rg -n "Activation: not_performed|Spend: 0|Mike approval|Stop rule" marketing/discovery/demand-capture/apple-ads-plan.md
```

Expected: consistent CSV and explicit no-activation state.

- [ ] **Step 7: Commit paid/attribution preparation**

```bash
git add marketing/discovery/demand-capture/apple-ads-plan.md marketing/discovery/demand-capture/attribution-map.md marketing/discovery/demand-capture/experiment-portfolio.csv
git commit -m "docs: prepare demand attribution and Apple Ads plan"
```

### Task 6: Integrate The First Demand Decision

**Files:**
- Create: `marketing/discovery/demand-capture/decision-summary.md`
- Modify: `marketing/discovery/demand-capture/acceptance-checklist.md`
- Modify: `marketing/discovery/demand-capture/blockers.md`

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: one recommended first no-spend experiment plus separately gated App Store/paid options.

- [ ] **Step 1: Rank by evidence and reversibility**

Compare ASO metadata, PPO, custom pages, first SEO page, and Apple Ads using observed demand, proof strength, expected learning, implementation cost, reversibility, data threshold, and approval burden. Do not invent reach.

- [ ] **Step 2: Select one first experiment**

Choose the smallest test that can produce useful evidence from the current baseline. State why it precedes the stronger alternative.

- [ ] **Step 3: Build separate Mike gates**

Create explicit `approve | revise | defer` decisions for App Store metadata/page submission, owned-page publication, and Apple Ads budget/activation. Do not combine approval for one with the others.

- [ ] **Step 4: Record external actions not taken**

List App Store changes, PPO/CPP activation, website publication, Apple Ads activation, and spend as not performed.

- [ ] **Step 5: Run final acceptance checks**

Run:

```bash
test -f marketing/discovery/demand-capture/intent-map.md
test -f marketing/discovery/demand-capture/product-page-portfolio.md
test -f marketing/discovery/demand-capture/seo-portfolio.md
test -f marketing/discovery/demand-capture/apple-ads-plan.md
test -f marketing/discovery/demand-capture/attribution-map.md
rg -n "Selected first experiment:|External actions not taken|approve \| revise \| defer" marketing/discovery/demand-capture/decision-summary.md
```

Expected: all portfolios exist and the decision packet has separate gates.

- [ ] **Step 6: Commit the complete demand packet**

```bash
git add marketing/discovery/demand-capture
git commit -m "docs: complete Throughline demand capture plan"
```
