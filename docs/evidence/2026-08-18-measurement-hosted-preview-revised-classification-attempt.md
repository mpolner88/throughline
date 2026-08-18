# Measurement hosted-preview revised-classification attempt

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** one separately and explicitly approved, short-lived, billable, data-less Supabase preview
- **Runner:** SHA-256 `ecc8eb53834a566ce2abf99ac20fee0740e9544eac9a8ac40e87899e4956ba5b`
- **Result:** provider and direct runtime health passed; the gate stopped before stable database classification or migrations
- **Production impact:** none

## Preflight and authority

The bounded preflight reverified the exact runner artifact, zero existing non-default previews, active production API v22 at the recorded control digest, and the exact ordered pair of pending production migrations before issuing one preview-create call. Mike's approval authorized exactly this one data-less preview and no production migration, function deployment, provider, model, pricing, recording-limit, onboarding, TestFlight, or App Store action.

Immediately before creation, the operator rechecked the [Supabase branching price](https://supabase.com/docs/guides/platform/manage-your-usage/branching): the default Micro compute size starts at **$0.01344 per hour**, with possible additional usage charges.

## Result

The runner created exactly one data-less preview. Provider service health passed four of four required services, and direct database/Auth/REST/Storage readiness passed four of four.

The first database operation needed for stable starting-state classification then failed with the fixed, content-safe category `database failure category: unknown`. Stable classification did not complete. No migration dry-run, migration apply, pgTAP contract, migration-history verification, final zero-row REST check, lint, or advisor step ran.

The fixed category proves only that the database command exited nonzero with output the sanitizer could not safely classify. The root cause cannot be recovered from this attempt; no more specific cause should be inferred.

## Cleanup and production post-check

The cleanup-armed runner deleted its exact preview target and confirmed cleanup. An independent post-check confirmed:

- zero non-default previews remained;
- production `api` remained active at v22 and matched the recorded control digest; and
- the exact pending production migrations remained unchanged and in order:
  1. `20260817180709_measurement_attribution.sql`
  2. `20260818061933_measurement_privilege_hardening.sql`.

No production migration, function deployment, or production data mutation occurred.

## Gate and next step

The one-use preview approval was consumed. No additional preview is authorized. Production rollout remains blocked.

Diagnose the fixed `unknown` database failure category through isolated local or CI evidence. Any revised runner must pass offline verification and independent review before another preview is proposed. A further billable preview requires Mike's fresh explicit approval for exactly one reviewed artifact.

## Privacy boundary

No raw audio, transcript, note text, feedback text, email, credential, provider project or branch reference, endpoint, or user/session identifier is present in this record.
