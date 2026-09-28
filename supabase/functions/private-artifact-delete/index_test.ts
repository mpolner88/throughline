const RECEIPT = "a".repeat(64);
const TOKEN = "synthetic-delete-token";

Deno.test("an authenticated receipt request deletes its stored artifact", async () => {
  const storage = new MemoryStorage([
    `evaluation-artifacts/${RECEIPT}/manifest.json`,
  ]);
  const createHandler = await loadCreateHandler();
  const handler = createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  });

  const response = await handler(
    new Request("https://edge.test/private-artifact-delete", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ materializer_receipt_sha256: RECEIPT }),
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "deleted", deleted_count: 1 });
  assertEquals(storage.objects.size, 0);
});

Deno.test("recursively deletes only the exact receipt prefix and preserves siblings", async () => {
  const siblingReceipt = "b".repeat(64);
  const storage = new MemoryStorage([
    `evaluation-artifacts/${RECEIPT}/manifest.json`,
    `evaluation-artifacts/${RECEIPT}/cases/case-one/audio.m4a`,
    `evaluation-artifacts/${RECEIPT}/cases/case-one/reference.json`,
    `evaluation-artifacts/${siblingReceipt}/manifest.json`,
    `outside/${RECEIPT}/unrelated.bin`,
  ]);
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    deleteRequest(RECEIPT),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "deleted", deleted_count: 1 });
  assertEquals([...storage.objects].sort(), [
    `evaluation-artifacts/${siblingReceipt}/manifest.json`,
    `outside/${RECEIPT}/unrelated.bin`,
  ]);
});

Deno.test("paginates listings and deletes in bounded batches", async () => {
  const objects = Array.from(
    { length: 205 },
    (_, index) =>
      `evaluation-artifacts/${RECEIPT}/cases/case-${
        String(index).padStart(3, "0")
      }.json`,
  );
  const storage = new MemoryStorage(objects, 100);
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    deleteRequest(RECEIPT),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { status: "deleted", deleted_count: 1 });
  assertEquals(storage.objects.size, 0);
  assertEquals(storage.maxDeleteBatchSize, 100);
});

Deno.test("rejects an oversized request body before contacting Storage", async () => {
  const storage = new MemoryStorage([]);
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    new Request("https://edge.test/private-artifact-delete", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        materializer_receipt_sha256: RECEIPT,
        padding: "x".repeat(5_000),
      }),
    }),
  );

  assertEquals(response.status, 413);
  assertEquals(await response.json(), { error: "request_too_large" });
  assertEquals(storage.requestCount, 0);
});

Deno.test("auth and exact JSON shape gates reject requests before Storage", async () => {
  const storage = new MemoryStorage([]);
  const createHandler = await loadCreateHandler();
  const handler = createHandler({ fetch: storage.fetch, env: testEnv() });

  const unauthorized = await handler(deleteRequest(RECEIPT, "wrong-token"));
  assertEquals(unauthorized.status, 401);
  assertEquals(await unauthorized.json(), { error: "unauthorized" });

  const extraField = await handler(
    new Request("https://edge.test/private-artifact-delete", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        materializer_receipt_sha256: RECEIPT,
        bucket: "caller-selected",
      }),
    }),
  );
  assertEquals(extraField.status, 400);
  assertEquals(await extraField.json(), { error: "invalid_request" });

  const duplicateKey = await handler(
    new Request("https://edge.test/private-artifact-delete", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body:
        `{"materializer_receipt_sha256":"${RECEIPT}","materializer_receipt_sha256":"${RECEIPT}"}`,
    }),
  );
  assertEquals(duplicateKey.status, 400);
  assertEquals(await duplicateKey.json(), { error: "invalid_request" });
  assertEquals(storage.requestCount, 0);
});

Deno.test("fails closed on a partial delete acknowledgement without leaking scope", async () => {
  const storage = new MemoryStorage([
    `evaluation-artifacts/${RECEIPT}/manifest.json`,
    `evaluation-artifacts/${RECEIPT}/sealed.json`,
  ]);
  storage.truncateDeleteResponse = true;
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    deleteRequest(RECEIPT),
  );
  const responseText = await response.text();

  assertEquals(response.status, 503);
  assertEquals(JSON.parse(responseText), { error: "delete_failed" });
  assertEquals(responseText.includes(RECEIPT), false);
  assertEquals(responseText.includes(TOKEN), false);
  assertEquals(responseText.includes("evaluation-artifacts"), false);
});

Deno.test("contains request-body stream failures as a fixed safe error", async () => {
  const storage = new MemoryStorage([]);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("private-stream-sentinel"));
    },
  });
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    new Request("https://edge.test/private-artifact-delete", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body,
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(await response.json(), { error: "invalid_json" });
  assertEquals(storage.requestCount, 0);
});

Deno.test("accepts a loopback Supabase URL for local-only verification", async () => {
  const storage = new MemoryStorage([]);
  const env = {
    ...testEnv(),
    SUPABASE_URL: "http://127.0.0.1:54321",
  };
  const createHandler = await loadCreateHandler();
  const response = await createHandler({ fetch: storage.fetch, env })(
    deleteRequest(RECEIPT),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    status: "not_found",
    deleted_count: 0,
  });
});

