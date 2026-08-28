# MCP Registry Preparation Package

**Status:** planned metadata only; not published. Checked 2026-08-27 against the [official remote-server guide](https://modelcontextprotocol.io/registry/remote-servers), [publisher authentication guide](https://modelcontextprotocol.io/registry/authentication), and current [server schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json).

## Readiness Decision

The official MCP Registry is preview. It supports a public `streamable-http` remote and required secret headers. Throughline's live MCP endpoint is publicly reachable and rejects unauthenticated JSON-RPC requests, so it is a candidate for metadata preparation. This package is **not** evidence that a registry client will preserve the secret-header setup, that a namespace is owned, or that the server has been published.

## Proposed `server.json`

The namespace and release version are deliberately placeholders pending Mike's selected publisher identity. `websiteUrl` is constrained by the schema to one central public URL; the listing packet must additionally give reviewers the support and privacy URLs below. Do not add unsupported top-level support or privacy properties.

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.mpolner88/throughline-memory",
  "title": "Throughline Memory",
  "description": "Read your saved Throughline voice notes and open to-dos with read-only MCP tools.",
  "version": "0.1.0",
  "websiteUrl": "https://mpolner88.github.io/throughline/",
  "repository": {
    "url": "https://github.com/mpolner88/throughline",
    "source": "github"
  },
  "remotes": [
    {
      "type": "streamable-http",
      "url": "https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/mcp",
      "headers": [
        {
          "name": "Authorization",
          "description": "Bearer token created by the Throughline account owner.",
          "isRequired": true,
          "isSecret": true,
          "value": "Bearer {throughline_token}",
          "variables": {
            "throughline_token": {
              "description": "Your Throughline MCP token.",
              "isRequired": true,
              "isSecret": true,
              "format": "string",
              "placeholder": "USER_SUPPLIED_TOKEN"
            }
          }
        }
      ]
    }
  ]
}
```

## Field Classification

| Field or input | Status | Basis / action before use |
| --- | --- | --- |
| `$schema`, `title`, `description`, `remotes[].type`, and endpoint URL | ready | Official current schema plus 2026-08-27 public health check. |
| Secret Authorization header declaration | ready for schema validation | Official remote-server docs and schema support secret header inputs; client behavior must be tested with a synthetic token. |
| `name: io.github.mpolner88/throughline-memory` | needs_live_check | GitHub namespace ownership and matching registry login must be verified; use a domain namespace only after domain verification. |
| `version: 0.1.0` | requires_mike_approval | Proposed metadata release version; do not derive it from server's current `0.0.0` implementation string. |
| `websiteUrl` and repository URL | needs_live_check | Confirm public root, ownership, and product-facing content immediately before publication. |
| `icons` | needs_public_asset | Add an HTTPS PNG/JPEG/WebP/SVG asset only after the owned-surface lead provides an approved asset. |
| Support URL | ready outside schema | `https://mpolner88.github.io/throughline/support/` returned HTTP 200; carry it in the reviewer/listing packet. |
| Privacy URL | ready outside schema | `https://mpolner88.github.io/throughline/privacy/` returned HTTP 200; carry it in the reviewer/listing packet. |
| Publisher identity and auth session | requires_mike_approval | Registry login is an account action. |

## Required Validation Evidence

1. Validate the final JSON against the exact schema URL above, with no unrecognized fields.
2. Confirm the public endpoint still returns 401 to an unauthenticated JSON-RPC request.
3. With a newly created synthetic account and non-retained token, run authenticated `initialize`, `tools/list`, one empty/synthetic read, and an invalid/unsupported write request.
4. Revoke the synthetic token and prove the same request is rejected; retain no response content.
5. After Mike separately approves publication, check the exact registry lookup URL and compare listed metadata with the signed-off JSON.

## Publication Gate

Mike must approve the final name, version, icon, public description, publisher authentication, and the exact `mcp-publisher publish` action. No registry login, publication, or lookup-as-proof-of-publication occurred in DISC-01.
