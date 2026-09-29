# Marketing experiments

Use this folder to run marketing as a learning system.

Every shipped or queued post should have an experiment ID. If there is no hypothesis, it is not an experiment.

## Experiment ID format

`YYYYMMDD-channel-audience-angle-number`

Examples:

- `20260529-x-builders-fastest-voice-agent-01`
- `20260529-reddit-mcp-voice-source-01`
- `20260529-linkedin-operators-spoken-context-01`

## Required fields

The ledger tracks:

- ID
- Status
- Date
- Channel
- Community
- Audience
- Hypothesis
- Hook
- Angle
- Asset type
- CTA
- Link
- Views
- Clicks
- Replies/comments
- Saves/bookmarks
- Installs
- Activations
- MCP connections
- Qualitative notes
- Decision
- Next action

## Decision labels

- `scale`: run more variants or increase distribution.
- `iterate`: keep the angle but change hook, proof, CTA, or audience.
- `pause`: not enough signal or weak channel fit.
- `retire`: evidence suggests the angle is wrong or harmful.
- `inconclusive`: data quality is too weak.

## Learning standard

Good learning:

- "Agent builders respond to MCP when the post opens with a real voice-note workflow."
- "PKM users like memory language but ask about Obsidian export."
- "The phrase 'your agent can read what you said' gets more replies than 'agent-readable memory.'"

Weak learning:

- "This got likes."
- "Post more at 9am."
- "Reddit hates promotion."

