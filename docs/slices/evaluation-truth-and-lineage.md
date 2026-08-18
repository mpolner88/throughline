# Evaluation Truth and Immutable Lineage Slice

**Status:** Selected and planned; runtime work is blocked on the dependency gate below
**Selected:** 2026-08-17
**Backlog:** `TL-EVAL-001`
**Program:** [Core Quality and Learning](../programs/core-quality-learning.md)
**Verified control:** 2026-08-17; [current state](../CURRENT_STATE.md) and [iOS 1.0.4 / API v22 provenance closure](../releases/2026-08-17-ios-1.0.4-2026081602-provenance.md)
**Hard runtime dependency:** `TL-DATA-001` Task 6 must have a dated verified migration/API rollout record and passing canaries before this slice's runtime Task 1 begins. The 2026-08-17 [measurement execution ledger](../../.superpowers/sdd/2026-08-17-measurement-attribution/progress.md) records Task 6 as blocked before production; it is not rollout evidence.

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

An honest private benchmark will begin from a service-materialized audio-to-task manifest, create predictions inside a Deno runtime-enforced input-only permission sandbox without exposing expected outputs to the adapter, and reject incomplete, stale, revoked, copied, leaking, or mismatched runs. Real manifests cannot be hand-authored. Grade-only diagnostics, reviewed-field corrections, and explicitly accepted full-output labels remain distinct; the original model output is never reused as a challenger reference merely because its owner graded it. Golden copying will remain available only as explicitly named plumbing and can never emit a quality or promotion pass.

## Contribution and evaluator boundary

- The user who recorded a note is the only human evaluator for that note. A service-token request cannot submit a human evaluation.
- Only explicitly saving a 1–5 grade or a material canonical content-fingerprint change under the current disclosure creates eligibility.
- Opening a note, completing or reopening an action, inactivity, a no-op save, general product feedback, analytics, legacy `should_remember`, and inferred historical behavior never create eligibility.
- Historical grades and corrections may remain separate legacy aggregate signals. They gain neither corpus eligibility nor extended audio retention unless the owner performs a new qualifying contribution under the current disclosure.
- A content correction means an edit to the note or transcript that changes the server-computed canonical content fingerprint. A free-text explanation about quality is not a content correction.
- An explicit grade remains eligible for private diagnostic evaluation and the disclosed retention exception, but it rates the evaluated control revision only. It is not an expected output for a new challenger prediction and cannot enter an exact-reference or benchmark-winner denominator by itself.
- A material correction labels only the fields the server proves changed from its base revision. Untouched fields are not silently treated as reviewed; transcript is labeled only when transcript content was explicitly corrected.
- A structured output becomes a complete benchmark reference only after the owner explicitly accepts that exact current evaluated revision for agent use—for this contract, a deliberate `agent_ready: true` evaluation linked to that revision. The accepted revision may be `original_model` or `user_content_correction`; absent/null/false readiness never implies acceptance. Without acceptance, a grade stays diagnostic and a correction is scored only over its server-derived reviewed-field mask.
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
4. `NoteRevisionV1` preserves `original_model`, `user_content_correction`, and `action_state` revisions. The recording has nullable typed pointers to its current operation, attempts, and revision; foreign keys are indexed and use cycle-safe delete actions.
5. `EvaluationV1` links the owner grade to the exact evaluated revision and processing operation. `EvaluationContributionEventV1` records eligibility creation or withdrawal with server-derived provenance and disclosure versions.
6. `EvaluationCorpusCaseV1` is created only by the service-only active-eligibility materializer. Its immutable receipt binds the server-derived contribution, current disclosure/policy, stable split, content hashes, server-derived label kind/completeness/field mask, and materialization time; append-only invalidation/revalidation events preserve lifecycle truth.
7. `EvaluationTextQuarantineV1` holds optional free text behind a fail-closed service boundary, separate from structured issue codes and every evaluation/export/report path.

Legacy rows remain `legacy_unattributed`. The system does not invent a run, model, prompt, original output, disclosure, or historical retention opt-in.

## Owner API contract

The compatibility API keeps old routes decodable while adding current contracts:

- `POST /recordings/{recording_id}/evaluations` accepts UUID `idempotency_key` and `evaluated_revision_id`, `rubric_version`, `notice_version`, `disclosure_version`, integer `score` from 1 through 5, bounded `issue_codes`, nullable `agent_ready`, and nullable quarantined `explanation`. The server locks the recording and rejects a non-current evaluated revision with `409 revision_conflict`; `should_remember`, if present, is ignored and authorizes nothing.
- `PATCH /recordings/{recording_id}` accepts UUID `idempotency_key`, optimistic `base_revision_id`, current notice/disclosure versions when the save is offered as a contribution, and the bounded editable note fields. Only a changed server-derived canonical content fingerprint can create `content_correction` eligibility.
- `PATCH /recordings/{recording_id}/action-items` appends workflow history only; it cannot create evaluation eligibility.
- `DELETE /recordings/{recording_id}/evaluation-contribution` accepts UUID `idempotency_key` and appends a withdrawal after required Storage deletion succeeds.
- Legacy feedback/edit requests may remain accepted for old clients, but without current server-verified disclosure provenance they cannot create eligibility or extend retention.

