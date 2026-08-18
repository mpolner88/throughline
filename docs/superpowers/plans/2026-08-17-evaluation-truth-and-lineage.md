# Evaluation Truth and Immutable Lineage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:test-driven-development and superpowers:verification-before-completion on every task. Use the repository Supabase and Postgres skills for Tasks 3–6 and 9.

**Goal:** Make Throughline's private quality evidence honest, owner-authorized, retention-aware, and traceable from audio through immutable attempts, revisions, evaluations, and aggregate reporting.

**Architecture:** A shared immutable inference contract feeds both production processing and a private audio-first evaluation runner. Additive service-only Postgres ledgers and atomic RPCs preserve attempts, revisions, structured evaluations, quarantined text, and contribution lifecycle; compatibility API modules derive eligibility and retention server-side. iOS adds quiet contextual controls only after Mike's taste checkpoint, and rollout uses feature flags plus a retention-aware rollback target.

**Tech Stack:** Deno/TypeScript Supabase Edge Functions, PostgreSQL/pgTAP, Node.js ESM eval/report tooling, SwiftUI/Foundation, Supabase Storage, JSON Schema.

**Spec:** [Evaluation Truth and Immutable Lineage Slice](../../slices/evaluation-truth-and-lineage.md)

## Global constraints

- Do not begin Task 1 until `TL-DATA-001` Task 6 has a dated verified migration/API rollout record and passing canaries. Record that evidence link in the execution ledger before editing runtime files.
- Preserve production extraction prompt bytes and SHA-256 `c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135`. Historical eval SHA-256 `5e6781339777bf3d1e080088d405243a044efc891f4852b50824910adf449321` is drift evidence only.
- The recording owner is the only human evaluator. Service-token context must receive `403 human_evaluation_requires_owner`.
- Only an explicit 1–5 grade or material canonical note-content correction under `private_evaluation_notice_v1` and `private_evaluation_disclosure_v1` can create eligibility.
- `should_remember`, note opening, action toggling, inactivity, no-op save, product feedback, analytics, historical behavior, and legacy feedback never create eligibility.
- Historical grades/corrections require a new current disclosed contribution before they can protect audio.
- Free text is quarantined and excluded from scoring, candidates, promotion, analytics, fixtures, reports, and tracked artifacts.
- No training/fine-tuning, automatic promotion, advertising/tracking use, new provider sharing, provider/base-model change, production-prompt change, pricing/limit/credit/subscription change, onboarding change, or App Store action.
- Public policy publication, App Store privacy-answer changes, upload, TestFlight, submission, and a new binary remain Mike-gated.
- Keep transactions short; make external provider and Storage calls before atomic database commits. Every public table has explicit RLS, client revokes, least-privilege service grants, indexed foreign keys, and immutable-update tests.
- Every writing task has exclusive ownership of the listed paths. Do not run tasks with overlapping paths in parallel. Preserve unrelated dirty work, keep private data out of Git, and stage only each task's declared paths.

## Cross-task interfaces

These names and wire values are fixed across tasks.

```ts
type Sha256 = string; // exactly 64 lowercase hex characters
type EvaluationIssueCode =
  | "missed_action" | "unsupported_action" | "wrong_importance"
  | "meaning_changed" | "weak_summary" | "transcription_error"
  | "schema_invalid" | "other_structured";
type EligibilitySource = "explicit_grade" | "content_correction";
type RevisionKind = "original_model" | "user_content_correction" | "action_state";
type SafeFailureCode =
  | "configuration_missing" | "input_missing" | "timeout" | "rate_limited"
  | "provider_http" | "provider_response_invalid" | "storage_failed" | "unknown";
const NOTICE_VERSION = "private_evaluation_notice_v1";
const DISCLOSURE_VERSION = "private_evaluation_disclosure_v1";
const MANIFEST_VERSION = "throughline-private-audio-manifest-v1";
const PREDICTION_VERSION = "throughline-private-prediction-v1";
```

Owner grade request:

```json
{
  "idempotency_key": "00000000-0000-4000-8000-000000000101",
  "rubric_version": "extraction_quality_v1",
  "notice_version": "private_evaluation_notice_v1",
  "disclosure_version": "private_evaluation_disclosure_v1",
  "score": 4,
  "issue_codes": ["weak_summary"],
  "agent_ready": true,
  "explanation": null
}
```

Current note-mutation envelope:

```json
{
  "idempotency_key": "00000000-0000-4000-8000-000000000102",
  "base_revision_id": "00000000-0000-4000-8000-000000000103",
  "notice_version": "private_evaluation_notice_v1",
  "disclosure_version": "private_evaluation_disclosure_v1",
  "title": "bounded title",
  "summary": "bounded summary",
  "transcript": "bounded transcript",
  "most_important": [],
  "todos": []
}
```

Private manifest and adapter boundary:

