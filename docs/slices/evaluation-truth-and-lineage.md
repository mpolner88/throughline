# Evaluation Truth and Immutable Lineage Slice

**Backlog state:** `approved_for_build`
**Slice phase:** `canary`
**Progress:** Production foundation, lineage canary, owner iOS/privacy controls, source-bound owner-canary package, API v30 hosted preflight, and valid internal TestFlight delivery are complete; installation and owner retention/evaluation execution remain pending.
**Selected:** 2026-08-17
**Backlog:** `TL-EVAL-001`
**Program:** [Core Quality and Learning](../programs/core-quality-learning.md)
**Verified control:** 2026-08-28; [current state](../CURRENT_STATE.md), [Home rollback internal delivery](../evidence/2026-08-28-home-ui-rollback.md), [owner-canary production preflight](../evidence/2026-08-23-evaluation-owner-canary-preflight.md), [production lineage behavior canary](../evidence/2026-08-23-evaluation-lineage-behavior-canary.md), [local iOS/privacy controls](../evidence/2026-08-23-evaluation-ios-privacy-controls.md), and [owner-canary preparation](../evidence/2026-08-23-evaluation-owner-canary-preparation.md)
**Runtime dependency:** `TL-DATA-001`, the flags-off TL-EVAL foundation, the bounded lineage behavior canary, the source-bound owner-canary package, the byte-verified API v30 preflight, and `VALID` internal TestFlight build `2026082801` visible to `Internal QA` are complete. Installation and owner retention/evaluation execution remain pending and must preserve the package's ordered canary and rollback contract below.

## User problem

Throughline cannot honestly say whether transcription or extraction is improving. The current evaluator can copy expected output into predictions, processed recordings lack immutable attempt and contract lineage, and note edits overwrite the model's original result. At the same time, the product needs a narrow, reversible way for the recording owner to contribute a grade or real content correction to private quality evaluation without turning normal use, old feedback, or free text into a corpus.

## Evidence-backed baseline

The 2026-08-17 [current-state record](../CURRENT_STATE.md) verifies from local source that:

- feedback is stored but not consumed;
- edits overwrite originals;
- recording rows do not preserve immutable transcription/extraction attempts or exact model and prompt attribution; and
- the extraction evaluator self-copies expected output when predictions are absent.

The production extraction prompt and historical eval prompt are different. Production prompt bytes remain unchanged in this slice's first runtime task and are locked to SHA-256 `c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135`. The historical eval prompt SHA-256 `5e6781339777bf3d1e080088d405243a044efc891f4852b50824910adf449321` records drift; it is not the replacement production contract.

## Outcome

Every new recording-processing operation will have an immutable resolved inference contract, separate transcription and extraction attempts including retries, private first-party input/output snapshots, safe failures, usage/cost when available, and an immutable original model revision. User content corrections and action-state changes will create later revisions without destroying the original.

The recording owner can save an idempotent 1–5 grade or a material note-content correction under the current contextual disclosure. The server, not the client, derives whether that action is eligible for private evaluation and extended audio retention. Optional explanations remain in a separately protected quarantine and never enter scoring, candidates, promotion evidence, analytics, fixtures, or tracked artifacts.

An honest private benchmark will begin from a service-materialized audio-to-task manifest, create predictions inside a Deno runtime-enforced input-only permission sandbox without exposing expected outputs to the adapter, and reject incomplete, stale, revoked, copied, leaking, or mismatched runs. Real manifests cannot be hand-authored. Grade-only diagnostics, reviewed-field corrections, and explicitly accepted full-output labels remain distinct; the original model output is never reused as a challenger reference merely because its owner graded it. Full-output truth derives from the frozen shared production schema and normalizer—not the smaller editable field list—and must be complete, schema-valid, owner-inspected, and contract-hash-matching. Golden copying remains plumbing only.

## Contribution and evaluator boundary

