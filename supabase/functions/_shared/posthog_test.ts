import {
  buildPostHogBatch,
  captureProductEventsInPostHog,
  deleteProductAnalyticsUserFromPostHog,
  type PostHogCaptureConfig,
  postHogDistinctId,
  type ProductEventRow,
} from "./posthog.ts";

const captureConfig: PostHogCaptureConfig = {
  projectToken: "phc_test",
  ingestHost: "https://us.i.posthog.com",
  analyticsIdSecret: "test-secret",
  environment: "test",
};

const signedInRow: ProductEventRow = {
  id: "evt_123e4567-e89b-42d3-a456-426614174000",
  auth_user_id: "123e4567-e89b-42d3-a456-426614174001",
  session_id: "123e4567-e89b-42d3-a456-426614174002",
  occurred_at: "2026-08-06T12:00:00.000Z",
  event_name: "recording_processed",
  platform: "ios",
  app_version: "1.0.1",
  build_number: "2026080601",
  schema_version: 2,
  distribution_channel: "testflight",
  is_internal_user: true,
  recording_id: "rec_private_recording_reference",
  properties: { processing_mode: "live", success: true },
};

Deno.test("PostHog identifiers are deterministic, scoped, and do not reveal source IDs", async () => {
  const first = await postHogDistinctId(
    "user",
    signedInRow.auth_user_id!,
    "test-secret",
  );
  const second = await postHogDistinctId(
    "user",
    signedInRow.auth_user_id!,
    "test-secret",
  );
  const session = await postHogDistinctId(
    "session",
    signedInRow.auth_user_id!,
    "test-secret",
  );

  if (first !== second) throw new Error("Expected deterministic identifiers");
  if (first === session) {
    throw new Error("Expected user and session identifiers to be scoped");
  }
  if (first.includes(signedInRow.auth_user_id!)) {
    throw new Error("Source identifier leaked");
  }
});

Deno.test("PostHog batch contains only sanitized product properties", async () => {
  const [event] = await buildPostHogBatch([signedInRow], captureConfig);

  if (event.event !== "recording_processed") {
    throw new Error("Wrong event name");
  }
  if (
    event.uuid === "123e4567-e89b-42d3-a456-426614174000" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        event.uuid,
      )
  ) {
    throw new Error("Event UUID must be keyed and pseudonymous");
  }
  if (event.properties["$process_person_profile"] !== true) {
    throw new Error("Signed-in event must be identified");
  }
  if (event.properties["$geoip_disable"] !== true) {
    throw new Error("GeoIP must be disabled");
  }
  if (event.properties.app_version !== "1.0.1") {
    throw new Error("App version missing");
  }
  if (event.properties.schema_version !== 2) {
    throw new Error("Server schema version missing");
  }
  if (event.properties.distribution_channel !== "testflight") {
    throw new Error("Server distribution channel missing");
  }
  if (event.properties.is_internal_user !== true) {
    throw new Error("Server internal classification missing");
  }
  if (JSON.stringify(event).includes(signedInRow.recording_id!)) {
    throw new Error("Recording reference leaked");
  }
  if (JSON.stringify(event).includes(signedInRow.auth_user_id!)) {
    throw new Error("Auth user ID leaked");
  }
  if (JSON.stringify(event).includes(signedInRow.session_id)) {
    throw new Error("Raw session ID leaked");
  }
});

Deno.test("anonymous PostHog events do not create person profiles", async () => {
  const [event] = await buildPostHogBatch(
    [{ ...signedInRow, auth_user_id: null, event_name: "app_opened" }],
    captureConfig,
  );

  if (event.properties["$process_person_profile"] !== false) {
    throw new Error("Anonymous event must be personless");
  }
  if (!event.distinct_id.startsWith("tl_session_")) {
    throw new Error("Anonymous event must use the pseudonymous session ID");
  }
});

