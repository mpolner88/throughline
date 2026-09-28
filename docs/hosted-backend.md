# Hosted backend runbook

**Last verified:** 2026-08-23 by local source, disposable-database/API tests, the independently reviewed [frozen TL-EVAL rollout package](evidence/2026-08-22-evaluation-rollout-package.md), the live flags-off [TL-EVAL production rollout](evidence/2026-08-23-evaluation-production-rollout.md), and the separate [production lineage-write behavior canary](evidence/2026-08-23-evaluation-lineage-behavior-canary.md).
**Current architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) is the factual runtime and data-flow map. [CURRENT_STATE.md](CURRENT_STATE.md) records the date-stamped live-fact boundary and release caveats.

This document contains operating procedures: configuration, deployment, health/canary checks, and retention. It does not establish that a provider configuration, function deployment, App Store state, or scheduled retention job is current.

Throughline uses Supabase as the hosted backend.

```text
iPhone app -> Supabase Edge Function -> Supabase Postgres/Storage -> Groq
                                           |
                                           -> MCP memory endpoint
```

The deployed Edge Function sources are in `supabase/functions`. See [ARCHITECTURE.md](ARCHITECTURE.md) for the component boundaries and data flow.

## What Supabase Owns

- Postgres tables for recordings and feedback.
- Private Storage bucket for audio.
- Edge Function `api` for app uploads, transcription, extraction, feedback, and note reads.
- Edge Function `mcp` for read-only agent memory tools.
- Project secrets for private keys such as `GROQ_API_KEY`.

## Prepare Database

Confirm that the local checkout is linked to the intended Supabase project before applying migrations. The production project reference used by the current app configuration is `ywsenspsfyrdhgyxgcrv`.

Apply local migrations:

```bash
supabase db push
```

The migrations create:

- `public.throughline_recordings`
- `public.throughline_feedback`
- private Storage bucket `throughline-audio`
- RLS enabled on the Throughline tables, with direct `anon` and `authenticated` table access revoked

The app does not put the Supabase service role key or Groq key on-device. The Edge Functions keep those private.

## Configure Secrets

Supabase Edge Functions already receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. Set only the app-specific secrets:

```bash
supabase secrets set \
  GROQ_API_KEY=... \
  THROUGHLINE_API_TOKEN=... \
  THROUGHLINE_AUDIO_BUCKET=throughline-audio \
  THROUGHLINE_AUDIO_RETENTION_DAYS=30 \
  THROUGHLINE_USER_ID=dev-user
```

`THROUGHLINE_API_TOKEN` is a backend service token for maintenance and dogfood scripts. Release iOS builds do not include it.

Optional MCP-specific token:

```bash
supabase secrets set THROUGHLINE_MCP_TOKEN=...
```

If `THROUGHLINE_MCP_TOKEN` is absent, the MCP endpoint uses `THROUGHLINE_API_TOKEN`.

The frozen flags-off TL-EVAL candidate additionally requires the private-artifact secret and non-secret reconciliation settings below. Do not put the secret value in a rollout manifest or tracked evidence. Keep all three evaluation behavior flags and compatibility mode unset during this infrastructure rollout.

```bash
supabase secrets set \
  THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN=... \
  THROUGHLINE_PRIVATE_ARTIFACT_PREFIX=evaluation-artifacts \
  THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS=3600 \
  THROUGHLINE_EVALUATION_ARTIFACT_RECONCILIATION_LIMIT=100 \
  THROUGHLINE_EVALUATION_ARTIFACT_CLAIM_TTL_SECONDS=300
```

The API derives the deletion endpoint as the exact same-project `/functions/v1/private-artifact-delete` route. If `THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL` is set, any different origin, path, query, fragment, or embedded credential fails closed.

## Deploy Functions

The iOS client sends a Supabase Auth JWT after sign-in. We still deploy with Supabase JWT verification disabled because the function validates the JWT itself and also accepts the separate service token for maintenance scripts.

```bash
supabase functions deploy private-artifact-delete --no-verify-jwt --use-api --project-ref ywsenspsfyrdhgyxgcrv
supabase functions deploy api --no-verify-jwt --use-api --project-ref ywsenspsfyrdhgyxgcrv
supabase functions deploy mcp --no-verify-jwt --use-api --project-ref ywsenspsfyrdhgyxgcrv
```