```ts
type PrivateCaseManifestV1 = {
  manifest_version: "throughline-private-audio-manifest-v1";
  case_key: string;
  eligibility_source: EligibilitySource;
  disclosure_version: string;
  policy_version: string;
  split: "development" | "sealed_holdout";
  audio: { path: string; sha256: Sha256; duration_ms: number; format: "m4a" | "wav" | "mp3" | "webm" };
  reference: {
    transcript_path: string; transcript_sha256: Sha256;
    expected_output_path: string; expected_output_sha256: Sha256;
    label_completeness: "complete";
  };
};
type PredictionAdapterInputV1 = {
  prediction_version: "throughline-private-prediction-v1";
  case_key: string; split: "development" | "sealed_holdout";
  audio_path: string; audio_sha256: Sha256; duration_ms: number;
  format: "m4a" | "wav" | "mp3" | "webm";
  inference_contract_sha256: Sha256;
};
```

---

### Task 1: Freeze and share the current production inference contract without behavior change

**Depends on:** Verified TL-DATA Task 6 rollout evidence.
**Exclusive files:**

- Create: `core/inference-contract.mjs`
- Create: `core/inference-contract.test.mjs`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/functions/api/index_test.ts`
- Modify: `core/extraction-pipeline.mjs`
- Modify: `core/extraction-pipeline.test.mjs`

**Interfaces:**

- Consumes: current API defaults, exact `EXTRACTION_PROMPT` bytes, `normalizeExtraction`, and environment overrides.
- Produces: `resolveInferenceContract(env: Record<string,string|undefined>): Promise<ResolvedInferenceContractV1>`, `canonicalJson(value: unknown): string`, `sha256Hex(value: string|Uint8Array): Promise<Sha256>`, `PRODUCTION_EXTRACTION_PROMPT`, `PRODUCTION_EXTRACTION_SCHEMA_V1`, and `PRODUCTION_NORMALIZER_SPEC_V1`.
- `ResolvedInferenceContractV1` contains `contract_version`, provider, resolved transcription/extraction model and request config, prompt/schema/normalizer versions and exact snapshots, each SHA-256, and one `contract_sha256` over canonical JSON.

- [ ] **Step 1: Write the contract tests first**

```js
test("production prompt bytes retain the approved hash", async () => {
  assert.equal(await sha256Hex(PRODUCTION_EXTRACTION_PROMPT),
    "c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135");
});
test("resolved overrides change contract identity without changing prompt bytes", async () => {
  const base = await resolveInferenceContract({});
  const changed = await resolveInferenceContract({ GROQ_MAX_RETRIES: "4" });
  assert.notEqual(base.contract_sha256, changed.contract_sha256);
  assert.equal(base.prompt.sha256, changed.prompt.sha256);
});
```

- [ ] **Step 2: Witness RED**

Run: `node --test core/inference-contract.test.mjs core/extraction-pipeline.test.mjs`
Expected RED: module import fails because `core/inference-contract.mjs` does not exist. Run `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/api/index_test.ts`; expect the new resolved-contract assertion to fail because the API still owns anonymous constants.

- [ ] **Step 3: Implement the minimal shared contract**

Move the prompt bytes unchanged, express schema and normalizer specifications as canonical JSON data, resolve every provider/model/timeout/retry/temperature/response-format setting once, and make the API and core normalizer import those values. Do not alter request payloads, retry counts, normalization output, or production defaults. Tests compare pre-refactor provider request bodies and normalized outputs byte-for-byte.

- [ ] **Step 4: Witness GREEN and verify no behavior drift**

Run: `node --test core/inference-contract.test.mjs core/extraction-pipeline.test.mjs` and `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/api/index_test.ts`.
Expected GREEN: all tests pass; the prompt hash is the approved value; provider request characterization snapshots are unchanged.

- [ ] **Step 5: Commit and review**

Commit: `refactor(eval): freeze production inference contract`
Rollback: revert this refactor; no schema or runtime data exists yet. Review must reject any prompt-byte or normalized-output difference.

---

### Task 2: Build honest private audio-manifest and independent-prediction plumbing

**Depends on:** Task 1 contract module.
**Exclusive files:**

- Create: `evals/contracts/private-audio-manifest.schema.json`
- Create: `evals/contracts/private-prediction.schema.json`
- Create: `evals/lib/private-manifest.mjs`
- Create: `evals/lib/private-manifest.test.mjs`
- Create: `evals/run-private-audio.mjs`
- Create: `evals/run-private-audio.test.mjs`
- Create: `evals/score-private-audio.mjs`
- Create: `evals/score-private-audio.test.mjs`
- Create: `evals/fixtures/synthetic/private-audio-manifest.json`
- Modify: `evals/run-extraction.mjs`
- Modify: `evals/score-extraction.mjs`
- Modify: `evals/README.md`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**

- Consumes: `ResolvedInferenceContractV1` and the manifest/adapter types above.
- Produces: `validatePrivateManifest(raw, root): ValidatedPrivateManifestV1`, `buildAdapterInput(caseRecord, contractHash): PredictionAdapterInputV1`, and `scorePrivateRun({manifest,predictions,split,minCases}): PrivateScoreReportV1`.
- `PrivateScoreReportV1.status` is `quality_result`, `invalid_run`, or `insufficient_sample_size`; `winner` is always null unless status is `quality_result`. Default `minCases` is 20.

- [ ] **Step 1: Write synthetic validator/runner/scorer tests first**

```js
test("adapter input contains audio but no expected or reference field", () => {
  const input = buildAdapterInput(syntheticCase, CONTRACT_HASH);
  assert.equal(input.audio_sha256, syntheticCase.audio.sha256);
  assert.equal("reference" in input, false);
  assert.doesNotMatch(JSON.stringify(input), /expected|transcript_path|expected_output_sha256/);
});
test("copied golden output is invalid rather than a quality pass", async () => {
  const report = await scorePrivateRun(copiedGoldenRun);
  assert.equal(report.status, "invalid_run");
  assert.equal(report.failure_code, "golden_or_copied_prediction");
  assert.equal(report.winner, null);
});
```

Table-driven tests cover missing, extra, duplicate, stale, split-leaking, manifest-hash mismatch, prediction-contract mismatch, copied/golden output, incomplete labels, and fewer than 20 eligible cases.

- [ ] **Step 2: Witness RED**

Run: `node --test evals/lib/private-manifest.test.mjs evals/run-private-audio.test.mjs evals/score-private-audio.test.mjs`
Expected RED: imports fail for the three new modules. Run `npm run eval:plumbing`; expect npm to fail because the script does not exist.

- [ ] **Step 3: Implement schemas, validator, runner, and scorer**

Ignore `/evals/private/` and `/evals/runs/private/`. The synthetic fixture contains generated non-user content only. The runner resolves and verifies audio hashes before invoking the command adapter; it passes exactly `PredictionAdapterInputV1`. It writes a prediction bundle with manifest hash, contract hash, adapter identity, split, timestamps, and one prediction per case. The scorer opens private references only after predictions are complete, never exports content, and maps every invalid condition to a closed failure code.

Rename `eval:check` to `eval:plumbing`. Set `eval:quality` to require `--manifest evals/private/manifest.json --predictions evals/runs/private/latest --split sealed_holdout --min-cases 20`. Golden and historical transcript-fixture commands print `plumbing_only: true` and cannot emit `pass: true`.

- [ ] **Step 4: Witness GREEN**

Run: `node --test evals/lib/private-manifest.test.mjs evals/run-private-audio.test.mjs evals/score-private-audio.test.mjs`, `npm run eval:plumbing`, and `node evals/score-private-audio.mjs --manifest evals/fixtures/synthetic/private-audio-manifest.json --predictions /private/tmp/throughline-eval-empty --split sealed_holdout --min-cases 20`.
Expected GREEN: tests pass; plumbing exits 0 with `plumbing_only`; the synthetic empty run exits nonzero with `insufficient_sample_size`, `winner: null`, and no content.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): require private audio predictions`
Rollback: remove the new commands while retaining `eval:plumbing`; never restore a golden quality pass. Review the adapter's serialized stdin byte-for-byte for label absence.