Deno.test("capture uses the batch endpoint and project token only in the body", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetcher: typeof fetch = (url, init) => {
    requestUrl = String(url);
    requestInit = init;
    return Promise.resolve(new Response("ok", { status: 200 }));
  };

  const result = await captureProductEventsInPostHog(
    [signedInRow],
    captureConfig,
    fetcher,
  );
  const body = JSON.parse(String(requestInit?.body));

  if (requestUrl !== "https://us.i.posthog.com/batch/") {
    throw new Error("Wrong capture URL");
  }
  if (
    requestInit?.headers &&
    JSON.stringify(requestInit.headers).includes("phc_test")
  ) {
    throw new Error(
      "Project token must not be sent as an authorization header",
    );
  }
  if (body.api_key !== "phc_test" || body.batch.length !== 1) {
    throw new Error("Invalid capture body");
  }
  const serialized = JSON.stringify(body);
  for (
    const sourceIdentifier of [
      signedInRow.recording_id!,
      signedInRow.auth_user_id!,
      signedInRow.session_id,
    ]
  ) {
    if (serialized.includes(sourceIdentifier)) {
      throw new Error("Raw first-party identifier leaked into capture body");
    }
  }
  if (result.sent !== 1) throw new Error("Wrong sent count");
});

Deno.test("PostHog capture never serializes client identifiers or content through metadata or event UUIDs", async () => {
  const rawSessionIdentifier = "00000000-0000-4000-8000-000000009991";
  const privateMarkers = [
    rawSessionIdentifier,
    "person@example.test",
    "private note body must not be analyzed",
  ];
  let requestBody = "";
  const fetcher: typeof fetch = (_url, init) => {
    requestBody = String(init?.body);
    return Promise.resolve(new Response("ok", { status: 200 }));
  };

  await captureProductEventsInPostHog(
    [{
      ...signedInRow,
      id: `evt_${rawSessionIdentifier}`,
      session_id: rawSessionIdentifier,
      app_version: rawSessionIdentifier,
      build_number: rawSessionIdentifier,
      properties: {
        surface: "person@example.test",
        raw_content: "private note body must not be analyzed",
      },
    }],
    captureConfig,
    fetcher,
  );

  for (const marker of privateMarkers) {
    if (requestBody.includes(marker)) {
      throw new Error("Private client value leaked into PostHog capture body");
    }
  }

  const body = JSON.parse(requestBody);
  const [event] = body.batch;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(event.uuid)
  ) {
    throw new Error("PostHog event UUID must be a keyed pseudonymous UUID");
  }
});

Deno.test("account deletion requests person and historical event deletion by pseudonymous ID", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetcher: typeof fetch = (url, init) => {
    requestUrl = String(url);
    requestInit = init;
    return Promise.resolve(Response.json({
      persons_found: 1,
      persons_deleted: 1,
      events_queued_for_deletion: true,
      recordings_queued_for_deletion: false,
      deletion_errors: [],
    }, { status: 202 }));
  };

  const result = await deleteProductAnalyticsUserFromPostHog(
    signedInRow.auth_user_id!,
    {
      personalApiKey: "phx_test",
      apiHost: "https://us.posthog.com",
      projectId: "335982",
      analyticsIdSecret: "test-secret",
    },
    fetcher,
  );
  const body = JSON.parse(String(requestInit?.body));

  if (
    requestUrl !==
      "https://us.posthog.com/api/projects/335982/persons/bulk_delete/"
  ) {
    throw new Error("Wrong deletion URL");
  }
  if (
    body.distinct_ids.length !== 1 ||
    !body.distinct_ids[0].startsWith("tl_user_")
  ) {
    throw new Error("Deletion must use the pseudonymous user ID");
  }
  if (body.delete_events !== true || body.keep_person !== false) {
    throw new Error("Historical events must be queued for deletion");
  }
  if (!result.eventsQueuedForDeletion) {
    throw new Error("Deletion result not verified");
  }
});
