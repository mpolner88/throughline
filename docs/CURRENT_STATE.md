# Throughline current state

## September 28 re-entry verification

**Verified:** 2026-09-28. **Scope:** live GitHub, App Store Connect UI, Supabase management metadata and aggregate SQL, local source/workspace inspection, and a fresh aggregate product report. Evidence: [return audit](evidence/2026-09-28-return-audit.md) and [product evidence](evidence/2026-09-28-product-evidence.md). This section supersedes the August statements below only for the explicitly rechecked facts; old dates do not become new runtime attestations.

- **Public:** App Store Connect shows 1.0.4 Ready for Distribution with build 2026081602. Exact local-source-to-signed-binary identity remains unproved.
- **Internal:** newest TestFlight build remains 1.0.5 (2026082801), Testing in Internal QA, with one reported install and 13 sessions. Aggregate installation is now observed; the restored Home/evaluation journey and Mike's acceptance remain unverified.
- **Backend inventory:** active API v30, MCP v15, private-artifact-delete v3, and ten migrations through August 23. No source byte-match, active-flag inspection, authenticated health test, or recording canary was performed.
- **Product evidence:** the preceding 35-day report has 192 events, 25 sessions and three signed-in users. Four schema-v2 outcomes now match durable recordings, all in the unknown cohort; their distribution channel is unknown. Public-baseline-eligible outcomes remain zero. Activation and retention are below readiness floors. Do not reuse August's zero-schema-v2 statement as current.
- **Quality:** current aggregate tables contain zero immutable processing operations, owner evaluations, contributions and corpus cases. There is still no independent real-audio quality result or proven feedback-learning loop. Legacy ratings do not establish either.
- **Work locations:** the local August checkout and September Claude [PR #2](https://github.com/mpolner88/throughline/pull/2) overlap; the PR's base/head lack the local operating guides. Its successful checks do not establish integration, peer review, deployment or owner acceptance. The [audit](evidence/2026-09-28-return-audit.md) owns the dated inventory.
- **Next gate:** preserve/reconcile local and remote work into one reviewed base before overlapping implementation. Product selection remains Mike's decision. The [tandem workflow](AGENT_TANDEM.md#daily-working-agreement) now includes mutual review; actual adoption is pending.

## August verification record

**Verified:** 2026-08-28
**Verification scope:** local source inspection, an isolated build from committed iOS source, the public US [App Store listing](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241), the point-in-time live API source comparison recorded in the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md), the bounded production and preview checks in the [first hosted-preview attempt](evidence/2026-08-18-measurement-hosted-preview-attempt.md), [first classification attempt](evidence/2026-08-18-measurement-hosted-preview-classification-attempt.md), [revised classification attempt](evidence/2026-08-18-measurement-hosted-preview-revised-classification-attempt.md), [Management classification attempt](evidence/2026-08-18-measurement-hosted-preview-management-classification-attempt.md), and [pgTAP diagnostic attempt](evidence/2026-08-18-measurement-hosted-preview-pgtap-diagnostic-attempt.md), the corrective [classification database gate](evidence/2026-08-18-measurement-classification-database-gate.md), the [read-only Management classification CI gate](evidence/2026-08-18-measurement-classification-management-api-ci.md), the non-billable [hosted pgTAP diagnostic readiness record](evidence/2026-08-18-measurement-hosted-pgtap-diagnostic-ready.md), and the [structured-contract CI gate](evidence/2026-08-18-measurement-structured-contract-ci.md). The August 17 counts below are an operator-observed, unretained private aggregate-query snapshot: a repository assertion, not tracked production evidence. Other live-provider and App Store Connect state is not independently re-verified from this checkout. For durable intent, see [PRODUCT.md](PRODUCT.md); for the current runtime map, see [ARCHITECTURE.md](ARCHITECTURE.md).

**2026-08-22 live measurement evidence:** [production rollout and first post-cutover baseline](evidence/2026-08-22-measurement-production-rollout.md). This newer evidence supersedes the older measurement-rollout and API status recorded below where they conflict.