For TL-EVAL, deploy `private-artifact-delete` first and record its actual provider function identity. The tracked Deno bundle is a reproducible local candidate, not a provider deployment identity. Run the content-free direct Edge/Storage preflight before applying the TL-EVAL migrations or deploying the API candidate. The end-to-end API reconciliation phase runs only after the exact migrations and flags-off API candidate exist.

App backend URL:

```text
https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api
```

MCP endpoint:

```text
https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/mcp
```

## Health and canary checks

Run these checks after deployment and record the result in the relevant slice evidence or release manifest. A documented command and expected response do not prove a current production deployment.

```bash
curl https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "throughline-supabase-edge-api",
  "storage": "supabase",
  "auth_required": true,
  "authenticated": false,
  "transcription": "groq"
}
```

Authenticated check:

```bash
curl \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/recordings
```

## iPhone Setup

Open Throughline:

1. Sign up or sign in.
2. Record a short note.
3. Wait for the transcript and note preview.
4. Open settings only when you want to connect an agent or manage the account.

## MCP Setup

The deployed `mcp` Edge Function exposes the same read-only memory tools as the local stdio MCP server:

- `get_today`
- `get_daily_loop`
- `get_recordings`
- `get_recording`
- `search`
- `list_open_todos`
- `get_recent_reflections`
- `get_energy_patterns`
- `get_balance_snapshot`

It accepts MCP-style JSON-RPC over HTTP. Agents that support remote MCP with custom bearer headers can use the deployed endpoint. The iOS app exposes this as `settings -> connect an agent`, where the user can mint a read-only MCP token and copy a Claude Code or Codex CLI setup command.

See [agent-connect.md](agent-connect.md) for copy-paste setup commands and the starter agent prompt.

Agents that do not yet support authenticated remote MCP can still use:

```bash
npm run mcp:stdio
```

That local MCP server reads the same Supabase data when `.env.local` points at Supabase.

## Audio Retention

Audio objects are retained separately from transcripts and structured notes. To enforce the 30-day audio retention posture before App Store submission, schedule the protected maintenance endpoint:

```bash
curl -X POST \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/maintenance/audio-retention
```

With evaluation retention disabled, the endpoint deletes stored audio objects older than `THROUGHLINE_AUDIO_RETENTION_DAYS` and marks their recording audio metadata as expired. Transcripts and structured notes remain available to the app and MCP tools.

The evaluation-aware code and schema foundation are deployed, but all evaluation behavior controls remain absent/off. Before enabling evaluation retention or any real private materialization, configure and separately govern all of the following:

```text
THROUGHLINE_EVALUATION_RETENTION_ENABLED=true
THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE=<exact rollout cutover timestamp>
THROUGHLINE_EVALUATION_RETENTION_CLAIM_TTL_SECONDS=300
THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN=<service credential>
THROUGHLINE_PRIVATE_ARTIFACT_PREFIX=evaluation-artifacts
THROUGHLINE_EVALUATION_ARTIFACT_STALE_SECONDS=3600
THROUGHLINE_EVALUATION_ARTIFACT_RECONCILIATION_LIMIT=100
THROUGHLINE_EVALUATION_ARTIFACT_CLAIM_TTL_SECONDS=300
```

`THROUGHLINE_EVALUATION_RETENTION_ELIGIBLE_SINCE` is the verified rollout boundary, not an extended-retention deadline. Only an active contribution created under the current disclosure at or after that boundary can protect still-available audio beyond the ordinary 30 days. The exception lasts only while that contribution remains active. Legacy feedback and historical grades never protect audio.

The private-artifact Edge function accepts an authenticated `POST` containing only `materializer_receipt_sha256` and returns either `{ "status": "deleted", "deleted_count": <positive integer> }` or `{ "status": "not_found", "deleted_count": 0 }`. It derives the exact `throughline-audio/evaluation-artifacts/<receipt>` prefix, recursively lists it, deletes in bounded batches, confirms the prefix is empty, and preserves siblings. Do not enable evaluation retention or private materialization until it is reachable from the API Edge Function and the hosted synthetic deletion canary passes.