- The user who recorded a note is the only human evaluator for that note. A service-token request cannot submit a human evaluation.
- Only explicitly saving a 1–5 grade or a material canonical content-fingerprint change under the current disclosure creates eligibility.
- Opening a note, completing or reopening an action, inactivity, a no-op save, general product feedback, analytics, legacy `should_remember`, and inferred historical behavior never create eligibility.
- Historical grades and corrections may remain separate legacy aggregate signals. They gain neither corpus eligibility nor extended audio retention unless the owner performs a new qualifying contribution under the current disclosure.
- A content correction means an edit to the note or transcript that changes the server-computed canonical content fingerprint. A free-text explanation about quality is not a content correction.
- An explicit grade remains eligible for private diagnostic evaluation and the disclosed retention exception, but it rates the evaluated control revision only. It is not an expected output for a new challenger prediction and cannot enter an exact-reference or benchmark-winner denominator by itself.
- A material correction labels only the smaller UI-editable fields the server proves changed: `title`, `summary`, `most_important`, and `todos`. Untouched fields are not silently treated as reviewed; transcript is separate and labeled only when explicitly corrected.
- A structured output becomes a complete benchmark reference only after the owner inspects every canonical field in that exact current revision and deliberately submits `agent_ready: true` with the matching preview binding. The accepted revision may be `original_model` or `user_content_correction`; absent/null/false readiness or an incomplete/stale/uninspectable preview never implies acceptance.
- The current canonical output is derived from the frozen production schema/normalizer and has exactly 14 top-level keys with no extras: `type`, `title`, `summary`, `most_important`, `todos`, `priorities`, `intentions`, `accomplishments`, `tomorrow_todos`, `mood`, `people`, `projects`, `tags`, and `centers_of_balance`. Nested values, including todos, must satisfy the same recursive contract.
- Evaluations and revisions are immutable. A later save supersedes an earlier evaluation; contribution removal appends a withdrawal event rather than rewriting history.

## Retention and deletion contract

The ordinary audio rule remains 30 days. Still-available audio linked to a current eligible contribution may remain beyond 30 days only while that contribution is active.

- Removing the contribution ends the exception but does not undo the corrected visible note.
- Deleting the note or account removes the audio and linked evaluation artifacts.
- Withdrawal, note deletion, or account deletion invalidates every linked corpus case and deletes its ephemeral input staging plus private raw benchmark copies. A run containing an invalidated case is stale even if prediction generation already finished.
- If audio is already older than the ordinary window when eligibility ends, Storage deletion happens before the withdrawal is committed. A Storage failure leaves eligibility active and returns a retryable failure; it never creates an unprotected old object.
- The retention selector distinguishes `standard_expired`, `evaluation_protected`, and `eligibility_ended` candidates. It never infers eligibility from legacy feedback.

## Inference truth and revision model

The implementation uses these immutable concepts:

1. `InferenceContractV1` identifies the resolved provider, model and request configuration plus prompt, schema, and normalizer versions, exact snapshots, and SHA-256 hashes.
2. `ProcessingOperationV1` is an immutable row in `throughline_processing_operations` with recording and contract foreign keys, operation status, safe failure code, and start/finish timestamps. Attempts, original revisions, and evaluations point to that operation explicitly; the recording has an indexed nullable current-operation pointer with cycle-safe deletion.
3. `InferenceAttemptV1` records each transcription or extraction try, including attempt number, safe result/failure code, latency, available usage/cost, input/output hashes, and private snapshots.
4. `NoteRevisionV1` preserves `original_model`, `user_content_correction`, and `action_state` revisions. Current original/corrected revisions carry a complete canonical extraction snapshot plus production schema/normalizer/keyset hashes; UI correction masks remain a separate smaller type and transcript remains separate. The recording has nullable typed pointers to its current operation, attempts, and revision; foreign keys are indexed and use cycle-safe delete actions.
5. `EvaluationV1` links the owner grade to the exact evaluated revision and processing operation. `EvaluationContributionEventV1` records eligibility creation or withdrawal with server-derived provenance and disclosure versions.
6. `EvaluationCorpusCaseV1` is created only by the service-only active-eligibility materializer. Its immutable receipt binds the contribution, disclosure/policy, stable split, content and label hashes, smaller editable mask, separate transcript state, exact preview/readiness provenance, and production schema/normalizer/keyset hashes; append-only invalidation/revalidation events preserve lifecycle truth.
7. `EvaluationTextQuarantineV1` holds optional free text behind a fail-closed service boundary, separate from structured issue codes and every evaluation/export/report path.