**2026-08-23 live evaluation evidence:** [TL-EVAL flags-off production foundation rollout](evidence/2026-08-23-evaluation-production-rollout.md) and the later [production lineage-write behavior canary](evidence/2026-08-23-evaluation-lineage-behavior-canary.md). They supersede the local-only TL-EVAL deployment status below while preserving the original verification history.

**2026-08-25 live TestFlight evidence:** [feedback iteration and internal delivery](evidence/2026-08-25-testflight-feedback-iteration.md). It supersedes the earlier processing and tester-visibility gaps for the internal TestFlight builds while preserving the original upload history.

**2026-08-27 live TestFlight evidence:** [Home feedback first slice and internal delivery](evidence/2026-08-27-home-feedback-first-slice.md). It supersedes build `2026082501` as the newest internal iteration while preserving the prior build and upload history.

**2026-08-28 live TestFlight evidence:** [Home UI rollback and internal delivery](evidence/2026-08-28-home-ui-rollback.md). It supersedes build `2026082601` as the newest internal iteration after owner rejection of that build's Home presentation, while preserving the backend, evaluation, privacy, and prior release history.

**2026-08-27 live public App Store evidence:** The public US listing shows version `1.0.4`, the subtitle `Voice to AI Agents & To-Do's`, and a public description of structured to-dos plus owner-controlled MCP access. This verifies public availability, not App Store Connect state or exact submitted-binary identity. Evidence: [live US App Store listing](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241).

**2026-08-27 live owned-discovery evidence:** GitHub Pages build `1179780269` reports `built` from commit `1770db3`. The public [home](https://mpolner88.github.io/throughline/) and [voice-to-task-list page](https://mpolner88.github.io/throughline/voice-to-task-list/) returned current content and images, and public Playwright checks passed at mobile and desktop widths. This verifies delivery, not acquisition lift or account-side campaign attribution.

## Evidence standard

This document separates executable local evidence from repository assertions about external systems. The latter are useful operating context, not independent proof of a current provider or App Store Connect state.

- **Local source evidence:** the release configuration in [ios/Throughline.xcodeproj/project.pbxproj](../ios/Throughline.xcodeproj/project.pbxproj), the iOS client, [Supabase API source](../supabase/functions/api/index.ts), and the committed-tree build recorded in the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md).
- **External-state assertions:** [App Store readiness record](app-store-readiness.md) and the August 17 aggregate counts below. The counts are an operator-observed, unretained private aggregate-query snapshot; they are not independently reproducible evidence in this checkout. Regenerate the privacy-safe aggregate report with [scripts/product-learning-report.mjs](../scripts/product-learning-report.mjs) before using any count for a decision. The underlying query output is not tracked because it could expose user or session identifiers.
- **Operational procedures:** [hosted-backend.md](hosted-backend.md) is a runbook, not proof that a command has been run or that a deployment is current.

## Current production measurement status

TL-DATA-001 production rollout is complete and measuring as of 2026-08-22. It reached the exact six-migration cutover history with zero pending or remote-only migrations; production has since advanced to ten fully paired migrations through the flags-off TL-EVAL foundation. API v25 matched the sealed measurement candidate source, JWT behavior remained exact, the non-API function fingerprint did not change, and the aggregate-only synthetic canary passed all three event paths with zero invalid identities or raw-data leaks. The first post-cutover report found zero real schema-v2 processing outcomes, so reconciliation and public-product conclusions remain collecting baseline. TL-EVAL-001 is no longer blocked on rollout evidence.

Evidence: [production rollout and first post-cutover baseline](evidence/2026-08-22-measurement-production-rollout.md), [product metrics](../product/metrics.md), and the reproducible aggregate report generator [product-learning-report.mjs](../scripts/product-learning-report.mjs).

## Current evaluation foundation

**Live status, verified 2026-08-23:** The frozen TL-EVAL foundation is deployed and its separate production lineage-write behavior canary passed. Production has the three core lineage/retention migrations, source-identical API v30 and private-artifact deletion Edge v3, and one protected 15-minute reconciliation schedule. The direct Edge/Storage preflight, one-hour API-to-deletion-Edge-to-Storage exercise, and one-lineage-flag synthetic transcript canary all passed. The later owner-canary preflight found the local revision-bound recording-detail response missing from API v29, deployed only that additive API response, then re-downloaded and byte-matched all 13 API/deletion sources. Authenticated health passed, unauthenticated recordings remained `401`, active eligibility remained zero, and all four behavior controls remained absent/off. No real private corpus was materialized, no private audio was sent to a provider, no owner evaluation or quality claim was established, and no UI changed.

