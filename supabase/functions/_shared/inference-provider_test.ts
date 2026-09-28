import {
  type ProviderAttemptOutcome,
  runInferenceProviderStage,
} from "./inference-provider.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("rate limiting produces a separate safe retry attempt", async () => {
  let call = 0;
  const result = await runInferenceProviderStage<string>({
    operationId: crypto.randomUUID(),
    recordingId: "rec_provider_retry",
    stage: "extraction",
    maxRetries: 1,
    inputSnapshot: { transcript_sha256: "a".repeat(64) },
    runAttempt: () => {
      call += 1;
      return Promise.resolve(
        call === 1
          ? {
            ok: false,
            failure_code: "rate_limited",
            retryable: true,
            private_body: "PRIVATE_PROVIDER_BODY",
          } as ProviderAttemptOutcome<string>
          : { ok: true, value: "done" } as ProviderAttemptOutcome<string>,
      );
    },
    sleep: () => Promise.resolve(),
  });

  assert(result.value === "done", "Expected retry value");
  assert(result.attempts.length === 2, "Expected two immutable attempts");
  assert(
    result.attempts[0].safe_failure_code === "rate_limited",
    "Expected safe rate-limit classification",
  );
  assert(
    !JSON.stringify(result).includes("PRIVATE_PROVIDER_BODY"),
    "Provider body crossed the safe boundary",
  );
});

Deno.test("non-retryable provider bodies never enter the thrown error", async () => {
  let message = "";
  try {
    await runInferenceProviderStage({
      operationId: crypto.randomUUID(),
      recordingId: "rec_provider_failure",
      stage: "transcription",
      maxRetries: 0,
      inputSnapshot: { audio_sha256: "b".repeat(64) },
      runAttempt: () =>
        Promise.resolve({
          ok: false,
          failure_code: "provider_http",
          retryable: false,
          private_body: "PRIVATE_PROVIDER_BODY",
        }),
    });
  } catch (error) {
    message = String(error instanceof Error ? error.message : error);
  }
  assert(message === "provider_http", "Expected only a safe failure code");
  assert(!message.includes("PRIVATE_PROVIDER_BODY"), "Provider body leaked");
});