Legacy rows remain `legacy_unattributed`. The system does not invent a run, model, prompt, original output, disclosure, or historical retention opt-in.

## Owner API contract

The compatibility API keeps old routes decodable while adding current contracts:

- `GET /recordings/{recording_id}/evaluation-readiness-preview?revision_id={uuid}` is owner-only and returns an inspectable ordered view of every schema-derived canonical field/value plus exact payload/schema/normalizer/keyset hashes; it fails closed if any field cannot be validated or shown.
- `POST /recordings/{recording_id}/evaluations` accepts UUID `idempotency_key` and `evaluated_revision_id`, rubric/disclosure fields, bounded grade fields, nullable `agent_ready`, optional matching readiness-preview binding, and quarantined explanation. True readiness requires the exact current preview binding; revision, payload, schema, normalizer, keyset, or preview drift is rejected. `should_remember` authorizes nothing.
- `PATCH /recordings/{recording_id}` accepts UUID `idempotency_key`, optimistic `expected_current_revision_id`, current notice/disclosure versions when the save is offered as a contribution, and the bounded editable note fields. Only a changed server-derived canonical content fingerprint can create `content_correction` eligibility.
- `PATCH /recordings/{recording_id}/action-items` appends workflow history only; it cannot create evaluation eligibility.
- `DELETE /recordings/{recording_id}/evaluation-contribution` accepts UUID `idempotency_key` and appends a withdrawal after required Storage deletion succeeds.
- Legacy feedback/edit requests may remain accepted for old clients, but without current server-verified disclosure provenance they cannot create eligibility or extend retention.

The bounded structured issue taxonomy is `missed_action`, `unsupported_action`, `wrong_importance`, `meaning_changed`, `weak_summary`, `transcription_error`, `schema_invalid`, and `other_structured`. `other_structured` carries no text; explanation text always goes to quarantine.

## Honest private audio benchmark

Tracked schemas and validators define an ignored `evals/private/` workspace. Synthetic tracked manifests are plumbing-only. Every real private manifest is written by a service-only materializer from currently active, server-derived eligibility; a hand-authored manifest or one without a valid materializer receipt is rejected. Each private case contains privately stored content and an immutable manifest with:

- opaque case key;
- eligibility source `explicit_grade` or `content_correction`;
- server-derived label kind `diagnostic_grade`, `reviewed_fields`, or `accepted_full_output`;
- label completeness `diagnostic_only`, `reviewed_fields_only`, or `complete_structured_output`, plus a bounded `EditableCorrectionField` mask and separate transcript-correction state;
- disclosure/policy version;
- audio reference, SHA-256, duration, and format;
- a reviewed-fields path/hash only for the editable correction mask; for accepted full output, a complete canonical path/hash, exact 14-key set, and production schema/normalizer/keyset hashes; transcript remains separate and appears only when explicitly corrected;
- immutable `development` or `sealed_holdout` split; and
- a materializer receipt binding case key, contribution, current disclosure/policy, split, label provenance/completeness, content hashes, inspected-preview provenance, production contract hashes, and materialized-at time without exposing raw identifiers in logs or reports.

The materializer derives label truth from immutable owner records; callers cannot select label kind, fields, or hashes. Null/false readiness emits `diagnostic_grade`. A correction without matching readiness emits `reviewed_fields` only for changed `title`, `summary`, `most_important`, or `todos`; transcript is separately explicit. `accepted_full_output` additionally requires a deliberate exact-revision preview binding and a snapshot that contains all 14 schema-derived keys, no extras, valid nested todo/schema values, a canonical fixed point under the shared normalizer, and matching production schema/normalizer/keyset hashes. A grade alone never authorizes self-copying its control output.