Evidence: [owner-canary production preflight](evidence/2026-08-23-evaluation-owner-canary-preflight.md), [production lineage-write behavior canary](evidence/2026-08-23-evaluation-lineage-behavior-canary.md), [TL-EVAL flags-off production foundation rollout](evidence/2026-08-23-evaluation-production-rollout.md), [frozen hosted rollout package](evidence/2026-08-22-evaluation-rollout-package.md), and [hosted Edge/Storage canary runner](evidence/2026-08-22-hosted-evaluation-canary-runner.md).

**Local iOS/privacy source status, verified 2026-08-23:** The approved note-level private-quality disclosure, exact-revision 14-field preview, default-off readiness binding, revision-aware correction request, and idempotent contribution-removal control now compile in an unsigned Release simulator build. Markdown/HTML policy parity, release privacy-manifest syntax, Swift wire/copy tests, and the complete API behavior suite pass. These are local source facts only: no behavior flag was enabled, no API or app was deployed, the policy was not published, App Store answers were not changed, and no real contribution or quality result exists.

Evidence: [evaluation iOS and local privacy controls](evidence/2026-08-23-evaluation-ios-privacy-controls.md).
**Owner-canary readiness status, verified 2026-08-23:** A deterministic content-free package binds eight exact API, behavior-flag, iOS, privacy-manifest, and policy sources; fixes the nine-phase lineage -> retention -> evaluation-write -> owner-action -> withdrawal order; excludes owner judgment and private identifiers; and switches rollback from stable to retention-aware after active eligibility. Its verifier rejects source drift and manifest tampering, and the generated artifact is mode `0600` in a private temporary namespace. The fresh read-only hosted preflight and API v30 source correction are complete. No behavior flag, owner contribution, retained audio, policy publication, App Store action, private materialization, or independent provider execution occurred.

Evidence: [owner-canary production preflight](evidence/2026-08-23-evaluation-owner-canary-preflight.md) and [owner-controlled canary preparation](evidence/2026-08-23-evaluation-owner-canary-preparation.md).

**Internal TestFlight delivery status, verified 2026-08-28:** Version `1.0.5`, build `2026082801`, restores the preceding Home presentation after owner rejection of build `2026082601`. It was signed and uploaded with Apple's internal-testing-only export control. Fresh App Store Connect API reads showed `VALID`, not expired, and present in the one-tester `Internal QA` group. Installation and the restored Home journey remain unproved. The public app was not submitted or changed; no backend, migration, policy, provider, model, or evaluation behavior control changed; and internal use does not establish user-outcome uplift.

Evidence: [Home UI rollback and internal delivery](evidence/2026-08-28-home-ui-rollback.md), [rollback release manifest](releases/2026-08-28-ios-1.0.5-2026082801.md), [rejected Home iteration](evidence/2026-08-27-home-feedback-first-slice.md), [preceding feedback iteration](evidence/2026-08-25-testflight-feedback-iteration.md), and the earlier [internal TestFlight canary delivery](evidence/2026-08-24-evaluation-owner-testflight-canary.md).
Historical local-only foundation detail and its superseded test totals are preserved outside the current snapshot in [the 2026-08-22 evaluation local-foundation history](history/2026-08-22-evaluation-local-foundation.md).

## Release and runtime

The dated live-status sections above supersede historical rollout rows below where they conflict.

