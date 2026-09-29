import {
  canonicalExtractionFields,
  resolveInferenceContract,
} from "../../../core/inference-contract.mjs";
import { runRecordingOperation } from "./processing-lineage.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function extractedNote() {
  return {
    type: "freeform",
    title: "Ship lineage",
    summary: "Persist each inference attempt without changing model behavior.",
    most_important: ["Persist immutable processing lineage"],
    todos: [],
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "focused",
    people: [],
    projects: ["Throughline"],
    tags: ["lineage"],
    centers_of_balance: ["profession"],
  };
}

Deno.test("a rate-limit retry remains inside one immutable operation", async () => {
  const contract = await resolveInferenceContract({ GROQ_MAX_RETRIES: "1" });
  let extractionCall = 0;
  const commit = await runRecordingOperation({
    recording_id: "rec_lineage_success",
    audio_bytes: new TextEncoder().encode("synthetic audio"),
    mime_type: "audio/m4a",
    metadata: { type: "freeform" },
  }, {
    contract,
    transcribeAttempt: () =>
      Promise.resolve({
        ok: true,
        value: "A synthetic transcript for contract testing.",
      }),
    extractAttempt: () => {
      extractionCall += 1;
      return Promise.resolve(
        extractionCall === 1
          ? {
            ok: false,
            failure_code: "rate_limited",
            retryable: true,
            private_body: "PRIVATE_PROVIDER_BODY",
          }
          : { ok: true, value: extractedNote() },
      );
    },
    sleep: () => Promise.resolve(),
  });

  assert(commit.operation.status === "succeeded", "Expected success");
  assert(commit.attempts.length === 3, "Expected transcription plus retry");
  assert(
    commit.attempts.map((attempt) =>
      `${attempt.stage}:${attempt.attempt_number}:${attempt.safe_failure_code}`
    ).join("|") ===
      "transcription:1:null|extraction:1:rate_limited|extraction:2:null",
    "Attempt order or safe failure lineage changed",
  );
  assert(
    commit.attempts.every((attempt) =>
      attempt.operation_id === commit.operation.operation_id
    ),
    "Attempt escaped its operation",
  );
  assert(
    commit.original_revision?.processing_operation_id ===
      commit.operation.operation_id,
    "Original revision lacks operation lineage",
  );
  assert(
    JSON.stringify(Object.keys(commit.original_revision!.canonical_output)) ===
      JSON.stringify(canonicalExtractionFields(contract)),
    "Original revision does not preserve the full canonical keyset",
  );
  assert(
    !JSON.stringify(commit).includes("PRIVATE_PROVIDER_BODY"),
    "Private provider body entered the commit",
  );
});

Deno.test("a failed operation contains safe attempts and no fake revision", async () => {
  const contract = await resolveInferenceContract({
    GROQ_TRANSCRIPTION_MAX_RETRIES: "0",
  });
  const commit = await runRecordingOperation({
    recording_id: "rec_lineage_failure",
    audio_bytes: new TextEncoder().encode("synthetic audio"),
    mime_type: "audio/m4a",
    metadata: {},
  }, {
    contract,
    transcribeAttempt: () =>
      Promise.resolve({
        ok: false,
        failure_code: "provider_response_invalid",
        retryable: false,
        private_body: "PRIVATE_PROVIDER_BODY",
      }),
  });

  assert(commit.operation.status === "failed", "Expected failed operation");
  assert(
    commit.original_revision === null,
    "Failed operation invented a revision",
  );
  assert(
    commit.operation.safe_failure_code === "provider_response_invalid",
    "Expected safe terminal failure",
  );
  assert(
    !JSON.stringify(commit).includes("PRIVATE_PROVIDER_BODY"),
    "Private provider body entered failed lineage",
  );
});
