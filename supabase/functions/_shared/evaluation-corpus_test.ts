import {
  materializeActiveEvaluationCorpus,
  revalidateSealedCorpus,
} from "./evaluation-corpus.ts";
import {
  canonicalJson,
  resolveInferenceContract,
  sha256Hex,
} from "../../../core/inference-contract.mjs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function rejects(code: string, run: () => unknown | Promise<unknown>) {
  try {
    await run();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    assert(error instanceof Error, "Expected an Error");
    assert(error.message === code, `Expected ${code}, got ${error.message}`);
  }
}

const canonical = {
  type: "freeform",
  title: "A private note",
  summary: "A grounded summary.",
  most_important: ["A grounded point"],
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

async function fixtureDeps() {
  const contract = await resolveInferenceContract({});
  const canonicalHash = await sha256Hex(canonicalJson(canonical));
  const calls: string[] = [];
  const candidates = [
    {
      contribution_id: "00000000-0000-4000-8000-000000000701",
      eligibility_source: "explicit_grade",
      disclosure_version: "private_evaluation_disclosure_v1",
      policy_version: "private_evaluation_policy_v1",
      agent_ready: false,
      revision_id: "00000000-0000-4000-8000-000000000711",
      canonical_snapshot: canonical,
      canonical_output_sha256: canonicalHash,
      production_schema_sha256: contract.schema.sha256,
      production_normalizer_sha256: contract.normalizer.sha256,
      canonical_keyset_sha256: contract.schema.keyset_sha256,
      editable_correction_mask: [],
      transcript_explicitly_corrected: false,
      audio_sha256: "a".repeat(64),
      audio_mime_type: "audio/m4a",
      audio_duration_ms: 1200,
    },
    {
      contribution_id: "00000000-0000-4000-8000-000000000702",
      eligibility_source: "content_correction",
      disclosure_version: "private_evaluation_disclosure_v1",
      policy_version: "private_evaluation_policy_v1",
      agent_ready: false,
      revision_id: "00000000-0000-4000-8000-000000000712",
      canonical_snapshot: { ...canonical, title: "Corrected title" },
      canonical_output_sha256: await sha256Hex(
        canonicalJson({ ...canonical, title: "Corrected title" }),
      ),
      production_schema_sha256: contract.schema.sha256,
      production_normalizer_sha256: contract.normalizer.sha256,
      canonical_keyset_sha256: contract.schema.keyset_sha256,
      editable_correction_mask: ["title"],
      transcript_explicitly_corrected: false,
      audio_sha256: "b".repeat(64),
      audio_mime_type: "audio/wav",
      audio_duration_ms: 2200,
    },
    {
      contribution_id: "00000000-0000-4000-8000-000000000703",
      eligibility_source: "explicit_grade",
      disclosure_version: "private_evaluation_disclosure_v1",
      policy_version: "private_evaluation_policy_v1",
      agent_ready: true,
      revision_id: "00000000-0000-4000-8000-000000000713",
      canonical_snapshot: canonical,
      canonical_output_sha256: canonicalHash,
      production_schema_sha256: contract.schema.sha256,
      production_normalizer_sha256: contract.normalizer.sha256,
      canonical_keyset_sha256: contract.schema.keyset_sha256,
      readiness_preview_sha256: "c".repeat(64),
      editable_correction_mask: [],
      transcript_explicitly_corrected: false,
      audio_sha256: "d".repeat(64),
      audio_mime_type: "audio/webm",
      audio_duration_ms: 3200,
    },
  ];
  const deps: any = {
    contract,
    requireService() {
      calls.push("authorize");
    },
    async fetchActiveCandidates(policyVersion: string) {
      calls.push(`fetch:${policyVersion}`);
      return structuredClone(candidates);
    },
    async stageCase(candidate: any, identity: any) {
      calls.push(`stage:${identity.case_key}`);
      return {
        audio: {
          path: `${identity.case_key}/audio.bin`,
          sha256: candidate.audio_sha256,
          duration_ms: candidate.audio_duration_ms,
          format: candidate.audio_mime_type.split("/")[1],
        },
        reviewed_fields: candidate.eligibility_source === "content_correction"
          ? {
            path: `${identity.case_key}/reviewed.json`,
            sha256: "e".repeat(64),
          }
          : null,
        canonical_output: candidate.agent_ready
          ? {
            path: `${identity.case_key}/canonical.json`,
            sha256: candidate.canonical_output_sha256,
          }
          : null,
        transcript: null,
      };
    },
    async persistMaterialization(value: any) {
      calls.push(`persist:${value.cases.length}`);
      return { source_set_sha256: "f".repeat(64) };
    },
    async fetchActiveReceipt() {
      return null;
    },
    now: () => "2026-08-22T22:00:00.000Z",
    newUuid: () => "00000000-0000-4000-8000-000000000799",
  };
  return {
    contract,
    calls,
    deps,
  };
}

Deno.test("materializer rejects caller-supplied case or eligibility fields", async () => {
  const { deps } = await fixtureDeps();
  await rejects(
    "corpus_request_field_forbidden",
    () =>
      materializeActiveEvaluationCorpus({
        policyVersion: "private_evaluation_policy_v1",
        privateRoot: "/private/tmp/corpus",
        cases: [],
      } as any, deps),
  );
});

Deno.test("materializer derives diagnostic, reviewed, and accepted labels", async () => {
  const { deps, calls } = await fixtureDeps();
  const result = await materializeActiveEvaluationCorpus({
    policyVersion: "private_evaluation_policy_v1",
    privateRoot: "/private/tmp/corpus",
  }, deps);
  assert(result.manifest.cases.length === 3, "Expected all active cases");
  assert(
    JSON.stringify(
      result.manifest.cases.map((item: any) => item.label.kind).sort(),
    ) ===
      JSON.stringify([
        "accepted_full_output",
        "diagnostic_grade",
        "reviewed_fields",
      ]),
    "Expected server-derived label kinds",
  );
  assert(
    result.receipt.diagnostic_case_count === 1,
    "Expected diagnostic count",
  );
  assert(
    result.receipt.reviewed_field_case_count === 1,
    "Expected reviewed count",
  );
  assert(
    result.receipt.accepted_full_output_case_count === 1,
    "Expected full count",
  );
  assert(calls.at(-1) === "persist:3", "Persistence must happen after staging");
});

Deno.test("materialization preserves stable split and sealed set hashes", async () => {
  const firstFixture = await fixtureDeps();
  const secondFixture = await fixtureDeps();
  const first = await materializeActiveEvaluationCorpus({
    policyVersion: "private_evaluation_policy_v1",
    privateRoot: "/private/tmp/corpus-a",
  }, firstFixture.deps);
  const second = await materializeActiveEvaluationCorpus({
    policyVersion: "private_evaluation_policy_v1",
    privateRoot: "/private/tmp/corpus-b",
  }, secondFixture.deps);
  assert(
    first.receipt.stable_split_sha256 === second.receipt.stable_split_sha256,
    "Split assignments must be stable",
  );
  assert(
    first.receipt.content_set_sha256 === second.receipt.content_set_sha256,
    "Content set must be stable",
  );
  assert(
    first.receipt.label_contract_set_sha256 ===
      second.receipt.label_contract_set_sha256,
    "Label contract set must be stable",
  );
});

Deno.test("accepted full output fails when readiness or contract evidence drifts", async () => {
  const fixture = await fixtureDeps();
  const original = fixture.deps.fetchActiveCandidates;
  fixture.deps.fetchActiveCandidates = async (policyVersion: string) => {
    const values = await original(policyVersion);
    values[2].production_schema_sha256 = "0".repeat(64);
    return values;
  };
  await rejects(
    "corpus_candidate_contract_invalid",
    () =>
      materializeActiveEvaluationCorpus({
        policyVersion: "private_evaluation_policy_v1",
        privateRoot: "/private/tmp/corpus",
      }, fixture.deps),
  );
});

Deno.test("post-prediction revalidation seals only the still-active set", async () => {
  const fixture = await fixtureDeps();
  fixture.deps.fetchActiveReceipt = async () => ({
    valid: true,
    active_content_set_sha256: "1".repeat(64),
    active_label_contract_set_sha256: "2".repeat(64),
    production_schema_sha256: fixture.contract.schema.sha256,
    production_normalizer_sha256: fixture.contract.normalizer.sha256,
    canonical_keyset_sha256: fixture.contract.schema.keyset_sha256,
    active_case_count: 3,
    active_accepted_full_output_case_count: 1,
  });
  const receipt = await revalidateSealedCorpus({
    materializerReceiptSha256: "3".repeat(64),
    predictionBundleSha256: "4".repeat(64),
  }, fixture.deps);
  assert(receipt.active_case_count === 3, "Expected active membership count");
  assert(
    /^[0-9a-f]{64}$/.test(receipt.receipt_sha256),
    "Expected sealed receipt",
  );
});

Deno.test("withdrawn or drifted cases fail revalidation closed", async () => {
  const fixture = await fixtureDeps();
  fixture.deps.fetchActiveReceipt = async () => ({
    valid: false,
    reason_code: "stale_or_revoked_case",
  });
  await rejects("stale_or_revoked_case", () =>
    revalidateSealedCorpus({
      materializerReceiptSha256: "3".repeat(64),
      predictionBundleSha256: "4".repeat(64),
    }, fixture.deps));
});