| Area | Current recorded fact | Evidence strength and link |
| --- | --- | --- |
| Public App Store release | Version **1.0.4** is publicly available in the US as of 2026-08-27. The listing names voice-to-agent and structured-to-do behavior. | Direct public evidence: [live US App Store listing](https://apps.apple.com/us/app/throughline-ai-voice-notes/id6774304241). This does not prove App Store Connect state or exact submitted-binary identity. |
| Public owned discovery | The product home and `/voice-to-task-list/` page are live from Pages commit `1770db3`; the verified CTA uses the `website-aug26` App Store campaign token. | Direct public evidence: [home](https://mpolner88.github.io/throughline/) and [task page](https://mpolner88.github.io/throughline/voice-to-task-list/); GitHub Pages build `1179780269` reported `built` on 2026-08-27. This does not prove account-side attribution visibility or performance. |
| Prior iOS release build | Version **1.0.4**, build **2026081602**, is committed as a strong source reconstruction and builds successfully from an isolated committed-tree export. Apple validation on 2026-08-24 reported the `1.0.4` version as previously approved and its prerelease train closed. | Local source configuration: [project.pbxproj](../ios/Throughline.xcodeproj/project.pbxproj). Build procedure, toolchain, frozen hashes, and evidence boundary: [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md). Public availability is separately verified by the live listing above. |
| Internal TestFlight iteration | Version **1.0.5**, build **2026082801**, restores the preceding Home presentation after owner rejection of build **2026082601**. It was uploaded with `testFlightInternalTestingOnly=true`; Apple reported `VALID`, not expired, and present in the one-tester **Internal QA** group. | [Home UI rollback and internal delivery](evidence/2026-08-28-home-ui-rollback.md) and [release manifest](releases/2026-08-28-ios-1.0.5-2026082801.md). |
| App Store Connect state beyond internal TestFlight | No App Store submission, review, public release, or public-version change occurred in the internal iteration. | Internal-only export receipt plus fresh App Store Connect UI verification recorded in the evidence above. |
| App API | iOS uses a Supabase Edge Function API. On 2026-08-23, active `api` v30 was freshly downloaded and all 13 API/deletion sources matched local bytes after the additive current-revision response deploy. Authenticated health passed, unauthenticated recordings returned `401`, active eligibility was zero, and all evaluation behavior controls were absent/off. | [UploadClient.swift](../ios/Throughline/Services/UploadClient.swift), [api/index.ts](../supabase/functions/api/index.ts), and the [owner-canary production preflight](evidence/2026-08-23-evaluation-owner-canary-preflight.md). |
| Measurement-attribution rollout | `TL-DATA-001` production rollout is complete and measuring as of 2026-08-22. Production reached the exact six-migration cutover, API v25 matched the sealed candidate, and the aggregate-only synthetic canary passed. The first post-cutover report found zero real schema-v2 outcomes, so product interpretation remains collecting baseline; `TL-EVAL-001` is unblocked. | [Production rollout and first post-cutover baseline](evidence/2026-08-22-measurement-production-rollout.md). |
| Transcription | Groq `whisper-large-v3-turbo`. | Code default in [api/index.ts](../supabase/functions/api/index.ts); the deployed secret/config was not fetched during this verification. |
| Extraction | Groq `openai/gpt-oss-120b` with JSON-object response mode. | Code default and request construction in [api/index.ts](../supabase/functions/api/index.ts); the deployed secret/config was not fetched during this verification. |
| Demo limit | The onboarding demo is 30 seconds. | [OnboardingView.swift](../ios/Throughline/Views/OnboardingView.swift) and the API demo-duration check in [api/index.ts](../supabase/functions/api/index.ts). |
| Authenticated recording limit | The current iOS client caps an individual authenticated recording at five minutes. | Client-side limit in [HomeView.swift](../ios/Throughline/Views/HomeView.swift). This is not evidence of an equivalent server-side duration limit. |
| Daily allowance | A ten-minute daily allowance is intended but not implemented or enforced. | No corresponding daily-limit enforcement exists in [api/index.ts](../supabase/functions/api/index.ts); see the documented constraint in the [operating-system plan](superpowers/plans/2026-08-17-documentation-operating-system.md). |
| Onboarding | Onboarding is unchanged by this documentation slice. | This slice changes documentation only; current UI is [OnboardingView.swift](../ios/Throughline/Views/OnboardingView.swift). |

## Privacy-safe August 17 usage baseline

The following is an operator-observed, unretained private aggregate-query snapshot from 2026-08-17. It is a repository assertion, not tracked production evidence; it contains no raw content or identifiers. Regenerate the privacy-safe aggregate report with [scripts/product-learning-report.mjs](../scripts/product-learning-report.mjs) before using these counts for a decision.

| Measure | Aggregate |
| --- | ---: |
| First-party mixed events | 536 |
| Sessions | 76 |
| Signed-in users | 5 |
| Durable processed recordings | 12 |
| Authenticated recordings | 6 across 4 users |
| Extraction-feedback rows | 8 across 5 recordings from 2 reviewers |
| Action-item toggles | 28, concentrated in 2 users |
| Note edits | 0 |
| Active MCP tokens | 0 |

Test/internal traffic is not yet marked separately from external traffic. The observed 20% activation calculation is **not a valid public baseline**: event versions differ and `surface` coverage differs, so its numerator and denominator cannot yet be treated as a matched, consistent activation cohort. The event stream and durable recordings also need reconciliation before processing outcomes are used for a product decision. Metric definitions and readiness floors are in [product/metrics.md](../product/metrics.md).

## First post-cutover processing baseline

The aggregate-only report generated on 2026-08-22 after TL-DATA-001 cutover contains zero real schema-v2 processing outcomes and zero public-baseline-eligible outcomes. It separately preserves 25 legacy-v1 unattributed outcomes and eight final durable recordings without a schema-v2 upload marker. This is a valid collecting baseline, not evidence of improved or degraded user outcomes. See the [production rollout evidence](evidence/2026-08-22-measurement-production-rollout.md).

## Known gaps and limits

- **Feedback is stored, not consumed.** The API persists extraction feedback, but there is no implemented feedback-learning or promotion path in [api/index.ts](../supabase/functions/api/index.ts).
- **Production edits still overwrite originals while behavior flags are off.** The deployed flags-off API and atomic RPC can preserve current corrections and action toggles as immutable revisions, with action state explicitly ineligible for evaluation, but those write paths are not enabled ([production rollout evidence](evidence/2026-08-23-evaluation-production-rollout.md)).
- **Immutable processing lineage is production-canary proven but has no real-user runtime traffic.** One synthetic transcript established complete immutable extraction lineage and cascade cleanup, then all behavior controls returned absent; the reconciled baseline has one reusable contract and zero recording-linked lineage/evaluation rows ([lineage behavior canary](evidence/2026-08-23-evaluation-lineage-behavior-canary.md)).
- **Exact model and prompt attribution is canary-proven, not yet continuously live.** The production flagged path bound the synthetic output to the resolved model/request/prompt/schema/normalizer contract, but the lineage flag was rolled back and real-user coverage remains zero ([lineage behavior canary](evidence/2026-08-23-evaluation-lineage-behavior-canary.md)).
- **No independent real-audio quality result.** The historical golden fixture path is now explicitly labeled `plumbing_only` and cannot emit a quality pass. The private path is locally sealed, isolated, and backed by a service-derived corpus lifecycle, but neither real corpus materialization nor real private-audio provider execution has been authorized or run ([evaluation evidence](evidence/2026-08-22-evaluation-contract-and-private-plumbing.md)).
- **Real schema-v2 processing volume is still zero.** The reconciliation contract is live, but the first post-cutover report has no real schema-v2 outcomes. Historical rows remain legacy/unattributed, and no processing outcome should be interpreted until new eligible traffic arrives.
- **No product cost ledger.** There is no persisted decision-grade accounting of model, tokens, retries, latency, and cost; the requirement is defined in [product/metrics.md](../product/metrics.md).
- **Submitted source is strongly reconstructed and committed, but exact binary identity remains unproved.** The audited iOS runtime and API v22 source are committed, frozen at recorded hashes, and the iOS tree builds from an isolated committed export. The submitted archive, signed binary, receipt, and signing/export inputs are absent, so they cannot be compared byte-for-byte; see the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md).

## Re-verification triggers

Recheck the relevant provider directly before any App Store decision, deployment, provider/model/configuration change, retention operation, or public metric claim. Record the new date and evidence link here; do not upgrade a repository assertion into a verified live fact without that evidence.
