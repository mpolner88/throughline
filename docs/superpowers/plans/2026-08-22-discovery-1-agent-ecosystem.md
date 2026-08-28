# Agent Ecosystem Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare evidence-complete, approval-ready paths for discovering Throughline through the MCP Registry, Anthropic connectors, and ChatGPT apps without submitting or changing production.

**Architecture:** A Terra workstream lead integrates four non-overlapping leaf audits into one platform readiness matrix. Current-compatible registry metadata stays separate from authentication or product changes, which become candidate slices for Mike rather than hidden implementation scope.

**Tech Stack:** Markdown evidence artifacts, current Throughline remote MCP implementation, official MCP/Anthropic/OpenAI documentation, shell validation.

**Spec:** `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`

## Global Constraints

- Current Throughline MCP is owner-scoped and read-only with manual bearer-token setup.
- Use first-party platform sources checked within seven days of execution.
- Never commit credentials, bearer values, raw user content, emails, or raw identifiers.
- Do not publish registry metadata, submit to a directory, deploy, or change authentication/product behavior.
- Mike approval is required for a submission, OAuth/product slice, or public integration claim.
- One writer owns `marketing/discovery/agent-ecosystem/`; leaf audits are read-only unless a unique file is assigned.

## File Map

- Create `marketing/discovery/agent-ecosystem/platform-readiness.md`: shared eligibility and priority matrix.
- Create `marketing/discovery/agent-ecosystem/mcp-registry-package.md`: proposed metadata, validation, and redacted proof.
- Create `marketing/discovery/agent-ecosystem/anthropic-gap-analysis.md`: custom connection versus directory-readiness audit.
- Create `marketing/discovery/agent-ecosystem/openai-gap-analysis.md`: Apps SDK/directory experience and product gaps.
- Create `marketing/discovery/agent-ecosystem/submission-backlog.md`: reversible actions and Mike gates.
- Create `marketing/discovery/agent-ecosystem/evidence-manifest.md`: dated claim/source ledger.
- Create `marketing/discovery/agent-ecosystem/decision-summary.md`: selected recommendation and alternatives.
- Create `marketing/discovery/agent-ecosystem/acceptance-checklist.md`: objective plan exit checks.
- Create `marketing/discovery/agent-ecosystem/blockers.md`: unresolved external or product dependencies.

---

### Task 1: Freeze The Current Connection Baseline

**Files:**
- Create: `marketing/discovery/agent-ecosystem/evidence-manifest.md`
- Create: `marketing/discovery/agent-ecosystem/acceptance-checklist.md`
- Create: `marketing/discovery/agent-ecosystem/blockers.md`

**Interfaces:**
- Consumes: canonical read order, `docs/agent-connect.md`, current MCP source, privacy/support pages.
- Produces: dated facts and acceptance gates used by Tasks 2-5.

- [ ] **Step 1: Write the acceptance checklist before research**

Record exact checks for transport, public endpoint reachability, authorization form, tool inventory, read-only safety, revocation, support, privacy, test account, platform source date, and prohibited external actions.

- [ ] **Step 2: Run the baseline checks and record expected gaps**

Run:

```bash
rg -n "streamable|Authorization|Bearer|tools/list|readOnly|read-only|revoke" docs/agent-connect.md supabase/functions/mcp
```

Expected: evidence for the current remote connection and read-only behavior; missing OAuth or first-tool-use telemetry stays a gap.

- [ ] **Step 3: Create the evidence manifest**

Use columns `Claim | Status | Source | Checked | Used by`. Allowed statuses are `verified_current`, `repository_assertion`, `observed_signal`, `hypothesis`, `planned`, and `blocked`.

- [ ] **Step 4: Record blockers without solving them implicitly**

Include current auth limitations, directory-specific product requirements, missing public proof, and live-state checks that require account access. State the exact owner and next reversible action for each.

- [ ] **Step 5: Verify privacy and ownership**

Run:

