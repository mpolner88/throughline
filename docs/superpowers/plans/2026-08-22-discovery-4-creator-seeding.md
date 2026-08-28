# Creator And Community Seeding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a maximum 12-person first-review creator cohort and a contribution-first community pilot with individualized, disclosure-ready outreach that Mike can approve one item at a time.

**Architecture:** Public research feeds a frozen fit rubric; Luna gathers and scores evidence, while Terra owns disqualifiers, outreach judgment, community fit, and the final pilot. Private contact data and correspondence live outside git, and no send or post occurs inside this plan.

**Tech Stack:** Public-source research, Markdown, CSV, campaign links, aggregate stage tracking, experiment ledger.

**Spec:** `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`

## Global Constraints

- The first Mike review contains no more than 12 prospects.
- Every prospect has dated public relevance evidence and conflict/disclosure checks.
- Do not scrape, bulk-message, automate DMs/replies, or manufacture personal affinity.
- Do not commit private contact details, private messages, emails, credentials, or raw product-user identifiers.
- A useful trial is offered without requiring positive coverage.
- Mike approves every send, post, compensation term, gifting decision, and content-rights arrangement.

## File Map

- Create `marketing/discovery/creator-seeding/pilot-brief.md`: audience mix, offer, scope, and stop rules.
- Create `marketing/discovery/creator-seeding/fit-rubric.md`: scoring dimensions and disqualifiers.
- Create `marketing/discovery/creator-seeding/prospect-review.csv`: maximum 12 public review rows.
- Create `marketing/discovery/creator-seeding/community-map.md`: current rules and contribution opportunities.
- Create `marketing/discovery/creator-seeding/outreach-drafts.md`: individualized approval drafts.
- Create `marketing/discovery/creator-seeding/creator-brief.md`: honest proof/trial kit.
- Create `marketing/discovery/creator-seeding/tracking-schema.md`: privacy-safe relationship stages.
- Create `marketing/discovery/creator-seeding/feedback-taxonomy.md`: coded learning without message text.
- Create `marketing/discovery/creator-seeding/evidence-manifest.md`: dated public/source ledger.
- Create `marketing/discovery/creator-seeding/decision-summary.md`: selected cohort and Mike gate.
- Create `marketing/discovery/creator-seeding/acceptance-checklist.md`: pilot gates.
- Create `marketing/discovery/creator-seeding/blockers.md`: unavailable proof, rule, terms, or links.

---

### Task 1: Freeze The Pilot And Fit Rubric

**Files:**
- Create: `marketing/discovery/creator-seeding/pilot-brief.md`
- Create: `marketing/discovery/creator-seeding/fit-rubric.md`
- Create: `marketing/discovery/creator-seeding/acceptance-checklist.md`

**Interfaces:**
- Consumes: accepted proof kit, owned destination, attribution map, product positioning.
- Produces: selection contract used by research and scoring.

- [ ] **Step 1: Define the pilot objective and boundary**

Select the purpose as learning and qualified discovery, not guaranteed coverage. Record the maximum 12-person review cohort, no-send boundary, one primary metric, downstream proxy, feedback goal, and stop conditions.

- [ ] **Step 2: Define audience categories**

Use agent builders, MCP educators, voice-workflow practitioners, and PKM creators as search lenses. Do not enforce equal quotas when evidence is weak.

- [ ] **Step 3: Freeze the scoring rubric**

Score `topic recency`, `audience overlap`, `workflow authenticity`, `proof compatibility`, `trust`, and `outreach risk` from 0-3 with explicit anchors. Weight proof compatibility and trust twice. Do not score private demographics.

- [ ] **Step 4: Define disqualifiers**

Exclude conflicts, paid-placement-only channels without disclosed terms, mass-giveaway behavior, unrelated audiences, repeated undisclosed promotion, unavailable public evidence, and outreach routes that violate platform rules.

- [ ] **Step 5: Verify the rubric**

Run:

```bash
rg -n "0 =|1 =|2 =|3 =|Disqualifier|maximum 12|Mike|No send" marketing/discovery/creator-seeding/fit-rubric.md marketing/discovery/creator-seeding/pilot-brief.md
```

