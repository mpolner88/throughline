# Throughline current state

**Verified:** 2026-08-18
**Verification scope:** local source inspection, an isolated build from committed iOS source, the point-in-time live API source comparison recorded in the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md), and the bounded production and preview checks in the [first hosted-preview attempt](evidence/2026-08-18-measurement-hosted-preview-attempt.md) and [latest classification attempt](evidence/2026-08-18-measurement-hosted-preview-classification-attempt.md). The August 17 counts below are an operator-observed, unretained private aggregate-query snapshot: a repository assertion, not tracked production evidence. Other live-provider and App Store state is not independently re-verified from this checkout. For durable intent, see [PRODUCT.md](PRODUCT.md); for the current runtime map, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Evidence standard

This document separates executable local evidence from repository assertions about external systems. The latter are useful operating context, not independent proof of a current provider or App Store Connect state.

- **Local source evidence:** the release configuration in [ios/Throughline.xcodeproj/project.pbxproj](../ios/Throughline.xcodeproj/project.pbxproj), the iOS client, [Supabase API source](../supabase/functions/api/index.ts), and the committed-tree build recorded in the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md).
- **External-state assertions:** [App Store readiness record](app-store-readiness.md) and the August 17 aggregate counts below. The counts are an operator-observed, unretained private aggregate-query snapshot; they are not independently reproducible evidence in this checkout. Regenerate the privacy-safe aggregate report with [scripts/product-learning-report.mjs](../scripts/product-learning-report.mjs) before using any count for a decision. The underlying query output is not tracked because it could expose user or session identifiers.
- **Operational procedures:** [hosted-backend.md](hosted-backend.md) is a runbook, not proof that a command has been run or that a deployment is current.

## Release and runtime

| Area | Current recorded fact | Evidence strength and link |
| --- | --- | --- |
| Public App Store release | Version **1.0.3** is recorded as public. | Repository assertion in [app-store-readiness.md](app-store-readiness.md), not independently checked in App Store Connect on 2026-08-17. |
| Next iOS build | Version **1.0.4**, build **2026081602**, is committed as a strong source reconstruction and builds successfully from an isolated committed-tree export. | Local source configuration: [project.pbxproj](../ios/Throughline.xcodeproj/project.pbxproj). Build procedure, toolchain, frozen hashes, and evidence boundary: [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md). |
| Upload and TestFlight | Build 2026081602 is recorded as uploaded and available in TestFlight. | Repository assertion in [app-store-readiness.md](app-store-readiness.md). Local source proves the version/build, not upload, processing, TestFlight, selection, submission, review status, or release. |
| App Store Connect state beyond upload | No independently retained local evidence proves every later App Store Connect state. | The repository assertions above must be rechecked in App Store Connect before a release decision. |
| App API | iOS uses a Supabase Edge Function API. A 2026-08-18 point-in-time post-check found active `api` v22 at the recorded control digest; no function deploy occurred. | [UploadClient.swift](../ios/Throughline/Services/UploadClient.swift), [api/index.ts](../supabase/functions/api/index.ts), the source comparison in the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md), and the bounded live post-check in the [latest hosted-preview classification attempt](evidence/2026-08-18-measurement-hosted-preview-classification-attempt.md). |
| Measurement-attribution rollout | Repository implementation and the isolated database gate are complete. The latest separately approved data-less hosted preview passed four-service provider health and its direct readiness sequence—database over the selected pooler route, Auth, REST, and Storage—but stopped before stable database classification or any migration when the richer database probe command became unavailable. Cleanup and an independent post-check confirmed zero previews, active API v22 at the recorded control digest, and the same ordered pair of production migrations still pending. Production rollout remains blocked, and no additional preview is authorized. | [Measurement database gate evidence](evidence/2026-08-17-measurement-database-gate.md), the [earlier hosted-preview attempt](evidence/2026-08-18-measurement-hosted-preview-attempt.md), and the [latest classification attempt](evidence/2026-08-18-measurement-hosted-preview-classification-attempt.md). |
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

## Known gaps and limits

- **Feedback is stored, not consumed.** The API persists extraction feedback, but there is no implemented feedback-learning or promotion path in [api/index.ts](../supabase/functions/api/index.ts).
- **Edits overwrite originals.** The note-edit route applies edits to the current recording and persists that record; it has no immutable revision history in [api/index.ts](../supabase/functions/api/index.ts).
- **No immutable transcription/extraction lineage.** Current recording data stores current processing fields, not immutable input/output versions or stage history ([api/index.ts](../supabase/functions/api/index.ts)).
- **No exact model or prompt-hash attribution.** The code selects model defaults and contains an extraction prompt, but processed records do not record an exact model identifier and prompt hash ([api/index.ts](../supabase/functions/api/index.ts)).
- **The current extraction eval self-copies golden output.** Without a predictions directory, the evaluator uses each fixture's expected output as its actual output ([evals/score-extraction.mjs](../evals/score-extraction.mjs)); it is not an independent model-quality result.
- **Events and durable-recording counts conflict.** The August 17 aggregate baseline above is mixed and has uneven event coverage; reconcile its event and durable-recording populations before interpreting funnel results.
- **No product cost ledger.** There is no persisted decision-grade accounting of model, tokens, retries, latency, and cost; the requirement is defined in [product/metrics.md](../product/metrics.md).
- **Submitted source is strongly reconstructed and committed, but exact binary identity remains unproved.** The audited iOS runtime and API v22 source are committed, frozen at recorded hashes, and the iOS tree builds from an isolated committed export. The submitted archive, signed binary, receipt, and signing/export inputs are absent, so they cannot be compared byte-for-byte; see the [1.0.4 provenance closure](releases/2026-08-17-ios-1.0.4-2026081602-provenance.md).

## Re-verification triggers

Recheck the relevant provider directly before any App Store decision, deployment, provider/model/configuration change, retention operation, or public metric claim. Record the new date and evidence link here; do not upgrade a repository assertion into a verified live fact without that evidence.
