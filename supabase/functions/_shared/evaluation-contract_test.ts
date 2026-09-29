import {
  AGENT_READINESS_PREVIEW_VERSION,
  buildAgentReadinessPreview,
  normalizeEvaluationRequest,
  validateAgentReadinessBinding,
} from "./evaluation-contract.ts";
import {
  canonicalJson,
  resolveInferenceContract,
  sha256Hex,
} from "../../../core/inference-contract.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertRejects(code: string, run: () => unknown | Promise<unknown>) {
  return Promise.resolve().then(run).then(
    () => {
      throw new Error(`Expected ${code}`);
    },
    (error) => {
      assert(error instanceof Error, "Expected an Error");
      assert(error.message === code, `Expected ${code}, got ${error.message}`);
    },
  );
}

const ids = {
  evaluation: "00000000-0000-4000-8000-000000000201",
  revision: "00000000-0000-4000-8000-000000000202",
  idempotency: "00000000-0000-4000-8000-000000000203",
};

const canonical = {
  type: "freeform",
  title: "A note",
  summary: "A grounded summary.",
  most_important: ["A grounded summary"],
  todos: [],
  priorities: [],
  intentions: [],
  accomplishments: [],
  tomorrow_todos: [],
  mood: "neutral",
  people: [],
  projects: [],
  tags: [],
  centers_of_balance: [],
};

Deno.test("evaluation requests require current disclosure and bounded structured feedback", () => {
  const request = normalizeEvaluationRequest({
    evaluation_id: ids.evaluation,
    evaluated_revision_id: ids.revision,
    idempotency_key: ids.idempotency,
    score: 4,
    issue_codes: ["weak_summary", "weak_summary"],
    notice_version: "private_evaluation_notice_v1",
    disclosure_version: "private_evaluation_disclosure_v1",
    policy_version: "private_evaluation_policy_v1",
    should_remember: true,
  });
  assert(request.score === 4, "Expected the exact score");
  assert(
    request.issue_codes.length === 1,
    "Issue codes should be deduplicated",
  );
  assert(
    !("should_remember" in request),
    "Legacy retention input must be ignored",
  );
  assert(request.agent_ready === false, "Readiness must default off");
});

Deno.test("evaluation requests reject score, taxonomy, and version drift", async () => {
  const base = {
    evaluation_id: ids.evaluation,
    evaluated_revision_id: ids.revision,
    idempotency_key: ids.idempotency,
    score: 5,
    issue_codes: [],
    notice_version: "private_evaluation_notice_v1",
    disclosure_version: "private_evaluation_disclosure_v1",
    policy_version: "private_evaluation_policy_v1",
  };
  await assertRejects(
    "evaluation_score_invalid",
    () => normalizeEvaluationRequest({ ...base, score: 6 }),
  );
  await assertRejects(
    "evaluation_issue_code_invalid",
    () => normalizeEvaluationRequest({ ...base, issue_codes: ["free_text"] }),
  );
  await assertRejects(
    "evaluation_disclosure_version_invalid",
    () => normalizeEvaluationRequest({ ...base, disclosure_version: "old" }),
  );
});

Deno.test("readiness preview exposes and seals the complete production keyset", async () => {
  const contract = await resolveInferenceContract({});
  const revision = {
    revision_id: ids.revision,
    canonical_snapshot: canonical,
    canonical_output_sha256: await sha256Hex(canonicalJson(canonical)),
    production_schema_sha256: contract.schema.sha256,
    production_normalizer_sha256: contract.normalizer.sha256,
    canonical_keyset_sha256: contract.schema.keyset_sha256,
  };
  const preview = await buildAgentReadinessPreview(revision, contract);
  assert(
    preview.preview_version === AGENT_READINESS_PREVIEW_VERSION,
    "Expected versioned preview",
  );
  assert(
    preview.canonical_fields.length === 14,
    "All 14 fields must be inspectable",
  );
  assert(
    preview.canonical_fields[0].field === "type",
    "Order must be canonical",
  );
  assert(
    preview.canonical_fields.at(-1)?.field === "centers_of_balance",
    "Expected the final canonical field",
  );
  assert(
    /^[0-9a-f]{64}$/.test(preview.preview_sha256),
    "Preview must be sealed",
  );

  const request = normalizeEvaluationRequest({
    evaluation_id: ids.evaluation,
    evaluated_revision_id: ids.revision,
    idempotency_key: ids.idempotency,
    score: 5,
    issue_codes: [],
    notice_version: "private_evaluation_notice_v1",
    disclosure_version: "private_evaluation_disclosure_v1",
    policy_version: "private_evaluation_policy_v1",
    agent_ready: true,
    agent_readiness_preview: preview,
  });
  const verified = await validateAgentReadinessBinding(
    request,
    revision,
    contract,
  );
  assert(
    verified.preview_sha256 === preview.preview_sha256,
    "Binding should match",
  );
});

Deno.test("readiness fails closed on missing binding or revision drift", async () => {
  const contract = await resolveInferenceContract({});
  const revision = {
    revision_id: ids.revision,
    canonical_snapshot: canonical,
    canonical_output_sha256: await sha256Hex(canonicalJson(canonical)),
    production_schema_sha256: contract.schema.sha256,
    production_normalizer_sha256: contract.normalizer.sha256,
    canonical_keyset_sha256: contract.schema.keyset_sha256,
  };
  const base = {
    evaluation_id: ids.evaluation,
    evaluated_revision_id: ids.revision,
    idempotency_key: ids.idempotency,
    score: 5,
    issue_codes: [],
    notice_version: "private_evaluation_notice_v1",
    disclosure_version: "private_evaluation_disclosure_v1",
    policy_version: "private_evaluation_policy_v1",
  };
  await assertRejects(
    "agent_readiness_preview_required",
    () => normalizeEvaluationRequest({ ...base, agent_ready: true }),
  );

  const preview = await buildAgentReadinessPreview(revision, contract);
  const request = normalizeEvaluationRequest({
    ...base,
    agent_ready: true,
    agent_readiness_preview: preview,
  });
  await assertRejects(
    "agent_readiness_preview_stale",
    () =>
      validateAgentReadinessBinding(request, {
        ...revision,
        revision_id: "00000000-0000-4000-8000-000000000299",
      }, contract),
  );
});
