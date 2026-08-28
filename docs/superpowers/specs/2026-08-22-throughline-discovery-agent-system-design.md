# Throughline Discovery Agent System Design

**Status:** Operating. On 2026-08-27 Mike authorized the reversible owned discovery build and deployment. Pages build `1179780269` published the six-file owned surface from commit `1770db3`. Paid spend, one-to-one outreach, account posting, platform submission, App Store changes, and live product changes remain exact-action gates.

**Owner:** Mike owns priority, product and creative taste, spend, publishing, platform submissions, and any product-scope decision. The Discovery Director owns orchestration, evidence integrity, integration, and verification.

**Verified:** 2026-08-27 against `docs/CURRENT_STATE.md`, `docs/PRODUCT.md`, `docs/launch-marketing.md`, `docs/WORKFLOW.md`, `product/metrics.md`, `product/backlog.json`, `docs/agent-connect.md`, the live US App Store listing, the live GitHub Pages site, and the official platform references at the end of this document.

## Decision

Build a queueable discovery operating system with one coordinator prompt and five independently executable workstream prompts:

1. Become native to agent discovery.
2. Fix the owned discovery surface.
3. Build a proof factory.
4. Seed creators and communities.
5. Capture existing demand.

The system prepares evidence, drafts, assets, implementation work, and approval packets. The selected slice may build and deploy the owned discovery surface after verification. It does not spend, contact people, post from an account, submit to a third-party directory, change the App Store, or change live product behavior without Mike approving the concrete action.

## User Problem

Throughline has a differentiated product loop, but discovery is fragmented. A qualified user should be able to understand and verify this sequence quickly:

1. Record a spoken thought.
2. Receive a structured note, summary, and to-dos.
3. Let a chosen AI agent read that durable context through the owner-scoped, read-only MCP server.

Today, the product proof, agent-directory readiness, owned web surface, creative production, creator seeding, and demand capture are separate activities without one queue, one evidence contract, or one learning loop.

## Positioning Contract

**Durable product promise:** `voice -> structured notes and to-dos -> readable AI agent`.

**Strategic message hypothesis:** “The fastest way to get your voice to an AI agent.”

“Fastest” is a positioning hypothesis, not a verified comparative fact. Public-facing workers must either:

- use a non-comparative form such as “Get your voice into your AI agent” or “Voice notes your agent can read”; or
- attach current comparative evidence and route the claim to Mike for explicit approval.

The acquisition story leads with the immediate human benefit. MCP is the differentiated proof, not unexplained infrastructure jargon.

## Baseline And Measurement

The first operating cycle establishes a discovery baseline before setting lift targets.

**Primary discovery metric:** first-time App Store downloads attributed to a named discovery source or campaign, reported only when Apple exposes the aggregate.

**Qualified-acquisition proxy:** same-window first-time downloads compared with new `auth_succeeded` activity. This is not a matched-user conversion rate until a privacy-safe join exists.

**Downstream product outcomes:** non-demo first value, days 2-7 repeated value, and first MCP tool use. The server-side first-tool-use event remains a measurement coverage gap and must not be reported as a healthy zero.

**Leading indicators:**

- verified directory/listing readiness and approved listings;
- qualified landing-page sessions and App Store click-through by campaign;
- App Store product-page views and conversion by source or product page;
- proof-asset completion rate, hold rate, saves, replies, and target-user objections;
- creator replies, accepted trials, and attributed first-time downloads;
- search impressions, rankings, product-page views, and downloads for declared queries.

**Guardrails:**

- report `debug`, `internal_dogfood`, `external_testflight`, `external_app_store`, and `unknown` separately;
- never retain raw content, emails, credentials, tokens, or raw user/session identifiers;
- label data below platform privacy thresholds as unavailable, not zero;
- vary one material message, audience, format, or placement variable per experiment;
- do not optimize for engagement without checking qualified downstream behavior.

## Agent Topology

### Discovery Director

- **Route:** 5.6 Sol, high effort.
- **Responsibility:** freeze the baseline, dispatch workstreams, resolve cross-stream conflicts, inspect evidence, prepare Mike's decision packets, and verify combined outputs.
- **Writing boundary:** shared manifests, queue status, and final integration report only.
- **Cannot:** approve its own public claims, publish, spend, submit, deploy, or change product behavior.

### Evidence And Learning Auditor

- **Route:** 5.6 Terra by default; escalate to Sol for metric interpretation or canonical-source conflict.
- **Responsibility:** check claims, evidence dates, experiment IDs, attribution links, privacy boundaries, and readiness labels across all five workstreams.
- **Mode:** read-only reviewer. It never rewrites a workstream's owned files.

### Workstream Leads