Expected: complete anchors and authority boundary exist.

- [ ] **Step 6: Commit the pilot contract**

```bash
git add marketing/discovery/creator-seeding/pilot-brief.md marketing/discovery/creator-seeding/fit-rubric.md marketing/discovery/creator-seeding/acceptance-checklist.md
git commit -m "docs: define creator seeding pilot"
```

### Task 2: Build And Select The Public Evidence Cohort

**Files:**
- Create: `marketing/discovery/creator-seeding/evidence-manifest.md`
- Create: `marketing/discovery/creator-seeding/prospect-review.csv`
- Create: `marketing/discovery/creator-seeding/blockers.md`

**Interfaces:**
- Consumes: Task 1 rubric and current public creator content.
- Produces: maximum 12 approved-review candidates for individualized drafting.

- [ ] **Step 1: Gather a broad public evidence pool**

For each candidate capture public display label, category, source URL, source date, recent relevant topic, audience/workflow evidence, proof fit, disclosed commercial conflict, and allowed contact route type. Store no email or private message.

- [ ] **Step 2: Apply disqualifiers before scoring**

Record the disqualifier code and omit disqualified candidates from the final review CSV. Preserve only aggregate exclusion counts in tracked artifacts.

- [ ] **Step 3: Score with the frozen rubric**

Create CSV columns `review_id,public_label,category,source_url,source_date,topic_score,audience_score,workflow_score,proof_score,trust_score,risk_score,weighted_total,recommended_proof,confidence,status`. `review_id` is a local sequence such as `CR-01`, not a platform identifier.

- [ ] **Step 4: Select no more than 12**

Choose the strongest evidence-backed set, preserve category diversity where scores support it, and explain every lower-confidence inclusion.

- [ ] **Step 5: Validate row count and private-data boundary**

Run:

```bash
node -e "const fs=require('fs');const rows=fs.readFileSync('marketing/discovery/creator-seeding/prospect-review.csv','utf8').trim().split(/\r?\n/);if(rows.length-1>12)throw new Error('more than 12 prospects');console.log(rows.length-1)"
rg -n -i "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|private message|DM text|phone" marketing/discovery/creator-seeding
```

Expected: 12 or fewer rows and no private contact data.

- [ ] **Step 6: Commit the review cohort**

```bash
git add marketing/discovery/creator-seeding/evidence-manifest.md marketing/discovery/creator-seeding/prospect-review.csv marketing/discovery/creator-seeding/blockers.md
git commit -m "docs: select creator review cohort"
```

### Task 3: Map Communities And Contribution Opportunities

**Files:**
- Create: `marketing/discovery/creator-seeding/community-map.md`

**Interfaces:**
- Consumes: pilot categories, current community/sitewide rules, accepted proof kit.
- Produces: contribution-first concepts for Mike review.

- [ ] **Step 1: Select only high-fit communities**

Use relevance to agents, MCP, voice workflows, PKM, indie building, or structured dictation. Exclude communities whose rules prohibit the planned participation or whose audience is mainly meeting transcription/team sales.

- [ ] **Step 2: Record current rule evidence**

For each community record checked date, rule URL, self-promotion rule, link rule, account/participation prerequisite, commercial disclosure, moderator contact path, and observed accepted post structure.

- [ ] **Step 3: Draft one contribution-first angle per community**

Each concept must remain useful with the Throughline name and link removed. Prefer workflow explanation, technical implementation lesson, honest build note, or specific question.

- [ ] **Step 4: Assign risk and next action**

Use `ready_for_mike_review`, `participate_before_posting`, `ask_moderator`, or `do_not_post`. Never treat missing rules as permission.

- [ ] **Step 5: Verify current evidence**

Run:

```bash
rg -n "Checked:|Rules:|Useful without link:|Status:" marketing/discovery/creator-seeding/community-map.md
```

Expected: every mapped community has all four fields.

- [ ] **Step 6: Commit the community map**

```bash
git add marketing/discovery/creator-seeding/community-map.md
git commit -m "docs: map creator communities"
```

### Task 4: Create Individualized Outreach And Honest Briefing