---

### Task 3: Add immutable schema and atomic service-only RPCs on a disposable database

**Depends on:** Tasks 1–2 types; no production migration.
**Exclusive files:**

- Create: `supabase/migrations/20260818000000_evaluation_truth_lineage.sql`
- Create: `supabase/tests/evaluation_truth_lineage_test.sql`
- Create: `supabase/functions/_shared/evaluation-db-contract.ts`
- Create: `supabase/functions/_shared/evaluation-db-contract_test.ts`

**Interfaces:**

- Consumes: cross-task enums and SHA-256/idempotency validation.
- Produces tables `throughline_inference_contracts`, `throughline_inference_attempts`, `throughline_note_revisions`, `throughline_evaluations`, `throughline_evaluation_contributions`, and `throughline_evaluation_text_quarantine`; nullable recording pointers `current_transcription_attempt_id`, `current_extraction_attempt_id`, and `current_note_revision_id`.
- Produces RPCs `throughline_commit_processing_v1(jsonb)`, `throughline_commit_user_mutation_v1(jsonb)`, `throughline_commit_evaluation_v1(jsonb)`, `throughline_remove_contribution_v1(jsonb)`, and `throughline_retention_candidates_v1(timestamptz,timestamptz,integer)`.

- [ ] **Step 1: Create the migration through the CLI, then write pgTAP/contract tests before SQL**

Run `supabase migration new evaluation_truth_lineage` to create the empty migration through the CLI, then rename that untouched empty file to the reserved exact owned path `supabase/migrations/20260818000000_evaluation_truth_lineage.sql` before adding SQL. Abort if the reserved path already exists or the CLI creates more than one file.