Prediction uses a fresh input-only staging directory containing only the allowlisted audio copy and a single-file adapter bundle. A launcher verifies Deno permission enforcement, then starts the adapter worker with no shell, no `--allow-run`, no FFI, no write access, read access limited to those staged inputs, network access limited to the resolved provider host, and environment access limited to the named provider variables. The repository, manifest, reference, and label roots are outside the staging directory, never passed to the worker, and absent from its read allowlist; Deno's runtime permission sandbox must deny access. If that boundary cannot be verified, the run fails closed as `adapter_isolation_unavailable`; there is no unsandboxed fallback.

The prediction adapter receives only case key, staged audio input, audio hash, format/duration, and inference-contract hash. It never receives the split, manifest, reference transcript, expected output, expected hash, label path, or repository root. An adversarial fixture must prove that attempted sentinel/reference reads fail before any prediction is accepted or written.

Predictions are atomically sealed and hashed before labels open. The service revalidates active eligibility, preview/label provenance, complete canonical shape, and production contract hashes. Drift or invalidation keeps labels closed. Diagnostic grades remain aggregate signals; reviewed fields use only the smaller editable mask. Full-output coverage, minimum, holdout, and winner denominators include only revalidated `accepted_full_output` cases satisfying the entire frozen 14-key recursive contract. Every missing key, extra key, invalid nested value, wrong schema/normalizer/keyset hash, or uninspectable/stale preview fails scoring.

The old `eval:check` name becomes `eval:plumbing`. It may prove schema, validator, and scorer wiring, but its output is permanently ineligible for a quality or promotion claim. `eval:quality` requires the private manifest and independent prediction bundle.

## Metric and evidence gates

The slice keeps live and offline integrity measures distinct:

- **Complete-lineage coverage:** eligible post-cutover owner evaluations whose referenced recording, operation, contract, attempts, original revision, evaluated revision, disclosure provenance, and contribution event are complete / all eligible post-cutover owner evaluations.
- **Diagnostic-grade denominator:** active grade-only cases, reported separately as online rubric/failure evidence with no expected-output or challenger-winner claim.
- **Reviewed-field denominator:** each corrected `EditableCorrectionField`, with transcript counted separately only when explicitly corrected. This remains partial-label evidence.
- **Independent-prediction coverage:** currently eligible `accepted_full_output` cases with exactly one independently generated, sandboxed, sealed, manifest-matching, revalidated prediction and a complete owner-inspected snapshot valid against the exact frozen 14-key production schema/normalizer / all cases meeting that same full contract. Grade-only, partial, incomplete, extra-key, invalid-nested, unpreviewed, or contract-drifted cases are excluded.
- **Quality-evidence integrity gate:** `pass` only when complete-lineage and accepted-full-output independent-prediction coverage are 100%, the accepted-full-output benchmark sample threshold is met, sealed-holdout rules pass, and no copied/golden, partial-label promotion, or quarantine content is present. Otherwise it is `fail` or `insufficient_sample_size`; no benchmark winner is claimed.

Reports and corpus lifecycle audits serialize aggregate counts and rates only. They contain no raw account/session/recording/evaluation/case IDs, materializer tokens or receipts, object paths, audio, transcript, note, prompt, feedback, free text, credential, or provider response.

## Disclosure, privacy, and design

Use quiet contextual disclosure next to the grade and content-correction save actions plus full policy detail. Do not change onboarding or add a blocking modal. The recommended copy for Mike's taste review is:

> Private quality check. Saving this grade or a content correction may keep this recording's audio past 30 days until you remove the contribution. Not used to train models. Learn more.

