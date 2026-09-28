const DEFAULT_BUCKET = "throughline-audio";
const DEFAULT_PREFIX = "evaluation-artifacts";
const RECEIPT_PATTERN = /^[0-9a-f]{64}$/u;
const LIST_PAGE_SIZE = 100;
const DELETE_BATCH_SIZE = 100;
const MAX_LIST_PAGES_PER_DIRECTORY = 100;
const MAX_DIRECTORIES = 1_000;
const MAX_OBJECTS = 1_000;
const MAX_REQUEST_BYTES = 4_096;

type EnvSource = Record<string, string> | {
  get(name: string): string | undefined;
};

type HandlerOptions = {
  fetch?: typeof fetch;
  env?: EnvSource;
};

export function createHandler(options: HandlerOptions = {}) {
  const fetchImpl = options.fetch ?? fetch;
  const env = options.env ?? Deno.env;

  return async (request: Request): Promise<Response> => {
    const config = readConfig(env);
    if (!config) return json(503, { error: "service_unavailable" });
    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" }, { Allow: "POST" });
    }
    if (
      !await isAuthorized(request.headers.get("authorization"), config.token)
    ) {
      return json(401, { error: "unauthorized" });
    }
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return json(415, { error: "json_required" });
    }

    let body: unknown;
    let rawBody: Awaited<ReturnType<typeof readBoundedBody>>;
    try {
      rawBody = await readBoundedBody(request, MAX_REQUEST_BYTES);
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (rawBody.status === "too_large") {
      return json(413, { error: "request_too_large" });
    }
    try {
      body = JSON.parse(rawBody.text);
    } catch {
      return json(400, { error: "invalid_json" });
    }
    if (!hasExactlyOneReceiptMember(rawBody.text)) {
      return json(400, { error: "invalid_request" });
    }
    const receipt = validatePayload(body);
    if (!receipt) return json(400, { error: "invalid_request" });

    try {
      const objectPrefix = `${config.prefix}/${receipt}`;
      const objects = await listObjects(fetchImpl, config, objectPrefix);
      if (objects.length === 0) {
        return json(200, { status: "not_found", deleted_count: 0 });
      }
      await deleteObjects(fetchImpl, config, objects);
      const remaining = await listObjects(fetchImpl, config, objectPrefix);
      if (remaining.length !== 0) throw new Error("deletion_unconfirmed");
      return json(200, { status: "deleted", deleted_count: 1 });
    } catch {
      return json(503, { error: "delete_failed" });
    }
  };
}

async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<{ status: "ok"; text: string } | { status: "too_large" }> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { status: "too_large" };
  }
  if (!request.body) return { status: "ok", text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { status: "too_large" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { status: "ok", text: new TextDecoder().decode(bytes) };
}

function isJsonContentType(value: string | null): boolean {
  return /^application\/json(?:\s*;|$)/iu.test(value ?? "");
}

function hasExactlyOneReceiptMember(text: string): boolean {
  return (text.match(/"materializer_receipt_sha256"\s*:/gu) ?? []).length === 1;
}

export function validatePayload(value: unknown): string | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 1 || keys[0] !== "materializer_receipt_sha256" ||
    typeof record.materializer_receipt_sha256 !== "string" ||
    !RECEIPT_PATTERN.test(record.materializer_receipt_sha256)
  ) return null;
  return record.materializer_receipt_sha256;
}

export async function isAuthorized(
  authorization: string | null,
  expectedToken: string,
): Promise<boolean> {
  const candidate = /^Bearer ([^\s]+)$/u.exec(authorization ?? "")?.[1] ?? "";
  const [actual, expected] = await Promise.all([
    sha256(candidate),
    sha256(expectedToken),
  ]);
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual[index] ^ expected[index];
  }
  return difference === 0 && candidate.length > 0;
}

type Config = {
  supabaseUrl: string;
  serviceRoleKey: string;
  token: string;
  bucket: string;
  prefix: string;
};