```sql
select has_table('public','throughline_inference_attempts');
select has_index('public','throughline_inference_attempts','throughline_inference_attempts_recording_stage_idx');
select throws_ok(
  $$ update public.throughline_note_revisions set revision_kind='action_state' $$,
  'P0001', 'immutable_row', 'note revisions reject updates');
select function_privs_are(
  'public','throughline_commit_evaluation_v1',array['jsonb'],
  'service_role',array['EXECUTE']);
```

- [ ] **Step 2: Witness RED on a disposable data-less database**

Run: `supabase test db supabase/tests/evaluation_truth_lineage_test.sql` against the verified disposable data-less database.
Expected RED: pgTAP reports the first missing `throughline_inference_contracts` table; TypeScript contract tests fail because payload validators are absent. Stop if the database is not verified disposable or contains rows.

- [ ] **Step 3: Implement the additive model and RPCs**

Use UUID primary keys, `timestamptz`, JSONB snapshots with object checks, 64-hex hash checks, score 1–5 checks, bounded issue-code checks, idempotency uniques scoped to owner/recording/operation, and unique `(operation_id,stage,attempt_number)`. Every FK has a named index. Child ledgers cascade from account/recording; recording current pointers use `ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED` so deletion is cycle-safe.

All six public tables enable RLS, have no client policies, revoke all from `public`, `anon`, and `authenticated`, and grant only required `SELECT/INSERT/DELETE` operations to `service_role`; immutable ledgers deny direct update. RPCs are `SECURITY INVOKER SET search_path = ''`, fully qualify every object, revoke execute from public/client roles, and grant execute only to `service_role`. Mutation RPCs lock the recording row, validate owner/base revision/idempotency, append rows, then advance nullable pointers atomically.

- [ ] **Step 4: Witness GREEN and run security review**

Run: `supabase test db supabase/tests/evaluation_truth_lineage_test.sql` and `DENO_DIR=/private/tmp/throughline-eval-deno deno test supabase/functions/_shared/evaluation-db-contract_test.ts`.
Expected GREEN: pgTAP passes constraints, indexes, RLS, privileges, immutability, idempotency, fixed search paths, and cascaded privacy deletion; the database remains data-less after rollback.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): add immutable lineage schema`
Rollback: no production application; delete the disposable branch. Review grant matrices, FK delete actions, concurrency locks, and RPC search paths before Task 4.

---

### Task 4: Persist processing attempts and the immutable original revision

**Depends on:** Task 3 disposable-database approval.
**Exclusive files:**

- Create: `supabase/functions/_shared/inference-provider.ts`
- Create: `supabase/functions/_shared/inference-provider_test.ts`
- Create: `supabase/functions/_shared/processing-lineage.ts`
- Create: `supabase/functions/_shared/processing-lineage_test.ts`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/functions/api/index_test.ts`

**Interfaces:**

- Consumes: `ResolvedInferenceContractV1` and `throughline_commit_processing_v1`.
- Produces `runRecordingOperation(input,deps): Promise<ProcessingCommitV1>`. `ProcessingCommitV1` contains one `operation_id`, exact `contract`, ordered `attempts`, and one `original_model` revision.
- Every `InferenceAttemptV1` carries stage, 1-based attempt number, status, safe failure code, latency, available usage/cost, input/output SHA-256, and private snapshots. It never carries a raw provider body in `failure_detail` or logs.

- [ ] **Step 1: Write provider retry and operation tests first**

```ts
Deno.test("a rate-limit retry creates two extraction attempts in one operation", async () => {
  const commit = await runRecordingOperation(input, depsReturning429ThenSuccess);
  assertEquals(commit.attempts.map(a => [a.stage,a.attempt_number,a.failure_code]),
    [["transcription",1,null],["extraction",1,"rate_limited"],["extraction",2,null]]);
  assertEquals(commit.original_revision.revision_kind, "original_model");
});
Deno.test("provider response text never reaches safe errors", async () => {
  const result = await runRecordingOperation(input, depsReturningPrivateBody);
  assert(!JSON.stringify(result).includes("PRIVATE_PROVIDER_BODY"));
});
```

- [ ] **Step 2: Witness RED**

Run: `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/inference-provider_test.ts supabase/functions/_shared/processing-lineage_test.ts supabase/functions/api/index_test.ts`.
Expected RED: imports fail for provider and lineage modules.

- [ ] **Step 3: Implement attempt capture and atomic commit**

Provider adapters return parsed values plus status/latency/usage, never raw bodies. Hash and snapshot transcription audio input/output and extraction transcript/input/output inside the first-party service boundary. Build all attempts in memory while external calls run, then call the atomic processing RPC once. On a failed operation, persist completed/failed attempts and safe operation status without creating a fake original revision. Existing legacy recordings stay readable and have null lineage pointers.

