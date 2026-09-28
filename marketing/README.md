# Throughline marketing operating system

This folder defines the marketing-agent system for Throughline.

The purpose is to scale content production, asset creation, posting workflows, and learning without losing the product's voice or turning community marketing into spam.

## North star

Throughline is the fastest way to get your voice to an AI agent.

The core loop:

1. Record voice notes.
2. Throughline captures them as to-dos, summaries, and memories.
3. Connect MCP directly and get your agent to read them.

Every agent output should make this loop clearer, more believable, or more desirable.

## Operating principle

Automate production. Automate analysis. Keep publishing judgment explicit.

At the start, agents may draft, score, adapt, schedule, analyze, and recommend. A human approves posts before publishing. Full auto-publishing can come later for low-risk owned channels or pre-approved scheduled content.

## Agent loop

| Stage | Agent | Input | Output |
|---|---|---|---|
| 1 | Signal researcher | Communities, posts, comments, analytics, reviews | Signal brief |
| 2 | Angle strategist | Signal brief, message library | Testable hypotheses |
| 3 | Channel copywriter | Hypothesis, channel brief | Draft posts |
| 4 | Asset director | Draft posts, product assets | Asset brief |
| 5 | Creative producer | Asset brief, provider matrix | Generated or captured asset candidates |
| 6 | Community reviewer | Draft, asset, rules | Approve, revise, or reject |
| 7 | Publisher | Approved queue | Scheduled or posted content |
| 8 | Performance analyst | Metrics, comments, installs | Experiment readout |
| 9 | Learning editor | Readout, objections, winning language | Updated playbook |

## Deployment phases

### Phase 1: Drafting factory

Agents produce:

- X/Twitter drafts.
- Reddit-native drafts.
- Founder posts.
- Short video scripts.
- Screenshot/carousel briefs.
- Technical diagrams.
- Direct outreach notes.
- Visual and video generation prompts.

Human approves everything. Metrics are entered manually or imported from platform exports.

### Phase 2: Assisted publishing

Agents maintain an approved queue and produce posting checklists. Publishing still happens manually or through official platform scheduling tools.

Use official APIs only when the workflow is compliant with each platform's current policy.

### Phase 3: Closed-loop optimization

Agents ingest performance data and comments, then update:

- Message hypotheses.
- Audience hypotheses.
- Community fit scores.
- Posting schedule recommendations.
- Asset formats.
- Objection handling.

### Phase 4: Limited automation

Only automate publishing for:

- Owned channels.
- Pre-approved evergreen posts.
- No unsolicited replies or DMs.
- No automated engagement.
- Channels where API terms and account setup explicitly allow the workflow.

## Required artifacts

- [voice-and-messaging.md](voice-and-messaging.md)
- [agents/README.md](agents/README.md)
- [assets/production-pipeline.md](assets/production-pipeline.md)
- [assets/provider-matrix.md](assets/provider-matrix.md)
- [experiments/README.md](experiments/README.md)
- [experiments/experiment-ledger.csv](experiments/experiment-ledger.csv)

## Platform guardrails

These are not legal advice. Re-verify before implementing API publishing.

X/Twitter:

- Use the official X API only.
- Do not scrape or use browser automation.
- Automated accounts must be transparent and labeled.
- No unsolicited DMs, replies, or mentions.
- No identical cross-posting, bulk posting, fake engagement, or trend manipulation.
- AI-generated replies require prior X approval.

Reddit:

- Follow sitewide Reddit Rules and each community's rules.
- Participate authentically and do not spam or manipulate content.
- Respect API rate limits and developer terms.
- Commercial API use or use beyond permitted limits may require a separate Reddit agreement.
- Treat Reddit as research plus community contribution before promotion.

Official references to re-check before implementation:

- X Developer Guidelines: `https://docs.x.com/developer-guidelines`
- Reddit Rules: `https://redditinc.com/policies/reddit-rules`
- Reddit Developer Terms: `https://redditinc.com/policies/developer-terms`
- Reddit Data API Terms: `https://redditinc.com/policies/data-api-terms`

## Human review gates

A post cannot move to publishing until it passes:

- Core message: the voice-to-agent loop is clear.
- Tone: restrained, useful, concrete.
- Claim safety: no unsupported claims.
- Channel fit: native to the community and format.
- Community rules: no obvious rule or self-promotion conflict.
- Platform safety: no automation behavior that risks the account.
- Learning plan: the experiment has a hypothesis and metric.

## Repository contract

Marketing agents should create durable artifacts, not chat-only ideas.

Use:

- `marketing/outputs/` for generated drafts and asset briefs.
- `marketing/assets/production-queue.csv` for asset work before it is published.
- `marketing/experiments/experiment-ledger.csv` for shipped or queued experiments.
- `marketing/voice-and-messaging.md` for message changes that have earned their way in.
- `docs/launch-marketing.md` for the current launch plan.
