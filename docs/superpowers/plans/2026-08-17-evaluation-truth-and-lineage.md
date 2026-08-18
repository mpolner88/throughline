# Evaluation Truth and Immutable Lineage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:test-driven-development and superpowers:verification-before-completion on every task. Use the repository Supabase and Postgres skills for Tasks 3–6 and 9.

**Goal:** Make Throughline's private quality evidence honest, owner-authorized, retention-aware, and traceable from audio through immutable attempts, revisions, evaluations, and aggregate reporting.

**Architecture:** A shared immutable inference contract feeds both production processing and a private audio-first evaluation runner. The runner accepts only service-materialized, currently eligible private cases, executes provider adapters in a Deno runtime-enforced input-only permission sandbox, seals predictions, revalidates eligibility, and only then opens labels for scoring. Additive service-only Postgres ledgers and atomic RPCs preserve processing operations, attempts, revisions, structured evaluations, corpus materialization/invalidation events, quarantined text, and contribution lifecycle; compatibility API modules derive eligibility and retention server-side. iOS adds quiet contextual controls only after Mike's taste checkpoint, and rollout uses feature flags plus a retention-aware rollback target.

**Tech Stack:** Deno/TypeScript Supabase Edge Functions, PostgreSQL/pgTAP, Node.js ESM eval/report tooling, SwiftUI/Foundation, Supabase Storage, JSON Schema.

**Spec:** [Evaluation Truth and Immutable Lineage Slice](../../slices/evaluation-truth-and-lineage.md)

## Global constraints

- Do not begin Task 1 until `TL-DATA-001` Task 6 has a dated verified migration/API rollout record and passing canaries. Record that evidence link in the execution ledger before editing runtime files.
- Preserve production extraction prompt bytes and SHA-256 `c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135`. Historical eval SHA-256 `5e6781339777bf3d1e080088d405243a044efc891f4852b50824910adf449321` is drift evidence only.
- The recording owner is the only human evaluator. Service-token context must receive `403 human_evaluation_requires_owner`.
- Only an explicit 1–5 grade or material canonical note-content correction under `private_evaluation_notice_v1` and `private_evaluation_disclosure_v1` can create eligibility.
- `should_remember`, note opening, action toggling, inactivity, no-op save, product feedback, analytics, historical behavior, and legacy feedback never create eligibility.
- Historical grades/corrections require a new current disclosed contribution before they can protect audio.
- A grade is retention-eligible evidence about its evaluated control revision, not by itself a challenger expected output. Material corrections label only the smaller server-derived UI-editable field mask. Full-output benchmark eligibility requires deliberate current `agent_ready: true` acceptance tied to the exact evaluated revision, an owner-inspected preview, and a complete snapshot validated against the frozen production schema and normalizer; absent/null/false readiness never implies acceptance. Never infer review of untouched fields or self-copy a control output from a grade alone.
- Full-output truth derives from `ResolvedInferenceContractV1`/`PRODUCTION_EXTRACTION_SCHEMA_V1` and `PRODUCTION_NORMALIZER_SPEC_V1`, never an eval-local four-field list. The frozen current top-level keyset has exactly 14 keys and no extras: `type`, `title`, `summary`, `most_important`, `todos`, `priorities`, `intentions`, `accomplishments`, `tomorrow_todos`, `mood`, `people`, `projects`, `tags`, and `centers_of_balance`. Nested values, including todo objects, must pass the frozen schema with no extra keys.
- Real private manifests are service-materialized from current active eligibility and cannot be hand-authored. Synthetic manifests prove plumbing only and can never support a quality claim.
- Provider adapters run in a fail-closed permission sandbox with only explicitly staged audio/adapter/worker reads and allowlisted provider network/environment access. Repository, manifest, reference, and label roots are never readable or mounted; shell, subprocess, FFI, and write permissions are absent.
- Predictions must be sealed before a service revalidation of active membership. Labels remain closed unless that post-prediction revalidation succeeds; stale, withdrawn, deleted, policy-mismatched, or revoked cases fail scoring.
- Withdrawal, note deletion, and account deletion invalidate affected corpus cases and delete ephemeral/private raw evaluation artifacts. Content-free audit records may remain; no receipt, case identifier, token, raw path, or user identifier enters reports or analytics.
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
type LabelKind = "diagnostic_grade" | "reviewed_fields" | "accepted_full_output";
type LabelCompleteness = "diagnostic_only" | "reviewed_fields_only" | "complete_structured_output";
type CanonicalExtractionField =
  | "type" | "title" | "summary" | "most_important" | "todos"
  | "priorities" | "intentions" | "accomplishments" | "tomorrow_todos"
  | "mood" | "people" | "projects" | "tags" | "centers_of_balance";
type EditableCorrectionField = "title" | "summary" | "most_important" | "todos";
type RevisionKind = "original_model" | "user_content_correction" | "action_state";
type SafeFailureCode =
  | "configuration_missing" | "input_missing" | "timeout" | "rate_limited"
  | "provider_http" | "provider_response_invalid" | "storage_failed" | "unknown";
type EvaluationRunFailureCode =
  | "adapter_isolation_unavailable" | "adapter_policy_violation"
  | "materializer_receipt_invalid" | "stale_or_revoked_case"
  | "prediction_seal_invalid" | "reference_integrity_failed";