Each workstream lead runs on 5.6 Terra unless the root prompt escalates a material ambiguity to Sol. Leads may assign leaf work to Luna. Every leaf prompt repeats its objective, exact file ownership, canonical read order, privacy rules, approval limits, verification evidence, dependency recipient, and the instruction not to spawn more agents.

## Shared Execution Contract

Every job must:

1. Inspect `git status --short` before writing.
2. Read the canonical sources in the repository-required order.
3. Read this design and its workstream plan.
4. Write only to the paths listed in the job's `write_scope`.
5. Separate `verified_current`, `repository_assertion`, `observed_signal`, `hypothesis`, and `planned` claims.
6. Attach a source URL or repository path and verification date to every current platform or product fact.
7. Produce a decision summary, evidence manifest, acceptance checklist, and unresolved blockers.
8. Stop at a human gate instead of taking the external action.
9. Send dependency findings directly to the named recipient and include them in the final handoff.
10. Recheck the combined diff and run the declared verification commands.

## Workstream 1: Agent Ecosystem Discovery

### Outcome

Make Throughline discoverable where agent users look for tools, beginning with the lowest-friction path supported by the current owner-scoped read-only remote MCP server.

### Agent Tree

- **Agent Ecosystem Lead, Terra:** owns the readiness matrix and submission backlog.
- **MCP Registry Scout, Luna leaf:** checks current remote-server metadata, namespace, validation, and publishing requirements using official sources.
- **Anthropic Connector Auditor, Terra leaf:** compares the current bearer-token setup with current connector and directory requirements.
- **OpenAI App Auditor, Terra leaf:** maps current Apps SDK/directory requirements and the smallest useful chat-native Throughline experience.
- **Connection Proof QA, Luna leaf:** verifies documentation steps with a synthetic account and redacted token evidence when execution is later approved.

### Deliverables

- `marketing/discovery/agent-ecosystem/platform-readiness.md`
- `marketing/discovery/agent-ecosystem/mcp-registry-package.md`
- `marketing/discovery/agent-ecosystem/anthropic-gap-analysis.md`
- `marketing/discovery/agent-ecosystem/openai-gap-analysis.md`
- `marketing/discovery/agent-ecosystem/submission-backlog.md`
- `marketing/discovery/agent-ecosystem/evidence-manifest.md`

### Sequence

1. Verify the current MCP transport, tools, authorization flow, support page, privacy page, and manual connection proof.
2. Build a platform matrix with eligibility, required implementation, review surface, distribution upside, effort, risk, owner, and next reversible action.
3. Prepare the MCP Registry metadata and validation package without publishing it.
4. Treat Anthropic OAuth/directory work and an OpenAI chat-native app as separate candidate product slices when they require authentication or UI changes.
5. Produce one Mike decision packet: “publish current-compatible metadata,” “approve a product slice,” or “defer.”

### Acceptance

- Every requirement links to an official source checked within seven days.
- The current bearer-token path is not described as OAuth or directory-approved.
- The package contains no production token or private user data.
- Each platform has one reversible next action, one explicit approval gate, and one verification method.
- No registry or directory submission occurs.

## Workstream 2: Owned Discovery Surface

### Outcome

Replace the thin owned web presence with a fast, indexable product proof that explains Throughline in one viewport and lets a qualified visitor verify the full voice-to-agent loop.

### Agent Tree

- **Owned Surface Lead, Terra:** owns information architecture and implementation integration.
- **Search Intent Architect, Luna leaf:** clusters qualified non-branded queries and maps them to pages without inventing volume.
- **Conversion Copywriter, Terra leaf:** writes the page hierarchy from verified claims.
- **Proof Asset Producer, Terra leaf:** specifies current-build capture and synthetic demo data.
- **Frontend Worker, Terra leaf:** implements the approved site slice in exclusive files.
- **Web QA, Luna leaf:** checks responsive layout, accessibility, indexing, performance, links, and campaign attribution.

### Deliverables

- `marketing/discovery/owned-surface/baseline.md`
- `marketing/discovery/owned-surface/information-architecture.md`
- `marketing/discovery/owned-surface/copy-deck.md`
- `marketing/discovery/owned-surface/proof-storyboard.md`
- `marketing/discovery/owned-surface/seo-map.csv`
- approved website files and visual evidence when Mike selects the build

### Required Page Story

1. Literal outcome: voice notes your AI agent can read.
2. Immediate proof: current-build video or images showing record, structure, and agent retrieval.
3. Concrete mechanics: notes, to-dos, summaries, and owner-scoped read-only MCP.
4. Compatible workflow examples without implying unverified native integrations.
5. App Store call to action using a named campaign link.
6. Privacy, support, and agent connection pages accessible from the primary experience.

### Acceptance

