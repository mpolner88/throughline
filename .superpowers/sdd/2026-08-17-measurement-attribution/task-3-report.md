# TL-DATA-001 Task 3 Report

**Status:** `COMPLETE — local implementation only; no deployment authorized or performed`
**Starting commit:** `4926af15b7a3baaa238e8a19f649e4de570a389c`
**Production changes:** None authorized

## Scope

- Enforced the Task 2 attribution contract at the `POST /events` API boundary.
- Added focused API provider-mock coverage without changing routes or response shapes.
- Updated the PostHog projection to omit first-party correlation keys.
- Did not query production, deploy functions, alter a migration, or change any Mike-gated surface.

## TDD evidence

Red tests were added first. The initial Deno run failed because the PostHog event row lacked server attribution fields and the API request handler was not testable from a focused provider-mock test. After the minimal implementation, the contract, PostHog, and API tests pass.

## Implementation

- Authenticated event requests resolve the service-only internal-user allowlist once. A confirmed hit stores `true`; a confirmed miss stores `false`; anonymous and service traffic stores `null`.
- Allowlist lookup failures return a retryable `503`; they never classify the request as external.
- Schema-v2 recording references are validated against the authenticated recording owner before event persistence. Unowned references receive `403`; lookup failures receive `503`.
- Legacy schema-v1 events continue to persist as schema v1, `unknown` distribution, and a null recording reference.
- Persisted events use the normalized schema, channel, sanitized properties, server-derived internal classification, and only an ownership-validated first-party recording reference.
- PostHog receives only contract-sanitized properties and server attribution categories. It no longer receives a session property and never receives a recording reference, raw account identifier, or raw session identifier.

## Verification

- Deno contract, PostHog, and focused API provider-mock tests: 16 passed, 0 failed.
- Extraction tests: 3 passed, 0 failed.
- Product-report tests: 2 passed, 0 failed.
- Deno type check of the API entrypoint: passed.
- Targeted Deno format checks: passed for the shared contract/PostHog files and focused API test.
- Targeted Deno lint: passed after excluding three rules with confirmed pre-existing API-file debt (`no-explicit-any`, `no-extra-boolean-cast`, and `require-await`). The starting API file itself has 46 Deno lint findings and is not Deno-formatted; full-file reformatting is outside this bounded enforcement slice.
- `git diff --check`: passed.
- Reviewed serialized PostHog request tests, the focused provider mocks, and the exact Task 3 diff. No real identifiers, credentials, or user content were added; fixtures use synthetic test values only.

## Review and handoff

Self-review found no route/response change, no client-controlled internal classification, no fallback from an allowlist error to external, and no first-party correlation key in the PostHog body. Independent privacy/security review remains required before a later deployment task; this task performed no deployment.