```bash
git status --short
rg -n -i "authorization: bearer [a-z0-9._-]{12,}|api[_ -]?key|access[_ -]?token|refresh[_ -]?token" marketing/discovery/agent-ecosystem
```

Expected: only owned files appear; the secret scan returns no credential value.

- [ ] **Step 6: Commit the baseline artifact**

```bash
git add marketing/discovery/agent-ecosystem/evidence-manifest.md marketing/discovery/agent-ecosystem/acceptance-checklist.md marketing/discovery/agent-ecosystem/blockers.md
git commit -m "docs: baseline agent discovery readiness"
```

### Task 2: Prepare The MCP Registry Package

**Files:**
- Create: `marketing/discovery/agent-ecosystem/mcp-registry-package.md`

**Interfaces:**
- Consumes: Task 1 evidence manifest and official MCP Registry schemas/docs.
- Produces: proposed `server.json` content, namespace decision, validation commands, and redacted smoke-proof format.

- [ ] **Step 1: Recheck official registry requirements**

Record the exact schema URL, registry preview status, remote transport types, public endpoint requirement, namespace verification, required metadata, and current publisher validation flow with source URLs and checked date.

- [ ] **Step 2: Draft the complete proposed metadata**

Include name, title, description, version source, website/repository/support/privacy links, remote Streamable HTTP URL, required secret header declaration if supported, icons, and owner information. Use literal redaction markers such as `USER_SUPPLIED_TOKEN`; never paste a real value.

- [ ] **Step 3: Define validation evidence**

Specify metadata schema validation, unauthenticated rejection, authenticated `initialize`, `tools/list`, one synthetic read, attempted unsupported write, token revocation, and registry lookup after any future publication.

- [ ] **Step 4: Classify the package**

Mark each field `ready`, `needs_public_asset`, `needs_live_check`, or `requires_mike_approval`. Do not mark the package published.

- [ ] **Step 5: Verify completeness**

Run:

```bash
rg -n "schema|namespace|streamable-http|privacy|support|initialize|tools/list|revocation|Mike" marketing/discovery/agent-ecosystem/mcp-registry-package.md
```

Expected: every required topic is present.

- [ ] **Step 6: Commit the registry preparation**

```bash
git add marketing/discovery/agent-ecosystem/mcp-registry-package.md
git commit -m "docs: prepare MCP registry discovery package"
```

### Task 3: Audit Anthropic Connector Readiness

**Files:**
- Create: `marketing/discovery/agent-ecosystem/anthropic-gap-analysis.md`

**Interfaces:**
- Consumes: Task 1 baseline and current official Anthropic connector/directory rules.
- Produces: a strict separation among manual custom connection, verified-domain/directory eligibility, and product changes.

- [ ] **Step 1: Build the current requirement table**

Include remote MCP transport, auth, support, privacy, safety annotations, tool naming/descriptions, test credentials/account, organization controls, directory policy, and review evidence where official sources require them.

- [ ] **Step 2: Compare current Throughline behavior**

For every row, record `meets`, `partial`, `does_not_meet`, or `not_verified`, plus source and smallest reversible next action.

- [ ] **Step 3: Isolate product work**

Put OAuth, guided connection, domain verification, or new UI in a `Candidate product slice` section with user problem, metric, guardrail, non-goals, rollback, and Mike gate. Do not edit `product/backlog.json`.

- [ ] **Step 4: Define redacted connection proof**

Specify a synthetic account, token creation, connector authorization, read-only tool call, revocation, and injection-resistance test with no retained content.

- [ ] **Step 5: Verify claim boundaries**

Run:

```bash
rg -n -i "custom connector|directory|oauth|bearer|read-only|candidate product slice|Mike" marketing/discovery/agent-ecosystem/anthropic-gap-analysis.md
```

Expected: manual connection and directory eligibility are visibly separate.

- [ ] **Step 6: Commit the Anthropic audit**

