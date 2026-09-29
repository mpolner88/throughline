# Approved R8/R9 follow-up

Verified 2026-09-28. Starting source: `b34adfb46d4af8b2089250daac80efc009d14059`, branch `codex/reconcile-september-base`, active checkout `throughline-local`. Mike approved both recommendations in the [decision packet](2026-09-28-main-merge-decisions.md), then asked to leave privacy-policy work aside. Main merge remains unapproved.

## Exact implementation

- **R8:** `bac44c17b78f2d0ed75e060accdcd108fe49043d`. Eight files: `ios/Throughline/Services/AIProcessingPermission.swift`, `ios/Throughline/Services/UploadClient.swift`, `ios/Throughline/Views/HomeView.swift`, `ios/Throughline/Views/OnboardingView.swift`, `ios/Throughline/Views/SharedComponents.swift`, `ios/Throughline.xcodeproj/project.pbxproj`, `ios/Tests/AIProcessingPermissionTests.swift`, `scripts/test-ai-processing-permission.sh`.
- **R9:** `52d1f0bc72825349386d62ba3f91e29457c5292c`. Three files: `docs/_config.yml`, `scripts/verify-pages-output.mjs`, `scripts/verify-pages-output.test.mjs`.
- The following documentation commit records the approval, this receipt, current-state/backlog/tandem/readiness corrections and the three local package commands. It does not change executable behavior or public policy bytes.

R8 restores installation-wide, default-denied permission using main's original preference key. Demo audio, signed-in audio and demo transcript promotion all check permission after request preparation/authentication and immediately before initiating transport. The permission check, initiation and withdrawal use one lock. Cancellation remains supported. Reading and deleting notes remain available. Granting only dismisses the sheet; recording or saving requires a separate tap. Microphone-await continuations recheck permission, foreground state, view visibility and account identity. Withdrawal blocks future dispatch, not processing already sent.

Permission refusal during demo promotion preserves the demo on onboarding with explicit save retry or continue without saving; it neither emits a processing-failure event nor adds an unsaved demo to Home. Other pre-existing promotion failures still use the old fallback and remain a capture-slice concern. Refused live recordings have no recovery tray in this slice; the message explicitly says they were not sent and cannot be retried from that screen.

R9 excludes internal Markdown and the existing internal directories. Complete generated output is checked against exactly four HTML routes (home, privacy, support, voice-to-task-list) and four discovery images, with byte equality to the source. The verifier rejects unexpected files, missing routes, changed bytes and symbolic links. It checks the full generated directory, not a filtered copy.

## Independent review

Codex's independent engineering review identified a P2 demo-refusal retry gap. The added signed-in retry/continue controls resolved it; the subsequent source review found no remaining blocker in the bounded permission implementation. This is not release approval.

Actual Claude Code review in the Throughline design session verified all six supplied candidate source hashes against base `b34adfb`. It found no permission-bypass blocker and verified all three inference paths. Its P2 presentation findings were pinned action reachability/tap targets, context-specific copy, and an explicit path forward after declining the onboarding demo.

- P2 targets and context copy: addressed in source. Actions are pinned with expanding labels and minimum 52-point targets; recording/demo-save/Settings get appropriate instructions. The current three view hashes are Home `85ef407db7b3161aa5d62001e1b27f5a7d8a4b6a23affecde34bd5e48ace550a`, Onboarding `1cfca4f810c85bb617deea6841c702f6ca2dbd16d41f002273fbc0082505b834`, SharedComponents `469e44395cf38171a5997d612289c3cf1a63ba11f83328eba35693b4b4a5b602`. Independent Codex re-review found no new source blocker at these hashes.
- P2 visible onboarding exit: **pending Mike**. Proposed quiet “sign in without the demo” action goes to the existing sign-in screen. Automatic approval review rejected adding it as a separately gated onboarding change. It is not implemented. Existing page swiping still permits exit; that is not considered final release-quality refusal navigation.
- Minor findings addressed: conditional Settings explanation, action casing, neutral demo-refusal notice, truthful no-retry wording and accessibility header traits. Generic microphone permission wording stays unchanged because explicit AI disclosure precedes it. Existing generic demo-save fallback is deferred to capture recovery.
- Claude's visual review and review of the final presentation corrections remain pending: the Mac locked before the follow-up could be sent. No final Claude visual approval is claimed.

