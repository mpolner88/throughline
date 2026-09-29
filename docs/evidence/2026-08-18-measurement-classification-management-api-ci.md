# Measurement classification read-only Management API CI gate

- **Verified:** 2026-08-18 America/Los_Angeles
- **Scope:** isolated, data-less Docker-backed Supabase reconstruction in GitHub Actions
- **Result:** passed
- **Production impact:** none

## Result

GitHub Actions run [32181007382](https://github.com/mpolner88/throughline/actions/runs/32181007382) completed successfully in 1 minute 39 seconds. The contract suite passed 27 of 27 tests, and `node scripts/verify-measurement-database.mjs` emitted the terminal marker `Measurement database gate passed.`

The public CI-only commit `1cfa271d9ba22d28268eb47ae63fe2f0dfb77709` has parent `bb41b28db764f5c8084891186f3dfae6b0f913e2` and contains exactly these five authorized paths:

- `.github/workflows/measurement-database.yml`
- `scripts/hosted-preview-management-query.mjs`
- `scripts/preview-branch-contract.mjs`
- `scripts/preview-branch-contract.test.mjs`
- `scripts/verify-measurement-database.mjs`

The corresponding exact Git blob identifiers are:

- workflow: `df9ae4d91ad4226abe422604a2dc797e5a8686cb`;
- Management query: `7c4127ebc54abb501c3a9c194e60188c3e0a8277`;
- contract: `b56084e638e66a1cf9d4a9ffb074af589f56d48e`;
- contract tests: `d5310156c0a21964c25f4cba3af2e88a74a887ac`; and
- database verifier: `a0bdcbbf94049099955c00b88f03f6f13b656ab3`.

Those five blobs are byte-identical to local commit `256cb8a0002ce461ad8ba69f591613a40ec17c3f`.

The database verifier admits its success marker only after the pristine full-replay check, baseline reconstruction and 21-test contract, populated delta-only classification, isolated attribution migration and 30-test contract, isolated privilege-hardening migration and 7-test contract, exact migration-history checks, empty REST checks, lint, advisors, and cleanup all pass. The individual pgTAP summaries are intentionally not echoed in the Actions log; their exact counts are enforced by the reviewed verifier and its contract tests.

The separately reviewed offline hosted runner has SHA-256 `2f01bd829160e2d557df743f3df26323db7474bf7f842c40d3ddde14c68bad2b`; its test artifact has SHA-256 `d54bc6d00ed270a7cd44e748ad8fa1af7261d3ae25f038d77e962d69856bc33e`. Their combined offline verification passed 34 of 34 tests with no Critical, Important, or Minor review findings. No new Supabase preview was created or executed, and no billable-preview approval was consumed.

The workflow emitted a non-fatal action-runtime deprecation warning for Node.js 20 compatibility. It did not affect the job or either verification step.

## Evidence boundary

This run proves the read-only child-classification contract and the complete database sequence in an isolated local Supabase stack. It does not prove hosted-preview compatibility, hosted Management API response behavior against a child database, production-derived migration history, hosted privileges, or production rollout safety.

The prior failed hosted-preview evidence remains immutable. Production remains unchanged and rollout remains blocked. A further billable data-less preview requires Mike's fresh explicit approval for exactly one reviewed runner artifact.

## Privacy boundary

No raw audio, transcript, note text, feedback text, email, credential, provider project or preview reference, provider endpoint, or user/session identifier is present in this record.
