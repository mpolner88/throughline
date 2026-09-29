# TL-EVAL-001 contract and private-plumbing evidence

**Verified:** 2026-08-22  
**Scope:** local source and synthetic-only execution  
**Production mutation:** none

> Current-package note: this evidence remains the foundation record, but its earlier bundle identities and test totals are superseded where they conflict by the [frozen hosted rollout package](2026-08-22-evaluation-rollout-package.md).

## Verified outcomes

- Production inference is represented by one immutable contract covering provider, transcription and extraction models, request configuration, exact prompt bytes, canonical schema, normalizer rules, and content hashes.
- The approved production prompt remains byte-identical at SHA-256 `c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135`.
- API and offline extraction normalization now consume the same implementation. The characterization fixture remained byte-for-byte stable.
- Private prediction input contains verified audio metadata and the inference-contract hash, but excludes split, expected output, reference paths, labels, and receipts.
- The adapter worker runs in a fresh mode-0700 temporary directory under a Deno permission boundary. An adversarial adapter was denied reference-file access before it could emit output.
- Prediction bundles are sealed before scoring. Labels remain closed until active-membership revalidation succeeds.
- Diagnostic grades, reviewed fields, and accepted full outputs use separate denominators. Synthetic manifests return `insufficient_sample_size` with `winner: null` and cannot emit a quality result.
- Legacy golden fixtures now report `plumbing_only: true` and `plumbing_pass`; they cannot emit `pass: true` or support a model-quality claim.
- A disposable Postgres 17 rebuild applied the complete history plus the additive lineage schema. Nine service-only RLS tables, four recording pointers, indexed foreign keys, immutable ledgers, and privacy-safe cascade deletion passed pgTAP.
- The atomic processing RPC persists the exact contract, finalized operation, ordered attempts, and a successful original revision together. Replay is idempotent, and failed operations create no fake revision.
- The API path is off by default behind `THROUGHLINE_LINEAGE_WRITES_ENABLED`. Its isolated on-state test persisted one extraction attempt, one operation, and one complete 14-field original revision before exposing the processed note.
- Provider retries create distinct attempts, and raw provider response bodies are excluded from lineage payloads and error strings.
- Owner evaluation and current-correction contracts are implemented locally behind `THROUGHLINE_EVALUATION_WRITES_ENABLED`, which is off by default. Service tokens cannot submit human evaluations; the server derives the owner, exact current revision, processing operation, contribution eligibility, and correction mask.
- Readiness acceptance is false by default and requires a complete, ordered 14-field preview sealed to the exact revision, canonical payload, production schema, normalizer, and keyset. Any drift fails closed.
- Atomic owner mutation and evaluation RPCs lock the recording, reject stale revisions, replay the same idempotency key safely, keep optional explanation text in quarantine, and advance visible note state only with its immutable revision.
- The active corpus lifecycle is implemented locally as a service-only two-phase prepare/commit RPC. The database derives the active contribution set, eligibility, stable split, label class, exact contract bindings, and source-set hash; callers cannot provide case IDs, contribution IDs, splits, labels, or case lists.
- The offline materializer downloads only the database-derived private audio objects, verifies every source hash, writes mode-0600 artifacts under a mode-0700 private root, emits a receipt-bound private manifest, and rejects an authoritative commit receipt mismatch.
- Post-prediction revalidation re-derives active membership and fails closed when a contribution is withdrawn after prediction. Real private materialization still requires an explicit command flag and a separate authorization environment gate and was not executed.
- The existing action-item compatibility route now appends a complete immutable `action_state` revision when the local evaluation flag is enabled. It changes only canonical todo workflow status, creates no evaluation contribution, and retains the legacy persistence path when the flag is off.
- Retention-aware privacy deletion is implemented locally behind `THROUGHLINE_EVALUATION_RETENTION_ENABLED`, which remains off by default. The service-only selector protects only active current-disclosure contributions created at or after the configured rollout boundary; legacy feedback and historical/no-active contributions follow the ordinary 30-day path.
- Owner withdrawal deletes source audio, then receipt-scoped registered private artifacts, then atomically appends withdrawal, invalidation, and raw-artifact-deletion events. Non-404 deletion failures return the stable retryable code without committing withdrawal. Unmaterialized contributions remain removable without inventing an artifact receipt.
- Note and account deletion reuse the same artifact cleanup before database cascade. API failure logs redact recording identifiers, and retention responses expose aggregate counts and safe codes only.
- Retention maintenance now claims a bounded database row before external deletion, performs Storage and private-artifact work without holding a database lock, and finalizes or releases only with the exact database-issued token. Any unfinalized claim, including an expired but not yet reclaimed claim, blocks new eligible contributions.
- Claim acquisition uses a parent-row `FOR UPDATE SKIP LOCKED` pass followed by a second-statement READ COMMITTED eligibility recheck under the held lock. An actual two-session race proved that a contribution committing across the first snapshot remains protected and produces zero deletion claims.
- A local compatibility matrix now defaults every new behavior flag off. Explicit `retention_aware` mode forces lineage/evaluation writes off while retaining withdrawal, note/account deletion, and maintenance; explicit `stable` mode is refused unless the service-only active-eligibility aggregate is exactly zero.
- The resolved local API dependency graph contains eleven repository source files. A canonical JSON manifest of sorted relative path/source-SHA pairs plus mode produced flags-off candidate identity `d03c8fde09f33f09a1cc42c38852814035d870063255d88acca76cfd904a4788` and retention-aware compatibility identity `0698924aeea892f31c59ae8ec66c31e2728630ec506fdd1a492f161d10a5d883`. These are local source identities, not Supabase deploy-bundle or live-function digests.
- The weekly JSON/Markdown report and founder dashboard now emit aggregate-only complete-lineage coverage, diagnostic and reviewed-field denominators, full-contract independent-prediction coverage, lifecycle/retention/quarantine counts, and a fail-closed integrity gate. Missing evaluation sources remain coverage gaps, and no winner can appear without every complete-schema, preview, isolation, sealing, currentness, and revalidation attestation.

