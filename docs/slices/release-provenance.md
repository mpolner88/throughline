# Release Provenance Slice

**Backlog state:** `closed`
**Slice phase:** `closed`
**Backlog:** Completed program dependency; no standalone backlog item
**Selected:** 2026-08-17
**Completed:** 2026-08-17
**Program:** [Core Quality and Learning](../programs/core-quality-learning.md)
**Closure:** [iOS 1.0.4 / API v22 provenance closure](../releases/2026-08-17-ios-1.0.4-2026081602-provenance.md)

## Problem

The submitted iOS 1.0.4 source and deployed Supabase API v22 are ahead of the previously committed runtime. Changing the quality or measurement pipeline before preserving that control would make regressions and release evidence harder to interpret.

## Outcome

Preserve, without changing or deploying behavior:

- the audited 14-file iOS 1.0.4 build 2026081602 runtime delta;
- the two-file Git delta that reproduces deployed API v22;
- release-adjacent verification artifacts in a separate commit; and
- an additive provenance closure record plus a narrow current-state update.

## Evidence

- A prior ephemeral Xcode receipt established successful delivery/upload of iOS 1.0.4 build 2026081602 to Apple. The receipt and archive are now absent, so the complete submitted binary cannot be re-hashed.
- Before temporary evidence was removed, `OnboardingView.swift`, `HomeView.swift`, and `ThroughlineNote.swift` matched the archive-derived snapshot. The remaining submitted source is strongly reconstructed, not cryptographically proven.
- A fresh 2026-08-17 live check found Supabase `api` active at v22 with bundle digest `e894c25fd6c87e894ebf04eef32ae33ac61c0869c93be2995eaef97c655fde33`.
- A fresh isolated download matched all four deployed API source components byte-for-byte. Only `api/index.ts` and `_shared/posthog.ts` are uncommitted deltas; the other two components are already tracked and unchanged.

## Primary metric

All 16 audited runtime paths are committed at their frozen hashes, and the deployed API remains a 4/4 byte-for-byte source match at verification time.

## Guardrails

- No deployment, App Store action, production-data write, provider/model/configuration change, onboarding change, privacy-policy change, or user-facing behavior change.
- No credentials, user content, email addresses, or raw user/session identifiers.
- Stage only the declared files in each commit; preserve every unrelated dirty path.
- A successful clean build strengthens reconstructability but does not prove binary identity with the absent archive.

## Authority

This is routine, reversible evidence preservation inside the approved core-quality program. It does not exercise any Mike-gated product or release decision.

## Non-goals

- Consolidating `docs/app-store-readiness.md` or `docs/product-learning-loop.md`.
- Committing `package.json`, report/dashboard scripts, screenshots, marketing, mockups, generated output, local Xcode configuration, SwiftPM workspace state, archives, or signing material.
- Claiming current App Store Connect processing, TestFlight, submission, review, or release state.

## Rollback

The preservation commits remain reviewable and revertible. If any path or hash is wrong, revert only the affected commit and repeat the audit. Never alter historical source merely to make a verification pass.

## Acceptance

- Exact scoped files and hashes are recorded.
- Selected text files contain no credential-shaped literals.
- Plists and asset metadata parse.
- API v22 metadata and four-file equality are rechecked without downloading over the repository.
- Release-adjacent unit checks pass.
- The committed iOS tree builds in an isolated Release configuration, or the exact external blocker is recorded.
- A new immutable closure record states evidence strength, commit SHAs, tests, and unresolved archive/signing limits.