**Files:**
- Create: `marketing/discovery/creator-seeding/outreach-drafts.md`
- Create: `marketing/discovery/creator-seeding/creator-brief.md`

**Interfaces:**
- Consumes: selected Task 2 cohort, Task 3 community evidence, accepted proof kit and links.
- Produces: item-by-item Mike approval queue; nothing is sent.

- [ ] **Step 1: Write the creator brief**

Include literal product loop, audience/not-for boundaries, current read-only MCP setup, synthetic trial workflow, proof assets, known limitations, free/paid truth, disclosure expectations, rights options, and direct-feedback route through Mike.

- [ ] **Step 2: Draft one message per selected prospect**

Each draft names one dated public relevance signal, why the proof matches, a low-friction ask, exact asset/link, no-positive-coverage condition, disclosure/compensation state, and a single follow-up limit.

- [ ] **Step 3: Remove fabricated familiarity**

Reject wording such as “long-time follower,” “love your work,” or “perfect for your audience” unless the evidence manifest supports the exact statement.

- [ ] **Step 4: Attach approval fields**

Every draft has `Review ID`, `Evidence source`, `Offer`, `Compensation`, `Rights`, `Disclosure`, `Campaign label`, `Mike decision`, and `Send status: not_sent`.

- [ ] **Step 5: Validate individualized evidence**

Run:

```bash
rg -n "Review ID:|Evidence source:|Offer:|Compensation:|Rights:|Disclosure:|Campaign label:|Mike decision:|Send status: not_sent" marketing/discovery/creator-seeding/outreach-drafts.md
```

Expected: every draft carries the complete approval contract.

- [ ] **Step 6: Commit the approval drafts**

```bash
git add marketing/discovery/creator-seeding/outreach-drafts.md marketing/discovery/creator-seeding/creator-brief.md
git commit -m "docs: prepare creator outreach approvals"
```

### Task 5: Build The Privacy-Safe Learning Loop And Decision Packet

**Files:**
- Create: `marketing/discovery/creator-seeding/tracking-schema.md`
- Create: `marketing/discovery/creator-seeding/feedback-taxonomy.md`
- Create: `marketing/discovery/creator-seeding/decision-summary.md`
- Modify: `marketing/discovery/creator-seeding/acceptance-checklist.md`
- Modify: `marketing/discovery/creator-seeding/blockers.md`

**Interfaces:**
- Consumes: Tasks 1-4 and product metric/privacy rules.
- Produces: aggregate pilot readout contract and a maximum-12-item Mike review.

- [ ] **Step 1: Define allowed stage tracking**

Use local review ID, category, public source class, approval state, outreach state, response category, trial state, content state, campaign label, attributed aggregate availability, feedback code, and next action. Prohibit private text/contact fields.

- [ ] **Step 2: Define feedback codes**

Include setup friction, unclear value, privacy concern, wrong audience, proof disbelief, missing agent, missing use case, positive trial intent, content fit, and no response. Aggregate themes; do not retain message text.

- [ ] **Step 3: Define decision rules**

No-response is not product rejection. One reply is evidence, not a trend. Repeated coded objections can change messaging or promote a product question; private correspondence never enters public proof.

- [ ] **Step 4: Prepare the Mike packet**

Recommend the first smaller send batch from the approved cohort, with reason, asset, campaign label, compensation/rights status, and stop rule. Keep every `Send status` as `not_sent`.

- [ ] **Step 5: Run final verification**

Run:

```bash
test -f marketing/discovery/creator-seeding/prospect-review.csv
test -f marketing/discovery/creator-seeding/community-map.md
test -f marketing/discovery/creator-seeding/outreach-drafts.md
rg -n "not_sent|External actions not taken" marketing/discovery/creator-seeding/decision-summary.md marketing/discovery/creator-seeding/outreach-drafts.md
rg -n -i "[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|authorization: bearer|private message" marketing/discovery/creator-seeding
```

Expected: complete review packet, no sends, and no private data.

- [ ] **Step 6: Commit the complete pilot packet**

```bash
git add marketing/discovery/creator-seeding
git commit -m "docs: complete creator seeding pilot plan"
```
