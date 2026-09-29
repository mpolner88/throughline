# Measurement hosted-preview attempt

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** one explicitly approved, short-lived, billable, data-less Supabase preview
- **Result:** inconclusive before database verification
- **Production impact:** none

## Result

Mike approved exactly one new preview for this gate. Immediately before creation, the operator rechecked the [Supabase branching price](https://supabase.com/docs/guides/platform/manage-your-usage/branching): the default Micro compute size starts at **$0.01344 per hour**, with possible additional usage charges. The preflight found zero existing non-default previews, the exact ordered pair of pending production migrations, and active API v22 at the recorded control digest.

The independently reviewed runner at SHA-256 `df86c41b8081a513d3a9eb6e54432dcb298570f7a84339b4b166802103a822ed` issued one data-less preview-create call. It never emitted the readiness-success marker and stopped after its bounded readiness window. No migration dry-run, migration apply, pgTAP test, database classification, REST verification, lint, or advisor step ran.

The runner then deleted the preview. A separate post-check confirmed zero non-default previews remained. It also confirmed production still had the same two pending migrations in the same order and API v22 still matched the control digest.

## Diagnosis

The failed attempt does **not** prove that the Supabase preview remained unhealthy. The runner sent `timeout_ms=10000` to the Management API service-health endpoint and converted the provider-rejected response into a generic retry. A subsequent read-only control matrix against healthy production established:

- repeated or comma-separated `auth`, `db`, `rest`, and `storage` requests without `timeout_ms` returned HTTP 200 and four `ACTIVE_HEALTHY` results;
- either encoding with `timeout_ms=10000` returned HTTP 400; and
- no raw response body, provider error text, project reference, credential, or user data was retained.

The [Management API reference](https://supabase.com/docs/reference/api/v1-get-services-health) documents the service-health endpoint and its query parameters, while the [current OpenAPI contract](https://api.supabase.com/api/v1-json) advertises `10000` within the optional timeout range. The HTTP 400 is therefore observed provider behavior at that boundary, not evidence of an invalid service list. The exact live control result above is the controlling evidence for this gate.

## Safe next step

The future runner now validates the identical no-timeout health request against healthy production before creating a preview, retries only transitional/network conditions, fails immediately on permanent HTTP, credential, identity, or response-shape errors, and reports only fixed, content-safe readiness stages. Independent review approved exact future-runner SHA-256 `6ae07f49d6115e9ee5d404f7b4bd3879d55c0c741b2ab370fd76f207b0b77055` with no Critical or Important findings. It has not been executed.

The single approved billable preview was consumed. A new hosted attempt requires Mike's fresh explicit approval. Production migration and API rollout remain blocked until one hosted preview passes the ordered 21-assertion baseline, 30-assertion attribution contract, seven-assertion privilege contract, exact histories, zero-row service checks, lint, advisors, and cleanup.

## Privacy and authority boundary

No raw audio, transcript, note text, feedback text, email, credential, project reference, branch reference, or user/session identifier is present in this record. No production migration, function deploy, account change, TestFlight action, or App Store action occurred.
