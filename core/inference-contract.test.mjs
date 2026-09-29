import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalExtractionFields,
  canonicalJson,
  PRODUCTION_EXTRACTION_PROMPT,
  PRODUCTION_EXTRACTION_SCHEMA_V1,
  PRODUCTION_NORMALIZER_SPEC_V1,
  resolveInferenceContract,
  sha256Hex,
  validateCanonicalExtractionSnapshot,
} from "./inference-contract.mjs";

const EXPECTED_FIELDS = [
  "type",
  "title",
  "summary",
  "most_important",
  "todos",
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "mood",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
];

function completeSnapshot() {
  return {
    type: "morning",
    title: "Ship the release",
    summary: "Ship the small release and verify it.",
    most_important: [
      "Ship the release",
      "Verify the release",
      "Keep it small",
    ],
    todos: [{
      text: "Verify the release",
      status: "open",
      priority: "high",
      due: null,
      for_date: "2026-08-23",
      context: "After deployment",
    }],
    priorities: ["Ship the release"],
    intentions: ["Keep it small"],
    accomplishments: [],
    tomorrow_todos: ["Verify the release"],
    mood: "focused",
    people: [],
    projects: ["Throughline"],
    tags: ["launch"],
    centers_of_balance: ["profession"],
  };
}

test("production prompt bytes retain the approved hash", async () => {
  assert.equal(
    await sha256Hex(PRODUCTION_EXTRACTION_PROMPT),
    "c05627ec47177eb06719267bdeea9c0c2253931f11862d9ccead012f27c52135",
  );
});

test("canonical JSON sorts object keys recursively without reordering arrays", () => {
  assert.equal(
    canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [{ d: 4, c: 5 }] }),
    '{"a":{"b":3,"y":2},"list":[{"c":5,"d":4}],"z":1}',
  );
  assert.throws(
    () => canonicalJson({ bad: undefined }),
    /canonical_json_invalid/u,
  );
});

test("resolved overrides change contract identity without changing prompt bytes", async () => {
  const base = await resolveInferenceContract({});
  const changed = await resolveInferenceContract({ GROQ_MAX_RETRIES: "4" });
  assert.notEqual(base.contract_sha256, changed.contract_sha256);
  assert.equal(base.prompt.sha256, changed.prompt.sha256);
  assert.equal(base.prompt.snapshot, PRODUCTION_EXTRACTION_PROMPT);
  assert.deepEqual(base.provider, {
    name: "groq",
    base_url: "https://api.groq.com/openai/v1",
  });
  assert.deepEqual(base.transcription, {
    model: "whisper-large-v3-turbo",
    timeout_ms: 60000,
    max_retries: 3,
    response_format: "json",
  });
  assert.deepEqual(base.extraction, {
    model: "openai/gpt-oss-120b",
    timeout_ms: 60000,
    max_retries: 3,
    temperature: 0,
    response_format: { type: "json_object" },
  });
});

test("invalid numeric overrides fail closed instead of changing runtime behavior", async () => {
  for (
    const env of [
      { GROQ_MAX_RETRIES: "-1" },
      { GROQ_MAX_RETRIES: "1.5" },
      { GROQ_TIMEOUT_MS: "zero" },
      { GROQ_TRANSCRIPTION_TIMEOUT_MS: "0" },
    ]
  ) {
    await assert.rejects(
      () => resolveInferenceContract(env),
      /inference_contract_env_invalid/u,
    );
  }
});

test("frozen schema exposes the complete canonical keyset", async () => {
  const contract = await resolveInferenceContract({});
  assert.deepEqual(canonicalExtractionFields(contract), EXPECTED_FIELDS);
  assert.equal(PRODUCTION_EXTRACTION_SCHEMA_V1.additionalProperties, false);
  assert.equal(
    PRODUCTION_EXTRACTION_SCHEMA_V1.properties.todos.items.additionalProperties,
    false,
  );
  assert.deepEqual(
    PRODUCTION_EXTRACTION_SCHEMA_V1.properties.todos.items.required,
    ["text", "status", "priority", "due", "for_date", "context"],
  );
  assert.equal(
    contract.schema.keyset_sha256,
    await sha256Hex(canonicalJson(EXPECTED_FIELDS)),
  );
  assert.equal(contract.normalizer.snapshot, PRODUCTION_NORMALIZER_SPEC_V1);
});

test("canonical snapshot validation is recursive, exact, and normalized", async () => {
  const contract = await resolveInferenceContract({});
  assert.deepEqual(
    validateCanonicalExtractionSnapshot(completeSnapshot(), contract),
    completeSnapshot(),
  );

  const missing = completeSnapshot();
  delete missing.tags;
  assert.throws(
    () => validateCanonicalExtractionSnapshot(missing, contract),
    /canonical_extraction_invalid/u,
  );

  assert.throws(
    () =>
      validateCanonicalExtractionSnapshot(
        { ...completeSnapshot(), action_items: [] },
        contract,
      ),
    /canonical_extraction_invalid/u,
  );

  const nestedExtra = completeSnapshot();
  nestedExtra.todos[0] = { ...nestedExtra.todos[0], completed_at: null };
  assert.throws(
    () => validateCanonicalExtractionSnapshot(nestedExtra, contract),
    /canonical_extraction_invalid/u,
  );

  const invalidNested = completeSnapshot();
  invalidNested.todos[0].status = "done";
  assert.throws(
    () => validateCanonicalExtractionSnapshot(invalidNested, contract),
    /canonical_extraction_invalid/u,
  );
});
