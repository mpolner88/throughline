# Capture-tray revision 3 readiness receipt

**Verified:** 2026-09-29. **Reviewer/integrator:** Codex, with a read-only Codex contract scout. **Design author:** Claude Code in the existing Throughline design session. **Verdict:** `handoff_ready` after Claude's corrections and Codex's exact-file re-review. This is source/design readiness, not implemented behavior or a release pass.

Mike directed “Finish the capture tray handoff.” Candidate B, “The recorder holds it,” and D1/D2 stay selected. The [decision log](../../decision-log.md) records scope. Claude authored the handoff and reference assets; Codex reviewed them, returned findings to that same Claude session, and integrated only the resolved design plus canonical records. No substitute Codex review is presented as a Claude review.

## Exact identity

- Source base: `3faf0f2f430b4e075c7c2367809c6d6d4837064b`, branch `codex/reconcile-september-base`, active nonsynced checkout `throughline-local`.
- Committed design revision: `4c7cea1060f55438a0fd0c8deee97019376d1d9b`.
- [Ready handoff](../handoffs/2026-09-28-home-capture-recovery.md), revision 3 SHA-256: `eb4456ecda2912a9be3ef59797eb5be7a70584689dfba780e1bc98f70729dd50`.
- [Mock](../handoffs/assets/2026-09-28-home-capture-recovery/selected-mock.html) SHA-256: `0daec4ec39481a3f59236a2f5b31b3dc128f48664e36c7ec6af55478de3cf2bd`.
- [Asset manifest](../handoffs/assets/2026-09-28-home-capture-recovery/SHA256SUMS.txt) SHA-256: `88779b84e93b4909e0e35f92e1630dd98bcac3eaf2730d4c0ba30627612a38a1`; 41 entries, covering the HTML and 40 PNGs exactly.
- Initial revision-3 draft reviewed: `9b35dd2df3a02429406cd3280c251b91f5859605d832448035967a9b2a75a43e`.
- Corrected substantive draft reviewed: `69b94cad3a074ea851dbd7a4f11d03954d31149a42344c994fe382a5019328a5`. The final ready file was compared against that draft; only stage/review/next-owner metadata changed.

The [revision-2 review](2026-09-28-codex-capture-rereview.md) and [Claude base review](2026-09-28-claude-reconciliation-capture-review.md) remain preserved. This receipt supersedes their capture-readiness hold only. It does not reopen or claim to resolve the deferred evaluation findings or change PR #1/#2 dispositions.

## C1–C6 dispositions

| Finding | Severity | Resolution and disposition |
| --- | --- | --- |
| C1: incomplete acceptance and deleted-note replay | P1 | Resolved. Separate incomplete, accepted, owner-deleted and conflict outcomes; immutable completed receipt; resumable incomplete work; minimal owner/capture/deletion-time tombstone until account deletion; authenticated owner-deleted cleanup. |
| C2: discard ordering | P1 | Resolved. Persist terminal intent and invalidate work before unlinking. Intent-write failure reports failure and preserves audio; cleanup failure keeps a nonuploadable record. In-flight server work may complete and is not falsely erased. |
| C3: ambiguous account deletion | P1 | Resolved. Persist the owner hold before dispatch; restore it before scheduling after a crash; retain audio and send nothing until a definitive result. Server acceptance/finalization is serialized with deletion. |
| C4: file naming | P2 | Resolved. An independent opaque local token names the audio file; the private record maps it to the capture. Capture/account/session/recording IDs and digests are excluded from filenames. |
| C5: temporarily inaccessible audio | P2 | Resolved. Checking/temporarily unreadable retains audio; validated unusable audio alone exposes Dismiss. Explicit confirmed account/discard actions remain available under terminal-intent rules. |
| C6: order and delivery guarantees | P2 | Resolved. Oldest-first concerns scheduling, not completion. At-most-once processing does not promise eventual completion. Milestones are durably enqueued with the corresponding state change and stable private event identity; ingestion and later outcomes deduplicate. |

## Follow-up review and corrections

Codex found the following contradictions in the initial revision-3 draft and returned them to Claude. Claude corrected them; Codex rechecked the exact corrected hash above. No material handoff finding remains open.

| Finding | Severity | Verified correction |
| --- | --- | --- |
| F1: a locally refused retry erased earlier uncertain history | P1 | Local/request-specific refusal preserves earlier unknown-send history and truthful discard copy. Check 28 covers both histories. Only an authoritative capture-wide answer can resolve uncertainty. |
| F2: accepted audio cleanup used terminal deletion semantics | P1 | Receipt cleanup is separate, retaining the saved/structuring presentation, slim receipt/event record and processing observation while upload retries stop. |
| F3: crash after deletion dispatch could precede persisted hold | P1 | Hold is stored before dispatch. Failure to persist prevents dispatch; relaunch restores it before scheduling. Check 15 covers that crash window. |
| F4: token filenames were forbidden by another paragraph | P2 | Filename rules now explicitly permit the independent local token while excluding it from analytics/logs/tracked evidence. |
| F5: cross-owner test contradicted the owner namespace | P2 | Check 21 verifies isolation and nondisclosure; reuse of a random ID by a different owner alone need not be refused. |
| F6: temporary unreadability conflicted with explicit sign-out deletion | P2 | Unreadability alone does not authorize destruction; explicit confirmed actions still follow terminal intent. Checks 16/17 include the temporary-checking outcome. |

Evidence wording was corrected too: all 37 original PNGs match committed revision 2; Claude reported re-rendering eight control images, not all 37. The manifest changes include the HTML hash plus three added image entries.

## Verification and limits

- Codex independently verified all 41 manifest entries, exact asset coverage and byte identity of all 37 original PNGs against the starting commit.
- Codex inspected the three added synthetic reference images: audio checking in light appearance, and deletion pending in light/dark. The existing small-phone failure and accessibility sign-in references were also inspected. These are browser mock references, not screenshots of an implemented app.
- Repository foundation verification passed; local Markdown targets/anchors passed; whitespace checks passed. Added text was screened for personal paths, email addresses, credentials and raw identifiers; the added images contain synthetic reference content. No private audio or user content was added.
- Production-source inspection covered current upload overwrite/merge-upsert, processing finalization, deletion ordering, event batching and recorder lifecycle. Those observations support feasibility and the dependencies below; they do not prove the proposed behavior exists.
- No app/API implementation, migration replay, pgTAP, Node/Deno behavior suite, iOS build, simulator capture or physical-device test was performed for this documentation-only completion. Handoff checks 1–28 are future implementation acceptance tests, not passing test results.
- PR #3 was verified open/draft at the starting source. Publication is confined to its existing branch. This receipt does not claim a main merge, deployment, release, or production outcome.

## Implementation handoff

The approved design remains the tray. It adds durable recovery and truthful saved states without changing the selected Home hierarchy. R7 must be addressed before capture events ship (permanent event-batch rejection cannot block the queue). R10 requires a safe isolated migration replay with its Vault prerequisites and the relevant pgTAP assertions before capture migration verification; those assertions are not currently CI-gated. R11 requires guarded processing finalization so deleted rows cannot be re-created.

The bounded implementation plan must also finalize the private per-capture recovery metric and its denominators before reporting a recovery rate. It must test the state/API contract, physical interruption/storage cases, account isolation and rollback using a compatible new build that preserves and drains pending captures. These are implementation obligations, not unresolved design choices.

**One next action:** Mike approves build entry for the bounded capture-recovery slice against this committed handoff. Codex then plans, implements and verifies; Claude reviews the implemented design before delivery. Running list follows capture recovery. Private Evaluation remains deferred.
