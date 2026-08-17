export const PRODUCT_EVENT_SCHEMA_VERSIONS = [1, 2] as const;
export const PRODUCT_EVENT_DISTRIBUTION_CHANNELS = [
  "debug",
  "testflight",
  "app_store",
  "unknown",
] as const;
export const PRODUCT_EVENT_NAMES = [
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
] as const;

export type ProductEventSchemaVersion =
  typeof PRODUCT_EVENT_SCHEMA_VERSIONS[number];
export type ProductEventDistributionChannel =
  typeof PRODUCT_EVENT_DISTRIBUTION_CHANNELS[number];
export type ProductEventProperty = string | number | boolean;

export type NormalizedProductEventContract = {
  schema_version: ProductEventSchemaVersion;
  distribution_channel: ProductEventDistributionChannel;
  recording_id: string | null;
  properties: Record<string, ProductEventProperty>;
};

const PRODUCT_EVENT_NAME_SET = new Set<string>(PRODUCT_EVENT_NAMES);

const ALLOWED_PROPERTIES_BY_EVENT: Record<string, ReadonlySet<string>> = {
  first_opened: new Set(["route"]),
  app_opened: new Set(["route"]),
  onboarding_step_viewed: new Set(["step"]),
  demo_recording_completed: new Set([
    "processing_status",
    "duration_bucket",
    "structured_items",
    "has_note",
  ]),
  auth_started: new Set(["mode"]),
  auth_confirmation_required: new Set(["mode"]),
  auth_succeeded: new Set(["mode", "account_state", "onboarding_path"]),
  auth_failed: new Set(["mode", "reason"]),
  home_viewed: new Set(["state"]),
  recording_started: new Set(["surface"]),
  recording_uploaded: new Set(["surface", "duration_bucket"]),
  recording_processed: new Set(["surface", "processing_status"]),
  recording_failed: new Set([
    "surface",
    "stage",
    "failure_type",
    "processing_status",
  ]),
  action_item_toggled: new Set(["completed"]),
  agent_token_created: new Set(["tool"]),
  feedback_opened: new Set(["surface"]),
  feedback_submitted: new Set([
    "surface",
    "category",
    "contact_allowed",
    "score",
  ]),
  feedback_submit_failed: new Set(["surface"]),
};

const ENUM_PROPERTY_VALUES: Record<string, ReadonlySet<string>> = {
  route: new Set(["home", "onboarding"]),
  processing_status: new Set([
    "uploaded",
    "transcribed",
    "processed",
    "needs_transcript",
    "needs_extractor",
    "transcription_failed",
    "extraction_failed",
    "processing_failed",
    "unknown",
  ]),
  duration_bucket: new Set([
    "under_5_seconds",
    "5_to_14_seconds",
    "under_15_seconds",
    "15_to_59_seconds",
    "60_seconds_or_more",
    "1_to_2_minutes",
    "3_to_5_minutes",
  ]),
  mode: new Set(["apple", "google", "create_account", "sign_in"]),
  account_state: new Set(["new", "existing", "unknown"]),
  onboarding_path: new Set(["direct", "demo"]),
  reason: new Set([
    "confirmation_required",
    "invalid_credentials",
    "rate_limited",
    "server_error",
    "configuration",
    "invalid_response",
    "unknown",
  ]),
  state: new Set(["empty", "populated"]),
  surface: new Set([
    "home",
    "onboarding",
    "onboarding_promotion",
    "settings",
    "product_feedback",
    "extraction_quality",
  ]),
  stage: new Set([
    "pre_record",
    "demo_upload",
    "demo_promotion",
    "upload_or_processing",
    "processing",
  ]),
  tool: new Set(["claudeCode", "codexCli"]),
  category: new Set(["general", "idea", "problem", "praise"]),
};

const BOOLEAN_PROPERTIES = new Set([
  "has_note",
  "completed",
  "contact_allowed",
]);
const PROCESSING_FAILURE_TYPES = new Set([
  "processing_uploaded",
  "processing_processed",
  "processing_needs_transcript",
  "processing_needs_extractor",
  "processing_transcription_failed",
  "processing_extraction_failed",
  "processing_processing_failed",
  "processing_empty_structure",
  "processing_unknown",
]);
const PRE_DURABLE_FAILURE_STAGES = new Set([
  "pre_record",
  "demo_upload",
  "demo_promotion",
]);