The bounded structured issue taxonomy is `missed_action`, `unsupported_action`, `wrong_importance`, `meaning_changed`, `weak_summary`, `transcription_error`, `schema_invalid`, and `other_structured`. `other_structured` carries no text; explanation text always goes to quarantine.

## Honest private audio benchmark

Tracked schemas and validators define an ignored `evals/private/` workspace. Synthetic tracked manifests are plumbing-only. Every real private manifest is written by a service-only materializer from currently active, server-derived eligibility; a hand-authored manifest or one without a valid materializer receipt is rejected. Each private case contains privately stored content and an immutable manifest with:

- opaque case key;
- eligibility source `explicit_grade` or `content_correction`;
- server-derived label kind `diagnostic_grade`, `reviewed_fields`, or `accepted_full_output`;
- label completeness `diagnostic_only`, `reviewed_fields_only`, or `complete_structured_output`, plus a bounded structured-output field mask;
- disclosure/policy version;
- audio reference, SHA-256, duration, and format;
- an expected-output path/hash only for reviewed fields or an accepted full structured output, and a transcript reference only when transcript was explicitly corrected;
- immutable `development` or `sealed_holdout` split; and
- a materializer receipt binding case key, contribution, current disclosure/policy, split, label provenance/completeness, content hashes, and materialized-at time without exposing raw identifiers in logs or reports.

The materializer derives label truth from immutable owner records; callers cannot select a label kind or field mask. An explicit grade with absent/null/false readiness emits `diagnostic_grade` with no expected-output reference. A content correction without matching readiness emits `reviewed_fields` with only the canonical fields whose values differ from its base revision; it does not copy unchanged fields into a gold reference. A deliberate current `agent_ready: true` evaluation tied to the exact evaluated revision emits `accepted_full_output` and uses that accepted revision as the structured-output reference, whether the revision is original or corrected. A grade alone never authorizes self-copying its control output; explicit owner readiness is the additional label provenance. Transcript completeness remains separate and requires an explicit transcript correction.

Prediction uses a fresh input-only staging directory containing only the allowlisted audio copy and a single-file adapter bundle. A launcher verifies Deno permission enforcement, then starts the adapter worker with no shell, no `--allow-run`, no FFI, no write access, read access limited to those staged inputs, network access limited to the resolved provider host, and environment access limited to the named provider variables. The repository, manifest, reference, and label roots are outside the staging directory, never passed to the worker, and absent from its read allowlist; Deno's runtime permission sandbox must deny access. If that boundary cannot be verified, the run fails closed as `adapter_isolation_unavailable`; there is no unsandboxed fallback.

The prediction adapter receives only case key, staged audio input, audio hash, format/duration, and inference-contract hash. It never receives the split, manifest, reference transcript, expected output, expected hash, label path, or repository root. An adversarial fixture must prove that attempted sentinel/reference reads fail before any prediction is accepted or written.

Predictions are atomically sealed and hashed before the evaluator can open labels. The service then revalidates every case against current eligibility, label provenance, and its materializer receipt. Only a fully active, hash-matching revalidation receipt unlocks the references permitted by that case's server-derived label contract. Withdrawal, note/account deletion, disclosure/policy mismatch, changed content, label-provenance drift, or missing raw artifacts makes the run `stale_or_revoked_case`; labels stay closed and no result is emitted. Scoring also rejects missing, extra, duplicate, golden/copied, split-leaking, or manifest-mismatched predictions. Diagnostic-grade cases report online rubric/failure aggregates only. Reviewed-field cases score only their field-mask denominator. Only accepted-full-output cases enter full-output coverage, minimum-case, holdout, and winner denominators. A run below its declared minimum accepted-full-output case count reports `insufficient_sample_size` and names no winner.

The old `eval:check` name becomes `eval:plumbing`. It may prove schema, validator, and scorer wiring, but its output is permanently ineligible for a quality or promotion claim. `eval:quality` requires the private manifest and independent prediction bundle.

## Metric and evidence gates

The slice keeps live and offline integrity measures distinct:

- **Complete-lineage coverage:** eligible post-cutover owner evaluations whose referenced recording, operation, contract, attempts, original revision, evaluated revision, disclosure provenance, and contribution event are complete / all eligible post-cutover owner evaluations.
- **Diagnostic-grade denominator:** active grade-only cases, reported separately as online rubric/failure evidence with no expected-output or challenger-winner claim.
- **Reviewed-field denominator:** each server-derived corrected structured field (and transcript only when explicitly corrected) with an independently generated, sandboxed, sealed, revalidated prediction / all such reviewed fields declared for that run. This remains partial-label evidence.
- **Independent-prediction coverage:** currently eligible `accepted_full_output` cases with exactly one independently generated, sandboxed, sealed, manifest-matching, post-prediction-revalidated prediction / all accepted-full-output cases declared for that run. Grade-only and partial-correction cases are excluded from both numerator and denominator.
- **Quality-evidence integrity gate:** `pass` only when complete-lineage and accepted-full-output independent-prediction coverage are 100%, the accepted-full-output benchmark sample threshold is met, sealed-holdout rules pass, and no copied/golden, partial-label promotion, or quarantine content is present. Otherwise it is `fail` or `insufficient_sample_size`; no benchmark winner is claimed.

