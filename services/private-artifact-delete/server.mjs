#!/usr/bin/env node

import { createHash, timingSafeEqual } from "node:crypto";
import { lstat, mkdir, realpath, rename, rm } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RECEIPT_PATTERN = /^[0-9a-f]{64}$/u;
const DEFAULT_MAX_REQUEST_BYTES = 4_096;
const MAX_DELETE_PASSES = 32;
const TOMBSTONE_PREFIX = ".throughline-delete-in-progress-";

export class ArtifactScopeError extends Error {
  constructor(code = "invalid_artifact_root") {
    super(code);
    this.name = "ArtifactScopeError";
    this.code = code;
  }
}

export async function preparePrivateRoot(configuredRoot) {
  if (typeof configuredRoot !== "string" || !configuredRoot.trim()) {
    throw new Error("private_root_invalid");
  }

  const requestedRoot = configuredRoot.trim();
  if (!path.isAbsolute(requestedRoot)) throw new Error("private_root_invalid");
  const absoluteRoot = path.resolve(requestedRoot);
  await mkdir(absoluteRoot, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(absoluteRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("private_root_invalid");
  }

  const canonicalRoot = await realpath(absoluteRoot);
  if (canonicalRoot !== absoluteRoot) {
    throw new Error("private_root_invalid");
  }
  return canonicalRoot;
}

export function createTokenDigest(token) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("delete_token_invalid");
  }
  return sha256(token.trim());
}

export function isAuthorized(authorizationHeader, expectedTokenDigest) {
  if (
    typeof authorizationHeader !== "string" ||
    !(expectedTokenDigest instanceof Uint8Array) ||
    expectedTokenDigest.byteLength !== 32
  ) return false;

  const match = /^Bearer ([^\s]+)$/u.exec(authorizationHeader);
  const candidate = match?.[1] ?? "";
  return timingSafeEqual(sha256(candidate), expectedTokenDigest);
}

export function validateDeletePayload(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) return null;

  const keys = Object.keys(value);
  if (
    keys.length !== 1 ||
    keys[0] !== "materializer_receipt_sha256" ||
    typeof value.materializer_receipt_sha256 !== "string" ||
    !RECEIPT_PATTERN.test(value.materializer_receipt_sha256)
  ) return null;

  return value.materializer_receipt_sha256;
}

export async function deleteReceiptArtifacts(privateRoot, receipt) {
  if (!RECEIPT_PATTERN.test(receipt)) {
    throw new ArtifactScopeError("invalid_receipt");
  }

  const target = directChild(privateRoot, receipt);
  const tombstone = directChild(privateRoot, `${TOMBSTONE_PREFIX}${receipt}`);
  let found = false;

  for (let pass = 0; pass < MAX_DELETE_PASSES; pass += 1) {
    const tombstoneState = await directoryState(tombstone);
    if (tombstoneState === "directory") {
      found = true;
      await rm(tombstone, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay: 10,
      });
      continue;
    }
    if (tombstoneState === "invalid") throw new ArtifactScopeError();

    const targetState = await directoryState(target);
    if (targetState === "missing") {
      return found
        ? { status: "deleted", deleted_count: 1 }
        : { status: "not_found", deleted_count: 0 };
    }
    if (targetState === "invalid") throw new ArtifactScopeError();

    found = true;
    try {
      await rename(target, tombstone);
    } catch (error) {
      if (isRetryableRenameRace(error)) continue;
      throw error;
    }
  }

  throw new Error("artifact_delete_conflict");
}