- [ ] **Step 4: Witness GREEN**

Run the focused Deno command above plus `npm run extraction:test`.
Expected GREEN: retries are distinct immutable attempts, one original survives later mutations, request behavior remains compatible, and privacy-token scans find no provider body.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): persist processing lineage`
Rollback before eligibility: disable `THROUGHLINE_LINEAGE_WRITES_ENABLED` and use the verified TL-DATA stable API. No evaluation-linked retention exists yet.

---

### Task 5: Add owner revisions, structured evaluations, quarantine, and eligibility

**Depends on:** Task 4 lineage pointers.
**Exclusive files:**

- Create: `supabase/functions/_shared/evaluation-contract.ts`
- Create: `supabase/functions/_shared/evaluation-contract_test.ts`
- Create: `supabase/functions/_shared/note-revisions.ts`
- Create: `supabase/functions/_shared/note-revisions_test.ts`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/functions/api/index_test.ts`

**Interfaces:**

- Consumes: owner grade and mutation envelopes, current revision pointers, evaluation/user-mutation RPCs.
- Produces `normalizeEvaluationRequest`, `canonicalContentFingerprint`, `buildUserMutationCommit`, and owner routes `POST /recordings/{id}/evaluations`, current/legacy `PATCH /recordings/{id}`, and workflow-only `PATCH /recordings/{id}/action-items`.
- Current grade saves return `{evaluation_id,evaluated_revision_id,eligible,eligibility_source:"explicit_grade"}`. Current material corrections return `{recording,current_revision_id,material_change,eligible}`.

- [ ] **Step 1: Write the owner/idempotency/materiality tests first**

```ts
Deno.test("service context cannot submit a human grade", async () => {
  const response = await postEvaluation(serviceRequest(validGrade));
  assertEquals(response.status, 403);
  assertEquals((await response.json()).error_code, "human_evaluation_requires_owner");
});
Deno.test("legacy and no-op edits never create eligibility", () => {
  assertEquals(buildUserMutationCommit(legacyEdit).eligibility_source, null);
  assertEquals(buildUserMutationCommit(currentNoOp).material_change, false);
});
```

Also test score bounds, issue taxonomy/count, UUID idempotency, optimistic-revision conflict `409 revision_conflict`, same-key replay equality, different-key supersession, quarantine separation, action toggles, `should_remember` ignored, and historical feedback non-eligibility.

- [ ] **Step 2: Witness RED**

Run: `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/evaluation-contract_test.ts supabase/functions/_shared/note-revisions_test.ts supabase/functions/api/index_test.ts`.
Expected RED: current evaluation route returns 404 and contract imports fail.

- [ ] **Step 3: Implement current and compatibility paths**

Require authenticated owner context for current evaluation. Derive recording owner, evaluated revision/operation, eligibility source, and disclosure provenance server-side. Store only bounded structured values in `throughline_evaluations`; insert optional explanation only into quarantine. Current note mutation canonicalizes title, summary, transcript, most-important items, and todo content, computes the server fingerprint, and creates `content_correction` eligibility only when the fingerprint changes under both current disclosure versions. Action-state revisions preserve workflow history but carry no eligibility. Legacy feedback and edit decoding remains accepted, stores legacy signals/revisions, ignores `should_remember`, and cannot extend retention.

- [ ] **Step 4: Witness GREEN**

Run the Deno command above and `npm run note:edit:smoke` against the local compatibility API only.
Expected GREEN: contract tests pass, legacy smoke remains accepted, current replays are idempotent, and no quarantine text appears in evaluation rows/logs.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): add owner evaluation contributions`
Rollout note: keep `THROUGHLINE_EVALUATION_WRITES_ENABLED=false`; do not deploy evaluation eligibility before Task 6 and the retention-aware rollback target exist.

---

### Task 6: Enforce evaluation-linked retention and privacy deletion

**Depends on:** Task 5 committed but evaluation writes still disabled.
**Exclusive files:**

- Create: `supabase/functions/_shared/evaluation-retention.ts`
- Create: `supabase/functions/_shared/evaluation-retention_test.ts`
- Create: `supabase/tests/evaluation_retention_test.sql`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/functions/api/index_test.ts`
- Modify: `docs/hosted-backend.md`

**Interfaces:**

- Consumes: `throughline_retention_candidates_v1`, `throughline_remove_contribution_v1`, Storage deletion, and contribution ledger.
- Produces `selectRetentionAction(candidate): "delete_standard"|"protect_evaluation"|"delete_eligibility_ended"`, `DELETE /recordings/{id}/evaluation-contribution`, and retention summary counts only.

- [ ] **Step 1: Write retention/deletion tests first**

