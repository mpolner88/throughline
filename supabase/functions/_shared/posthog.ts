export type ProductEventProperty = string | number | boolean;

export type ProductEventRow = {
  id: string;
  auth_user_id: string | null;
  session_id: string;
  occurred_at: string;
  event_name: string;
  platform: string;
  app_version: string | null;
  build_number: string | null;
  properties: Record<string, ProductEventProperty>;
};

export type PostHogCaptureConfig = {
  projectToken: string;
  ingestHost: string;
  analyticsIdSecret: string;
  environment: string;
};

export type PostHogDeletionConfig = {
  personalApiKey: string;
  apiHost: string;
  projectId: string;
  analyticsIdSecret: string;
};

type Fetcher = typeof fetch;

export function hasPostHogCaptureConfig(config: PostHogCaptureConfig) {
  return Boolean(
    config.projectToken && config.ingestHost && config.analyticsIdSecret,
  );
}

export function hasPostHogDeletionConfig(config: PostHogDeletionConfig) {
  return Boolean(
    config.personalApiKey && config.apiHost && config.projectId &&
      config.analyticsIdSecret,
  );
}

export async function postHogDistinctId(
  kind: "user" | "session",
  sourceId: string,
  analyticsIdSecret: string,
) {
  if (!analyticsIdSecret) {
    throw new Error("Analytics identifier secret is required");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(analyticsIdSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`throughline:${kind}:${sourceId}`),
  );
  const digest = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `tl_${kind}_${digest}`;
}

export async function buildPostHogBatch(
  rows: ProductEventRow[],
  config: PostHogCaptureConfig,
) {
  return Promise.all(rows.map(async (row) => {
    const isIdentified = Boolean(row.auth_user_id);
    const distinctId = await postHogDistinctId(
      isIdentified ? "user" : "session",
      row.auth_user_id ?? row.session_id,
      config.analyticsIdSecret,
    );
    const sessionId = await postHogDistinctId(
      "session",
      row.session_id,
      config.analyticsIdSecret,
    );
    const eventUuid = productEventUuid(row.id);
    const properties: Record<string, ProductEventProperty> = {
      ...row.properties,
      platform: row.platform,
      environment: config.environment,
      throughline_session_id: sessionId,
      "$process_person_profile": isIdentified,
      "$geoip_disable": true,
      "$lib": "throughline-edge",
      "$lib_version": "1",
    };

    if (row.app_version) properties.app_version = row.app_version;
    if (row.build_number) properties.build_number = row.build_number;

    return {
      event: row.event_name,
      distinct_id: distinctId,
      timestamp: row.occurred_at,
      properties,
      ...(eventUuid ? { uuid: eventUuid } : {}),
    };
  }));
}

export async function captureProductEventsInPostHog(
  rows: ProductEventRow[],
  config: PostHogCaptureConfig,
  fetcher: Fetcher = fetch,
) {
  if (!rows.length || !hasPostHogCaptureConfig(config)) {
    return { configured: hasPostHogCaptureConfig(config), sent: 0 };
  }

  const response = await fetcher(
    `${trimTrailingSlash(config.ingestHost)}/batch/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "throughline-edge/1",
      },
      body: JSON.stringify({
        api_key: config.projectToken,
        historical_migration: false,
        batch: await buildPostHogBatch(rows, config),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`PostHog capture failed (${response.status})`);
  }

  return { configured: true, sent: rows.length };
}

export async function deleteProductAnalyticsUserFromPostHog(
  authUserId: string,
  config: PostHogDeletionConfig,
  fetcher: Fetcher = fetch,
) {
  if (!hasPostHogDeletionConfig(config)) {
    throw new Error("PostHog account-deletion integration is not configured");
  }

  const distinctId = await postHogDistinctId(
    "user",
    authUserId,
    config.analyticsIdSecret,
  );
  const response = await fetcher(
    `${trimTrailingSlash(config.apiHost)}/api/projects/${
      encodeURIComponent(config.projectId)
    }/persons/bulk_delete/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.personalApiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "throughline-edge/1",
      },
      body: JSON.stringify({
        distinct_ids: [distinctId],
        delete_events: true,
        delete_recordings: false,
        keep_person: false,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`PostHog user deletion failed (${response.status})`);
  }

  const result = await response.json();
  if (Array.isArray(result?.deletion_errors) && result.deletion_errors.length) {
    throw new Error("PostHog user deletion returned one or more errors");
  }
  if (
    Number(result?.persons_found) > 0 &&
    result?.events_queued_for_deletion !== true
  ) {
    throw new Error("PostHog did not queue historical event deletion");
  }

  return {
    personsFound: Number(result?.persons_found) || 0,
    personsDeleted: Number(result?.persons_deleted) || 0,
    eventsQueuedForDeletion: result?.events_queued_for_deletion === true,
  };
}

function productEventUuid(eventId: string) {
  const match = eventId.match(
    /^evt_([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