export function createApp({
  privateRoot,
  tokenDigest,
  maxRequestBytes = DEFAULT_MAX_REQUEST_BYTES,
}) {
  if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 256) {
    throw new Error("max_request_bytes_invalid");
  }

  return async function handleRequest(request, response) {
    setSecurityHeaders(response);

    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { ok: true });
    }
    if (request.method !== "POST" || request.url !== "/delete") {
      return sendJson(response, 404, { error: "not_found" });
    }
    if (!isAuthorized(request.headers.authorization, tokenDigest)) {
      return sendJson(response, 401, { error: "unauthorized" });
    }
    if (!isJsonContentType(request.headers["content-type"])) {
      return sendJson(response, 415, { error: "json_required" });
    }

    const body = await readBoundedBody(request, maxRequestBytes);
    if (body.status === "too_large") {
      response.setHeader("Connection", "close");
      const result = sendJson(response, 413, { error: "request_too_large" });
      response.once("finish", () => request.destroy());
      return result;
    }
    if (body.status !== "ok") {
      return sendJson(response, 400, { error: "invalid_json" });
    }

    let payload;
    try {
      payload = JSON.parse(body.text);
    } catch {
      return sendJson(response, 400, { error: "invalid_json" });
    }
    if (!hasExactlyOneReceiptMember(body.text)) {
      return sendJson(response, 400, { error: "invalid_request" });
    }
    const receipt = validateDeletePayload(payload);
    if (!receipt) {
      return sendJson(response, 400, { error: "invalid_request" });
    }

    try {
      const result = await deleteReceiptArtifacts(privateRoot, receipt);
      return sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof ArtifactScopeError) {
        return sendJson(response, 409, { error: "invalid_artifact_root" });
      }
      return sendJson(response, 503, { error: "delete_failed" });
    }
  };
}

export async function startServer({ env = process.env } = {}) {
  const privateRoot = await preparePrivateRoot(
    env.THROUGHLINE_PRIVATE_ARTIFACT_ROOT,
  );
  const tokenDigest = createTokenDigest(
    env.THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN,
  );
  const port = parsePort(env.PORT);
  const host = env.HOST?.trim() || "0.0.0.0";
  const maxRequestBytes = parseRequestLimit(env.MAX_REQUEST_BYTES);
  const app = createApp({ privateRoot, tokenDigest, maxRequestBytes });
  const server = http.createServer((request, response) => {
    Promise.resolve(app(request, response)).catch(() => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: "internal_error" });
      } else {
        response.destroy();
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return server;
}

async function directoryState(candidate) {
  try {
    const stat = await lstat(candidate);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return "invalid";
    return "directory";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

function directChild(root, childName) {
  const candidate = path.join(root, childName);
  if (path.dirname(candidate) !== root) throw new ArtifactScopeError();
  return candidate;
}

function isRetryableRenameRace(error) {
  return ["ENOENT", "EEXIST", "ENOTEMPTY"].includes(error?.code);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

function isJsonContentType(value) {
  return typeof value === "string" &&
    /^application\/json(?:\s*;|$)/iu.test(value);
}

function hasExactlyOneReceiptMember(text) {
  return (text.match(/"materializer_receipt_sha256"\s*:/gu) ?? []).length === 1;
}

function readBoundedBody(request, maxBytes) {
  const contentLength = Number(request.headers["content-length"]);
  if (
    Number.isFinite(contentLength) &&
    contentLength >= 0 &&
    contentLength > maxBytes
  ) return Promise.resolve({ status: "too_large" });

  return new Promise((resolve) => {
    const chunks = [];
    let byteLength = 0;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("aborted", onAborted);
      request.off("error", onError);
      resolve(result);
    };
    const onData = (chunk) => {
      byteLength += chunk.byteLength;
      if (byteLength > maxBytes) {
        request.pause();
        finish({ status: "too_large" });
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => finish({
      status: "ok",
      text: Buffer.concat(chunks, byteLength).toString("utf8"),
    });
    const onAborted = () => finish({ status: "aborted" });
    const onError = () => finish({ status: "aborted" });

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("aborted", onAborted);
    request.on("error", onError);
  });
}

function setSecurityHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function sendJson(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function parsePort(value) {
  if (value === undefined || value === "") return 8080;
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error("port_invalid");
  }
  return port;
}

function parseRequestLimit(value) {
  if (value === undefined || value === "") return DEFAULT_MAX_REQUEST_BYTES;
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 256 || limit > 65_536) {
    throw new Error("max_request_bytes_invalid");
  }
  return limit;
}

async function main() {
  const server = await startServer();
  const close = () => server.close(() => process.exit(0));
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("service_start_failed");
    process.exit(1);
  });
}