```ts
Deno.test("historical grade without current disclosure never protects old audio", () => {
  assertEquals(selectRetentionAction(historicalGradeCandidate), "delete_standard");
});
Deno.test("old audio is deleted before withdrawal commits", async () => {
  await removeContribution(oldEligibleRecording, orderedDeps);
  assertEquals(orderedDeps.calls, ["storage.delete", "rpc.remove_contribution"]);
});
```

Test active protection, current withdrawal, Storage 404 idempotency, retryable Storage failure with eligibility preserved, note deletion, account deletion, linked quarantine/evaluation cascade, corrected visible note persistence, batch limits, and no raw paths/IDs in responses/logs.

- [ ] **Step 2: Witness RED**

Run: `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/evaluation-retention_test.ts supabase/functions/api/index_test.ts`.
Expected RED: retention module import fails and contribution-removal route returns 404.

- [ ] **Step 3: Implement fail-closed retention**

Use the RPC's server-derived candidate reason. Protect only active current-disclosure contributions with still-available audio. For already-old audio, delete Storage before inserting withdrawal; on non-404 Storage failure return `503 evaluation_withdrawal_retryable` and retain eligibility. Note/account deletion delete Storage first, then cascade database rows. Retention responses expose counts by reason and safe error code only. Update the runbook with ordinary versus evaluation-linked behavior and rollback warning.

- [ ] **Step 4: Witness GREEN**

Run the Deno command above and `supabase test db supabase/tests/evaluation_retention_test.sql` against the verified disposable data-less database.
Expected GREEN: each candidate is acted on once, old historical grades expire normally, and all deletion-order tests pass.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): enforce contribution retention`
Rollback: before eligibility use TL-DATA stable API; after eligibility only the Task 9 retention-aware compatibility API is allowed.

---

### Task 7: Pass Mike's taste checkpoint, then add iOS disclosure/control and local privacy sources

**Depends on:** Tasks 5–6 backend contracts. Mike's taste approval is required before any file edit in this task.
**Exclusive files:**

- Create: `ios/Tests/EvaluationContributionCodingTests.swift`
- Create: `ios/Tests/EvaluationContributionCopyTests.swift`
- Create: `ios/Throughline/Services/EvaluationContributionContract.swift`
- Create: `scripts/check-privacy-policy-parity.mjs`
- Create: `scripts/check-privacy-policy-parity.test.mjs`
- Modify: `ios/Throughline/Services/UploadClient.swift`
- Modify: `ios/Throughline/Models/ThroughlineNote.swift`
- Modify: `ios/Throughline/Views/HomeView.swift`
- Modify: `ios/Throughline.xcodeproj/project.pbxproj`
- Modify: `ios/Throughline/PrivacyInfo.xcprivacy`
- Modify: `docs/privacy-policy.md`
- Modify: `docs/privacy/index.html`
- Modify: `docs/app-store-readiness.md`
- Modify: `package.json`

**Interfaces:**

- Consumes: exact current API envelopes and contribution removal route.
- Produces Swift `EvaluationContributionRequest`, `EvaluationContributionState`, current `RecordingEditRequest`, and `removeEvaluationContribution(recordingID:idempotencyKey:)`.
- Recommended copy for review: `Private quality check. Saving this grade or a content correction may keep this recording's audio past 30 days until you remove the contribution. Not used to train models. Learn more.`

- [ ] **Step 1: Record Mike's product/design taste decision**

Present the recommended copy, grade/edit hierarchy, Learn more destination, and removal control. Record approval or exact replacement copy in `decision-log.md` before implementation. This checkpoint does not authorize onboarding, publication, App Store privacy answers, upload, TestFlight, submission, or a new binary.

- [ ] **Step 2: Write coding/copy/policy parity tests first**

```swift
let body = try JSONEncoder().encode(EvaluationContributionRequest.fixture)
let json = try JSONSerialization.jsonObject(with: body) as! [String: Any]
precondition(json["notice_version"] as? String == "private_evaluation_notice_v1")
precondition(json["should_remember"] == nil)
```

The copy test checks both grade and edit contribution surfaces expose the approved disclosure and removal action; it does not inspect onboarding. The Node parity test parses Markdown/HTML headings and required semantics, not raw byte equality.

- [ ] **Step 3: Witness RED**

Run: `swiftc -parse-as-library ios/Throughline/Services/EvaluationContributionContract.swift ios/Tests/EvaluationContributionCodingTests.swift ios/Tests/EvaluationContributionCopyTests.swift -o /private/tmp/throughline-eval-ios-tests && /private/tmp/throughline-eval-ios-tests`, then `node --test scripts/check-privacy-policy-parity.test.mjs`.
Expected RED: Swift compilation fails on missing contribution types and policy parity fails on the false permission-modal/Settings-withdrawal claims.

- [ ] **Step 4: Implement the approved quiet surfaces and local declarations**

Send UUID idempotency and current notice/disclosure versions with grade and material edit actions. Generate optimistic `base_revision_id`; expose removal without undoing the visible correction. Keep free-text explanation visually and technically separate from note-content edits and label it excluded from private evaluation.