- The first viewport names Throughline, the category, the outcome, and one action.
- The page uses real current-build product proof with synthetic data; generated media cannot impersonate the UI.
- “Fastest” is excluded unless the claim gate is satisfied.
- Campaign parameters persist through the App Store click.
- Mobile and desktop screenshots pass visual inspection with no overlap or clipped text.
- Indexing metadata, canonical URLs, structured data, link checks, accessibility, and performance checks pass.
- Deployment waits for Mike's product/design approval.

## Workstream 3: Proof Factory

### Outcome

Turn one verified product proof loop into a repeatable, differentiated weekly content kernel that can be adapted for X, Reddit, YouTube Shorts, LinkedIn, creator kits, the website, and App Store assets.

### Agent Tree

- **Proof Factory Lead, Terra:** owns the weekly kernel and accepted-select boundary.
- **Signal Researcher, Luna leaf:** extracts audience questions, language, objections, and format patterns from public sources.
- **Editorial Strategist, Terra leaf:** chooses one audience, one tension, one promise, and one proof.
- **Demo Producer, Terra leaf:** creates the script, shot list, synthetic dataset, and capture checklist.
- **Generative Asset Operator, Luna leaf:** creates only approved support assets using locked prompts and asset passports.
- **Repurposer, Luna leaf:** derives platform-native cuts and posts from an approved master.
- **Claim And Creative Reviewer, Terra leaf:** checks truth, originality, privacy, channel fit, and release hard-fails.

### Weekly Content Kernel

Each kernel produces:

- one 45-75 second master proof demo;
- three 10-30 second vertical cuts with different hooks but the same verified proof;
- one screenshot triptych or carousel;
- five X/founder post variants;
- two community-first Reddit drafts tied to named community rules;
- one creator kit excerpt;
- one owned-search article or workflow page only when search intent is supported;
- one experiment record and one results-retro shell.

### Acceptance

- The kernel begins from a verified product truth and a single experiment hypothesis.
- Every material claim appears in the claim register with status and evidence.
- Real UI is current-build capture; generated visuals are labeled and used only as support.
- Tokens, notifications, identifiers, and personal content are absent from every frame.
- Each derivative is native to its channel and is not merely a crop.
- Structural validators pass; release validators may remain blocked until real exports, direct inspection, rights review, and Mike's approval exist.
- No content is scheduled or published.

## Workstream 4: Creator And Community Seeding

### Outcome

Earn credible distribution through a small, high-fit network of people and communities already discussing agents, MCP, voice workflows, and personal knowledge, without bulk outreach or disguised promotion.

### Agent Tree

- **Seeding Lead, Terra:** owns the pilot cohort, relationship strategy, and approval queue.
- **Creator Scout, Luna leaf:** collects public evidence for fit, audience, recent topic relevance, contact route, and conflicts.
- **Fit Scorer, Luna leaf:** scores product fit, audience overlap, proof compatibility, trust, and outreach risk using a declared rubric.
- **Briefing Writer, Terra leaf:** creates one-to-one outreach drafts and creator briefs from public evidence.
- **Community Steward, Terra leaf:** maps rules, norms, contribution opportunities, and self-promotion constraints.
- **Feedback Synthesizer, Luna leaf:** aggregates replies and objections without retaining private correspondence in tracked artifacts.

### Pilot Design

1. Build a broad evidence pool, then select a maximum of 12 prospects for Mike's first review.
2. Divide the pilot across agent builders, MCP educators, voice-workflow practitioners, and PKM creators; do not force equal quotas if evidence is weak.
3. Offer a useful proof kit, a real test workflow, and direct founder access. Do not require positive coverage.
4. Draft individualized outreach; Mike approves and sends each message.
5. Track aggregate stage counts and coded feedback themes. Store private contact details outside tracked repository artifacts.

### Acceptance

- Every proposed person has dated public fit evidence and a reason Throughline is relevant to their audience.
- No email address, private message, or personal identifier is committed.
- No automated DM, unsolicited reply, mass personalization, or hidden sponsorship is proposed.
- Compensation, gifting, usage rights, and disclosure requirements are explicit before any commitment.
- Community drafts are useful without a product link and pass current rules review.
- Outreach and posting wait for Mike's approval.

## Workstream 5: Existing Demand Capture

### Outcome

Intercept people already searching for voice notes, agent memory, MCP tools, and structured dictation, then send each intent to the most relevant proof and App Store product page.

### Agent Tree

- **Demand Capture Lead, Terra:** owns the intent map and experiment portfolio.
- **ASO Researcher, Luna leaf:** records current listing, competitor language, autocomplete/search evidence, and metadata constraints without inventing volume.
- **Apple Product Page Strategist, Terra leaf:** designs default-page, product-page-optimization, and custom-product-page hypotheses.
- **Search Content Architect, Terra leaf:** maps qualified queries to owned pages and internal links.
- **Apple Ads Planner, Terra leaf:** drafts a capped campaign and negative-keyword plan; cannot activate spend.
- **Attribution Analyst, Luna leaf:** validates campaign links, privacy thresholds, experiment IDs, and readout templates.