## Verification matrix

- Core inference-contract and normalization tests: 10 passed, 0 failed.
- Private manifest, isolation, runner, scorer, and offline materializer tests: 14 passed, 0 failed.
- Full integrated Deno contract sweep across the API, lineage, owner evaluation, corpus, retention, claim compatibility, PostHog, and event contracts: 66 passed, 0 failed. The API suite itself passed 19 tests; the new flag and compatibility suites passed seven.
- Provider-attempt and processing-lineage tests: 4 passed, 0 failed.
- Database-lineage payload validator tests: 4 passed, 0 failed.
- Owner evaluation, readiness, and note-revision contract tests: 8 passed, 0 failed.
- Service-only corpus materialization and revalidation contract tests: 6 passed, 0 failed.
- Retention selection, ordered deletion, retry, idempotency, and unmaterialized-withdrawal contract tests: 5 passed, 0 failed.
- Disposable schema/security/immutability tests: 31 passed, 0 failed.
- Disposable atomic processing RPC tests: 7 passed, 0 failed.
- Disposable atomic owner mutation/evaluation/action-state RPC tests: 16 passed, 0 failed.
- Disposable corpus prepare/commit/revalidation RPC tests: 9 passed, 0 failed.
- Disposable retention/withdrawal/invalidation RPC tests: 15 passed, 0 failed.
- Fresh PostgreSQL 17 exact-once replay of every migration plus the six current evaluation/retention suites: 122 passed, 0 failed (31 schema/security, seven processing, sixteen owner mutation/evaluation, nine corpus, fifteen retention, and forty-four claim/finalize/rollback assertions).
- Independent two-session database race: a contribution transaction held the parent row while maintenance began; after commit, the second-statement recheck returned zero claims, the claim token remained null, and the active-eligibility aggregate was one.
- Integrated Node contract, isolation, private-evaluation plumbing, and report suites: 39 passed, 0 failed.
- Weekly product/quality report suite: 15 passed, 0 failed; report and dashboard generators passed syntax checks, structural dashboard packaging passed, and the serialized privacy scan found no private sentinels, hashes, credential patterns, or UUID-shaped values.
- `npm run eval:plumbing`: passed on 30 historical plumbing fixtures plus one synthetic isolated case.
- Synthetic empty quality run: exited nonzero with `insufficient_sample_size`, `winner: null`, and zero quality denominators.
- Receipt-root materializer regression: 2 passed, 0 failed; the complete synthetic private tree was sealed under its receipt-addressed root and an unrelated sibling survived.
- Trusted deletion service: 9 passed, 0 failed; its unprivileged container built locally.
- Disposable PostgreSQL/PostgREST/service canary: 8 of 8 checks passed on three consecutive clean central runs after a missing unique volume name was caught by central review and regression-fixed. Cleanup left zero matching containers, networks, volumes, or temporary directories. Evidence: [artifact-deletion canary](2026-08-22-evaluation-artifact-deletion-canary.md).

## Explicit limits

- No real user audio, transcript, note, feedback text, raw identifier, or credential was read, written to tracked evidence, or sent to a provider.
- Real private-audio network execution remains locked because provider/data-use authorization is a separate Mike decision.
- The lineage, retention, and claim migrations and API path have not been deployed. All three local behavior flags are off by default and compatibility mode is unset. Owner mutation/evaluation, corpus prepare/commit/revalidation, withdrawal, invalidation, retention, claim/finalize/release, and compatibility RPCs are implemented only in local source and disposable databases.
- The trusted receipt-scoped private-artifact deletion service is implemented and passes a real disposable local PostgreSQL/PostgREST/container canary, but it is not hosted, configured, or deployed. The local API still fails closed for materialized withdrawals until a production-grade service is reachable from the Edge Function; evaluation retention must not be enabled before that separate reachability canary passes.
- The local Supabase CLI printed a complete migration replay but then restored a stale local snapshot whose migration ledger claimed versions that its schema had not applied. The retention source was therefore replayed directly into the disposable database before the 78-assertion evaluation/retention sweep. This is a local harness gap; it is not production rollout evidence.
- Docker-backed PostgreSQL/PostgREST verification is now available for the synthetic artifact-deletion boundary. The claim RPC gate still uses a fresh PostgreSQL 17 cluster with minimal empty Supabase role/schema stubs, exact-once migration replay, pgTAP, and a real two-session race; neither local path is hosted deployment proof.
- Browser interaction for the new dashboard section remains unverified because Chromium headless-shell is unavailable; the generator, schema/package validation, source tests, and privacy scan passed.
- The compatibility hashes above identify resolved local sources and mode inputs only. A reproducible local Deno runtime bundle is recorded in the artifact-canary evidence, but the actual Supabase deploy-bundle digest and function version remain provider-generated rollout evidence; do not substitute the local bundle or source identity for live-function evidence.
- The offline materializer has not been run against real private data. No private corpus receipt, independent prediction bundle, or quality result exists.
- The action-item route remains a compatibility path, but its local feature-gated branch now appends immutable non-eligible action-state history. It is undeployed.
- No independent model-quality result exists yet, and no provider or base-model change is authorized.
