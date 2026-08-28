# DISC-04 Privacy-Safe Pilot Tracking Schema

**Prepared:** 2026-08-27
**Status:** `planned`; this is a schema, not a record of outreach or results.

## Allowed Fields

| Field | Allowed value | Purpose |
| --- | --- | --- |
| `review_id` | `CR-01` through `CR-12` | Stable local review key; never a platform identifier. |
| `category` | agent builder, MCP educator, voice workflow, PKM | Cohort mix. |
| `public_source_class` | blog, public profile, public video, community page | Evidence provenance. |
| `approval_state` | not_reviewed, approved_for_exact_action, deferred, declined | Mike decision state. |
| `outreach_state` | not_sent, sent_by_mike, follow_up_approved, closed | Manual action state. |
| `response_category` | none_recorded, positive_trial_intent, decline, needs_clarification, no_response | Aggregate stage count only. |
| `trial_state` | not_offered, approved_offer, accepted, completed, stopped | Controlled proof state. |
| `content_state` | none_recorded, independent_review_possible, disclosed_output_observed, rights_pending | No claim that content exists. |
| `campaign_label` | pending_verification or a Mike-approved source label | Attribution mapping. |
| `attributed_aggregate_availability` | unavailable, threshold_qualified, pending | Apple reporting boundary. |
| `feedback_code` | code from the taxonomy | Coded learning. |
| `next_action` | a bounded approval or measurement step | Keeps the queue inspectable. |

## Prohibited Fields

Do not record names beyond the public display label already in `prospect-review.csv`, direct-contact details, account credentials, access tokens, correspondence body, raw product feedback, audio, transcript, note text, raw user identifiers, raw session identifiers, inferred demographics, or a platform handle as an analytics key.

## Stage Rules

1. `not_sent` is the default and remains so until Mike manually takes an exact approved action.
2. `no_response` is not product rejection, audience rejection, or permission for additional contact.
3. One coded response is a signal, not a trend.
4. A second follow-up requires a separate Mike approval; the standard pilot cap is one approved follow-up at most.
5. Attribution is only `threshold_qualified` when Apple exposes the aggregate. Do not derive it from a click, post view, or reply.
6. Public App Store and internal/TestFlight cohorts stay separate.

## Aggregate Readout Shape

| Reporting window | Approved exact actions | Sent by Mike | Trial accepted | Completed | Content observed | Apple attribution | Coded themes | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Not started | 0 | 0 | 0 | 0 | 0 | unavailable | none | `planned`; no outcome is claimed. |

The first decision-ready readout must pair threshold-qualified first-time downloads with the same-window aggregate `auth_succeeded` proxy and, when coverage permits, non-demo first value. It must state that this is not a matched conversion rate.
