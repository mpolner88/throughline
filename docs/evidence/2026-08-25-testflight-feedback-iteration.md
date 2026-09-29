# TestFlight feedback iteration and internal delivery

**Verified:** 2026-08-25 14:23 Pacific  
**Scope:** private TestFlight feedback intake, bounded UI correction, and internal-only TestFlight delivery

## Outcome

The newest private TestFlight screenshot feedback was deduplicated into the ignored `.throughline/feedback-intake/` inbox and converted into a private specification without committing tester text, screenshots, Apple feedback identifiers, or local evidence paths. The resulting iOS iteration replaces the large recording-use warning with one blue **How we treat recordings** link and preserves the 1–5 note rating when an immutable revision is not available. Exact-revision private evaluation remains fail-closed when a valid immutable revision is available.

Throughline version `1.0.5`, build `2026082501`, bundle `app.throughline.ios`, was archived from an exact isolated copy of the current iOS working tree and uploaded with `testFlightInternalTestingOnly=true`. Apple marked the build `VALID`. A fresh App Store Connect API read confirmed that the build is visible in the internal `Internal QA` group, which contains one tester.

## Verification

- Private feedback intake, privacy-policy parity, and owner-package suites: 18 passed, 0 failed.
- Focused Swift evaluation coding, copy, and rating-mode contract: passed.
- Markdown/HTML privacy parity executable check: passed.
- Release iPhoneOS archive: succeeded with Xcode 26.3 (`17C529`).
- Xcode store validation, App Store Connect package analysis, internal-only upload, and Apple processing: passed.
- Built version/build: `1.0.5` / `2026082501`.
- Production Supabase URL and public client key: present.
- Privileged Throughline service token: absent.
- Release privacy manifest: present.
- `HomeView.swift` and `EvaluationContributionContract.swift`: present in the Release compiler source list.
- App Store Connect live state: `VALID`, not expired, assigned to `Internal QA`, and visible from that group's build relationship.

## Source and artifact binding

- Source commit at archive time: `8066ea03bee6304a4268f8c2f6a4570f0521af06`.
- The checkout was intentionally dirty; the isolated release copy was byte-compared with the current `ios/Throughline` source before and after archiving.
- Release executable SHA-256: `9d4ed092b0f22002ee84db556b56f4d6e858d033e4f668bea64f4173cb6bcbf3`.
- Feedback UI source SHA-256: `fd2e6901494fea07b6cfe1e641d9aecfd3e24756dcc0354df51561457bb48747`.
- Evaluation contract source SHA-256: `143d1425b30ae920d269529de0484b3f927550485d247fcea80d43ce2e14db25`.
- The archive and Apple receipt are retained temporarily under `/private/tmp/throughline-feedback-testflight-2026082501.2T9W19/`; that path is ephemeral and is not a durable repository artifact.

The generic local `codesign --verify` trust check could not independently validate either this archive or the previously Apple-accepted archive because the command-line keychain reported zero trusted identities. Xcode's archive validation, distribution preparation, App Store Connect package analysis, successful upload, and Apple's later `VALID` state are the retained evidence for this delivery; this record does not claim independent local certificate-chain verification.

## Authority and remaining boundary

Mike authorized feedback iterations to advance automatically to internal TestFlight after verification. That standing authorization covers new internal-only builds and assignment to the existing internal QA group. It does not authorize App Store submission, public release, privacy-policy publication, App Store privacy-answer changes, provider/model changes, or production behavior-flag changes.

No public App Store version changed. No production evaluation behavior control was enabled, no private corpus was materialized, and no owner judgment was automated.
