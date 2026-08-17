# Throughline Measurement Attribution Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development`, `superpowers:test-driven-development`, and `superpowers:verification-before-completion` task by task. Use the repository Supabase and Postgres guidance for schema work.

**Goal:** Make post-cutover processing measurement decision-grade by separating distribution/internal cohorts and reconciling events with durable recordings, without exposing content or identifiers.

**Slice:** [Measurement Attribution and Reconciliation](../../slices/measurement-attribution.md)

**Control:** Begin from the approved [1.0.4 / API v22 provenance closure](../../releases/2026-08-17-ios-1.0.4-2026081602-provenance.md). Preserve unrelated dirty work and keep the index empty between tasks.

## Global constraints

- Follow the order `migration -> API -> app -> private allowlist -> aggregate report interpretation`.
- Write failing tests before each behavior change and obtain an independent review before starting the next task.
- Never commit emails, account/session/recording identifiers, content, credentials, local configuration, query results, or generated private reports.
- Never forward `recording_id`, raw user ID, or raw session ID to PostHog.
- Unknown attribution stays unknown. Do not heuristically backfill external status or match legacy events by timestamp.
- Do not change onboarding copy/layout/flow, provider/model/prompt, data-use policy, pricing, limits, subscriptions, credits, or App Store state.
- A TestFlight upload or other App Store Connect action requires Mike's explicit approval after the local build and canaries pass.

## Task 1: Preserve the current measurement tools

**Files:**

- `package.json`
- `scripts/product-learning-report.mjs`
- `scripts/product-learning-report.test.mjs`
- `scripts/generate-product-dashboard.mjs`

1. Confirm the starting SHA-256 values: report `4faed6761516c8c1f446740a637225b0dd628c9bc997c6674ac35745e98d5605`, report test `b2b005a44f42aa14086a8ff30405b8767c917e3505173ecaca47a6a4877cab65`, dashboard `2903007aeddee5349fd77c7c634babba90c253144800dbdd43a63df5872322b4`, and package `1156cf33595689a0bfb5ad1f11a19453a96dda2044f64f215f36d3ad654a2b0e`.
   The frozen package delta intentionally preserves all six existing operator commands: `product:weekly`, `product:weekly:test`, `product:auth-canary`, `product:recording-canary`, `product:dashboard`, and `extraction:test`. The canary and extraction implementations were already preserved in the release-provenance slice; this task only makes their package entry points reproducible.
2. Run `npm run product:weekly:test` and syntax-check the dashboard generator.
3. Scan the four files for credentials, content fixtures, and retained identifiers.
4. Stage exactly the four files and commit `chore(measurement): preserve current reporting tools`.
5. Independently review hashes, tests, scope, and the pre-existing clean-tree link gap this commit closes.

## Task 2: Define and test the additive data contract

**Files:**

- Create a migration with `supabase migration new measurement_attribution`.
- Create `supabase/tests/measurement_attribution_test.sql`.
- Create `supabase/functions/_shared/product-event-contract.ts`.
- Create `supabase/functions/_shared/product-event-contract_test.ts`.

1. Write failing contract tests for schema-v1 compatibility, allowed channel/version values, schema-v2 recording-reference rules, bounded property allowlists, and reserved identifier/content key removal.
2. Write database tests for the four event columns, channel/version checks, recording foreign key, partial FK index, service-only internal-user table, RLS, and least-privilege grants.
3. Add nullable `recording_id`, nullable `is_internal_user`, `distribution_channel default 'unknown'`, and `schema_version default 1` to product events. Add the service-only UUID allowlist without any account rows.
4. Require indexes for all new foreign keys. Existing rows remain v1/unknown/null.
5. Run Deno tests with caches outside the repository. Run the SQL tests in a disposable local database; if no verified database test runtime is available, stop before deployment and record the blocker rather than treating static inspection as execution.
6. Commit `feat(measurement): add attribution data contract`, then obtain independent schema/security review.

## Task 3: Enforce server-owned attribution and private correlation

**Files:**

- `supabase/functions/api/index.ts`
- `supabase/functions/_shared/product-event-contract.ts`
- `supabase/functions/_shared/product-event-contract_test.ts`
- `supabase/functions/_shared/posthog.ts`
- `supabase/functions/_shared/posthog_test.ts`
- Add focused API/provider-mock tests if extraction from the monolith is required.

1. Extend failing tests so forged client `is_internal_user`, schema, and reserved properties cannot override server values; serialized PostHog bodies contain no recording/account/session identifier anywhere.
2. Resolve allowlist membership once per authenticated event request. A lookup failure returns a retryable 5xx; it never defaults to external.
3. Validate each supplied recording reference against the authenticated recording owner. Accept legacy v1 events without a reference.
4. Store server-owned attribution and the validated private recording reference. Forward only sanitized properties plus server-owned channel/internal/version categories to PostHog.
5. Preserve existing route and response compatibility. Run contract, PostHog, extraction, and product-report tests.
6. Commit `feat(measurement): enforce server event attribution`, then obtain independent privacy/security review. Do not deploy in this task.

