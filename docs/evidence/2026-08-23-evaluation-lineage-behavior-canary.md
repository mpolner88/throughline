# TL-EVAL-001 production lineage-write behavior canary

**Verified:** 2026-08-23  
**Production scope:** one reversible lineage flag and one synthetic transcript  
**Final production state:** all evaluation behavior controls absent/off  
**Private audio or corpus materialization:** not run  
**User-visible change:** none

## Decision and boundary

This canary exercised only immutable processing-lineage writes against the deployed TL-EVAL foundation. Evaluation writes, evaluation retention, and compatibility mode stayed absent. The input was a uniquely marked synthetic transcript with no audio bytes or Storage object. The existing production extraction provider and frozen inference contract were exercised; no provider, base model, request contract, data-use policy, pricing, recording limit, onboarding, App Store, or UI setting changed.

The runner is [verify-evaluation-lineage-canary.mjs](../../scripts/verify-evaluation-lineage-canary.mjs). It is fixed to the production project, requires both `--execute-hosted` and a separate authorization environment gate, refuses any pre-existing evaluation behavior control or nonzero active eligibility, and always performs marker-based synthetic-record recovery plus lineage-flag rollback after a creation attempt. Its output rejects identifiers, URLs, credentials, and transcript or note content.

## Offline verification

- The focused lineage-canary suite passed 9 tests, including double authorization, fixed-project configuration, exact flag sequencing, nonzero-eligibility refusal, wrong-flag refusal, incomplete-lineage rejection, evaluation-row rejection, cascade-residue rejection, ambiguous-create recovery, rollback failure, and output privacy.
- The lineage and existing hosted deletion canary suites passed together.
- The configured Deno sweep passed 28 focused API and behavior-flag tests, including the API contract that commits immutable lineage before exposing a processed note.
- The script passed Node syntax validation.

## Production execution

The preflight found all four behavior controls absent, active evaluation eligibility at zero, and the authenticated API healthy. The runner then:

1. set only `THROUGHLINE_LINEAGE_WRITES_ENABLED=true`;
2. independently observed the exact lineage-only behavior-control state;
3. processed one uniquely marked synthetic transcript synchronously with no audio;
4. proved one succeeded operation, one succeeded extraction attempt, one resolved inference contract, one immutable original revision with exactly the 14 canonical keys, and correct recording pointers;
5. proved zero evaluations, contributions, or corpus cases;
6. deleted the synthetic recording and proved its recording, operation, attempt, revision, evaluation, contribution, quarantine, and corpus-case scope absent;
7. unset the lineage flag; and
8. independently observed all four behavior controls absent again and the authenticated API healthy.

The content-free runner result passed all nine checks: flags-off preflight, zero active eligibility, lineage-only enablement, synthetic transcript processing, complete immutable lineage, evaluation absence, recording-cascade cleanup, flags-off rollback, and privacy.

## Reconciled post-canary baseline

An independent aggregate-only postflight found:

- inference contracts: 1 reusable frozen contract row;
- processing operations, inference attempts, note revisions, evaluations, contributions, quarantined text rows, corpus cases, and corpus events: 0 each;
- active evaluation eligibility: 0;
- authenticated API health: pass; and
- evaluation behavior controls present: none.

Secret propagation advanced the active provider counters to API version 29 and private-artifact-delete version 3. Freshly downloaded production bundles matched the repository source inputs byte-for-byte with zero mismatches, so this was configuration propagation rather than a source change.

## What this proves

Production can atomically persist and cascade-delete complete immutable extraction lineage for a controlled transcript while evaluation and retention behavior remain off. It does not establish real-user lineage coverage, owner evaluation coverage, independent prediction coverage, extraction quality, transcription quality, or user-outcome improvement.

The next governed boundary is an owner-controlled evaluation/retention canary: retention must be enabled before evaluation writes, and the recording user must personally choose the grade, correction, and readiness signal. Real private-audio corpus materialization and independent provider execution remain separately gated.