const NOTICE_VERSION = "private_evaluation_notice_v1";
const DISCLOSURE_VERSION = "private_evaluation_disclosure_v1";
const MANIFEST_VERSION = "throughline-private-audio-manifest-v1";
const PREDICTION_VERSION = "throughline-private-prediction-v1";
```

Owner grade request:

```json
{
  "idempotency_key": "00000000-0000-4000-8000-000000000101",
  "evaluated_revision_id": "00000000-0000-4000-8000-000000000103",
  "rubric_version": "extraction_quality_v1",
  "notice_version": "private_evaluation_notice_v1",
  "disclosure_version": "private_evaluation_disclosure_v1",
  "score": 4,
  "issue_codes": ["weak_summary"],
  "agent_ready": true,
  "agent_ready_preview": {
    "revision_id": "00000000-0000-4000-8000-000000000103",
    "canonical_output_sha256": "4444444444444444444444444444444444444444444444444444444444444444",
    "production_schema_sha256": "1111111111111111111111111111111111111111111111111111111111111111",
    "production_normalizer_sha256": "2222222222222222222222222222222222222222222222222222222222222222",
    "canonical_keyset_sha256": "3333333333333333333333333333333333333333333333333333333333333333",
    "preview_sha256": "5555555555555555555555555555555555555555555555555555555555555555"
  },
  "explanation": null
}
```

`agent_ready: true` is a full structured-output acceptance signal only when it is deliberately submitted on a current evaluation referencing the exact revision being materialized and carries the matching server-issued `AgentReadinessPreviewV1` binding. That revision may be `original_model` or `user_content_correction`. The preview exposes all canonical fields produced by the frozen schema/normalizer; if the revision, payload, schema, normalizer, or keyset changes, readiness resets and the server rejects the old binding. A grade with absent, null, or false readiness remains `diagnostic_grade`; a correction without matching readiness remains `reviewed_fields`.

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
  purpose: "real_private_quality" | "synthetic_plumbing";
  case_key: string;
  eligibility_source: EligibilitySource;
  disclosure_version: string;
  policy_version: string;
  materializer_receipt_sha256: Sha256;
  split: "development" | "sealed_holdout";
  audio: { path: string; sha256: Sha256; duration_ms: number; format: "m4a" | "wav" | "mp3" | "webm" };
  label: {
    kind: LabelKind;
    completeness: LabelCompleteness;
    editable_correction_mask: EditableCorrectionField[];
    transcript_explicitly_corrected: boolean;
    provenance_sha256: Sha256;
    reviewed_fields: null | {
      path: string; sha256: Sha256;
      field_mask: EditableCorrectionField[];
    };
    canonical_output: null | {
      path: string; sha256: Sha256;
      fields: CanonicalExtractionField[];
      production_schema_sha256: Sha256;
      production_normalizer_sha256: Sha256;
      canonical_keyset_sha256: Sha256;
    };
    transcript: null | {
      path: string; sha256: Sha256;
      completeness: "explicitly_corrected";
    };
  };
};
type AgentReadinessPreviewV1 = {
  revision_id: string;
  canonical_output_sha256: Sha256;
  production_schema_sha256: Sha256;
  production_normalizer_sha256: Sha256;
  canonical_keyset_sha256: Sha256;
  fields: CanonicalExtractionField[];
  preview_sha256: Sha256;
};
type PredictionAdapterInputV1 = {
  prediction_version: "throughline-private-prediction-v1";
  case_key: string;
  audio_path: string; audio_sha256: Sha256; duration_ms: number;
  format: "m4a" | "wav" | "mp3" | "webm";
  inference_contract_sha256: Sha256;
};
type ProcessingOperationV1 = {
  operation_id: string;
  recording_id: string;
  inference_contract_id: string;
  status: "started" | "succeeded" | "failed";
  safe_failure_code: SafeFailureCode | null;
  started_at: string;
  finished_at: string | null;
};
type CorpusMaterializerReceiptV1 = {
  receipt_version: "throughline-corpus-materializer-receipt-v1";
  corpus_id: string;
  policy_version: string;
  disclosure_version: "private_evaluation_disclosure_v1";
  stable_split_sha256: Sha256;
  content_set_sha256: Sha256;
  label_contract_set_sha256: Sha256;
  production_schema_sha256: Sha256;
  production_normalizer_sha256: Sha256;
  canonical_keyset_sha256: Sha256;
  case_count: number;
  diagnostic_case_count: number;
  reviewed_field_case_count: number;
  accepted_full_output_case_count: number;
  materialized_at: string;
  receipt_sha256: Sha256;
};
type CorpusRevalidationReceiptV1 = {
  receipt_version: "throughline-corpus-revalidation-receipt-v1";
  materializer_receipt_sha256: Sha256;
  prediction_bundle_sha256: Sha256;
  active_content_set_sha256: Sha256;
  active_label_contract_set_sha256: Sha256;
  production_schema_sha256: Sha256;
  production_normalizer_sha256: Sha256;
  canonical_keyset_sha256: Sha256;
  active_case_count: number;
  active_accepted_full_output_case_count: number;
  revalidated_at: string;
  receipt_sha256: Sha256;
};
type AdapterIsolationPolicyV1 = {
  staged_audio_path: string;
  staged_adapter_path: string;
  staged_worker_path: string;
  provider_hosts: string[];
  provider_env_names: string[];
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
- Produces: `resolveInferenceContract(env: Record<string,string|undefined>): Promise<ResolvedInferenceContractV1>`, `canonicalJson(value: unknown): string`, `sha256Hex(value: string|Uint8Array): Promise<Sha256>`, `canonicalExtractionFields(contract): CanonicalExtractionField[]`, `validateCanonicalExtractionSnapshot(value,contract): CanonicalExtractionV1`, `PRODUCTION_EXTRACTION_PROMPT`, `PRODUCTION_EXTRACTION_SCHEMA_V1`, and `PRODUCTION_NORMALIZER_SPEC_V1`.
- `ResolvedInferenceContractV1` contains `contract_version`, provider, resolved transcription/extraction model and request config, prompt/schema/normalizer versions and exact snapshots, each SHA-256, and one `contract_sha256` over canonical JSON.
- `canonicalExtractionFields` derives its ordered keyset from the frozen production schema snapshot; it is not an eval-owned field list. The current test oracle is exactly the 14 `CanonicalExtractionField` values above. `validateCanonicalExtractionSnapshot` applies the shared normalizer contract and recursive JSON Schema, rejects every missing/extra top-level or nested key, and validates todo objects against the current exact keys `text`, `status`, `priority`, `due`, `for_date`, and `context`.

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
test("frozen schema exposes the complete canonical keyset", async () => {
  assert.deepEqual(canonicalExtractionFields(await resolveInferenceContract({})), [
    "type", "title", "summary", "most_important", "todos", "priorities",
    "intentions", "accomplishments", "tomorrow_todos", "mood", "people",
    "projects", "tags", "centers_of_balance",
  ]);
  assert.equal(PRODUCTION_EXTRACTION_SCHEMA_V1.additionalProperties, false);
  assert.equal(PRODUCTION_EXTRACTION_SCHEMA_V1.properties.todos.items.additionalProperties, false);
});
```

- [ ] **Step 2: Witness RED**

Run: `node --test core/inference-contract.test.mjs core/extraction-pipeline.test.mjs`
Expected RED: module import fails because `core/inference-contract.mjs` does not exist. Run `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/api/index_test.ts`; expect the new resolved-contract assertion to fail because the API still owns anonymous constants.

- [ ] **Step 3: Implement the minimal shared contract**

Move the prompt bytes unchanged, express the complete recursive schema and normalizer specifications as canonical JSON data, resolve every provider/model/timeout/retry/temperature/response-format setting once, and make the API, core normalizer, readiness preview, and eval validator import those values. Derive canonical fields and keyset hash from the schema snapshot. Do not alter request payloads, retry counts, normalization output, or production defaults. Tests compare pre-refactor provider request bodies and normalized outputs byte-for-byte and reject schema/normalizer drift or any missing/extra/invalid nested canonical value.

- [ ] **Step 4: Witness GREEN and verify no behavior drift**

Run: `node --test core/inference-contract.test.mjs core/extraction-pipeline.test.mjs` and `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/api/index_test.ts`.
Expected GREEN: all tests pass; the prompt hash is approved; the frozen schema/normalizer and exact 14-key plus recursive todo contract are hashed and shared; provider request characterization snapshots are unchanged.

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
- Create: `evals/lib/adapter-isolation.mjs`
- Create: `evals/lib/adapter-isolation.test.mjs`
- Create: `evals/workers/private-adapter-worker.ts`
- Create: `evals/fixtures/adversarial/read-reference-adapter.mjs`
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
- Produces: `validatePrivateManifest(raw, root, {contract,verifyMaterializerReceipt}): Promise<ValidatedPrivateManifestV1>`, `validateAcceptedFullOutput(snapshot,label,contract): CanonicalExtractionV1`, `buildAdapterInput(caseRecord, contractHash): PredictionAdapterInputV1`, `verifyAdapterIsolation(policy): Promise<void>`, `runIsolatedAdapter({policy,input,providerEnv}): Promise<unknown>`, `sealPredictionBundle(bundle): Promise<SealedPredictionBundleV1>`, and `scorePrivateRun({manifest,sealedPredictions,revalidateEligibility,openPermittedLabels,split,minAcceptedFullOutputCases}): Promise<PrivateScoreReportV1>`.
- A `real_private_quality` manifest is valid only when `verifyMaterializerReceipt` confirms its immutable service-issued receipt, stable split hash, current disclosure/policy, content-set hash, label-contract-set hash, and exact production schema/normalizer/keyset hashes. `synthetic_plumbing` is the only hand-authored purpose and is structurally incapable of returning `quality_result`.
- `verifyAdapterIsolation` must prove a compatible Deno permission boundary is active or throw `adapter_isolation_unavailable`; there is no direct-command or unsandboxed fallback.
- `PrivateScoreReportV1` keeps `diagnostic_grade`, `reviewed_fields`, and `accepted_full_output` denominators/results separate. `status` is `quality_result`, `invalid_run`, or `insufficient_sample_size`; `winner` is always null unless at least 20 accepted-full-output cases pass all gates. Grade-only and partial-label results can never set `winner`.

