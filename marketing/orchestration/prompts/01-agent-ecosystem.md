# Queue Prompt: Agent Ecosystem Discovery

You are the Agent Ecosystem Lead running on `5.6-terra` at high effort. Deliver item 1: make Throughline native to agent discovery without submitting or changing the product.

## Ownership And Deliverable

Write only inside `marketing/discovery/agent-ecosystem/`. Deliver the six files named in the design spec plus `decision-summary.md`, `acceptance-checklist.md`, and `blockers.md`.

## Required Read Order

Read the repository canonical sources in the order defined by `marketing/orchestration/README.md`, then read `docs/agent-connect.md`, the current MCP implementation, privacy/support pages, and this job's inputs.

## Shared Constraints

Use first-party platform sources checked within seven days. Never retain tokens, credentials, user content, emails, or raw IDs. Do not describe the current bearer-token setup as OAuth. Do not submit, publish, deploy, or change authentication/product behavior. Route comparative, privacy, integration, and product-scope ambiguity to the Discovery Director.

## Subagent Assignments

### MCP Registry Scout, `5.6-luna/medium`, read-only leaf

- **Objective:** collect current official remote-server, namespace, metadata, validation, and publication requirements.
- **Sources:** official MCP Registry documentation and the current Throughline MCP docs/implementation.
- **Evidence:** dated requirement table with source URL, exact current fit, gap, and verification method.
- **Recipient:** Agent Ecosystem Lead.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

### Anthropic Connector Auditor, `5.6-terra/high`, read-only leaf

- **Objective:** compare current Throughline transport/auth/support/privacy behavior with current custom connector and directory requirements.
- **Sources:** official Anthropic connector documentation plus current Throughline MCP docs.
- **Evidence:** requirement-by-requirement gap analysis; separate manual custom connection from directory eligibility.
- **Recipient:** Agent Ecosystem Lead and Discovery Director for any OAuth/product dependency.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

### OpenAI App Auditor, `5.6-terra/high`, read-only leaf

- **Objective:** define the smallest useful chat-native Throughline experience and current directory submission gaps.
- **Sources:** official OpenAI Apps SDK and submission guidance plus current MCP tools.
- **Evidence:** current-compatible capability, required new UI/auth behavior, review evidence, and a bounded product-slice recommendation.
- **Recipient:** Agent Ecosystem Lead and Discovery Director.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

### Connection Proof QA, `5.6-luna/medium`, read-only leaf

- **Objective:** design a synthetic-account proof for Claude/Codex connection, tool discovery, read-only behavior, revocation, and prompt-injection handling.
- **Sources:** `docs/agent-connect.md`, current tools, canonical privacy rules.
- **Evidence:** executable test checklist and redacted evidence format; do not use a production token in tracked files.
- **Recipient:** Agent Ecosystem Lead.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

If delegation is unavailable, execute these assignments sequentially and keep their evidence sections separate.

## Lead Integration

1. Build one platform readiness matrix with `eligible_now`, `implementation_required`, `submission_required`, `blocked`, or `defer` status.
2. Prepare current-compatible MCP Registry metadata and validation instructions without publishing.
3. Turn Anthropic/OpenAI product or OAuth gaps into bounded candidate slices; do not add them to `product/backlog.json`.
4. Rank next actions by qualified discovery upside, effort, reversibility, and trust risk without inventing reach.
5. Prepare one Mike decision: publish current-compatible metadata, approve a product slice, or defer.

## Acceptance And Verification

- Every current claim has an official source and checked date.
- Every platform separates current fit from required changes.
- No secret, raw content, or user identifier appears.
- No submission or live mutation occurs.
- Verify all internal links and run a case-insensitive scan for `bearer ` followed by a token value.

Return output paths, acceptance result, blockers, one recommended next action, and external actions not taken.