The current production-target implementation is [private-artifact-delete/index.ts](../supabase/functions/private-artifact-delete/index.ts), configured by the `[functions.private-artifact-delete]` stanza in [supabase/config.toml](../supabase/config.toml). The offline materializer uploads immutable objects to the same fixed Storage prefix, reserving the receipt before publication and committing the database corpus only after publication succeeds. Both the server and materializer reject more than 249 cases so the worst-case receipt remains below the function's 1,000-object bound.

The older commands below verify the historical local-filesystem/container boundary only. They do not satisfy the hosted Supabase Edge/Storage canary gate:

```bash
node scripts/verify-evaluation-artifact-canary.mjs --contract-only
npm run eval:artifact-canary
```

The required hosted canary uses generated receipt hashes and synthetic bytes only. It has two ordered proofs and refuses to run unless both `--execute-hosted` and `THROUGHLINE_EVALUATION_HOSTED_CANARY_AUTHORIZED=true` are present. It is fixed to the approved Throughline Supabase project, bucket, prefix, and 3,600-second stale contract; it never accepts a caller-selected URL or Storage scope.

After deploying `private-artifact-delete`, run the direct deletion Edge to Storage preflight. This phase requires the local service-role and deletion credentials but does not create a registry row:

```bash
THROUGHLINE_EVALUATION_HOSTED_CANARY_AUTHORIZED=true \
  npm run eval:hosted-artifact-canary -- \
  --execute-hosted --phase edge-preflight
```

After applying the exact TL-EVAL migrations and deploying the API with every evaluation behavior flag still off, prepare the API-chain proof. The state path is restricted to the exact private temporary namespace, is created as mode `0600`, contains synthetic hashes only, and is removed after a successful exercise:

```bash
THROUGHLINE_EVALUATION_HOSTED_CANARY_AUTHORIZED=true \
  npm run eval:hosted-artifact-canary -- \
  --execute-hosted --phase prepare \
  --state-file /private/tmp/throughline-evaluation-edge-canary-rollout.json
```

Wait until the aggregate-only `wait_until` timestamp printed by `prepare`, then exercise API Edge to deletion Edge to Storage:

```bash
THROUGHLINE_EVALUATION_HOSTED_CANARY_AUTHORIZED=true \
  npm run eval:hosted-artifact-canary -- \
  --execute-hosted --phase exercise \
  --state-file /private/tmp/throughline-evaluation-edge-canary-rollout.json
```

The exercise proves target absence, sibling survival, terminal registry acknowledgment, deletion idempotency, privacy-safe aggregate output, and cleanup. The runner never prints receipt hashes, object paths, URLs, credentials, or raw hosted error bodies. Record the actual deployed function identities and both hosted results in release evidence. Local contract tests are not hosted evidence.

The separate lineage-write behavior canary uses one uniquely marked synthetic transcript and no audio. It refuses any pre-existing behavior flag or nonzero active eligibility, enables only lineage writes, requires complete immutable extraction lineage with no evaluation rows, recovers the synthetic record by its unique marker even after an ambiguous response, verifies cascade cleanup, and always unsets lineage before returning. It requires both execution locks and is fixed to the production project:

```bash
THROUGHLINE_LINEAGE_HOSTED_CANARY_AUTHORIZED=true \
  node --env-file=.env.local \
  scripts/verify-evaluation-lineage-canary.mjs --execute-hosted
```

A pass is not permission to leave lineage enabled for real traffic. Independently confirm all four behavior controls are absent, active eligibility is zero, and API health is green after the run. The 2026-08-23 execution passed and returned to the flags-off state; see the dated behavior-canary evidence.

Before any private materialization, install and verify a scheduled call to the service-only reconciler. Production uses [the tracked scheduler migration](../supabase/migrations/20260823062018_evaluation_artifact_reconciliation_schedule.sql), which installs one `pg_cron` job every 15 minutes and resolves its fixed endpoint and service token from Vault at execution time. The first live scheduled invocation returned HTTP `200` on 2026-08-23; see the [production rollout evidence](evidence/2026-08-23-evaluation-production-rollout.md).

Before the owner-controlled retention/evaluation canary, build the source-bound content-free package into the restricted private temporary namespace:

```bash
npm run eval:owner-canary-package -- \
  /private/tmp/throughline-evaluation-owner-canary-<label>.json
```

