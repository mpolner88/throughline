# DISC-03 creator kit

**Status:** `planned`. This is a proof workflow for review, not outreach, a request for favorable coverage, or a permission to disclose a relationship.

## Literal description

Throughline is an iOS voice-note app for an individual who wants a spoken thought to become a structured note with to-dos and a summary, then be readable by their chosen AI agent through owner-scoped, read-only MCP access.

## Who it is for / not for

**For:** individual builders, operators, writers, and knowledge-work practitioners who already use an AI agent and capture thoughts away from a keyboard.

**Not for:** meeting-recording buyers, team transcription workflows, anyone looking for agent write-back, or anyone who needs a claim of automatic action.

## Proof workflow

1. Use only the synthetic `Return-to-desk plan` in `production-plan.md` for the capture proof.
2. Inspect the current-build recording and structured note.
3. Confirm that a controlled agent retrieval returns only the three synthetic to-dos.
4. Confirm the visible boundary: access is owner-scoped and read-only.
5. Do not record, copy, or share any token, endpoint, account details, private notes, or conversations.

## Current setup limits

- `verified_current`: saved notes are exposed through a remote MCP endpoint with owner-scoped, read-only access. Source: `docs/CURRENT_STATE.md`, `docs/agent-connect.md`; checked 2026-08-27.
- `verified_current`: server-side first MCP tool use remains a coverage gap. Source: `product/metrics.md`; checked 2026-08-27.
- `repository_assertion`: the public App Store listing and owned-site baseline are documented in `marketing/discovery/_run/baseline.md`; checked 2026-08-27.
- `do-not-use`: do not say it works natively with every agent, writes back, improves a workflow, is faster than alternatives, or is used by customers.

## Synthetic trial script

"When I get back to my desk, I need to outline the release note, check the final app screens, and write the launch checklist."

The expected result is one title, one summary, and the three declared tasks in `production-plan.md`. Any other data is out of scope for this proof.

## Disclosure and rights

- A creator must disclose any paid relationship, free access, or other material connection before publishing; no compensation or gift is offered by this package.
- Creator and Throughline each retain their pre-existing materials. Throughline receives no reuse right for a creator's output unless a separate written agreement says so.
- Generated support assets require provider rights, provenance, and disclosure review before use. Current-build captures must not show private data or credentials.
- No attribution, quote, testimonial, or endorsement is implied. A creator's independent judgment remains theirs.

## Contact gate

All contact, access provisioning, compensation, terms, publication, and follow-up require Mike's explicit exact-action approval. This workstream does not send messages or create accounts.