Update Markdown and HTML in parity: describe contextual grade/content-correction contribution, private evaluation only, retention exception/removal/note/account deletion, no training/fine-tuning/automatic promotion/ads, and normal inference sharing boundary. Remove claims that a first-recording permission modal or existing Settings withdrawal flow exists. Add Analytics to Audio Data purposes in `PrivacyInfo.xcprivacy` only in the evaluation-linked-audio release source. Record ordinary third-party-AI inference permission as a separate unresolved App Store readiness risk; do not invent UI.

- [ ] **Step 5: Witness GREEN and build locally**

Run the exact Swift command from Step 3, `node --test scripts/check-privacy-policy-parity.test.mjs`, `npm run privacy:check`, and `xcodebuild -project ios/Throughline.xcodeproj -scheme Throughline -configuration Release -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/throughline-eval-derived CODE_SIGNING_ALLOWED=NO build`.
Expected GREEN: exact wire values/copy/parity pass; onboarding source hash is unchanged; build succeeds; no publication or upload occurs.

- [ ] **Step 6: Commit and review**

Commit: `feat(eval): disclose private evaluation controls`
Rollback before any eligible contribution: revert app/local declarations. After eligibility: app rollback may hide new contribution entry but must keep removal reachable through the retention-aware compatibility path; policy publication is separately gated.

---

### Task 8: Report aggregate lineage, benchmark, quarantine, and retention integrity

**Depends on:** Tasks 2–6 interfaces.
**Exclusive files:**

- Modify: `scripts/product-learning-report.mjs`
- Modify: `scripts/product-learning-report.test.mjs`
- Modify: `scripts/generate-product-dashboard.mjs`
- Modify: `product/metrics.md`

**Interfaces:**

- Consumes: count-only grouped database results plus content-free private benchmark summary.
- Produces `quality_evidence.complete_lineage_coverage`, `quality_evidence.independent_prediction_coverage`, and `quality_evidence.integrity_gate` (`pass`, `fail`, or `insufficient_sample_size`), plus aggregate retention/quarantine counts.

- [ ] **Step 1: Write aggregate/privacy tests first**

```js
test("benchmark claim requires both distinct integrity measures", () => {
  const snapshot = buildSnapshot({ lineage: {complete: 9,total: 10}, benchmark: {valid: 20,total: 20} });
  assert.equal(snapshot.quality_evidence.integrity_gate, "fail");
  assert.equal(snapshot.quality_evidence.winner, null);
});
test("serialized report excludes private evaluation values", () => {
  assert.doesNotMatch(JSON.stringify(buildSnapshot(privateTokens)),
    /PRIVATE_ID|PRIVATE_PATH|PRIVATE_TRANSCRIPT|PRIVATE_PROMPT|PRIVATE_FEEDBACK/);
});
```

- [ ] **Step 2: Witness RED**

Run: `npm run product:weekly:test`.
Expected RED: new assertions fail because `quality_evidence` is absent.

- [ ] **Step 3: Implement distinct measures and combined gate**

Query grouped counts only where possible; any private joins remain in memory and serialize aggregates only. Do not read quarantine text. Keep live-grade distributions distinct from offline scores. Report eligible post-cutover lineage numerator/denominator, benchmark valid/eligible cases, insufficient sample, copied/leak rejections, active/withdrawn contributions, standard-expired/evaluation-protected/deletion-error counts, and quarantine row count. A winner appears only when both coverage rates are 1, sealed-holdout validation passes, and sample status is sufficient.

- [ ] **Step 4: Witness GREEN**

Run `npm run product:weekly:test`, syntax-check/package the dashboard, and scan serialized fixtures for IDs, paths, audio, transcript, note, prompt, feedback, credentials, and provider responses.
Expected GREEN: report tests pass; each integrity measure remains separate; all privacy tokens are absent.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): report quality evidence integrity`
Rollback: hide the new dashboard section without altering private ledgers or retention behavior.

---

### Task 9: Roll out compatibility, owner canary, and content-free evidence

**Depends on:** Tasks 1–8, all reviews clean, and TL-DATA Task 6 rollout still verified.
**Exclusive files:**

- Create: `supabase/functions/_shared/evaluation-flags.ts`
- Create: `supabase/functions/_shared/evaluation-flags_test.ts`
- Create: `supabase/functions/api/retention-aware-compatibility_test.ts`
- Create: `docs/releases/2026-08-18-evaluation-truth-lineage-rollout.md`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/functions/api/index_test.ts`
- Modify: `docs/CURRENT_STATE.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/hosted-backend.md`

**Interfaces:**

- Consumes flags `THROUGHLINE_LINEAGE_WRITES_ENABLED`, `THROUGHLINE_EVALUATION_WRITES_ENABLED`, `THROUGHLINE_EVALUATION_RETENTION_ENABLED`, and `THROUGHLINE_EVAL_COMPATIBILITY_MODE=stable|retention_aware`.
- Produces a retention-aware compatibility build that sets all new-write flags false while keeping retention selection, contribution removal, note deletion, and account deletion active.