- [ ] **Step 1: Write synthetic validator/runner/scorer tests first**

```js
test("adapter input contains audio but no expected or reference field", () => {
  const input = buildAdapterInput(syntheticCase, CONTRACT_HASH);
  assert.equal(input.audio_sha256, syntheticCase.audio.sha256);
  assert.equal("reference" in input, false);
  assert.equal("split" in input, false);
  assert.doesNotMatch(JSON.stringify(input), /expected|transcript_path|expected_output_sha256/);
});
test("adversarial adapter cannot read a sentinel reference before output", async () => {
  const result = await runAdversarialIsolationProbe();
  assert.equal(result.exitCode === 0, false);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /PermissionDenied/);
});
test("labels open only after a sealed bundle and active-membership revalidation", async () => {
  const calls = [];
  await scorePrivateRun({ ...eligibleRun,
    revalidateEligibility: async () => (calls.push("revalidate"), activeReceipt),
    openPermittedLabels: async () => (calls.push("labels"), references) });
  assert.deepEqual(calls, ["revalidate", "labels"]);
});
test("a grade-only case has no challenger reference or winner denominator", async () => {
  assert.equal(gradeOnlyCase.label.kind, "diagnostic_grade");
  assert.equal(gradeOnlyCase.label.reviewed_fields, null);
  assert.equal(gradeOnlyCase.label.canonical_output, null);
  assert.equal(gradeOnlyCase.label.transcript, null);
  assert.equal((await scorePrivateRun(gradeOnlyRun)).winner, null);
});
for (const field of EXPECTED_CURRENT_CANONICAL_FIELDS) {
  test(`full output rejects missing ${field}`, () => {
    const snapshot = structuredClone(validCanonicalSnapshot);
    delete snapshot[field];
    assert.throws(() => validateAcceptedFullOutput(snapshot, fullLabel, contract));
  });
}
test("full output rejects extras, contract drift, and invalid nested todos", () => {
  assert.throws(() => validateAcceptedFullOutput({ ...validCanonicalSnapshot, extra: true }, fullLabel, contract));
  assert.throws(() => validateAcceptedFullOutput(validCanonicalSnapshot, wrongSchemaHashLabel, contract));
  assert.throws(() => validateAcceptedFullOutput(validCanonicalSnapshot, wrongNormalizerHashLabel, contract));
  assert.throws(() => validateAcceptedFullOutput({ ...validCanonicalSnapshot,
    todos: [{ ...validCanonicalSnapshot.todos[0], unexpected: "value" }] }, fullLabel, contract));
});
test("a partial correction scores only its server-derived field mask", async () => {
  const report = await scorePrivateRun(summaryOnlyCorrectionRun);
  assert.deepEqual(report.reviewed_fields.denominator_fields, ["summary"]);
  assert.equal(report.accepted_full_output.denominator_cases, 0);
});
test("copied golden output is invalid rather than a quality pass", async () => {
  const report = await scorePrivateRun(copiedGoldenRun);
  assert.equal(report.status, "invalid_run");
  assert.equal(report.failure_code, "golden_or_copied_prediction");
  assert.equal(report.winner, null);
});
```

Table-driven tests cover illegal label-kind/completeness/reference combinations, grade-without-readiness expected-output presence, absent/null/false readiness, deliberate true readiness on both original and corrected exact revisions, partial-label fields outside `EditableCorrectionField`, transcript reference without explicit transcript correction, accepted-full-output without preview/exact-revision provenance, each of the 14 canonical keys missing in turn, every extra top-level/nested key, wrong schema/normalizer/keyset hash, invalid nested todo shape/value, non-canonical normalizer output, missing/extra/duplicate cases, stale/revoked, split-leaking, missing/forged materializer receipt, manifest/content/label-contract-set hash mismatch, prediction-contract mismatch, copied/golden output, and fewer than 20 accepted-full-output cases. A label-opener spy stays untouched when sealing or post-prediction revalidation fails.

- [ ] **Step 2: Witness RED**

Run: `node --test evals/lib/private-manifest.test.mjs evals/lib/adapter-isolation.test.mjs evals/run-private-audio.test.mjs evals/score-private-audio.test.mjs`
Expected RED: imports fail for the new manifest, isolation, runner, and scorer modules. Run `npm run eval:plumbing`; expect npm to fail because the script does not exist.

- [ ] **Step 3: Implement schemas, validator, runner, and scorer**

Ignore `/evals/private/`, `/evals/runs/private/`, and all temporary corpus staging. The synthetic fixture contains generated non-user content only and declares `purpose: synthetic_plumbing`. Reject any hand-authored `real_private_quality` manifest or receipt not verified by the service-side materializer/revalidator implemented in Task 5.

For every adapter invocation, create a fresh mode-`0700` staging directory outside the repository and copy in only the verified audio bytes, a single-file adapter bundle, and the trusted worker. Do not stage or pass the corpus manifest, split, repository root, reference paths, labels, or materializer receipt. Delete the staging directory in a `finally` path after output capture or any failure. Spawn with `shell: false`, a minimal environment, and this equivalent exact capability set:

```text
deno run --no-prompt --quiet
  --allow-read=<staged-audio>,<staged-adapter>,<staged-worker>
  --allow-net=<approved-provider-hosts>
  --allow-env=<approved-provider-env-names>
  <staged-worker> <staged-adapter>
```

Never pass `--allow-run`, `--allow-write`, `--allow-ffi`, a broad read root, or a shell. The repository, corpus-manifest, reference, and label roots must be outside the staging directory, never passed to the worker, and absent from Deno's read allowlist, so the Deno runtime-enforced permission boundary cannot read them. `verifyAdapterIsolation` runs an unhandled sentinel/reference read probe before accepting the first provider output; missing Deno, unsupported permission behavior, or a successful forbidden read fails closed as `adapter_isolation_unavailable`. A runtime permission violation fails the case as `adapter_policy_violation` and discards all stdout.

The runner verifies audio hashes, passes exactly `PredictionAdapterInputV1`, captures worker stdout in the parent, and writes a prediction bundle with manifest hash, contract hash, adapter identity, timestamps, and one prediction per case. It seals and hashes that complete bundle before scoring. The scorer then asks the service to revalidate every case against current active membership, label provenance, and the sealed prediction hash. Only a successful `CorpusRevalidationReceiptV1` permits `openPermittedLabels`, and that callback may return only the references allowed by the revalidated label contract. Stale/revoked membership, withdrawal/deletion, policy/disclosure drift, content/label-contract drift, or a seal mismatch returns `stale_or_revoked_case`, keeps all labels closed, and emits no quality result.

Enforce label combinations structurally: `diagnostic_grade` has an empty editable-correction mask and no reviewed/canonical-output or transcript reference; `reviewed_fields` has a nonempty server-derived `EditableCorrectionField` mask and exposes only those changed fields; transcript presence is governed by the separate `transcript_explicitly_corrected` flag. `accepted_full_output` requires receipt-bound deliberate `agent_ready: true` plus a matching inspected-preview binding for the exact current evaluated revision, original or corrected, and a full schema-valid `canonical_output`.

Derive full-output keys recursively from the frozen shared `ResolvedInferenceContractV1` schema and normalizer, not the editable field mask. Require exactly the current 14 top-level keys (`type`, `title`, `summary`, `most_important`, `todos`, `priorities`, `intentions`, `accomplishments`, `tomorrow_todos`, `mood`, `people`, `projects`, `tags`, `centers_of_balance`), no extras, valid nested todo/schema values and keys, the exact production schema/normalizer/keyset hashes, and a canonical fixed point under the shared normalizer. Never use an evaluated control output as an expected challenger result from a grade alone; the separate inspected readiness signal is required label provenance. Score diagnostic grades, reviewed editable fields, and accepted full canonical outputs under separate denominators; the sealed-holdout minimum, coverage, and winner logic use only accepted outputs satisfying the entire frozen contract.

