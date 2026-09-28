# Evaluation iOS and local privacy controls

**Verified:** 2026-08-23
**Scope:** local repository source and unsigned iOS simulator build only
**Slice:** `TL-EVAL-001`, implementation-plan Task 7

## Outcome

The approved quiet private-quality treatment is implemented in local iOS source:

- grading lives in the full note rather than the quick home card;
- the exact contextual retention/no-training disclosure appears beside grading and revision-backed content correction;
- `What your agent will read` renders the ordered 14-field canonical preview, including recursively inspectable nested values;
- readiness starts off, remains disabled until the complete preview is opened, binds the exact revision and preview only after an explicit action, and resets on preview or note-contract drift;
- grade requests carry UUID idempotency, the exact lowercase evaluated revision, and current notice/disclosure/policy versions without legacy `should_remember`;
- material edits use the server's current optimistic revision field when lineage is available and remain legacy-compatible when it is not;
- note-level contribution removal calls the idempotent owner-only withdrawal route and does not undo visible note corrections;
- optional explanation text is visibly and technically separate from note correction and is labeled excluded from private evaluation and automated changes; and
- the owner-scoped recording-detail envelope now exposes its current immutable revision so the client can construct the required binding.

The local Markdown and HTML policy sources now describe explicit grade/content-correction contribution, private quality evaluation, the ordinary 30-day audio rule and contribution exception, removal/note/account deletion, no training or fine-tuning, no automatic promotion or advertising, and the separate normal transcription/extraction processor boundary. The false first-recording permission-modal and Settings-withdrawal claims were removed. The release privacy manifest adds Analytics as an Audio Data purpose for evaluation-linked audio.

## Test-first evidence

The planned RED state was witnessed before implementation:

- Swift failed because `EvaluationContributionContract.swift` and its types did not exist.
- Node failed because `check-privacy-policy-parity.mjs` did not exist.
- After the checker was introduced, the local policy test failed specifically on the two stale UI claims and the missing private-evaluation semantics.
- A later tightened state test failed until fetched-but-unseen previews were prevented from enabling readiness.

## Fresh verification

The following checks passed against the final local source:

```text
swiftc -parse-as-library ios/Throughline/Services/EvaluationContributionContract.swift ios/Tests/EvaluationContributionCodingTests.swift ios/Tests/EvaluationContributionCopyTests.swift -o /private/tmp/throughline-eval-ios-tests
/private/tmp/throughline-eval-ios-tests

node --test scripts/check-privacy-policy-parity.test.mjs
npm run privacy:check

deno test --config supabase/functions/api/deno.json --allow-env supabase/functions/api/index_test.ts

xcodebuild -project ios/Throughline.xcodeproj -scheme Throughline -configuration Release -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/throughline-eval-derived CODE_SIGNING_ALLOWED=NO build
```

Observed results:

- Swift contribution/copy executable: pass.
- Privacy parity: 4 tests passed; command check passed.
- API behavior suite: 22 passed, 0 failed, including the new owner revision-envelope regression.
- Unsigned Release simulator build: `BUILD SUCCEEDED` for arm64 and x86_64.
- `PrivacyInfo.xcprivacy`: property-list lint passed.
- `package.json`: JSON parse passed.
- Scoped whitespace check: passed.
- Onboarding source remained untouched; SHA-256 was `fe4e868f5728cd872b6b512ad3ece2622eeeff7fd7791d50451f061e44230bb5` at verification.

The direct workspace build stalled before launching a compiler because the file-provider-backed checkout did not complete Xcode's source scan. The exact current `ios/` source and project, excluding generated `ios/build`, were copied to an isolated temporary directory and the same unsigned Release command passed there. This is compile evidence for the current source, not a signed archive or binary provenance claim.

## Evidence boundary

This work did not:

- enable any production evaluation behavior flag;
- deploy the API or private-artifact deletion function;
- create an evaluation contribution or retain any real audio;
- materialize a private corpus or run private audio through a provider;
- publish the updated privacy policy;
- change App Store Connect privacy answers;
- upload a binary, use TestFlight, or submit an App Store version; or
- establish a quality or user-outcome improvement.

The production state therefore remains the prior verified flags-off baseline: the lineage canary passed and rolled back, all behavior controls are absent/off, and real evaluation coverage is zero. The next runtime milestone remains the ordered owner-controlled retention/evaluation canary. Ordinary third-party-AI inference permission remains an unresolved App Store readiness risk and is recorded in `docs/app-store-readiness.md` without inventing new onboarding UI.

## Rollback

Before any eligible production contribution exists, revert the local iOS/privacy changes. After eligibility exists, an app rollback may hide new contribution entry but must keep withdrawal reachable through the retention-aware compatibility path; public-policy rollback and App Store privacy answers remain separately gated.
