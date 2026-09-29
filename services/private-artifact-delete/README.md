# Throughline private-artifact deletion service

This service implements the trusted, receipt-scoped deletion boundary required by `TL-EVAL-001`. It has no external package dependencies and does not contact Supabase, a model provider, or any other network service.

## Contract

`POST /delete` requires `Authorization: Bearer <service token>` and `Content-Type: application/json`. The body must contain exactly one field:

```json
{"materializer_receipt_sha256":"<lowercase 64-character SHA-256>"}
```

The service derives the target only as the direct child:

```text
<THROUGHLINE_PRIVATE_ARTIFACT_ROOT>/<materializer_receipt_sha256>
```

Callers cannot provide a root or path. A successful deletion returns `{"status":"deleted","deleted_count":1}`. An already-absent scope returns `{"status":"not_found","deleted_count":0}`. Symlink and non-directory targets are rejected. Responses contain aggregate status only, and request values are never logged.

Deletion first atomically renames the complete receipt root to a reserved in-progress child and then removes it recursively. Concurrent retries converge safely. If the process stops after the rename, the next request for the same receipt finishes the reserved in-progress deletion.

`GET /health` is unauthenticated and returns only `{"ok":true}`.

## Configuration

- `THROUGHLINE_PRIVATE_ARTIFACT_ROOT` — required absolute private root. The service creates it when absent and rejects a symlink or non-directory root.
- `THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN` — required bearer credential.
- `HOST` — optional listen address; defaults to `0.0.0.0`.
- `PORT` — optional port; defaults to `8080`.
- `MAX_REQUEST_BYTES` — optional body limit from 256 through 65536 bytes; defaults to 4096.

The process must have read, rename, and recursive-delete access to the mounted private root. The API setting `THROUGHLINE_PRIVATE_ARTIFACT_DELETE_URL` should point to the full trusted URL ending in `/delete`. Keep the evaluation behavior flags off until a separately governed synthetic canary passes.

## Local verification

From this directory:

```bash
npm test
```

All tests use generated synthetic bytes in temporary directories. They cover authentication, exact payload validation, request limits, direct-child deletion, idempotency, concurrency, interrupted-delete recovery, and symlink/non-directory rejection.

## Container

Build from this directory and mount the private root at a directory writable by the container's unprivileged `node` user:

```bash
docker build -t throughline-private-artifact-delete .
docker run --rm -p 8080:8080 \
  -e THROUGHLINE_PRIVATE_ARTIFACT_ROOT=/private/evaluation \
  -e THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN=synthetic-canary-token \
  -v /private/evaluation:/private/evaluation \
  throughline-private-artifact-delete
```

The example credential is synthetic. Do not place real tokens, receipts, private paths, or corpus content in tracked files, command history, logs, or evidence.