- [ ] **Step 1: Write flag matrix and rollback tests first**

```ts
Deno.test("retention-aware mode disables writes but preserves withdrawal", async () => {
  const flags = resolveEvaluationFlags({THROUGHLINE_EVAL_COMPATIBILITY_MODE:"retention_aware"});
  assertEquals(flags.lineageWrites, false);
  assertEquals(flags.evaluationWrites, false);
  assertEquals(flags.retentionEnforcement, true);
});
```

Test old client grade/edit acceptance without eligibility, stable rollback allowed only at zero eligible contributions, and retention-aware rollback required at one or more eligible contributions.

- [ ] **Step 2: Witness RED and establish predeploy evidence**

Run `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/inference-provider_test.ts supabase/functions/_shared/processing-lineage_test.ts supabase/functions/_shared/evaluation-contract_test.ts supabase/functions/_shared/note-revisions_test.ts supabase/functions/_shared/evaluation-retention_test.ts supabase/functions/_shared/evaluation-flags_test.ts supabase/functions/api/index_test.ts supabase/functions/api/retention-aware-compatibility_test.ts`, `node --test core/inference-contract.test.mjs evals/lib/private-manifest.test.mjs evals/run-private-audio.test.mjs evals/score-private-audio.test.mjs scripts/product-learning-report.test.mjs scripts/check-privacy-policy-parity.test.mjs`, `supabase test db supabase/tests/evaluation_truth_lineage_test.sql`, `supabase test db supabase/tests/evaluation_retention_test.sql`, the exact Swift executable command from Task 7 Step 3, and the exact unsigned Release build command from Task 7 Step 5.
Expected RED: flag/compatibility imports fail. All previously shipped suites must remain green; stop if any pre-existing gate fails.

- [ ] **Step 3: Implement flags and freeze both rollback bundles**

Default all three new behavior flags false. Build and hash the normal candidate and retention-aware compatibility bundle before migration. Record the TL-DATA stable API target for phase-one rollback and the new compatibility digest for phase two. The API refuses `stable` mode when the service-only aggregate active-eligibility count is nonzero.

- [ ] **Step 4: Witness GREEN locally and on a disposable database**

Re-run every exact command from Step 2 after implementation, then run `npm run eval:plumbing`, `npm run product:weekly:test`, and `npm run privacy:check`.
Expected GREEN: old/current contracts pass, compatibility mode honors retention/removal/deletion, schema tests pass, and release evidence contains no content or identifiers.

- [ ] **Step 5: Perform reversible production rollout in order**

Apply the additive migration; deploy with all flags false; run health, legacy-client, lineage-write, evaluation-write-disabled, retention-selection, and deletion canaries. Enable lineage writes and verify complete lineage on a controlled processing canary. Enable evaluation retention before evaluation writes. Only then enable evaluation writes.

The recording owner, privately identified outside tracked evidence, records their own canary and personally saves the grade or material correction. Agents do not choose or submit that human value. Verify owner linkage and deletion/withdrawal through content-free counts. A failed canary disables new writes and deploys the correct rollback phase.

- [ ] **Step 6: Record content-free release evidence and commit**

Record date, source commit, migration identity, API version/digest, contract hash, flag transitions, aggregate canary outcomes, policy publication state, compatibility digest, and rollback test. Do not record raw IDs, paths, content, grades, prompts, credentials, or provider responses. Narrowly update current state/architecture/runbook only for verified facts.

Commit: `docs(eval): record lineage rollout`
Rollback phase one: if active eligibility count is zero, disable flags and restore TL-DATA stable API. Rollback phase two: if active eligibility count is nonzero, deploy retention-aware compatibility; never restore a retention-unaware API.

## Whole-slice verification

- Production prompt bytes/hash and current provider/model behavior are unchanged.
- Every post-cutover operation has an immutable resolved contract and per-retry attempts; originals survive user edits.
- Owner requests are idempotent and revision-linked; service/legacy/no-op/action/product-feedback paths never create eligibility.
- Historical grades never protect audio without a new current disclosed contribution.
- Free text is reachable only through quarantine service paths and absent from every score/candidate/report/artifact.
- Private audio manifests, independent prediction coverage, and sealed holdouts pass; golden copying reports plumbing only.
- Complete-lineage and independent-prediction coverage remain distinct; the combined gate requires both.
- Standard/evaluation-linked retention, Storage-first withdrawal, note deletion, and account deletion pass.
- Markdown/HTML policy sources match, local privacy manifest purpose is updated only with the shipping feature, and ordinary AI-inference permission remains a named App Store risk.
- Old clients remain compatible; two-phase rollback is executable; content-free release evidence is complete.
