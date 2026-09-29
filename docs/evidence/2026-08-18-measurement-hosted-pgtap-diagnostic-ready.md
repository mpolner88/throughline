# Measurement hosted pgTAP diagnostic readiness

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** non-billable local diagnostic implementation and offline future-runner review
- **Result:** ready for a fresh one-use approval; not executed
- **Production impact:** none
- **External action:** none

## Committed diagnostic

Commit `80216be8fbbca17cf2d3af929d58d8d3de4b7305` contains exactly two files:

- `scripts/preview-branch-contract.test.mjs` at Git blob `0f48dc3cb4d0b2e446a3b5d4f34418e55902102b`; and
- `scripts/verify-measurement-database.mjs` at Git blob `0be41ae20f0b8a99698c5266f6713acc5cc08cfb`.

The repository contract passed 29 of 29 tests, and both changed files passed syntax checks. The committed verifier supplies the same bounded pgTAP failure summarizer to the baseline, attribution, and privilege-hardening phases. It reports only failed assertion numbers or fixed categories for authentication, SQL/permission/catalog, connection/timeout, CLI invocation, malformed or missing TAP summary, and unknown failure. Oversized or unsafe output fails closed rather than returning partial assertions or raw child output.

Independent review returned GO with no findings.

## Frozen future runner

The offline runner is frozen to the reviewed repository inputs, including the two blobs above:

- runner SHA-256: `bfd036fad27535346a6a0ad3500b3ac3283c882ab4998d5517fe68cf49b1ee89`;
- test-artifact SHA-256: `0c21bd5cefbf30aeb6e08e5d44c796fd30ecfc166435f3bb14610f69566718c6`; and
- focused verification: 11 of 11 tests passed.

Those tests bind both classification stages to the validated data-less child, preserve cleanup and the no-production-mutation boundary, and route all three pgTAP phases through the committed content-safe diagnostic. The runner has not created a preview, queried production data, applied a migration, or deployed a function.

## Evidence boundary and next gate

This milestone improves the evidence that a future hosted attempt can retain; it does not resolve the prior baseline pgTAP failure or prove hosted compatibility. The previous hosted-attempt record remains immutable, its one-use approval is consumed, and production remains unchanged and blocked.

There is no automatic retry. The next action is Mike's fresh explicit approval for exactly one billable data-less preview using only the runner SHA-256 recorded above. Any artifact drift requires renewed offline verification and review before a new approval request.

## Privacy boundary

This record contains no provider project or preview reference, endpoint, credential, raw database output, user or session identifier, email, audio, transcript, note text, feedback text, or row content.