Rename `eval:check` to `eval:plumbing`. Set `eval:quality` to require `--manifest evals/private/manifest.json --predictions evals/runs/private/latest --split sealed_holdout --min-accepted-full-output-cases 20`. Golden and historical transcript-fixture commands print `plumbing_only: true` and cannot emit `pass: true`.

- [ ] **Step 4: Witness GREEN**

Run: `node --test evals/lib/private-manifest.test.mjs evals/lib/adapter-isolation.test.mjs evals/run-private-audio.test.mjs evals/score-private-audio.test.mjs`, `npm run eval:plumbing`, and `node evals/score-private-audio.mjs --manifest evals/fixtures/synthetic/private-audio-manifest.json --predictions /private/tmp/throughline-eval-empty --split sealed_holdout --min-accepted-full-output-cases 20`.
Expected GREEN: isolation tests prove forbidden sentinel/reference access fails before output; labels remain unopened until seal and revalidation; grade-only/editable-partial/full-14-key denominators stay separate; every malformed, incomplete, extra-key, nested-schema, or contract-hash case fails; plumbing exits 0 with `plumbing_only`; the synthetic empty run exits nonzero with `insufficient_sample_size`, `winner: null`, and no content.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): require isolated private audio predictions`
Rollback: remove the new commands while retaining `eval:plumbing`; never restore a golden quality pass or an unsandboxed adapter path. Review staged files, Deno flags, child environment, and serialized adapter input byte-for-byte for label, split, receipt, and repository-path absence.

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
- Produces tables `throughline_inference_contracts`, immutable `throughline_processing_operations`, `throughline_inference_attempts`, `throughline_note_revisions`, `throughline_evaluations`, `throughline_evaluation_contributions`, `throughline_evaluation_text_quarantine`, immutable `throughline_evaluation_corpus_cases`, and append-only `throughline_evaluation_corpus_events`.
- `throughline_processing_operations` stores `operation_id`, required recording and inference-contract FKs, final status, nullable safe failure code, `started_at`, and nullable `finished_at`. Attempts carry required `operation_id`; every `original_model` revision and every evaluation carries an explicit `processing_operation_id` FK. Recordings add an indexed nullable `current_processing_operation_id` alongside `current_transcription_attempt_id`, `current_extraction_attempt_id`, and `current_note_revision_id`.
- Corpus cases bind the server-derived contribution, current disclosure/policy, stable split, label kind/completeness, `EditableCorrectionField` mask, separate transcript-correction state, exact-revision preview/readiness provenance, production schema/normalizer/keyset hashes, private content hashes, and immutable materializer receipt; corpus events append materialized, revalidated, invalidated, and raw-artifacts-deleted state without mutating case history.
- Produces RPCs `throughline_commit_processing_v1(jsonb)`, `throughline_commit_user_mutation_v1(jsonb)`, `throughline_commit_evaluation_v1(jsonb)`, `throughline_remove_contribution_v1(jsonb)`, `throughline_materialize_evaluation_corpus_v1(jsonb)`, `throughline_revalidate_evaluation_corpus_v1(jsonb)`, `throughline_invalidate_evaluation_corpus_v1(jsonb)`, and `throughline_retention_candidates_v1(timestamptz,timestamptz,integer)`.

- [ ] **Step 1: Create the migration through the CLI, then write pgTAP/contract tests before SQL**

Run `supabase migration new evaluation_truth_lineage` to create the empty migration through the CLI, then rename that untouched empty file to the reserved exact owned path `supabase/migrations/20260818000000_evaluation_truth_lineage.sql` before adding SQL. Abort if the reserved path already exists or the CLI creates more than one file.

```sql
select has_table('public','throughline_processing_operations');
select has_table('public','throughline_inference_attempts');
select has_index('public','throughline_inference_attempts','throughline_inference_attempts_recording_stage_idx');
select has_index('public','recordings','recordings_current_processing_operation_id_idx');
select throws_ok(
  $$ update public.throughline_note_revisions set revision_kind='action_state' $$,
  'P0001', 'immutable_row', 'note revisions reject updates');
select function_privs_are(
  'public','throughline_commit_evaluation_v1',array['jsonb'],
  'service_role',array['EXECUTE']);
