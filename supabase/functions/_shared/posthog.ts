import {
  normalizeProductEventAppVersion,
  normalizeProductEventBuildNumber,
  type ProductEventDistributionChannel,
  type ProductEventSchemaVersion,
  sanitizeProductEventProperties,
} from "./product-event-contract.ts";

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
  schema_version: ProductEventSchemaVersion;
  distribution_channel: ProductEventDistributionChannel;
  is_internal_user: boolean | null;
  recording_id: string | null;
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

export function buildPostHogBatch(
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
    const eventUuid = await postHogEventUuid(
      row.id,
      config.analyticsIdSecret,
    );
    const properties: Record<string, ProductEventProperty> = {
      ...sanitizeProductEventProperties(row.event_name, row.properties),
      platform: row.platform,
      environment: config.environment,
      schema_version: row.schema_version,
      distribution_channel: row.distribution_channel,
      is_internal_user: row.is_internal_user ?? "unknown",
      "$process_person_profile": isIdentified,
      "$geoip_disable": true,
      "$lib": "throughline-edge",
      "$lib_version": "1",
    };

    const appVersion = normalizeProductEventAppVersion(row.app_version);
    const buildNumber = normalizeProductEventBuildNumber(row.build_number);
    if (appVersion) properties.app_version = appVersion;
    if (buildNumber) properties.build_number = buildNumber;

    return {
      event: row.event_name,
      distinct_id: distinctId,
      timestamp: row.occurred_at,
      properties,
      uuid: eventUuid,
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

export async function postHogEventUuid(
  eventId: string,
  analyticsIdSecret: string,
) {
  const digest = await hmacSha256Hex(
    "throughline:event:" + eventId,
    analyticsIdSecret,
  );
  const variant = "89ab"[Number.parseInt(digest.slice(16, 17), 16) % 4];
  return digest.slice(0, 8) + "-" + digest.slice(8, 12) + "-4" +
    digest.slice(13, 16) + "-" + variant + digest.slice(17, 20) + "-" +
    digest.slice(20, 32);
}

async function hmacSha256Hex(value: string, analyticsIdSecret: string) {
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
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