Deno.test("a repeated deletion is idempotent and aggregate-only", async () => {
  const storage = new MemoryStorage([
    `evaluation-artifacts/${RECEIPT}/manifest.json`,
  ]);
  const createHandler = await loadCreateHandler();
  const handler = createHandler({ fetch: storage.fetch, env: testEnv() });

  const first = await handler(deleteRequest(RECEIPT));
  const second = await handler(deleteRequest(RECEIPT));
  const firstText = await first.text();
  const secondText = await second.text();

  assertEquals(first.status, 200);
  assertEquals(JSON.parse(firstText), { status: "deleted", deleted_count: 1 });
  assertEquals(second.status, 200);
  assertEquals(JSON.parse(secondText), {
    status: "not_found",
    deleted_count: 0,
  });
  assertEquals(`${firstText}${secondText}`.includes(RECEIPT), false);
});

Deno.test("fails closed before deletion when the receipt object bound is exceeded", async () => {
  const objects = Array.from(
    { length: 1_001 },
    (_, index) =>
      `evaluation-artifacts/${RECEIPT}/cases/case-${
        String(index).padStart(4, "0")
      }.json`,
  );
  const storage = new MemoryStorage(objects);
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    deleteRequest(RECEIPT),
  );

  assertEquals(response.status, 503);
  assertEquals(await response.json(), { error: "delete_failed" });
  assertEquals(storage.deleteRequestCount, 0);
  assertEquals(storage.objects.size, 1_001);
});

Deno.test("fails closed when post-delete re-listing finds a remaining object", async () => {
  const storage = new MemoryStorage([
    `evaluation-artifacts/${RECEIPT}/manifest.json`,
    `evaluation-artifacts/${RECEIPT}/sealed.json`,
  ]);
  storage.retainLastObjectOnDelete = true;
  const createHandler = await loadCreateHandler();
  const response = await createHandler({
    fetch: storage.fetch,
    env: testEnv(),
  })(
    deleteRequest(RECEIPT),
  );

  assertEquals(response.status, 503);
  assertEquals(await response.json(), { error: "delete_failed" });
  assertEquals(storage.objects.size, 1);
});

type CreateHandler = (options: {
  fetch: typeof fetch;
  env: Record<string, string>;
}) => (request: Request) => Promise<Response>;

async function loadCreateHandler(): Promise<CreateHandler> {
  const module = await import("./index.ts").catch(() => null);
  if (module && typeof module.createHandler === "function") {
    return module.createHandler as CreateHandler;
  }
  return () => async () => new Response(null, { status: 599 });
}

function testEnv(): Record<string, string> {
  return {
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-key",
    THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN: TOKEN,
  };
}

function deleteRequest(receipt: string, token = TOKEN): Request {
  return new Request("https://edge.test/private-artifact-delete", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ materializer_receipt_sha256: receipt }),
  });
}

class MemoryStorage {
  objects: Set<string>;
  maxDeleteBatchSize = 0;
  requestCount = 0;
  deleteRequestCount = 0;
  retainLastObjectOnDelete = false;
  truncateDeleteResponse = false;
  readonly acceptedDeleteBatchSize: number;

  constructor(objects: string[], acceptedDeleteBatchSize = 1_000) {
    this.objects = new Set(objects);
    this.acceptedDeleteBatchSize = acceptedDeleteBatchSize;
  }

  fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    this.requestCount += 1;
    const url = new URL(String(input));
    if (url.pathname === "/storage/v1/object/list/throughline-audio") {
      const body = JSON.parse(String(init?.body));
      const prefix = `${body.prefix}/`;
      const children = new Map<string, boolean>();
      for (const objectName of this.objects) {
        if (!objectName.startsWith(prefix)) continue;
        const relativeName = objectName.slice(prefix.length);
        const slash = relativeName.indexOf("/");
        const childName = slash === -1
          ? relativeName
          : relativeName.slice(0, slash);
        children.set(
          childName,
          slash !== -1 || children.get(childName) === true,
        );
      }
      const names = [...children]
        .map(([name, isFolder]) => ({ name, isFolder }))
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(body.offset, body.offset + body.limit)
        .map(({ name, isFolder }) => ({
          name,
          id: isFolder ? null : "synthetic-object-id",
          metadata: isFolder ? null : {},
        }));
      return Response.json(names);
    }
    if (
      url.pathname === "/storage/v1/object/throughline-audio" &&
      init?.method === "DELETE"
    ) {
      this.deleteRequestCount += 1;
      const body = JSON.parse(String(init.body));
      this.maxDeleteBatchSize = Math.max(
        this.maxDeleteBatchSize,
        body.prefixes.length,
      );
      if (body.prefixes.length > this.acceptedDeleteBatchSize) {
        return Response.json({ error: "batch_too_large" }, { status: 413 });
      }
      const removable = this.retainLastObjectOnDelete
        ? body.prefixes.slice(0, -1)
        : body.prefixes;
      for (const name of removable) this.objects.delete(name);
      const deleted = body.prefixes.map((name: string) => ({ name }));
      return Response.json(
        this.truncateDeleteResponse ? deleted.slice(0, -1) : deleted,
      );
    }
    return Response.json({ error: "unexpected_request" }, { status: 500 });
  };
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}