```

- [ ] **Step 2: Witness RED on a disposable data-less database**

First run this exact contract-test command before implementing SQL or validators: `DENO_DIR=/private/tmp/throughline-eval-deno deno test supabase/functions/_shared/evaluation-db-contract_test.ts`.
Expected RED: the contract test fails because the `ProcessingOperationV1`, corpus receipt/revalidation, and RPC payload validators do not exist. Then run `supabase test db supabase/tests/evaluation_truth_lineage_test.sql` against the verified disposable data-less database; expect pgTAP to report the first missing `throughline_inference_contracts`/`throughline_processing_operations` table. Stop if either command unexpectedly passes, or if the database is not verified disposable or contains rows.

- [ ] **Step 3: Implement the additive model and RPCs**

Use UUID primary keys, `timestamptz`, JSONB snapshots with object checks, 64-hex hash checks, score 1–5 checks, bounded issue-code checks, idempotency uniques scoped to owner/recording/operation, and unique `(operation_id,stage,attempt_number)`. Insert one finalized immutable processing-operation row per provider operation after external work, with its recording and exact inference-contract FK; attempts, the `original_model` revision when present, and evaluations reference that same operation. Enforce the original-revision operation requirement with a check/constraint trigger and reject all operation updates as `immutable_row`. Every FK, including `current_processing_operation_id`, has a named index. Child ledgers cascade from account/recording; all recording current pointers use `ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED`, and deletion tests prove the recording/operation pointer cycle is safe.

The corpus materialization RPC derives candidates inside service context from active current contributions only; callers cannot supply recording IDs, contribution IDs, split assignments, content hashes, label kinds, field masks, schema/normalizer hashes, or readiness claims. It verifies current `private_evaluation_notice_v1`, `private_evaluation_disclosure_v1`, and policy version; derives the grade/editable-partial/full label contract; verifies the exact-revision preview/readiness binding; validates any full canonical snapshot recursively against the linked immutable inference contract; assigns and persists a stable split; binds the production schema/normalizer/keyset hashes and only permitted private audio/reference content hashes; appends a materialized event; and returns a canonical hashed `CorpusMaterializerReceiptV1`. The revalidation RPC takes only the materializer receipt hash and sealed prediction-bundle hash, rejects stale/revoked/deleted/policy-, label-provenance-, preview-, or production-contract-mismatched membership, recomputes the active content/label-contract/keyset hashes, appends a revalidated event, and returns `CorpusRevalidationReceiptV1`. The invalidation RPC appends content-free invalidation/deletion events; immutable historical case/event rows must not expose raw content and cascade on account/recording deletion where required.

All public tables enable RLS, have no client policies, revoke all from `public`, `anon`, and `authenticated`, and grant only required operations to `service_role`; immutable ledgers deny direct update. RPCs are `SECURITY INVOKER SET search_path = ''`, fully qualify every object, revoke execute from public/client roles, and grant execute only to `service_role`. Mutation RPCs lock the recording row, validate owner/base revision/idempotency, append rows, then advance nullable pointers atomically. pgTAP covers required operation FKs, the recording pointer/index, cycle-safe deletion, stable split/receipt uniqueness, service-only corpus RPC privileges, immutable cases/events, legal label-kind/completeness/reference combinations, editable-mask versus transcript separation, exact-revision preview/readiness provenance, production schema/normalizer/keyset hash constraints, current-policy filtering, and stale/revoked revalidation failure.

- [ ] **Step 4: Witness GREEN and run security review**

Run: `DENO_DIR=/private/tmp/throughline-eval-deno deno test supabase/functions/_shared/evaluation-db-contract_test.ts` and `supabase test db supabase/tests/evaluation_truth_lineage_test.sql`.
Expected GREEN: contract tests and pgTAP pass operation/corpus validators, explicit FKs, current-pointer indexes, cycle-safe deletion, stable receipts/splits, full-contract hash bindings, constraints, RLS, service-only privileges, immutability, idempotency, fixed search paths, stale/revoked/contract-drift rejection, and cascaded privacy deletion; the database remains data-less after rollback.

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
- Produces `runRecordingOperation(input,deps): Promise<ProcessingCommitV1>`. `ProcessingCommitV1` contains one immutable `ProcessingOperationV1`, exact `contract`, ordered `attempts`, and, on success, one `original_model` revision.
- Every `InferenceAttemptV1` carries the same required `operation_id`, stage, 1-based attempt number, status, safe failure code, latency, available usage/cost, input/output SHA-256, and private snapshots. The original revision carries `processing_operation_id`, the complete normalized 14-key canonical extraction snapshot, and its production schema/normalizer/keyset hashes; neither it nor an attempt can point to a different recording/contract operation. No row or log carries a raw provider body in `failure_detail`.

- [ ] **Step 1: Write provider retry and operation tests first**

```ts
Deno.test("a rate-limit retry creates two extraction attempts in one operation", async () => {
  const commit = await runRecordingOperation(input, depsReturning429ThenSuccess);
  assertEquals(commit.attempts.map(a => [a.stage,a.attempt_number,a.failure_code]),
    [["transcription",1,null],["extraction",1,"rate_limited"],["extraction",2,null]]);
  assertEquals(commit.original_revision.revision_kind, "original_model");
  assert(commit.attempts.every(a => a.operation_id === commit.operation.operation_id));
  assertEquals(commit.original_revision.processing_operation_id, commit.operation.operation_id);
  assert.deepEqual(Object.keys(commit.original_revision.canonical_output),
    canonicalExtractionFields(commit.contract));
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

Provider adapters return parsed values plus status/latency/usage, never raw bodies. Capture `started_at` and one operation UUID before calls; hash and snapshot transcription audio input/output and extraction transcript/input/output inside the first-party service boundary. Normalize extraction once with the frozen shared normalizer, require the result to pass its recursive production schema with exactly the derived 14-key set and no nested extras, and persist that complete canonical snapshot plus schema/normalizer/keyset hashes in the original revision. Build the finalized immutable operation and all attempts in memory while external calls run, then call the atomic processing RPC once. The RPC inserts the operation, contract, attempts, and original revision and advances all four recording pointers together. On a failed operation, persist the finalized failed operation with safe failure code plus completed/failed attempts, advance `current_processing_operation_id`, and create no fake original revision. Existing legacy recordings stay readable and have null lineage pointers; they cannot become full-output labels without current complete-contract evidence.

- [ ] **Step 4: Witness GREEN**

Run the focused Deno command above plus `npm run extraction:test`.
Expected GREEN: retries are distinct immutable attempts under one immutable operation; attempt/original-revision FKs equal the operation ID; recording pointers advance atomically; one original survives later mutations; request behavior remains compatible; and privacy-token scans find no provider body.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): persist processing lineage`
Rollback before eligibility: disable `THROUGHLINE_LINEAGE_WRITES_ENABLED` and use the verified TL-DATA stable API. No evaluation-linked retention exists yet.

---

### Task 5: Add owner evaluations and the service-only active corpus lifecycle

**Depends on:** Task 4 lineage pointers.
**Exclusive files:**

- Create: `supabase/functions/_shared/evaluation-contract.ts`
- Create: `supabase/functions/_shared/evaluation-contract_test.ts`
- Create: `supabase/functions/_shared/note-revisions.ts`
- Create: `supabase/functions/_shared/note-revisions_test.ts`
- Create: `supabase/functions/_shared/evaluation-corpus.ts`
- Create: `supabase/functions/_shared/evaluation-corpus_test.ts`
- Create: `evals/materialize-private-corpus.mjs`
- Create: `evals/materialize-private-corpus.test.mjs`
- Modify: `supabase/functions/api/index.ts`
- Modify: `supabase/functions/api/index_test.ts`

**Interfaces:**

- Consumes: owner grade and mutation envelopes, current operation/revision pointers, evaluation/user-mutation RPCs, and the service-only corpus RPCs from Task 3.
- Produces `normalizeEvaluationRequest`, `canonicalContentFingerprint`, `buildUserMutationCommit`, `buildAgentReadinessPreview(revision,contract): AgentReadinessPreviewV1`, `validateAgentReadinessBinding(request,revision,contract)`, `materializeActiveEvaluationCorpus({policyVersion,privateRoot},deps): Promise<CorpusMaterializerReceiptV1>`, and `revalidateSealedCorpus({materializerReceiptSha256,predictionBundleSha256},deps): Promise<CorpusRevalidationReceiptV1>`; owner routes add `GET /recordings/{id}/evaluation-readiness-preview?revision_id={uuid}` and retain `POST /recordings/{id}/evaluations`, current/legacy `PATCH /recordings/{id}`, and workflow-only `PATCH /recordings/{id}/action-items`.
- Current grade saves return `{evaluation_id,evaluated_revision_id,eligible,eligibility_source:"explicit_grade"}`. Current material corrections return `{recording,current_revision_id,material_change,eligible}`.
- Every evaluation records the explicit `processing_operation_id` server-derived through its evaluated revision; clients cannot choose or override it.
- Real corpus manifests are emitted only by `materializeActiveEvaluationCorpus` in service-role context into an ignored private root. Callers provide no case list, contribution IDs, split, content hashes, references, production-contract hashes, or eligibility claims. The immutable database receipt is mandatory; hand-authored `real_private_quality` manifests are invalid.

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
Deno.test("materializer derives current cases and preserves stable splits", async () => {
  const first = await materializeActiveEvaluationCorpus(requestWithoutCases, serviceDeps);
  const second = await materializeActiveEvaluationCorpus(requestWithoutCases, serviceDeps);
  assertEquals(first.stable_split_sha256, second.stable_split_sha256);
  assertEquals(serviceDeps.callerSuppliedCaseIds, []);
});
```

Also test score bounds, issue taxonomy/count, UUID idempotency, optimistic-revision conflict `409 revision_conflict`, same-key replay equality, different-key supersession, explicit evaluation-to-operation FK equality, quarantine separation, action toggles, `should_remember` ignored, historical feedback non-eligibility, service-only materializer/revalidator auth, unknown/caller-supplied case-field rejection, current notice/disclosure/policy filtering, server-derived current contribution, stable split reuse, sealed content/label-contract/production-contract/receipt hashes, grade-only null/false readiness with no reference, correction-only `EditableCorrectionField` masks, transcript exclusion unless explicitly corrected, complete 14-key readiness previews for original and corrected revisions, readiness rejection when any preview field/payload/revision/schema/normalizer/keyset hash changes, missing/extra/invalid nested canonical values, withdrawal between prediction and revalidation, and stale/revoked revalidation failure.

- [ ] **Step 2: Witness RED**

Run: `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/evaluation-contract_test.ts supabase/functions/_shared/note-revisions_test.ts supabase/functions/_shared/evaluation-corpus_test.ts supabase/functions/api/index_test.ts`, then `node --test evals/materialize-private-corpus.test.mjs`.
Expected RED: current evaluation route returns 404 and the evaluation/corpus contract imports fail.

- [ ] **Step 3: Implement current and compatibility paths**

Require authenticated owner context for current evaluation. Require `evaluated_revision_id`, lock the recording, and return `409 revision_conflict` unless it is still the exact current revision; derive its owner and processing operation, eligibility source, and disclosure provenance server-side. The owner-only preview route reads that exact revision's complete canonical snapshot, validates it against the immutable operation's shared production schema/normalizer, and returns an inspectable ordered view containing every derived canonical field plus payload/schema/normalizer/keyset hashes and one preview hash. It returns a safe fail-closed error if any canonical field cannot be shown or validated.

Store only bounded structured values, including nullable `agent_ready`, in `throughline_evaluations`; absent/null/false is never acceptance. True requires the matching server-issued preview binding, and the server recomputes every hash under the row lock before accepting it. A changed revision, canonical payload, schema, normalizer, keyset, or preview hash returns `409 agent_readiness_preview_stale`; a missing binding returns `422 agent_readiness_preview_required`. Insert optional explanation only into quarantine.

Current note mutation canonicalizes title, summary, transcript, most-important items, and todo content; its `EditableCorrectionField` mask contains only the four UI-editable canonical fields whose values changed. Transcript change is recorded separately. Build every current revision's complete canonical snapshot by applying those editable changes to the base revision's 14-key snapshot, then revalidate it recursively with the same production schema/normalizer and preserve the linked hashes. This never treats the other ten canonical fields as edited, but it keeps them available for truthful owner inspection. Create `content_correction` eligibility only when the editable fingerprint or separate transcript changes under both current disclosure versions. Action-state revisions preserve workflow history but carry no eligibility. Legacy feedback/edit decoding remains accepted, ignores `should_remember`, and cannot extend retention or produce `accepted_full_output` without a current complete snapshot and inspected readiness.

Implement materialization behind service-role authorization only. Query the RPC without caller case identifiers; require a currently active server-derived `explicit_grade` or `content_correction`, current notice/disclosure and policy, and available source audio. Derive label contracts from immutable records: a grade with null/false readiness is `diagnostic_grade` and has no reference; a correction without matching readiness is `reviewed_fields` and contains only values in its server-derived `EditableCorrectionField` mask; transcript is separate and included only when explicitly corrected. A current `agent_ready: true` evaluation becomes `accepted_full_output` only when its exact-revision preview binding still matches and its canonical snapshot contains exactly every field derived from the frozen production schema, no extras, recursively valid nested values, and matching production schema/normalizer/keyset hashes. Never derive a gold output from grade alone, treat unedited fields as corrected, or claim completeness for an uninspectable field.

Persist a stable development/holdout assignment on first eligibility and reuse it. Copy only label-contract-permitted raw inputs/references to a receipt-scoped, private, short-lived artifact root, hash bytes there, write the generated manifest atomically, and seal canonical case ordering, split hash, content-set hash, label-contract-set hash, production schema/normalizer/keyset hashes, label-kind counts, timestamp, and materializer receipt. The manifest has `purpose: real_private_quality`; no other writer may create it. Stdout/logs/audit expose aggregate counts and safe codes only.

Revalidation accepts only the immutable materializer receipt hash plus already sealed prediction-bundle hash. Requery and lock active contribution/corpus membership; require unchanged current disclosure/policy/split/content/label-contract hashes, exact-revision preview/readiness provenance, and production schema/normalizer/keyset hashes; revalidate the full snapshot recursively; reject any withdrawal, note/account deletion, unavailable audio, contract drift, or case drift as `stale_or_revoked_case`; and return a canonical sealed `CorpusRevalidationReceiptV1`. It does not return/open references; the Task 2 scorer uses receipt success as the only gate to open label-contract-permitted references. Synthetic manifests bypass neither this gate nor the `plumbing_only` result.

- [ ] **Step 4: Witness GREEN**

Run the Deno and Node commands above and `npm run note:edit:smoke` against the local compatibility API only.
Expected GREEN: owner/evaluation and service-only corpus tests pass; repeated materialization preserves sealed split/content/label/production-contract hashes; grade, editable-partial, and inspected full-14-key label kinds are derived correctly; any incomplete/extra/invalid/uninspectable/drifted full snapshot fails; revoked cases fail post-prediction revalidation; legacy smoke remains accepted; current replays are idempotent; and no quarantine text, case identifier, raw path, receipt, or token appears in stdout/logs.

- [ ] **Step 5: Commit and review**

Commit: `feat(eval): add owner contributions and active corpus`
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

- Consumes: `throughline_retention_candidates_v1`, `throughline_remove_contribution_v1`, `throughline_invalidate_evaluation_corpus_v1`, Storage/private-artifact deletion, corpus cases/events, and contribution ledger.
- Produces `selectRetentionAction(candidate): "delete_standard"|"protect_evaluation"|"delete_eligibility_ended"`, `purgeCorpusCaseArtifacts(scope,deps): Promise<ArtifactDeletionReceiptV1>`, `DELETE /recordings/{id}/evaluation-contribution`, and retention/invalidation summary counts only.

- [ ] **Step 1: Write retention/deletion tests first**

```ts
Deno.test("historical grade without current disclosure never protects old audio", () => {
  assertEquals(selectRetentionAction(historicalGradeCandidate), "delete_standard");
});
Deno.test("old audio is deleted before withdrawal commits", async () => {
  await removeContribution(oldEligibleRecording, orderedDeps);
  assertEquals(orderedDeps.calls, [
    "storage.delete_audio", "artifacts.delete_private_raw",
    "rpc.remove_contribution_and_invalidate"
  ]);
});
```

Test active protection, current withdrawal, Storage/artifact 404 idempotency, retryable deletion failure with eligibility preserved, note deletion, account deletion, concurrent materialization/revalidation locking, case invalidation, materializer artifact removal, adapter-staging `finally` cleanup, linked quarantine/evaluation cascade, corrected visible note persistence, batch limits, and no raw paths/IDs/receipts in responses/logs.

- [ ] **Step 2: Witness RED**

Run: `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/evaluation-retention_test.ts supabase/functions/api/index_test.ts`.
Expected RED: retention module import fails and contribution-removal route returns 404.

- [ ] **Step 3: Implement fail-closed retention**

Use the RPC's server-derived candidate reason. Protect only active current-disclosure contributions with still-available audio. `purgeCorpusCaseArtifacts` deletes receipt-scoped service artifacts and any registered ephemeral/private raw copies; Task 2 independently removes its per-adapter staging in `finally`. For withdrawal, note deletion, or account deletion, lock the affected contribution/corpus cases, reject new materialization/revalidation, delete all affected private corpus artifacts (and already-old source audio where applicable), then atomically remove/cascade the contribution and append invalidated/raw-artifacts-deleted events. Corrected visible note content remains unless the note itself is deleted.

On any non-404 audio/artifact deletion failure return `503 evaluation_withdrawal_retryable`, leave eligibility/case state active and retryable, and permit no quality scoring from an in-flight receipt. Once invalidated, all old materializer and revalidation receipts fail closed as `stale_or_revoked_case`; only content-free timestamps, reason codes, and aggregate counts remain auditable. Retention responses expose counts by reason and safe error code only. Update the runbook with ordinary 30-day behavior, the current-contribution exception, invalidation/artifact cleanup, and rollback warning.

- [ ] **Step 4: Witness GREEN**

Run the Deno command above and `supabase test db supabase/tests/evaluation_retention_test.sql` against the verified disposable data-less database.
Expected GREEN: each candidate is acted on once; old historical grades expire normally; withdrawal/note/account deletion invalidates cases and deletes private raw artifacts; stale receipts cannot score; and all locking, retry, cleanup, and deletion-order tests pass.

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

- Consumes: exact current API envelopes, owner-only readiness-preview route, and contribution removal route.
- Produces Swift `EvaluationContributionRequest`, `AgentReadinessPreview`, `CanonicalFieldPreviewRow`, `AgentReadinessChoice` (default `.notAccepted`), `EvaluationContributionState`, current `RecordingEditRequest`, and `removeEvaluationContribution(recordingID:idempotencyKey:)`. Evaluation requests carry the exact loaded `evaluated_revision_id`; only a deliberate `.accepted` choice after a complete matching preview encodes `agent_ready: true` plus its preview binding.
- Recommended copy for review: `Private quality check. Saving this grade or a content correction may keep this recording's audio past 30 days until you remove the contribution. Not used to train models. Learn more.`

- [ ] **Step 1: Record Mike's product/design taste decision**

Present the recommended disclosure, grade/edit hierarchy, Learn more destination, removal control, and a quiet explicit readiness control next to an inspectable `What your agent will read` preview. The preview must show every canonical field/value in the frozen production contract, including the ten fields outside the smaller edit form, before acceptance can be enabled. Explain that readiness accepts the exact previewed revision/output; correction save alone labels only editable changed fields, and transcript remains separate/unlabeled unless explicitly corrected. Do not imply the user edited or inspected any field the UI did not actually show. Record Mike's approval or exact replacement copy/control in `decision-log.md` before implementation. This checkpoint does not authorize onboarding, publication, App Store privacy answers, upload, TestFlight, submission, or a new binary.

- [ ] **Step 2: Write coding/copy/policy parity tests first**

```swift
let body = try JSONEncoder().encode(EvaluationContributionRequest.fixture)
let json = try JSONSerialization.jsonObject(with: body) as! [String: Any]
precondition(json["notice_version"] as? String == "private_evaluation_notice_v1")
precondition(json["should_remember"] == nil)
precondition(json["evaluated_revision_id"] as? String == EvaluationContributionRequest.fixture.evaluatedRevisionID.uuidString.lowercased())
precondition(json["agent_ready"] as? Bool == false)

let accepted = EvaluationContributionRequest.fixture.withReadiness(.accepted)
let acceptedJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(accepted)) as! [String: Any]
precondition(acceptedJSON["agent_ready"] as? Bool == true)
precondition((acceptedJSON["agent_ready_preview"] as? [String: Any])?["preview_sha256"] != nil)
```

Using synthetic values only, assert the preview renders exactly the schema-derived current fields `type`, `title`, `summary`, `most_important`, `todos`, `priorities`, `intentions`, `accomplishments`, `tomorrow_todos`, `mood`, `people`, `projects`, `tags`, and `centers_of_balance`, with no hidden or extra field; nested todos render inspectably. Also encode legacy/nil-readiness and prove absent is never true. State tests prove readiness defaults off, correction save alone does not flip it, incomplete/invalid/unrenderable previews disable the control, and any changed canonical payload/output hash, schema hash, normalizer hash, keyset hash, or revision resets readiness and removes the binding. Only an explicit tap after the complete exact preview encodes true. Copy tests cover disclosure, truthful preview/readiness meaning, and removal; they do not inspect onboarding. The Node parity test parses Markdown/HTML headings and required semantics, not raw byte equality.

- [ ] **Step 3: Witness RED**

Run: `swiftc -parse-as-library ios/Throughline/Services/EvaluationContributionContract.swift ios/Tests/EvaluationContributionCodingTests.swift ios/Tests/EvaluationContributionCopyTests.swift -o /private/tmp/throughline-eval-ios-tests && /private/tmp/throughline-eval-ios-tests`, then `node --test scripts/check-privacy-policy-parity.test.mjs`.
Expected RED: Swift compilation fails on missing contribution types and policy parity fails on the false permission-modal/Settings-withdrawal claims.

- [ ] **Step 4: Implement the approved quiet surfaces and local declarations**

Fetch the owner-only preview for the exact loaded revision and render every schema-derived canonical field/value under the Mike-approved quiet `What your agent will read` treatment; recursively render todos and other nested values, without claiming editability. Fail closed and keep readiness disabled if any field cannot be validated or displayed. Send UUID idempotency, exact loaded `evaluated_revision_id`, and current notice/disclosure versions with grade actions; send optimistic `base_revision_id` with material edits. Keep readiness off by default. A correction save alone sends no readiness acceptance. Encode `agent_ready: true` and `agent_ready_preview` only after deliberate acceptance of the complete exact preview. Reset on payload/schema/normalizer/keyset/revision change; on `409 revision_conflict` or preview-stale, require a fresh preview rather than replaying acceptance. Expose removal without undoing the visible correction. Keep free-text explanation visually and technically separate from note-content edits and label it excluded from private evaluation.

Update Markdown and HTML in parity: describe contextual grade/content-correction contribution, private evaluation only, retention exception/removal/note/account deletion, no training/fine-tuning/automatic promotion/ads, and normal inference sharing boundary. Remove claims that a first-recording permission modal or existing Settings withdrawal flow exists. Add Analytics to Audio Data purposes in `PrivacyInfo.xcprivacy` only in the evaluation-linked-audio release source. Record ordinary third-party-AI inference permission as a separate unresolved App Store readiness risk; do not invent UI.

- [ ] **Step 5: Witness GREEN and build locally**

Run the exact Swift command from Step 3, `node --test scripts/check-privacy-policy-parity.test.mjs`, `npm run privacy:check`, and `xcodebuild -project ios/Throughline.xcodeproj -scheme Throughline -configuration Release -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/throughline-eval-derived CODE_SIGNING_ALLOWED=NO build`.
Expected GREEN: exact wire values/copy/parity pass; all 14 canonical fields and nested values are inspectable before acceptance; missing/unrenderable/drifted preview state fails closed; default/nil/false readiness never becomes full-output acceptance; deliberate true binds the exact preview/revision/production contract; correction alone stays partial-label; onboarding source hash is unchanged; build succeeds; no publication or upload occurs.

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

- Consumes: count-only grouped database results plus a content-free private benchmark summary produced only after service materialization, isolated prediction, sealing, and active-membership revalidation.
- Produces `quality_evidence.complete_lineage_coverage`, separate `diagnostic_grade_cases`, `reviewed_field_coverage`, full-frozen-schema-only `independent_prediction_coverage`, and `quality_evidence.integrity_gate` (`pass`, `fail`, or `insufficient_sample_size`), plus aggregate operation, materialization/revalidation/invalidation, isolation-failure, retention, and quarantine counts.

- [ ] **Step 1: Write aggregate/privacy tests first**

```js
test("benchmark claim requires both distinct integrity measures", () => {
  const snapshot = buildSnapshot({ lineage: {complete: 9,total: 10}, benchmark: {valid: 20,total: 20} });
  assert.equal(snapshot.quality_evidence.integrity_gate, "fail");
  assert.equal(snapshot.quality_evidence.winner, null);
});
test("grade-only and partial corrections never enter winner denominator", () => {
  const snapshot = buildSnapshot({ benchmark: { diagnostic: 40, reviewedFields: 30, acceptedFull: 0 } });
  assert.equal(snapshot.quality_evidence.independent_prediction_coverage.denominator, 0);
  assert.equal(snapshot.quality_evidence.winner, null);
});
test("incomplete or contract-drifted full outputs never enter coverage", () => {
  const snapshot = buildSnapshot({ benchmark: {
    acceptedFull: 20, fullFrozenSchemaValid: 18, schemaHashMatches: false,
  }});
  assert.equal(snapshot.quality_evidence.independent_prediction_coverage.numerator, 0);
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

Query grouped counts only where possible; any private joins remain in memory and serialize aggregates only. Do not read quarantine text or raw corpus artifacts. Keep live-grade/diagnostic distributions distinct from offline editable-reviewed-field scores and full-output scores. Report eligible post-cutover lineage; grade-only diagnostic count; reviewed-field numerator/denominator from `EditableCorrectionField` masks; and accepted-full-output cases only when owner-inspected preview provenance, all 14 schema-derived canonical keys with no extras, nested schema validity, exact production schema/normalizer/keyset hashes, verified materializer receipts, sandboxed predictions, valid seals, and post-prediction revalidation all pass. Report each contract-integrity rejection category separately in aggregate.

`independent_prediction_coverage`, its minimum sample, holdout validation, and winner denominator use only the full frozen production contract—not the four editable fields or a partial projection. A winner appears only when both required coverage rates are 1, every counted full-output case is still active and contract-valid at scoring, and sample status is sufficient; grade-only, partial-label, incomplete-key, extra-key, invalid-nested, unpreviewed, or contract-drifted volume can never satisfy it.

Serialized reports, dashboards, fixtures, and analytics must exclude case/recording/contribution/operation identifiers, receipt and content hashes, raw paths, split assignments below aggregate counts, audio, transcript/note/reference/prediction content, free text, credentials, and provider responses. Synthetic/plumbing runs can report only `plumbing_only` and never enter independent-prediction coverage.

- [ ] **Step 4: Witness GREEN**

Run `npm run product:weekly:test`, syntax-check/package the dashboard, and scan serialized fixtures for IDs, receipts/hashes, paths, audio, transcript, note, reference, prediction, prompt, feedback, credentials, and provider responses.
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

Run `DENO_DIR=/private/tmp/throughline-eval-deno deno test --allow-env supabase/functions/_shared/inference-provider_test.ts supabase/functions/_shared/processing-lineage_test.ts supabase/functions/_shared/evaluation-contract_test.ts supabase/functions/_shared/note-revisions_test.ts supabase/functions/_shared/evaluation-corpus_test.ts supabase/functions/_shared/evaluation-retention_test.ts supabase/functions/_shared/evaluation-flags_test.ts supabase/functions/api/index_test.ts supabase/functions/api/retention-aware-compatibility_test.ts`, `DENO_DIR=/private/tmp/throughline-eval-deno deno test supabase/functions/_shared/evaluation-db-contract_test.ts`, `node --test core/inference-contract.test.mjs evals/lib/private-manifest.test.mjs evals/lib/adapter-isolation.test.mjs evals/materialize-private-corpus.test.mjs evals/run-private-audio.test.mjs evals/score-private-audio.test.mjs scripts/product-learning-report.test.mjs scripts/check-privacy-policy-parity.test.mjs`, `supabase test db supabase/tests/evaluation_truth_lineage_test.sql`, `supabase test db supabase/tests/evaluation_retention_test.sql`, the exact Swift executable command from Task 7 Step 3, and the exact unsigned Release build command from Task 7 Step 5.
Expected RED: flag/compatibility imports fail. All previously shipped suites must remain green; stop if any pre-existing gate fails.

- [ ] **Step 3: Implement flags and freeze both rollback bundles**

Default all three new behavior flags false. Build and hash the normal candidate and retention-aware compatibility bundle before migration. Record the TL-DATA stable API target for phase-one rollback and the new compatibility digest for phase two. The API refuses `stable` mode when the service-only aggregate active-eligibility count is nonzero.

- [ ] **Step 4: Witness GREEN locally and on a disposable database**

Re-run every exact command from Step 2 after implementation, then run `npm run eval:plumbing`, `npm run product:weekly:test`, and `npm run privacy:check`.
Expected GREEN: old/current contracts pass, compatibility mode honors retention/removal/deletion, schema tests pass, and release evidence contains no content or identifiers.

- [ ] **Step 5: Perform reversible production rollout in order**

Apply the additive migration; deploy with all flags false; run health, legacy-client, lineage-write, evaluation-write-disabled, retention-selection, and deletion canaries. Enable lineage writes and verify complete lineage on a controlled processing canary. Enable evaluation retention before evaluation writes. Only then enable evaluation writes.

The recording owner, privately identified outside tracked evidence, records their own canary and personally saves the grade or material correction. Agents do not choose or submit that human value or readiness choice. First verify a grade with readiness off remains diagnostic and a correction alone remains reviewed-fields. Only after the owner opens the approved `What your agent will read` preview, can inspect all 14 schema-derived canonical fields and nested values, and deliberately accepts that exact revision/payload/production contract may the case become accepted-full-output. For the private quality canary, the service materializer recursively validates the complete snapshot and seals stable manifest/content/label/schema/normalizer/keyset hashes; the isolated Deno worker predicts from staged audio only; the parent seals the prediction bundle; the service revalidates active membership, exact preview/readiness, and the frozen production contract against that seal; and only then does the scorer open the permitted private reference and score. Verify operation/evaluation FK linkage, owner linkage, full-schema denominator separation, isolation-probe denial-before-output, contract-drift/stale-receipt rejection, and deletion/withdrawal through content-free aggregate outcomes. A failed canary keeps labels closed, disables new writes, deletes ephemeral/private raw artifacts, and deploys the correct rollback phase.

- [ ] **Step 6: Record content-free release evidence and commit**

Record date, source commit, migration identity, API version/digest, contract hash, flag transitions, aggregate canary outcomes, policy publication state, compatibility digest, and rollback test. Do not record raw IDs, paths, content, grades, prompts, credentials, or provider responses. Narrowly update current state/architecture/runbook only for verified facts.

Commit: `docs(eval): record lineage rollout`
Rollback phase one: if active eligibility count is zero, disable flags and restore TL-DATA stable API. Rollback phase two: if active eligibility count is nonzero, deploy retention-aware compatibility; never restore a retention-unaware API.

## Whole-slice verification

- Production prompt bytes/hash and current provider/model behavior are unchanged.
- Every post-cutover operation is an immutable recording/contract/status row; attempts, original revisions, and evaluations carry explicit operation FKs; current pointers/indexes and cycle-safe deletion pass.
- Owner requests are idempotent and revision-linked; service/legacy/no-op/action/product-feedback paths never create eligibility.
- `CanonicalExtractionField` derives from the frozen production schema/normalizer and is exactly the current 14-key, recursively validated, no-extra-key contract; `EditableCorrectionField` remains the smaller four-field UI correction mask and transcript stays separate.
- Grade-only evidence remains diagnostic; partial corrections score only server-derived editable changed fields; only deliberate readiness after an inspectable all-canonical-field preview tied to the exact revision/payload/contract enters the accepted-full-output winner denominator. Transcript stays unlabeled unless explicitly corrected.
- Historical grades never protect audio without a new current disclosed contribution.
- Free text is reachable only through quarantine service paths and absent from every score/candidate/report/artifact.
- Real manifests are service-materialized from current active contributions with stable sealed split/content/label hashes plus frozen production schema/normalizer/keyset hashes and immutable receipts; hand-authored/synthetic manifests are plumbing only.
- Provider adapters run in a Deno runtime-enforced input-only permission sandbox with exact staged reads and allowlisted provider net/env only; repository/manifest/reference roots, shell/run, FFI, and writes remain unavailable, and adversarial reference access fails before output.
- Predictions seal before current-membership revalidation; labels open only afterward. Withdrawal/note/account deletion invalidates cases, deletes ephemeral/private raw artifacts, and makes stale/revoked cases fail scoring.
- Complete-lineage and independent-prediction coverage remain distinct; full-output minimum/coverage/winner denominators include only complete schema-valid 14-key snapshots with no extras, valid nested todos, matching production hashes, and inspected readiness; the combined gate requires both.
- Ordinary 30-day and current-contribution retention, Storage/artifact-first withdrawal, note deletion, account deletion, and content-free invalidation audit pass; historical grades never gain extended retention without new current disclosed contribution.
- Markdown/HTML policy sources match, local privacy manifest purpose is updated only with the shipping feature, and ordinary AI-inference permission remains a named App Store risk.
- Old clients remain compatible; two-phase rollback is executable; content-free release evidence is complete.
