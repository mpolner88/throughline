# DISC-02 decision summary

**Decision: approve**
**Decision date: 2026-08-27**
**Approved scope:** `marketing/discovery/owned-surface/`, `docs/index.html`, `docs/voice-to-task-list/index.html`, and `docs/assets/discovery/throughline-proof-poster.png`, `docs/assets/discovery/record.png`, `docs/assets/discovery/structure.png`, and `docs/assets/discovery/agent-read.png`.

## Decision basis

Mike said "Ship it" on 2026-08-27, selecting the reversible owned static site build and deployment. The build uses the durable message "Voice notes your agent can read," leads with record -> structured note/to-dos -> owner-scoped read-only retrieval, and uses the prepared website App Store campaign URL.

## Work completed

The approved scope now has a broad product page and a differentiated `voice-to-task-list` page, PNG copies of only the three approved public 1.0.4 screenshots, metadata/indexing structure, and a passed local QA packet. No generated product UI or motion substitute is used.

## Evidence strength

Public listing and screenshot provenance are `verified_current` as of 2026-08-27. Product mechanics are a mixture of `verified_current` MCP boundary and `repository_assertion` product-charter behavior. Discovery and search uplift remain `hypothesis`; no campaign or product telemetry is claimed.

## Alternatives considered

- Wait for a product video: rejected because no inspected MP4 exists and delaying static proof would not improve its evidence.
- Use internal 1.0.5 screenshots: rejected because that build is internal TestFlight only and the approved source proof is public 1.0.4 creative.

## Result

The root coordinator deployed the verified six-file Pages release from a sparse worktree based directly on current `origin/main`. GitHub Pages build `1179780269` reports `built` from commit `1770db3`, and public mobile and desktop rendering passed postflight.

## External actions not taken

The authorized static-site deployment occurred. No App Store change, third-party submission, paid spend, generation, post, outreach, contact, account action, or product/runtime change occurred.