## Task 4: Add conservative iOS distribution attribution

**Files:**

- Create `ios/Throughline/Services/ProductEventAttribution.swift`.
- Modify `ios/Throughline.xcodeproj/project.pbxproj`.
- Modify `ios/Throughline/Services/UploadClient.swift`.
- Modify instrumentation only in `ios/Throughline/Views/HomeView.swift`.
- Modify instrumentation only in `ios/Throughline/Views/OnboardingView.swift`.
- Create `ios/Tests/ProductEventAttributionTests.swift`.
- Create `ios/Tests/ProductEventCodingTests.swift`.

1. Write failing tests for debug, Xcode, sandbox, production, unverified/error, legacy queued-event decoding, and schema-v2 round trips.
2. Classify verified StoreKit environments conservatively. Never use the result for authorization or entitlements.
3. Keep new queued-event fields optional for decoding. New events emit schema v2.
4. Send `recording_id` as a top-level field for uploaded/processed outcomes and for failures after a durable recording exists. Never put it in generic properties.
5. Do not change onboarding copy, layout, navigation, or timing.
6. Run standalone Swift tests and an unsigned Release build from a clean export with caches under `/private/tmp`.
7. Commit `feat(measurement): attribute iOS processing events`, then obtain independent code and no-UI-change review.

## Task 5: Reconcile aggregates and isolate cohorts

**Files:**

- `scripts/product-learning-report.mjs`
- `scripts/product-learning-report.test.mjs`
- `scripts/generate-product-dashboard.mjs`
- `product/metrics.md`

1. Add failing report tests for all five cohorts; matched, event-only, durable-only, mismatch, duplicate, and legacy populations; and exclusion of every identifier from serialized output.
2. Fetch only the private fields required for an in-memory join. Never emit a row-level result.
3. Never heuristically join legacy data. Only external, non-internal, App Store, schema-v2, correctly reconciled outcomes may enter the public-baseline population.
4. Keep the August 17 snapshot labeled mixed and legacy; the first honest baseline begins after cutover.
5. Run report and dashboard tests and scan outputs for identifiers/content.
6. Commit `feat(measurement): reconcile processing outcomes`, then obtain independent analytics/privacy review.

## Task 6: Verify migration and API rollout

**Files:**

- Create a dated deployment evidence record under `docs/releases/`.
- Narrowly update `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, and `docs/hosted-backend.md` only after verified state changes.

1. Re-run the full local suite, database tests, an unsigned clean-tree iOS Release build, and an authenticated local event-ingestion smoke.
2. Confirm rollback targets: API v22 commit `5d1fc2f` and the pre-migration nullable/default behavior.
3. Apply the additive migration, then deploy the backward-compatible API. Record exact migration, function version/digest, source commit, tests, canaries, and rollback evidence without secrets.
4. Run controlled authenticated legacy-v1 and schema-v2 canaries. Require correct database attribution, valid owner link, and no raw identifier in PostHog.
5. If any canary fails, revert the API behavior and leave the additive nullable columns in place for diagnosis.
6. Commit `docs(measurement): record attribution rollout`, then obtain independent deployment-evidence review.

## Task 7: Confirm internal accounts and prepare TestFlight evidence

**Files:**

- No account identifier or email is committed.
- Add only content-safe aggregate evidence to the dated rollout record and current state.

1. Ask Mike to privately confirm the two accounts before adding their UUIDs to the service-only allowlist. Do not infer ownership from an email string.
2. Backfill `is_internal_user = true` only for events owned by those confirmed accounts. Leave every other historical row nullable.
3. Run one controlled founder dogfood recording and require 100% attribution/reconciliation.
4. Produce the clean signed-build handoff and exact TestFlight canary checklist. Stop for Mike's explicit approval before any upload or App Store Connect action.
5. After an approved TestFlight build is exercised, require 100% controlled-canary reconciliation before closing the slice. External App Store behavior remains unmeasured until a later public build.

## Whole-slice acceptance

- Controlled canaries are 100% attributed and reconciled.
- Internal dogfood, external TestFlight, external App Store, debug, unknown, and legacy populations are never combined.
- No content or raw identifier enters PostHog, reports, dashboards, commits, or release evidence.
- Old clients remain compatible and unknown history is not fabricated.
- Onboarding and every Mike-gated product surface remain unchanged.
- Independent review finds no Critical or Important issue.
