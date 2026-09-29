# Capture tray implementation verification — 2026-09-29

**Scope:** TL-CAP-001, selected Candidate B revision 3; internal TestFlight candidate 1.0.5 (2026092901). Local branch `codex/capture-tray`, base `ee2e7914410fe3ad32635878ce698db5a6b71b18`. Backend candidate: `283be2c`, [exact hashes and verification](2026-09-29-capture-backend-candidate.md).

## Implemented

Durable phone capture identity and audio before recording; streamed payload and digest; receipt-validated cleanup; retry/replay/discard; owner-isolated notes, queue and callbacks; interrupted-recording retention; offline versus rejected sign-in; explicit same-token account-deletion retry and persisted hold; truthful tray/list reconciliation and bounded observation of processing. The existing AI-processing safeguard is unchanged. No running-list feature or evaluation activation.

## Engineering review

Codex's independent read-only reviewer found and writers resolved: pre-start orphan capture, transient storage pause recovery, authenticated account-survival check, stopping a held recording before confirmed deletion, owner-cache removal only on confirmed account deletion, interruption/new-start race, bounded persisted polling with list placeholders, explicit deletion retry, and legacy Storage writes racing deletion. The final bounded recheck found no remaining blocker in those fixes. Source review is not a physical-device or hosted Storage result.

## Actual Claude review

Claude reviewed the implementation in the existing Throughline design session on 2026-09-29. Initial P1: sign-in-only reuse incorrectly selected the already-signed-in branch. Initial P2s: tap targets, recorder error surfaces, truthful waiting counts, state glyphs, retry hierarchy, announcements, singular counts and held-account retry feedback. Codex corrected these; Claude's next source review confirmed those P1/P2 findings closed. Additional P3 corrections cover repeated note-ready announcements, one haptic per new failure state, spoken duration, recorder mark, sign-in chrome and duplicate refusal text. Final visual re-review remains pending until the settled normal/small-screen synthetic matrix is supplied.

Claude accepted these additional truthful error strings: “Couldn't sign out. Captures on this phone are kept. Try again in a moment.” and “Couldn't refresh your notes. Pull down to try again.”

## Checks completed

- Full isolated Debug iOS simulator build with Swift 6 passed after integration; latest view polish is being rebuilt before the archive.
- Six persistent-store groups passed: restart, receipt/event durability, failed terminal-intent persistence, owner/deletion hold, pre-start failure and recoverable state-write failure.
- Stream tests passed exact synthetic bytes/digest and permission denial/withdrawal before dispatch.
- Six executable coordinator groups passed: stale accepted response, rejected sign-in retention, persisted polling bound/placeholder, active held recording stopped before confirmed deletion, explicit same-token deletion retry, public unauthenticated health cannot clear a hold.
- Actual refresh coordinator source passed mocked offline retention, definite rejection and stale success/error isolation.
- The coordinator harness preserves production control flow but substitutes platform, storage directory and transport. It is not device evidence.
- 136 Node regression tests passed; existing seven permission test groups passed. Repository foundation verification and privacy-policy parity passed. Policy files are unchanged.
- Backend: 99 Deno tests, 246 pgTAP assertions, complete 11-migration isolated replay, and 12 concurrent SQL sessions passed; details and exclusions in the backend receipt.
- Frozen handoff SHA-256 remains `eb4456ecda2912a9be3ef59797eb5be7a70584689dfba780e1bc98f70729dd50`.

## Boundaries and pending delivery

Read-only Apple check on 2026-09-29: newest build remains 1.0.5 (2026082801), VALID and not expired; existing Internal QA group is internal. No upload or new build availability is claimed here. Production API remains v30 with ten migrations; exact backend deployment approval was requested separately under Mike's existing gate.

Pending: settled simulator visual matrix and Claude signoff; signed archive; authorized backend deployment and synthetic authenticated hosted canary; internal-only upload, Apple processing and Internal QA relationship verification. Actual iPhone call/lock/file-protection behavior, real playback routing, VoiceOver speech/focus and user acceptance remain device checks. Device checks are not implied by source or simulator success.

Measurement remains counts-only: milestone identities are stable and private, but there is no common analytics capture key for reconstructing the cross-session denominator. Confirmed account deletion removes its pending owner events, so missing coverage is explicit, not counted as zero. No recovery-rate improvement is claimed.

## Safety choices

The unbound legacy note cache is preserved and never attributed to an inferred owner. Confirmed account deletion removes only the known owner's bound cache. Automatic approval review rejected an automatic destructive retry after ambiguous deletion status; the implementation instead preserves the hold, checks status on foreground, and repeats DELETE only after the person explicitly chooses Try again. No rejected automatic-retry change was applied.

## Final local candidate follow-up

App source `c9d2d5c93de44880efbbdff2162535114d797874` fixes row wrapping at accessibility sizes and makes synthetic offline/microphone previews deterministic. All 15 final synthetic images were captured after content rendered; the small-screen action view verifies scrolling reaches Save again, Play and Discard. This supersedes the earlier blank startup captures, which are not evidence. Source preview paths are DEBUG-only except the inert preview guard.

The final isolated signed archive and internal-only export succeeded and signatures passed. Version/build is 1.0.5 (2026092901). Exact provenance and retained artifact hashes: [candidate manifest](../releases/2026-09-29-ios-1.0.5-2026092901-candidate.md). The queue/refresh harness rerun passed. Hosted-canary script `23ac943` passed 13 mocked tests; no hosted calls. Its incomplete/unknown-reservation outcome retains a private recovery journal and reports cleanup pending rather than broadening deletion. It does not prove physical Storage cleanup or processing-claim counts.

Final Claude visual re-review of the settled matrix is in progress. Backend approval, hosted verification, Apple upload/processing and group availability remain pending. Simulator tap automation failed at the native-control boundary, so actual sign-in-sheet interaction and VoiceOver behavior remain explicit device checks.