function readConfig(env: EnvSource): Config | null {
  const get = (name: string) =>
    typeof (env as { get?: unknown }).get === "function"
      ? (env as { get(name: string): string | undefined }).get(name)
      : (env as Record<string, string>)[name];
  const supabaseUrl = get("SUPABASE_URL")?.trim().replace(/\/+$/u, "");
  const serviceRoleKey = get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const token = get("THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN")?.trim();
  const bucket = get("THROUGHLINE_AUDIO_BUCKET")?.trim() || DEFAULT_BUCKET;
  const prefix = get("THROUGHLINE_PRIVATE_ARTIFACT_PREFIX")?.trim() ||
    DEFAULT_PREFIX;
  if (
    !supabaseUrl || !serviceRoleKey || !token || !safePath(bucket) ||
    !safePath(prefix)
  ) {
    return null;
  }
  try {
    const parsed = new URL(supabaseUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      parsed.hostname,
    );
    if (
      parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return { supabaseUrl, serviceRoleKey, token, bucket, prefix };
}

async function listObjects(
  fetchImpl: typeof fetch,
  config: Config,
  prefix: string,
): Promise<string[]> {
  const objects: string[] = [];
  const seenObjects = new Set<string>();
  const seenDirectories = new Set<string>();
  await listDirectory(prefix);
  return objects;

  async function listDirectory(directoryPrefix: string): Promise<void> {
    if (seenDirectories.has(directoryPrefix)) {
      throw new Error("storage_list_cycle");
    }
    seenDirectories.add(directoryPrefix);
    if (seenDirectories.size > MAX_DIRECTORIES) {
      throw new Error("storage_directory_limit_exceeded");
    }
    for (let page = 0; page < MAX_LIST_PAGES_PER_DIRECTORY; page += 1) {
      const response = await fetchImpl(
        `${config.supabaseUrl}/storage/v1/object/list/${
          encodeURIComponent(config.bucket)
        }`,
        {
          method: "POST",
          headers: storageHeaders(config, true),
          body: JSON.stringify({
            prefix: directoryPrefix,
            limit: LIST_PAGE_SIZE,
            offset: page * LIST_PAGE_SIZE,
            sortBy: { column: "name", order: "asc" },
          }),
        },
      );
      if (!response.ok) throw new Error("storage_list_failed");
      const entries = await response.json();
      if (!Array.isArray(entries)) throw new Error("storage_list_invalid");
      for (const entry of entries) {
        if (
          entry === null || typeof entry !== "object" ||
          typeof entry.name !== "string" || !safeSegment(entry.name)
        ) throw new Error("storage_list_invalid");
        const objectPath = `${directoryPrefix}/${entry.name}`;
        if (typeof entry.id === "string" && entry.id) {
          if (seenObjects.has(objectPath)) {
            throw new Error("storage_list_invalid");
          }
          seenObjects.add(objectPath);
          objects.push(objectPath);
          if (objects.length > MAX_OBJECTS) {
            throw new Error("storage_object_limit_exceeded");
          }
        } else if (entry.id === null && entry.metadata === null) {
          await listDirectory(objectPath);
        } else {
          throw new Error("storage_list_invalid");
        }
      }
      if (entries.length < LIST_PAGE_SIZE) return;
    }
    throw new Error("storage_page_limit_exceeded");
  }
}

async function deleteObjects(
  fetchImpl: typeof fetch,
  config: Config,
  objects: string[],
): Promise<void> {
  for (let offset = 0; offset < objects.length; offset += DELETE_BATCH_SIZE) {
    const batch = objects.slice(offset, offset + DELETE_BATCH_SIZE);
    const response = await fetchImpl(
      `${config.supabaseUrl}/storage/v1/object/${
        encodeURIComponent(config.bucket)
      }`,
      {
        method: "DELETE",
        headers: storageHeaders(config, true),
        body: JSON.stringify({ prefixes: batch }),
      },
    );
    if (!response.ok) {
      throw new Error("storage_delete_failed");
    }
    const acknowledged = await response.json();
    if (!Array.isArray(acknowledged) || acknowledged.length !== batch.length) {
      throw new Error("storage_delete_failed");
    }
    const acknowledgedNames = new Set<string>();
    for (const entry of acknowledged) {
      if (
        entry === null || typeof entry !== "object" ||
        typeof entry.name !== "string" || !batch.includes(entry.name)
      ) throw new Error("storage_delete_failed");
      acknowledgedNames.add(entry.name);
    }
    if (acknowledgedNames.size !== batch.length) {
      throw new Error("storage_delete_failed");
    }
  }
}

function storageHeaders(config: Config, jsonBody = false): HeadersInit {
  return {
    authorization: `Bearer ${config.serviceRoleKey}`,
    apikey: config.serviceRoleKey,
    ...(jsonBody ? { "content-type": "application/json" } : {}),
  };
}

function safePath(value: string): boolean {
  return value.split("/").every(safeSegment);
}

function safeSegment(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/u.test(value) && value !== "." && value !== "..";
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function json(
  status: number,
  value: unknown,
  headers: HeadersInit = {},
): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

if (import.meta.main) Deno.serve(createHandler());
