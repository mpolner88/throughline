# Throughline Release Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task by task.

**Goal:** Preserve the submitted iOS 1.0.4 and deployed API v22 control before changing measurement or quality behavior.

**Architecture:** Runtime source, verification artifacts, and evidence records are separate commits. Every claim is bounded by its evidence strength; no deploy or App Store mutation occurs.

**Slice:** [Release Provenance](../../slices/release-provenance.md)

## Global constraints

- Begin from the documentation-foundation head and an empty index.
- The provenance audit used `5010d6953dfbd6555c804a664085caaa71fa455c` as its runtime comparison base. Later documentation-only commits do not strengthen release provenance.
- Never stage a file outside the current task's exact list.
- Never commit `.env*`, `ios/Config/Local.xcconfig`, `ios/Config/LocalRelease.xcconfig`, `supabase/.temp/**`, signing/export material, archives, raw content, or identifiers.
- Do not edit runtime source in order to make a check pass. A mismatch blocks the task and triggers re-audit.
- Avoid broad Git scans if the iCloud-backed checkout stalls; use explicit path lists.

### Task 1: Preserve reconstructed iOS 1.0.4 source

**Files:**
- `ios/Throughline.xcodeproj/project.pbxproj`
- `ios/Throughline/AppState.swift`
- `ios/Throughline/Info.plist`
- `ios/Throughline/Models/ThroughlineNote.swift`
- `ios/Throughline/Services/AuthClient.swift`
- `ios/Throughline/Services/UploadClient.swift`
- `ios/Throughline/Views/HomeView.swift`
- `ios/Throughline/Views/OnboardingView.swift`
- `ios/Throughline/Views/RootView.swift`
- `ios/Throughline/Views/SharedComponents.swift`
- `ios/Throughline/Assets.xcassets/GoogleG.imageset/Contents.json`
- `ios/Throughline/Assets.xcassets/GoogleG.imageset/google-g-logo.png`
- `ios/Throughline/Resources/GoogleSans-Medium.ttf`
- `ios/Throughline/Throughline.entitlements`

- [ ] Record SHA-256 for all 14 files in the task report and run the credential-shaped-literal scan over selected text files.
- [ ] Validate both plists with `plutil` and parse the asset JSON.
- [ ] Stage exactly the 14 paths; run staged whitespace and name checks.
- [ ] Commit `chore(release): preserve reconstructed iOS 1.0.4 source`.
- [ ] State that this is a strong reconstruction, not byte-for-byte proof of the absent submitted archive.

### Task 2: Preserve deployed API v22 source

**Files:**
- `supabase/functions/api/index.ts`
- `supabase/functions/_shared/posthog.ts`

- [ ] Recheck live function metadata: active v22 and digest `e894c25fd6c87e894ebf04eef32ae33ac61c0869c93be2995eaef97c655fde33`.
- [ ] Download `api` into a new `mktemp -d` work directory, never over the repository.
- [ ] Require byte equality and these hashes for all four deployed components: `api/index.ts` `5bfb2d91b4ae8cc6ea3ec96a50b34d46178c36871f315a4a9841a194800942eb`; `api/deno.json` `776494746017e3d2b06d84933befb734499e53c2ef2e951566801b8cb65882ba`; `_shared/memory-tools.ts` `177a78a57ecbc3a4563bf9167e0c5d4f12e568dd5f837328a3c9444d1a1bdc7f`; `_shared/posthog.ts` `b4fb0c0e5fc333abc54cea09f47726c5cd6b0bbafe2b5383abd8a9c6f8d3bf39`.
- [ ] Confirm `api/deno.json` and `_shared/memory-tools.ts` are already tracked and unchanged.
- [ ] Stage exactly the two delta files, run checks, and commit `chore(release): preserve deployed API v22 source`.
- [ ] Do not deploy a function.

### Task 3: Preserve release verification artifacts

**Files:**
- `supabase/functions/_shared/posthog_test.ts`
- `core/extraction-pipeline.mjs`
- `core/extraction-pipeline.test.mjs`
- `ios/Tests/ThroughlineNoteActionItemTests.swift`
- `scripts/auth-canary.mjs`
- `scripts/recording-canary.mjs`
- `evals/prompts/extract-note-v0.md`

- [ ] Verify the eval prompt remains the release-era semantic reference for the embedded runtime rules; do not claim byte identity.
- [ ] Run the extraction tests, both canary syntax checks, the PostHog Deno tests, and the standalone Swift action-item test with caches under `/private/tmp`.
- [ ] Stage exactly the seven paths, run checks, and commit `test(release): preserve 1.0.4 verification artifacts`.
- [ ] Do not stage `package.json` or product-report/dashboard scripts.

### Task 4: Verify the committed tree and close provenance

**Files:**
- Create `docs/releases/2026-08-17-ios-1.0.4-2026081602-provenance.md`
- Modify `docs/CURRENT_STATE.md`

- [ ] Export only committed `ios/` content with `git archive` into a temporary directory.
- [ ] Build Release for `generic/platform=iOS` with signing disabled and all build/package caches outside the workspace.
- [ ] Record Xcode version, resolved version/build, result, all three preservation commit SHAs, frozen hashes, live API evidence, checks, rollback, and remaining archive/signing ambiguity in the additive closure record.
- [ ] Update current state narrowly: a committed reconstruction now exists, while exact submitted-binary identity remains unproved.
- [ ] Validate links, whitespace, and exact two-file staged scope.
- [ ] Commit `docs(release): record 1.0.4 provenance closure`.

### Task 5: Whole-slice verification

- [ ] Review the net diff from this plan's execution base for exact allowed paths only.
- [ ] Confirm no secret-shaped literals, content, identifiers, deployment, App Store action, or unrelated dirty file entered any commit.
- [ ] Confirm 14/14 iOS and 2/2 API delta hashes, live 4/4 API equality, verification checks, and clean-tree build evidence are honestly recorded.
- [ ] Run a final independent review; Critical or Important findings block closure.
