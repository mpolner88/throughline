import {
  normalizeProductEventContract,
  PRODUCT_EVENT_NAMES,
  ProductEventContractError,
  sanitizeProductEventProperties,
} from "./product-event-contract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assertThrowsContractError(run: () => unknown, message: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof ProductEventContractError, message);
    return;
  }
  throw new Error(`${message}: expected ProductEventContractError`);
}

Deno.test("legacy schema-v1 events stay valid and unattributed", () => {
  const event = normalizeProductEventContract({
    event_name: "recording_processed",
    distribution_channel: "app_store",
    recording_id: "rec_should_not_be_linked",
    properties: { surface: "home" },
  });

  assertEquals(event, {
    schema_version: 1,
    distribution_channel: "unknown",
    recording_id: null,
    properties: { surface: "home" },
  }, "legacy event contract");
});

Deno.test("schema and distribution values are closed enums", () => {
  for (
    const distributionChannel of ["debug", "testflight", "app_store", "unknown"]
  ) {
    const event = normalizeProductEventContract({
      event_name: "app_opened",
      schema_version: 2,
      distribution_channel: distributionChannel,
    });
    assert(
      event.distribution_channel === distributionChannel,
      "allowed channel rejected",
    );
  }

  assertThrowsContractError(
    () =>
      normalizeProductEventContract({
        event_name: "app_opened",
        schema_version: 3,
      }),
    "unsupported schema accepted",
  );
  assertThrowsContractError(
    () =>
      normalizeProductEventContract({
        event_name: "app_opened",
        schema_version: 2,
        distribution_channel: "sandbox",
      }),
    "unsupported channel accepted",
  );
});

Deno.test("event names use the complete closed production vocabulary", () => {
  assertEquals(PRODUCT_EVENT_NAMES, [
    "first_opened",
    "app_opened",
    "onboarding_step_viewed",
    "onboarding_started",
    "demo_recording_started",
    "demo_recording_completed",
    "auth_started",
    "auth_confirmation_required",
    "auth_succeeded",
    "auth_failed",
    "home_viewed",
    "settings_opened",
    "recording_started",
    "recording_uploaded",
    "recording_processed",
    "recording_failed",
    "note_opened",
    "note_edited",
    "note_deleted",
    "action_item_toggled",
    "agent_connection_opened",
    "agent_token_created",
    "agent_token_revoked",
    "feedback_opened",
    "feedback_submitted",
    "feedback_submit_failed",
  ], "product event vocabulary");

  assertThrowsContractError(
    () => normalizeProductEventContract({ event_name: "unknown_event" }),
    "unknown event accepted",
  );
});

Deno.test("schema-v2 durable outcomes require a top-level recording reference", () => {
  for (const eventName of ["recording_uploaded", "recording_processed"]) {
    assertThrowsContractError(
      () =>
        normalizeProductEventContract({
          event_name: eventName,
          schema_version: 2,
        }),
      `${eventName} accepted without recording_id`,
    );
  }

  const processed = normalizeProductEventContract({
    event_name: "recording_processed",
    schema_version: 2,
    distribution_channel: "testflight",
    recording_id: "rec_valid_123",
  });
  assert(
    processed.recording_id === "rec_valid_123",
    "valid recording_id rejected",
  );

  assertThrowsContractError(
    () =>
      normalizeProductEventContract({
        event_name: "recording_processed",
        schema_version: 2,
        recording_id: "other_123",
      }),
    "invalid recording_id accepted",
  );
});

Deno.test("pre-record failures may omit a reference but processing failures may not", () => {
  const preRecordFailure = normalizeProductEventContract({
    event_name: "recording_failed",
    schema_version: 2,
    distribution_channel: "debug",
    properties: { stage: "pre_record", surface: "home" },
  });
  assert(
    preRecordFailure.recording_id === null,
    "pre-record failure requires a reference",
  );

  for (
    const stage of [
      "upload_or_processing",
      undefined,
      "not_a_stage",
      "processing",
    ]
  ) {
    assertThrowsContractError(
      () =>
        normalizeProductEventContract({
          event_name: "recording_failed",
          schema_version: 2,
          properties: stage === undefined ? { surface: "home" } : { stage },
        }),
      `${stage ?? "omitted"} failure accepted without recording_id`,
    );
  }

  assertThrowsContractError(
    () =>
      normalizeProductEventContract({
        event_name: "recording_failed",
        schema_version: 2,
        properties: { stage: "processing" },
      }),
    "processing failure accepted without recording_id",
  );
});

Deno.test("properties are event-allowlisted and value-constrained", () => {
  const properties = sanitizeProductEventProperties("recording_processed", {
    surface: "home",
    processing_status: "x".repeat(200),
    recording_id: "must-not-survive",
    auth_user_id: "must-not-survive",
    session_id: "must-not-survive",
    transcript_raw: "must-not-survive",
    feedback_text: "must-not-survive",
    email: "must-not-survive",
    arbitrary: "not allowlisted",
    score: Number.POSITIVE_INFINITY,
  });

  assertEquals(properties, { surface: "home" }, "property values");
  assert(
    !JSON.stringify(properties).includes("must-not-survive"),
    "reserved content or identifier survived",
  );
});

Deno.test("allowed property keys still reject identifier and content values", () => {
  const properties = sanitizeProductEventProperties("recording_failed", {
    surface: "person@example.com",
    stage: "processing",
    failure_type: "remember the private transcript",
    processing_status: "processed",
  });

  assertEquals(properties, {
    stage: "processing",
    processing_status: "processed",
  }, "categorical property validation");
});
