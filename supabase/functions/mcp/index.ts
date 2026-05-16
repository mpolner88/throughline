import "@supabase/functions-js/edge-runtime.d.ts";

import { getMemoryToolDefinitions, runMemoryTool } from "../_shared/memory-tools.ts";

const FUNCTION_NAME = "mcp";
const PROTOCOL_VERSION = "2025-06-18";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type McpContext = {
  kind: "service" | "user";
  authUserId: string | null;
};

Deno.serve((req) => {
  return handleRequest(req).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unknown server error";
    return jsonResponse(status, { error: message });
  });
});

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const pathname = normalizeFunctionPath(url.pathname, FUNCTION_NAME);
  const context = await mcpContext(req);

  if (req.method === "GET" && pathname === "/health") {
    return jsonResponse(200, {
      ok: true,
      service: "throughline-memory-mcp",
      auth_required: mcpTokens().length > 0,
      authenticated: Boolean(context),
      auth_mode: context?.kind ?? null,
      tools: getMemoryToolDefinitions().length,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "MCP endpoint expects POST JSON-RPC requests" });
  }

  if (!context) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const payload = await parseJsonRequest(req);
  if (Array.isArray(payload)) {
    const responses = [];
    for (const message of payload) {
      const response = await handleJsonRpcMessage(message, context);
      if (response) responses.push(response);
    }
    return jsonResponse(200, responses);
  }

  const response = await handleJsonRpcMessage(payload, context);
  return response ? jsonResponse(200, response) : new Response(null, { status: 202, headers: corsHeaders() });
}

async function handleJsonRpcMessage(message: any, context: McpContext) {
  const isRequest = Object.hasOwn(message ?? {}, "id");
  const id = isRequest ? message.id : null;
  const method = message?.method;

  if (!isRequest) return null;

  try {
    if (method === "initialize") {
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: "throughline-memory",
          version: "0.0.0",
        },
        instructions: "Throughline exposes processed voice notes as read-only memory tools for an AI agent.",
      });
    }

    if (method === "ping") {
      return result(id, {});
    }

    if (method === "tools/list") {
      return result(id, {
        tools: getMemoryToolDefinitions().map(toMcpTool),
      });
    }

    if (method === "tools/call") {
      const name = message.params?.name;
      const input = message.params?.arguments ?? {};
      if (typeof name !== "string") {
        return error(id, -32602, "tools/call requires params.name");
      }
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return error(id, -32602, "tools/call params.arguments must be an object");
      }

      const output = runMemoryTool(name, input, {
        recordings: await listFullRecordings(context),
      });
      return result(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
        structuredContent: output,
      });
    }

    return error(id, -32601, `Method not found: ${method}`);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "MCP tool failed";
    return error(id, -32000, message);
  }
}

function toMcpTool(tool: any) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.input_schema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  };
}

function result(id: unknown, payload: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result: payload,
  };
}

function error(id: unknown, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  };
}

async function listFullRecordings(context: McpContext) {
  const rows = await restRequest(
    [
      "/throughline_recordings?select=recording",
      recordingScopeQuery(context),
      "&order=created_at.desc",
      "&limit=1000",
    ].join(""),
  );
  return Array.isArray(rows) ? rows.map((row) => row.recording) : [];
}

async function restRequest(pathname: string, options: RequestInit = {}) {
  const url = supabaseUrl();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const response = await fetch(`${url}/rest/v1${pathname}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${responseText}`);
  }

  if (!responseText.trim()) return null;
  return JSON.parse(responseText);
}

async function parseJsonRequest(req: Request) {
  const text = await req.text();
  if (!text.trim()) {
    throw new HttpError(400, "Request body must be JSON-RPC");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}

async function mcpContext(req: Request): Promise<McpContext | null> {
  if (hasLegacyMcpToken(req)) {
    return { kind: "service", authUserId: null };
  }

  const token = credentialToken(req);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const rows = await restRequest(
    [
      "/throughline_mcp_tokens",
      "?select=id,user_id",
      `&token_hash=eq.${encodeURIComponent(tokenHash)}`,
      "&revoked_at=is.null",
      "&limit=1",
    ].join(""),
  );

  if (!Array.isArray(rows) || !rows.length || typeof rows[0].user_id !== "string") {
    return null;
  }

  EdgeRuntime.waitUntil(markMcpTokenUsed(rows[0].id));
  return { kind: "user", authUserId: rows[0].user_id };
}

function hasLegacyMcpToken(req: Request) {
  const expectedTokens = mcpTokens();
  if (!expectedTokens.length) return true;

  return [credentialToken(req), req.headers.get("x-throughline-api-key") || ""].some((candidate) =>
    expectedTokens.some((expected) => safeTokenEqual(candidate, expected))
  );
}

function credentialToken(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  return authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";
}

async function markMcpTokenUsed(id: string) {
  await restRequest(`/throughline_mcp_tokens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  });
}

function recordingScopeQuery(context: McpContext) {
  return context.authUserId ? `&auth_user_id=eq.${encodeURIComponent(context.authUserId)}` : "";
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeTokenEqual(candidate: string, expected: string) {
  if (!candidate || !expected) return false;

  const encoder = new TextEncoder();
  const left = encoder.encode(candidate);
  const right = encoder.encode(expected);
  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return diff === 0;
}

function normalizeFunctionPath(pathname: string, functionName: string) {
  const functionPrefix = `/${functionName}`;
  const localPrefix = `/functions/v1/${functionName}`;

  if (pathname === functionPrefix || pathname === localPrefix) return "/";
  if (pathname.startsWith(`${functionPrefix}/`)) return pathname.slice(functionPrefix.length) || "/";
  if (pathname.startsWith(`${localPrefix}/`)) return pathname.slice(localPrefix.length) || "/";
  return pathname || "/";
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Throughline-Api-Key, apikey",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  };
}

function mcpToken() {
  return Deno.env.get("THROUGHLINE_MCP_TOKEN") || Deno.env.get("THROUGHLINE_API_TOKEN") || "";
}

function mcpTokens() {
  const tokens = [
    mcpToken(),
    ...splitTokenList(Deno.env.get("THROUGHLINE_MCP_TOKENS") || ""),
    ...splitTokenList(Deno.env.get("THROUGHLINE_API_TOKENS") || ""),
  ].map((token) => token.trim()).filter(Boolean);

  return [...new Set(tokens)];
}

function splitTokenList(value: string) {
  return value.split(/[,\n]/).map((token) => token.trim()).filter(Boolean);
}

function supabaseUrl() {
  return trimTrailingSlash(Deno.env.get("SUPABASE_URL") || "");
}

function trimTrailingSlash(value: string) {
  return String(value ?? "").replace(/\/+$/, "");
}