Reports and corpus lifecycle audits serialize aggregate counts and rates only. They contain no raw account/session/recording/evaluation/case IDs, materializer tokens or receipts, object paths, audio, transcript, note, prompt, feedback, free text, credential, or provider response.

## Disclosure, privacy, and design

Use quiet contextual disclosure next to the grade and content-correction save actions plus full policy detail. Do not change onboarding or add a blocking modal. The recommended copy for Mike's taste review is:

> Private quality check. Saving this grade or a content correction may keep this recording's audio past 30 days until you remove the contribution. Not used to train models. Learn more.

Before iOS implementation, Mike reviews the exact copy, hierarchy, link treatment, removal control, and a quiet explicit readiness control explaining that it accepts the exact displayed revision as a complete structured-output reference. Readiness defaults off, resets when revision identity changes, and correction save alone never enables it. That checkpoint does not block earlier backend and private-eval tasks.

The implementation plan corrects the local Markdown and HTML policy sources that currently claim a first-recording permission modal and Settings withdrawal flow that do not exist. It separately records ordinary third-party-AI inference permission as an App Store readiness risk; this slice does not invent that UI. `PrivacyInfo.xcprivacy` adds Analytics as a purpose for Audio Data only when evaluation-linked audio ships. Policy publication, App Store privacy-answer changes, upload, TestFlight, submission, and a new binary remain Mike-gated external actions.

## Rollout and rollback

Rollout flags separate contract/lineage writes, evaluation writes, and evaluation-linked retention. The compatibility API accepts old clients while deriving eligibility only from current contracts.

Rollback has two phases:

1. Before any eligible contribution exists, disable the new flags and return to the verified TL-DATA stable API while leaving additive nullable schema in place.
2. After any eligible contribution exists, rollback must deploy the prebuilt retention-aware compatibility API. It disables new lineage and evaluation writes but continues protecting eligible audio and honoring contribution, note, and account deletion. Rolling back to a retention-unaware API is prohibited.

Production canary evaluation is performed by the recording owner on their own canary recording. Agents may run contract tests and inspect content-free aggregate counts, but they may not invent a grade or correction. Release evidence records source commit, schema/function identities, flags, test/canary outcomes, and rollback target without content or identifiers.

## Guardrails and non-goals

- No model training or fine-tuning, automatic promotion, advertising/tracking use, or new provider sharing.
- No provider, base-model, production-prompt-byte, pricing, recording-limit, credit, subscription, onboarding, TestFlight, App Store Connect, or submission change.
- No legacy evaluation backfill that creates eligibility or extended retention.
- No raw provider bodies in failure messages or logs.
- No public policy publication or App Store privacy-answer action in this slice without Mike's separate approval.
- No interpretation of historical golden or transcript-only fixtures as an audio-to-task quality result.

## Acceptance and evidence manifest

- TL-DATA Task 6 dependency evidence is dated and verified before runtime Task 1 starts.
- Production prompt SHA-256 remains `c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135` and the historical eval hash remains drift evidence only.
- Disposable-database tests prove the explicit operation ledger, operation foreign keys/current pointer, corpus materialization/invalidation ledger, constraints, indexed foreign keys, explicit RLS/revokes/grants, immutable-update rejection, privacy deletion, and service-only fixed-search-path RPCs.
- Contract/API tests prove retries and separate attempts, immutable originals, owner-only idempotency, material-change eligibility, old-client non-eligibility, quarantine isolation, Storage-first withdrawal, and service-token rejection.
- Synthetic private-eval tests prove Deno runtime-enforced input-only permission isolation, fail-closed `adapter_isolation_unavailable`, adversarial sentinel/reference denial before output, prediction sealing, post-prediction eligibility revalidation, and rejection of every incomplete/copy/leak/mismatch/stale/revoked class.
- Materializer tests prove real manifests cannot be hand-authored, active current disclosure/policy is required, splits/hashes are stable, grade-only cases with absent/null/false readiness have no expected output, partial corrections expose only a server-derived field mask, only deliberate readiness tied to the exact current evaluated revision becomes a complete structured-output label, no control output is self-copied from a grade alone, and withdrawal/note/account deletion invalidates cases and removes ephemeral/private raw artifacts before a stale run can score.
- Retention tests prove historical grades never protect audio without a current disclosed re-contribution.
- Aggregate reports prove all three integrity measures without serializing private values.
- A dated release record identifies migration, API digest, contract hash, feature flags, canaries, compatibility target, and both rollback phases.

The task-by-task implementation and exact interfaces are in the [evaluation truth and lineage implementation plan](../superpowers/plans/2026-08-17-evaluation-truth-and-lineage.md).