Before iOS implementation, Mike reviews the exact copy, hierarchy, link treatment, removal control, and a quiet `What your agent will read` preview plus readiness control. Every canonical field/value and nested todo must be inspectable before readiness is enabled; the UI must not claim inspection of hidden fields. Readiness defaults off and resets on revision, payload, schema, normalizer, or keyset change; correction save alone never enables it.

The implementation plan corrects the local Markdown and HTML policy sources that currently claim a first-recording permission modal and Settings withdrawal flow that do not exist. It separately records ordinary third-party-AI inference permission as an App Store readiness risk; this slice does not invent that UI. `PrivacyInfo.xcprivacy` adds Analytics as a purpose for Audio Data only when evaluation-linked audio ships. Policy publication, App Store privacy-answer changes, upload, TestFlight, submission, and a new binary remain Mike-gated external actions.

## Rollout and rollback

Rollout flags separate contract/lineage writes, evaluation writes, and evaluation-linked retention. The compatibility API accepts old clients while deriving eligibility only from current contracts.

Rollback has two phases:

1. Before any eligible contribution exists, disable the new flags and return to the verified TL-DATA stable API while leaving additive nullable schema in place.
2. After any eligible contribution exists, rollback must deploy the prebuilt retention-aware compatibility API. It disables new lineage and evaluation writes but continues protecting eligible audio and honoring contribution, note, and account deletion. Rolling back to a retention-unaware API is prohibited.

Production canary evaluation is performed by the recording owner on their own canary recording. Agents may run contract tests and inspect content-free aggregate counts, but they may not invent a grade or correction. Release evidence records source commit, schema/function identities, flags, test/canary outcomes, and rollback target without content or identifiers.

## Guardrails and non-goals

- No model training or fine-tuning, automatic promotion, advertising/tracking use, or new provider sharing.
- No provider, base-model, production-prompt-byte, pricing, recording-limit, credit, subscription, onboarding, App Store submission, or public-release change. The separately approved internal-only TestFlight canary delivery is recorded above.
- No legacy evaluation backfill that creates eligibility or extended retention.
- No raw provider bodies in failure messages or logs.
- No public policy publication or App Store privacy-answer action in this slice without Mike's separate approval.
- No interpretation of historical golden or transcript-only fixtures as an audio-to-task quality result.

## Acceptance and evidence manifest

- TL-DATA Task 6 dependency evidence is dated and verified before runtime Task 1 starts.
- Production prompt SHA-256 remains `c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135` and the historical eval hash remains drift evidence only.
- Disposable-database tests prove the explicit operation ledger, operation foreign keys/current pointer, corpus materialization/invalidation ledger, constraints, indexed foreign keys, explicit RLS/revokes/grants, immutable-update rejection, privacy deletion, and service-only fixed-search-path RPCs.
- Contract/API tests prove retries and separate attempts, immutable originals, owner-only idempotency, material-change eligibility, old-client non-eligibility, quarantine isolation, Storage-first withdrawal, and service-token rejection.
- Synthetic private-eval tests prove Deno runtime-enforced input-only permission isolation, fail-closed `adapter_isolation_unavailable`, adversarial reference denial, sealing/revalidation, and rejection of each missing canonical key, every extra key, wrong schema/normalizer/keyset hash, invalid nested value, and every copy/leak/mismatch/stale/revoked class.
- Materializer/UI tests prove the four-field editable mask is separate from the schema-derived 14-key canonical contract; real manifests cannot be hand-authored; all canonical values are inspectable before readiness; only a complete schema-valid preview-bound exact revision becomes full output; and invalidation removes private raw artifacts before scoring.
- Retention tests prove historical grades never protect audio without a current disclosed re-contribution.
- Aggregate reports prove all three integrity measures without serializing private values.
- A dated release record identifies migration, API digest, contract hash, feature flags, canaries, compatibility target, and both rollback phases.

The task-by-task implementation and exact interfaces are in the [evaluation truth and lineage implementation plan](../superpowers/plans/2026-08-17-evaluation-truth-and-lineage.md).