```bash
git add marketing/discovery/agent-ecosystem/anthropic-gap-analysis.md
git commit -m "docs: audit Anthropic connector discovery"
```

### Task 4: Audit OpenAI App Readiness

**Files:**
- Create: `marketing/discovery/agent-ecosystem/openai-gap-analysis.md`

**Interfaces:**
- Consumes: Task 1 baseline, current MCP tools, official Apps SDK and app-submission guidance.
- Produces: smallest useful ChatGPT app concept and a requirement-level gap analysis.

- [ ] **Step 1: Define user intent before interface**

Select one chat-native job: ask what was captured today, find open to-dos, or search a remembered topic. Explain why it is differentiated from a generic notes connector.

- [ ] **Step 2: Map current tools to the intent**

Record exact MCP tools used, user inputs, read-only outputs, empty/error states, authorization boundary, and safe treatment of note text as context rather than instructions.

- [ ] **Step 3: Audit submission requirements**

Use current official guidance to cover MCP connectivity, testing instructions, privacy, country availability, directory metadata, UI quality, safety, and account review. Mark beta or changeable requirements explicitly.

- [ ] **Step 4: Define the candidate product slice**

Specify any Apps SDK UI, OAuth/auth handoff, consent, deep link, or support implementation as planned work with exact Mike gate. Do not build it.

- [ ] **Step 5: Verify differentiation and limits**

Run:

```bash
rg -n -i "user intent|MCP|read-only|privacy|testing|directory|candidate product slice|not authorized" marketing/discovery/agent-ecosystem/openai-gap-analysis.md
```

Expected: the app concept is scoped, testable, and clearly not submitted.

- [ ] **Step 6: Commit the OpenAI audit**

```bash
git add marketing/discovery/agent-ecosystem/openai-gap-analysis.md
git commit -m "docs: audit ChatGPT app discovery"
```

### Task 5: Integrate The Platform Decision Packet

**Files:**
- Create: `marketing/discovery/agent-ecosystem/platform-readiness.md`
- Create: `marketing/discovery/agent-ecosystem/submission-backlog.md`
- Create: `marketing/discovery/agent-ecosystem/decision-summary.md`
- Modify: `marketing/discovery/agent-ecosystem/acceptance-checklist.md`
- Modify: `marketing/discovery/agent-ecosystem/blockers.md`

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: one integrated recommendation for `ROOT-99` and Mike.

- [ ] **Step 1: Build the platform readiness matrix**

Use columns `Surface | Current fit | Required work | Discovery mechanism | Evidence | Effort | Reversibility | Trust risk | Approval | Recommended status`.

- [ ] **Step 2: Order reversible work**

Put current-compatible metadata preparation before product/auth changes unless evidence shows the current path cannot be listed. Label estimated upside as a hypothesis, not a forecast.

- [ ] **Step 3: Create the submission backlog**

Give every action an owner, dependency, verification, rollback/stop condition, and Mike gate. Separate `prepare`, `build candidate`, `submit`, and `measure` phases.

- [ ] **Step 4: Write one recommendation**

The decision summary must select one next action and show the strongest alternative. Include confidence, evidence gaps, and all external actions not taken.

- [ ] **Step 5: Run the workstream acceptance audit**

Run:

```bash
test -f marketing/discovery/agent-ecosystem/platform-readiness.md
test -f marketing/discovery/agent-ecosystem/mcp-registry-package.md
test -f marketing/discovery/agent-ecosystem/anthropic-gap-analysis.md
test -f marketing/discovery/agent-ecosystem/openai-gap-analysis.md
test -f marketing/discovery/agent-ecosystem/submission-backlog.md
rg -n "External actions not taken" marketing/discovery/agent-ecosystem/decision-summary.md
```

Expected: all files exist and the decision summary names the boundary.

- [ ] **Step 6: Commit the integrated packet**

```bash
git add marketing/discovery/agent-ecosystem
git commit -m "docs: complete agent ecosystem discovery plan"
```