The package binds the exact local API, behavior-flag, iOS contribution/upload/UI, release privacy-manifest, and policy sources. It fixes the order as lineage, retention, evaluation writes, owner diagnostic grade, owner reviewed-fields correction, owner exact-preview readiness, owner withdrawal, and aggregate postflight. The package contains no grade, correction, readiness value, identifier, content, credential, or provider response and is created mode `0600`. Rebuild it after any bound-source change; its verifier rejects drift or tampering.

The recording owner must personally perform every judgment action. Agents must not accept grade, correction, readiness, transcript, note content, or recording identifiers as package inputs. Retention must be enabled and verified before evaluation writes. If a failure occurs before active eligibility, use the stable rollback with all three behavior flags off. At or after active eligibility, use only retention-aware compatibility until withdrawal and cleanup are verified.

The current package is local preparation, not hosted readiness or execution evidence. Before enabling a flag, independently recheck source identities, all behavior controls absent, active eligibility zero, authenticated API health, the retention-aware rollback target, and the current private deletion/reconciliation paths. Policy publication, App Store changes, binary release, real private-audio materialization, and independent provider execution remain separate gates.

```bash
curl -X POST \
  -H "Authorization: Bearer $THROUGHLINE_API_TOKEN" \
  https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api/maintenance/evaluation-artifact-reconciliation
```

The reconciler claims stale pending receipts atomically, deletes only the receipt prefix through the sibling Edge function, acknowledges exact deletion proof with the database-issued token, and releases failures for retry. Its response contains aggregate counts only.

Verify the installed schedule with [evaluation_artifact_reconciliation_schedule_test.sql](../supabase/tests/evaluation_artifact_reconciliation_schedule_test.sql) and confirm a matching `cron.job_run_details` success plus a `net._http_response` HTTP `200`. Inspect only aggregate response fields; never print scheduled headers, Vault values, request URLs, receipt hashes, or object paths.

Owner withdrawal uses `DELETE /recordings/{id}/evaluation-contribution` with a UUID `idempotency_key`. The API deletes source audio first, deletes receipt-scoped private artifacts second, and only then atomically appends the withdrawal and invalidation state. Recording and account deletion use the same artifact cleanup before database cascade. A non-404 cleanup failure returns `503 evaluation_withdrawal_retryable`; the contribution remains active and retryable. Responses and maintenance results contain aggregate counts and safe error codes only.

When evaluation-aware retention is enabled, maintenance uses the service-only database selector:

- `active_current_contribution`: keep the audio and count it as protected;
- `historical_or_no_active_contribution`: apply the ordinary 30-day deletion;
- `eligibility_ended`: delete audio and private artifacts, invalidate the corpus, then expire audio metadata.

Deletion workers do not act directly on selector output. They atomically claim a bounded batch with a database-issued UUID token, perform Storage and private-artifact deletion outside the database transaction, and finalize only with that exact token. A live or expired-but-unreclaimed claim blocks creation of a new eligible contribution; expiry permits only another service worker to replace the token atomically. Failures release the exact claim when possible, and an abandoned claim becomes reclaimable after the bounded TTL. No database lock is held across an external HTTP call, and responses remain aggregate-only.

## Evaluation compatibility and rollback

The local evaluation build accepts `THROUGHLINE_EVAL_COMPATIBILITY_MODE=stable|retention_aware`. Leave it unset for the ordinary feature-flagged candidate. Both explicit compatibility modes disable new lineage and evaluation writes regardless of the individual write flags.

- `stable` also disables evaluation retention and is accepted only when the service-only active-eligibility aggregate is exactly zero. A missing, malformed, or nonzero count fails closed.
- `retention_aware` keeps evaluation retention, contribution withdrawal, note deletion, account deletion, and maintenance cleanup active while new lineage and evaluation writes stay disabled.

The compatibility mode and the three behavior flags remain unset/off in production until the separately governed TL-EVAL rollout. Build and verify the retention-aware target before enabling the first eligible contribution.

Rollback warning: before any eligible contribution exists, the evaluation flags may return to the verified stable API. After the first eligible contribution exists, only a retention-aware compatibility build may be used; a retention-unaware rollback could delete protected audio or strand private artifacts.

## App Store Direction

The Release iOS config leaves `THROUGHLINE_API_TOKEN` empty. Users authenticate with Supabase Auth, and the Edge Function derives the user id from the Supabase JWT. Keep the service token only for backend maintenance and dogfood scripts.