export class ProductEventContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductEventContractError";
  }
}

export function sanitizeProductEventProperties(
  eventName: string,
  value: unknown,
): Record<string, ProductEventProperty> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const allowedKeys = ALLOWED_PROPERTIES_BY_EVENT[eventName] ??
    new Set<string>();
  const output: Record<string, ProductEventProperty> = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (!allowedKeys.has(key)) continue;

    const normalizedValue = normalizePropertyValue(key, rawValue);
    if (normalizedValue !== undefined) output[key] = normalizedValue;
  }

  return output;
}

export function normalizeProductEventContract(
  value: unknown,
): NormalizedProductEventContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductEventContractError("Product event must be an object");
  }

  const event = value as Record<string, unknown>;
  if (
    typeof event.event_name !== "string" ||
    !PRODUCT_EVENT_NAME_SET.has(event.event_name)
  ) {
    throw new ProductEventContractError("Unknown product event_name");
  }

  const schemaVersion = normalizeSchemaVersion(event.schema_version);
  const properties = sanitizeProductEventProperties(
    event.event_name,
    event.properties,
  );

  if (schemaVersion === 1) {
    return {
      schema_version: 1,
      distribution_channel: "unknown",
      recording_id: null,
      properties,
    };
  }

  const distributionChannel = normalizeDistributionChannel(
    event.distribution_channel,
  );
  const recordingId = normalizeRecordingId(event.recording_id);
  const isPreDurableFailureStage = typeof properties.stage === "string" &&
    PRE_DURABLE_FAILURE_STAGES.has(properties.stage);
  const requiresRecordingId = event.event_name === "recording_uploaded" ||
    event.event_name === "recording_processed" ||
    (event.event_name === "recording_failed" &&
      !isPreDurableFailureStage);

  if (requiresRecordingId && !recordingId) {
    throw new ProductEventContractError(
      `${event.event_name} requires a valid recording_id`,
    );
  }

  return {
    schema_version: 2,
    distribution_channel: distributionChannel,
    recording_id: recordingId,
    properties,
  };
}

function normalizePropertyValue(
  key: string,
  value: unknown,
): ProductEventProperty | undefined {
  const enumValues = ENUM_PROPERTY_VALUES[key];
  if (enumValues) {
    return typeof value === "string" && enumValues.has(value)
      ? value
      : undefined;
  }

  if (BOOLEAN_PROPERTIES.has(key)) {
    if (typeof value === "boolean") return value;
    return value === "true" || value === "false" ? value : undefined;
  }

  if (key === "step" || key === "structured_items") {
    if (
      typeof value === "number" && Number.isInteger(value) && value >= 0 &&
      value <= 999
    ) {
      return value;
    }
    return typeof value === "string" && /^\d{1,3}$/.test(value)
      ? value
      : undefined;
  }

  if (key === "score") {
    if (
      typeof value === "number" && Number.isInteger(value) && value >= 1 &&
      value <= 5
    ) {
      return value;
    }
    return typeof value === "string" && /^[1-5]$/.test(value)
      ? value
      : undefined;
  }

  if (key === "failure_type" && typeof value === "string") {
    if (value === "client_error" || value === "invalid_response") return value;
    if (/^http_[1-5]\d{2}$/.test(value)) return value;
    if (PROCESSING_FAILURE_TYPES.has(value)) return value;
  }

  return undefined;
}

function normalizeSchemaVersion(value: unknown): ProductEventSchemaVersion {
  if (value === undefined || value === null) return 1;
  if (value === 1 || value === 2) return value;
  throw new ProductEventContractError(
    "Unsupported product-event schema_version",
  );
}

function normalizeDistributionChannel(
  value: unknown,
): ProductEventDistributionChannel {
  if (value === undefined || value === null) return "unknown";
  if (
    typeof value === "string" &&
    PRODUCT_EVENT_DISTRIBUTION_CHANNELS.includes(
      value as ProductEventDistributionChannel,
    )
  ) {
    return value as ProductEventDistributionChannel;
  }
  throw new ProductEventContractError("Unsupported distribution_channel");
}

function normalizeRecordingId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ProductEventContractError("recording_id must be a string");
  }

  const recordingId = value.trim();
  if (
    recordingId.length > 128 ||
    !/^rec_[a-z0-9_-]+$/i.test(recordingId)
  ) {
    throw new ProductEventContractError("Invalid recording_id");
  }
  return recordingId;
}
