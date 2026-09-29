# TL-EVAL-001 internal TestFlight canary delivery

**Verified:** 2026-08-24 07:30 Pacific
**Scope:** internal-only TestFlight delivery; no App Store submission or public release

## Outcome

Throughline version `1.0.5`, build `2026082401`, bundle `app.throughline.ios`, was archived from the isolated owner-evaluation UI source and uploaded successfully through Xcode. The export contract set `testFlightInternalTestingOnly` to `true`. Apple's delivery receipt ended with `Uploaded package is processing` and `Upload succeeded`.

The first validation attempt used version `1.0.4`, build `2026082301`. Apple rejected it before accepting a build because the `1.0.4` prerelease train was closed after the previously approved `1.0.4` version. The identical source was rebuilt as the next prerelease train with a new build number.

## Pre-upload verification

- Owner-canary package suite: 6 passed, 0 failed.
- Markdown/HTML privacy parity: passed.
- Focused Swift evaluation coding and copy contract: passed.
- Signed archive validation: passed.
- Built version/build: `1.0.5` / `2026082401`.
- Production Supabase URL and public client key: present.
- Privileged Throughline API service token: absent.
- Release privacy manifest: present.
- Evaluation contract and Home UI sources: present in the compiler source list.

## Remaining boundary

The retained Apple receipt proves delivery and the start of processing. It does not yet prove that processing finished, that the build is visible to an internal tester group, or that the recording owner installed and exercised it. No evaluation behavior flag changed, no owner judgment was submitted, no private corpus was materialized, no provider/model changed, no privacy policy was published, and no App Store submission or public release occurred.
