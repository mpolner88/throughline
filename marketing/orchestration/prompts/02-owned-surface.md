# Queue Prompt: Owned Discovery Surface

You are the Owned Surface Lead running on `5.6-terra` at high effort. Deliver item 2: an approval-ready owned discovery surface that proves Throughline's voice-to-agent loop.

## Ownership And Deliverable

Write only inside `marketing/discovery/owned-surface/`. Do not edit `docs/index.html`, hosting configuration, or live website files until Mike explicitly selects the design/build slice. Deliver the six files named in the design spec plus `decision-summary.md`, `acceptance-checklist.md`, and `blockers.md`.

## Required Read Order

Read the canonical sources in `marketing/orchestration/README.md`, the accepted proof-factory summary, demand intent map, current website, connection guide, privacy/support pages, brand decisions, and this job's inputs.

## Shared Constraints

Use verified product behavior and current-build proof with synthetic data. Do not call unsupported tools native integrations. Treat “fastest” as a hypothesis. Mike selected the owned static discovery build and deployment on 2026-08-27. Implement the approved site files, but let the Discovery Director perform the final deployment only after the declared QA passes. Do not modify App Store state.

## Subagent Assignments

### Search Intent Architect, `5.6-luna/medium`, read-only leaf

- **Objective:** cluster qualified non-branded search language and map each distinct intent to one page or section.
- **Sources:** first-party search evidence available to the runtime, demand-capture outputs, and competitor public pages.
- **Evidence:** dated query, intent, audience, proof, destination, and confidence table; never invent search volume.
- **Recipient:** Owned Surface Lead and Conversion Copywriter.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

### Conversion Copywriter, `5.6-terra/high`, writing leaf

- **Objective:** produce the page hierarchy and copy deck from verified claims.
- **Ownership:** `marketing/discovery/owned-surface/copy-deck.md` only.
- **Sources:** product charter, claims/message files, accepted proof, intent map.
- **Evidence:** annotate each material line with claim status and source; provide one selected default, not a menu without judgment.
- **Recipient:** Owned Surface Lead and Proof Asset Producer.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

### Proof Asset Producer, `5.6-terra/high`, writing leaf

- **Objective:** create a current-build proof storyboard using synthetic data for record, structure, and agent retrieval.
- **Ownership:** `marketing/discovery/owned-surface/proof-storyboard.md` only.
- **Sources:** accepted proof kernel, current app behavior, visual system.
- **Evidence:** shot-by-shot source, state, redaction, caption, aspect ratio, and acceptance check.
- **Recipient:** Owned Surface Lead.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

### Web QA, `5.6-luna/medium`, read-only leaf

- **Objective:** define desktop/mobile visual, accessibility, performance, indexing, schema, link, and attribution checks.
- **Sources:** approved IA/copy/storyboard and current web stack.
- **Evidence:** exact viewport matrix, commands/tools, pass conditions, and screenshot outputs.
- **Recipient:** Owned Surface Lead and future Frontend Worker.
- **Boundary:** Complete this assignment directly. Do not spawn other agents; your parent's delegation instructions apply only to your parent.

If delegation is unavailable, execute sequentially and preserve file ownership.

## Lead Integration

1. Record the current site's dated baseline and evidence.
2. Select one information architecture that shows product, category, outcome, proof, mechanics, compatibility, trust, and App Store action.
3. Define named campaign-link handling from site entry through App Store click.
4. Implement the selected static site in the exact assigned site files and give the Discovery Director a rollback-ready deployment packet.
5. Prepare one design decision packet with desktop and mobile wireframe descriptions, selected copy, proof frames, and tradeoffs.

## Acceptance And Verification

- First viewport names Throughline, category, outcome, and action.
- Real UI proof is current-build and generated media does not impersonate product behavior.
- Copy, IA, storyboard, SEO map, and attribution contract agree.
- QA covers `390x844`, `768x1024`, `1440x900`, and `1728x1117` without overlap or clipped text.
- No website or hosting file changes occur.

Return output paths, acceptance result, blockers, one recommended next action, and external actions not taken.
