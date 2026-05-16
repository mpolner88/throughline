# Spec Review Checklist

Use this checklist before a spec enters implementation.

## Product

- The target user is specific.
- The core user loop is described end to end.
- Non-goals are explicit.
- Pricing, limits, and free/demo behavior are clear.
- Open questions are separated from decisions.
- Acceptance criteria are testable.

## Design

- Brand rules are reflected in the UI.
- The first-run flow shows the product value before asking too much.
- Empty, loading, failure, and limit states are specified.
- Copy follows the brand voice.

## Technical

- Platform constraints are named.
- Auth and token behavior are specified.
- Data model fields have clear ownership and validation rules.
- Background jobs and retries are described.
- External API failures have fallback behavior.
- Cost assumptions are backed by rough usage math.
- Security and privacy risks are named.

## Build readiness

- The riskiest spike is first.
- The implementation sequence is ordered by uncertainty, not visual polish.
- Tests or manual acceptance checks are listed.
- Out-of-scope items are protected from drift.