### Initial Intent Families

- voice notes for Claude, ChatGPT, Codex, Cursor, or AI agents;
- MCP notes, MCP memory, and personal MCP server;
- voice to to-do list and structured voice notes;
- voice capture while walking, driving, or thinking;
- alternatives to disposable transcripts and generic meeting recorders.

These are seed hypotheses. Workers must verify actual language and available evidence before treating them as priorities.

### Acceptance

- The default App Store page and every custom page each have one audience, one promise, one proof sequence, and one attributable link.
- Product-page optimization varies one material creative hypothesis and records the control.
- Campaign and product-page data below Apple's privacy threshold is reported as unavailable.
- Paid-search plans include budget cap, match type, negatives, stop conditions, and downstream quality readout.
- Metadata, product page submissions, and ad activation wait for Mike's explicit approval.
- SEO pages answer distinct intent and do not mass-produce thin agent-name variants.

## Dependency Graph

`ROOT-00` freezes the baseline and creates the run manifest.

`DISC-01` platform research, `DISC-03` first proof-kernel planning, and `DISC-05` intent research may start in parallel.

`DISC-02` uses the approved message/proof architecture from `DISC-03` and attribution contract from `DISC-05` before implementation.

`DISC-04` uses the accepted proof kit from `DISC-03` and named landing/App Store links from `DISC-02` and `DISC-05` before outreach.

No execution dependency grants approval. A job whose dependency is complete can still be blocked at its own Mike gate.

## Model Routing

- **5.6 Sol, high effort:** root coordination, ambiguous strategy, cross-stream integration, claim disputes, platform-policy interpretation, experiment decisions, and final Mike packets.
- **5.6 Terra, high effort:** workstream leadership, substantial research synthesis, specifications, copy systems, implementation, and substantive review.
- **5.6 Terra, medium effort:** bounded audits, routine drafting, and focused implementation with a frozen contract.
- **5.6 Luna, medium effort:** source gathering, classification, transformations, metadata assembly, repurposing, and checklist QA.
- **5.6 Luna, low effort:** deterministic format checks and inventory updates only.

The aliases are repository-local routing labels. Their provider model IDs belong in the queue runner's private configuration, not in tracked prompts.

## Escalation Rules

Escalate to the Discovery Director when:

- canonical sources conflict;
- a current platform rule cannot be verified from a first-party source;
- a claim could imply comparative superiority, native integration, write capability, or customer adoption;
- a worker encounters raw user content or identifiers;
- a task requires auth, OAuth, provider, model, data-use, pricing, limit, onboarding, or App Store submission changes;
- publishing, outreach, deployment, spend, account access, or irreversible action is next;
- an experiment lacks decision-grade coverage or produces conflicting signals.

## Approval Gates

| Gate | Prepared by agents | Approved by Mike |
| --- | --- | --- |
| Discovery strategy and queue | Yes | Priority and entry into execution |
| Public positioning and design | Options and evidence | Final taste and claim selection |
| Registry or directory submission | Readiness package | Submission |
| Website deployment | Build and QA evidence | Product/design and deploy |
| Content publishing or scheduling | Approved-ready queue | Publish/schedule |
| Creator outreach or compensation | Prospect and outreach packet | Send, spend, and terms |
| App Store metadata or product pages | Drafts and test design | Submission |
| Apple Ads | Campaign plan and stop rules | Budget and activation |
| Product/auth/OAuth capability | Candidate slice | Entry into build and design |

## Non-Goals

- autonomous social engagement, replies, DMs, or community posting;
- manufactured testimonials, fake users, fabricated metrics, or copied creator formats;
- unbounded SEO page generation;
- automatic budget reallocation;
- changing MCP from read-only to write-capable;
- changing provider, base model, data-use policy, pricing, recording limits, onboarding, or App Store submission state;
- claiming the existing campaign package has rendered or published assets.

## Official References

- MCP remote server publishing: `https://modelcontextprotocol.io/registry/remote-servers`
- MCP Registry quickstart: `https://modelcontextprotocol.io/registry/quickstart`
- Anthropic connectors collection: `https://support.claude.com/en/collections/15399129-connectors`
- Anthropic custom remote MCP connectors: `https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp`
- OpenAI app submissions: `https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/`
- OpenAI Apps SDK overview: `https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk`
- Apple product pages: `https://developer.apple.com/app-store/product-page/`
- Apple product page optimization: `https://developer.apple.com/app-store/product-page-optimization/`
- Apple custom product pages: `https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions/`
- Apple campaign links: `https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links`