The independent R9 review verified all public local references and current output. It found that exclusions alone do not protect arbitrary future non-Markdown folders. Adversarial Jekyll include/exclude experiments also leaked basename collisions, so an include list is not presented as a durable source allowlist. A read-only PR/main CI checker is prepared outside Git, but **pending Mike**: automatic approval review rejected its activation under the earlier automation restriction. No workflow/settings/branch-protection change was made. Until explicitly approved, the complete-output check is a mandatory manual review step before any main merge affecting site source. It is not a technical block on direct pushes or GitHub's legacy publication.

## Verification and limits

| Check | Result and scope |
| --- | --- |
| Synthetic permission contracts | Seven groups passed against actual Foundation application sources with mocked transport/authentication: all three default-denied paths send zero requests; grant persists; all allowed paths decode; withdrawal during authentication blocks both authenticated paths; read/delete work; withdrawal preserves a completed result and stops the next request; cancellation during authentication sends no request. No provider/backend was contacted. Reproduce with `npm run ios:permission:test`. |
| Node regressions | 165/165 passed, including nine Pages verifier tests and their unexpected root/new-directory/nested-asset/basename-collision cases. |
| Actual local site | Jekyll 3.10.0 with optional-front-matter 0.3.2, safe mode, complete docs source: exactly eight files, all byte-identical, public references intact. Local Ruby 4.0.6 differs from hosted 3.3.4; the full hosted plugin suite/deployment was not exercised. Reproduce verification with `npm run pages:verify -- <complete-generated-directory>`. |
| iOS builds | Isolated unsigned Debug and Release generic Simulator builds passed on Xcode 26.3, arm64 and x86_64, with neutral configuration and no ignored private files. Only an AppIntents metadata warning was reported. No signing, physical-device install, TestFlight or App Store action. |
| On-screen subset | On the earlier permission presentation in an isolated simulator bundle: first demo tap opens permission; Not now returns to idle; next tap asks again; Allow returns idle without recording. No microphone access or audio submission occurred. Final layout, Settings, dark mode, largest text, signed-in promotion journey and physical-device checks remain unverified after the Mac locked. |
| Preservation | All six frozen file hashes and all 38 Claude asset manifest entries pass. Both approved policy files and all Claude revision-2 handoff/assets/review bytes are unchanged. Added-text credential/personal-path pattern screen and manual synthetic-fixture inspection passed. |
| Repository checks | Documentation foundation: 19 backlog items/47 checked Markdown files. Privacy parity and whitespace checks pass. |
| Existing CI | Measurement gate passed at the starting head [b34adfb](https://github.com/mpolner88/throughline/actions/runs/36521126980). A new run, if triggered, must be attributed to its own head. No evaluation migration replay or new hosted check is claimed. |

Deno/API tests, database replay, production canaries, real-provider audio checks, device/Apple checks and live Pages verification were not rerun: no API/migration/provider/deployment change is part of this follow-up. Earlier test evidence remains attributed to its recorded source.

## Carry-forward and authority

Claude acknowledged and accepted C1–C6 from the [capture re-review](2026-09-28-codex-capture-rereview.md) without editing revision 2. It refined R3: the withdrawal API rejects `audio.storage = expired` as well as missing metadata when a latest contribution needs withdrawal. Codex confirmed that source condition and the two retention-finalization writes; whether a new contribution can be created after expiry is not established here. Cover expired metadata explicitly in the deferred evaluation fix. R1–R17 dispositions otherwise remain in the original receipt.

This branch is a reviewed engineering candidate with explicit remaining gates. Only its existing draft PR #3 is authorized for publication. No main merge, capture/running-list implementation, migration, deployment, behavior flag, secret, automation, provider/model/data-use/pricing/limit change or Apple action is performed. Capture recovery remains first, running list second, Private Evaluation deferred. Claude still owns the next capture handoff revision and its readiness decision after C1–C6 are resolved.
