# Throughline Core Quality and Learning System

**Status:** Draft for final review; architecture approved
**Date:** August 16, 2026
**Owner:** Throughline
**Initial scope:** English-primary iOS voice notes, with mixed-language guardrails

## Executive summary

Throughline's core product is the full path from a spoken thought to a trustworthy, agent-ready note:

1. The user records a voice note.
2. Throughline transcribes it accurately.
3. Throughline extracts only the tasks and important context the user actually expressed.
4. The user can correct and evaluate the result with little effort.
5. Consented, reviewed corrections improve later model, prompt, and product releases.
6. Accepted personal corrections can also produce bounded, private preferences for that user.

More feedback must not directly modify a production prompt or model. The learning loop is an offline, human-reviewed promotion system with a frozen holdout, versioned inference contracts, staged rollout, and rollback. Personalization is account-private and typed; it does not replay raw recordings or feedback into unrelated requests.

Quality comes before monetization. The 60-second authenticated free limit remains disabled until premium entitlements and earned extensions are reliable end to end.

## Target user

The primary user is an individual capturing personal plans, reflections, commitments, and ideas on an iPhone. They expect to speak naturally and receive a concise, accurate note whose tasks are safe for an AI agent to act on.

Throughline is not being designed as a meeting recorder, team transcription product, or general audio archive.

## Product principles

### Trust is the unit of value

A processed recording is successful only when:

- the recording is not lost;
- the transcript preserves the user's meaning;
- every task is supported by the recording;
- explicit tasks are not missed;
- important context remains useful;
- the user can understand and correct the result; and
- the output remains traceable to the exact models and instructions that produced it.

### More data does not automatically mean better output

User feedback becomes useful only after consent, validation, review, classification, and separation into development and holdout data. Free-form feedback is never appended directly to a system prompt.

### Global learning and personal learning are different

- Global learning chooses better providers, models, prompts, schemas, and normalizers for all users using a reviewed corpus.
- Personal learning derives editable preferences such as names, projects, vocabulary, task phrasing, and organization from that user's accepted corrections.
- Raw data never crosses account boundaries.

### Limits must not create data loss

The app must warn before a limit, stop cleanly, and preserve the recording it has already captured. Subscription or credit failures cannot discard a voice note.

## Approved product decisions

- The current production baseline remains the control until a candidate passes the quality gate.
- The first transcription challenger is Groq whisper-large-v3 against the current whisper-large-v3-turbo baseline.
- Extraction initially keeps Groq openai/gpt-oss-120b as the control while adding a strict structured-output contract and measuring other candidates through the same harness.
- Model selection remains provider-neutral. Groq stays only if it wins the measured quality, reliability, latency, and cost tradeoff.
- The initial corpus is English-primary and explicitly covers accents, background noise, proper names, projects, dates, numbers, negation, corrections, and some mixed-language speech.
- Only explicitly opted-in audio and corrections may enter an improvement corpus.
- Improvement consent is separate from the permission required to process a recording.
- Global improvement is reviewed and batch-promoted. There is no blind online self-training.
- Authenticated free recordings will ultimately have a 60-second base allowance.
- Premium users receive a longer configuration-driven allowance.
- Valid evaluations can earn non-transferable product credits that extend recording time.
- Credits reward completion of a unique, valid evaluation or correction, not the sentiment or score the user gives.
- The 60-second policy is enforced only after purchase restoration and earned-extension recovery pass end-to-end tests.

### Decision-log impact

Once this design receives final review, it supersedes the April 30, 2026 tier decision for authenticated accounts in full:

- authenticated free changes from a five-minute per-recording cap and ten-minute daily allowance to a 60-second base allowance per recording;
- no authenticated daily allowance is locked by this design;
- transcription quality is selected through the evaluation system rather than assigning Apple Speech to free and Groq to paid;
- the former $9.99 monthly price and 30-minute paid cap are no longer locked; and
- premium pricing, premium duration, and credit exchange rates remain open until the quality and cost baselines are decision-grade.

The unauthenticated demo remains 30 seconds per recording and three attempts per installation per rolling 24 hours. Changing that policy requires a separate decision.

## Release-safety prerequisite

At approval time:

- App Store Connect showed iOS version 1.0.4, build 2026081602, Waiting for Review.
- Public version 1.0.3 remained available.
- Git main still represented version 1.0.1, build 2026080601.
- The submitted iOS state and live Supabase API function were ahead of Git.
- The live API function matched the current local function, but the current voice canary predated that deployment.
- The public privacy policy promised a first-recording AI-processing permission and a Settings withdrawal control that were not found in the iOS implementation.

Before feature implementation, Throughline must:

1. identify and preserve the exact submitted iOS source state as far as the available evidence permits;
2. preserve the successful build/upload receipt;
3. capture the deployed API version and content-safe configuration;
4. document any files that cannot be proven to belong to the submitted build;
5. reconcile the public consent claim with actual app behavior; and
6. avoid non-critical production behavior changes while 1.0.4 is under review.

This checkpoint must not overwrite, discard, or sweep unrelated working-tree changes into a release commit.

## System architecture

### Runtime path

1. The client requests an allowance and creates a recording reservation.
2. The client records locally and retains the file until the server confirms durable receipt.
3. The server validates authorization, reservation, media type, byte size, and actual duration.
4. An immutable transcription run produces a transcript candidate.
5. An immutable extraction run produces a structured note candidate from the transcript.
6. Server-side validation and normalization produce a note revision.
7. The client displays the result and can retry recoverable failures.
8. User edits create later revisions; they never replace the original model output.

### Authorization and request identity

- A non-demo recording requires a valid Supabase user session.
- Every recording reservation belongs to one account and can be consumed only through an idempotent upload operation for that account.
- A reservation expires after its authorized duration plus a configuration-driven upload grace period. Expiry releases reserved credits exactly once.
- Refreshing an expired access token does not change reservation ownership. If the session cannot be refreshed, the local outbox retains the recording until the user signs in again.
- Revoked or deleted accounts cannot create or consume reservations. Their local file is not uploaded and remains subject to the client's explicit discard or export experience.
- Concurrent devices reserve credits through one serializable ledger transaction, so each available unit can back at most one active recording.
- The server derives entitlement and allowance from canonical server records. Client claims cannot grant premium time or credits.
- An unauthenticated demo uses the existing privacy-safe installation rate-limit identity and is limited to 30 seconds and three attempts per rolling 24 hours. It cannot spend credits or claim premium entitlement.
- MCP tokens do not grant access to raw audio, inference internals, evaluations, reviewer records, entitlements, or credit-ledger history.
- Service-only review and reconciliation operations require separate least-privilege authorization and create audit records.

### Learning path

1. A user evaluates the transcript, the structured extraction, or agent readiness.
2. A correction links the before state, after state, originating run, rubric version, and consent snapshot.
3. A unique submission becomes an evaluation candidate.
4. A service-only review marks it accepted, rejected, duplicate, unsafe, or needing clarification.
5. Accepted examples enter the development or regression corpus. A holdout is selected once in a versioned manifest before candidate tuning and is then sealed.
6. Candidate model or prompt versions run offline against the corpus.
7. Passing candidates progress to shadow, internal canary, limited canary, and general availability.
8. Every promotion is a human decision with a recorded report and rollback target.

### Personal adaptation path

1. Repeated user-confirmed corrections can propose a typed preference.
2. A separate account-private personalization control, independent of global improvement consent, authorizes derivation and use.
3. The user can view, edit, accept, disable, or remove that preference.
4. The inference request receives only the bounded preference fields required for that recording.
5. Personalized output is evaluated against the global baseline and can be disabled independently.

Declining global improvement still permits private personalization when the user enables it. Disabling personalization stops all preference use and removes derived preference records; it does not erase the user's underlying note edits. Deleting a source note or correction removes that source and triggers recomputation or removal of preferences that depended on it.

## Platform constraints

- The client remains a native SwiftUI iOS app using Apple audio frameworks. Recording must tolerate app interruption and relaunch through a durable local outbox; background recording is not assumed by this design.
- Supabase Auth remains the account authority. Supabase Postgres and Storage remain the canonical first-party data stores, and Supabase Edge Functions remain the protected API boundary.
- Node-based evaluation tools and the Deno-based production function must consume the same contract artifact through build-compatible data or generated modules. Shared behavior cannot depend on manually copying prompt or normalization text.
- The current short-note path may remain synchronous during the first milestone, but premium-length audio cannot depend on holding a long client request open. The target path uploads durably to storage, enqueues idempotent processing, and lets the client resume status observation after relaunch.
- StoreKit 2 supplies the iOS purchase experience. Server-side App Store transaction verification and notifications, not local receipt state alone, determine durable premium entitlement.
- Longer recording limits must account for provider payload, duration, and request-timeout constraints before the premium maximum is chosen.

## Quality measurement

### Scorecard 1: transcription

Measure:

- word and character error rates;
- names and project terms;
- dates, times, numbers, and units;
- negation and modality;
- punctuation only when it affects meaning;
- mixed-language preservation;
- blank or truncated output;
- latency, retries, and cost.

Ordinary word-error rate is not sufficient because a single wrong name, date, or negation can corrupt an otherwise readable transcript.

### Scorecard 2: extraction from verified text

Measure:

- explicit-task precision and recall;
- invented actions;
- missed explicit actions;
- assignee, due date, priority, and context fidelity;
- concise actionable wording;
- title, summary, important-item, people, project, and tag quality;
- schema and normalization failures;
- agent-ready judgment.

A critical failure includes an invented commitment, incorrect assignee, meaning-changing negation error, or materially wrong date that an agent could act on.

### Scorecard 3: complete audio to tasks

Measure:

- all transcription and extraction metrics together;
- correction-free result rate;
- accepted-unchanged rate;
- user correction burden;
- user-rated agent readiness;
- successful-recording latency and cost.

### Initial corpus

The first baseline foundation contains:

- the existing text fixtures, labeled as extraction-only;
- at least 30 explicitly consented audio cases to validate the harness and expose initial error slices;
- verified transcripts and expected structured outputs;
- critical-error labels;
- slices for quiet speech, environmental noise, accents, names, projects, dates, numbers, negation, lists, reflections without tasks, and mixed-language speech.

Before a production promotion decision, the sealed holdout contains at least 20 recordings, at least 40 explicit actions, at least five no-action recordings, and at least five examples in each critical slice: names, project terms, dates/times, numbers/units, negation/modality, environmental noise, accents, and mixed-language speech. Examples may satisfy more than one slice.

Each holdout has an immutable manifest and scorer-profile version. It is never used for prompt development, error-specific tuning, or candidate selection outside its declared evaluation. Newly discovered production failures enter the development and permanent regression sets, never the holdout used to select the current candidate. A future holdout version is drawn from examples that were not used to tune its candidates and is sealed before that evaluation cycle begins.

The initial 30-case sample is a harness and product-development baseline, not a universal accuracy claim or an automatic production-promotion dataset. It expands when an uncovered production error appears.

### Promotion gate

The initial action-quality-v1 profile is:

- 50 percent task-set F1;
- 20 percent task support and meaning fidelity;
- 15 percent applicable assignee and date/time fidelity;
- 10 percent applicable priority and context fidelity; and
- 5 percent concise actionability.

Each component uses labeled reference data and a documented deterministic or blinded-human rubric. Non-applicable fields are reported as not applicable rather than automatically correct; the scorer profile defines aggregation and minimum applicable-example counts before results are generated. Changing weights, matching, judging, or aggregation creates a new scorer version and invalidates direct comparison with the old score.

A candidate may advance only when:

- it has zero critical failures under the versioned rubric on the frozen holdout;
- explicit-task precision is at least 95 percent and recall is at least 90 percent;
- its versioned action-quality scorer is at least 90 percent and publishes its component weights;
- final user-visible schema validity is 100 percent on the holdout;
- no primary or critical-slice metric drops more than two absolute percentage points versus the control;
- p50 and p95 latency remain inside configured product budgets;
- cost per successful recording remains inside the configured economic budget; and
- a human records the promotion decision.

Metrics and paired deltas include 95 percent bootstrap confidence intervals. Before the holdout is opened, the candidate declares one primary metric. A score metric's candidate-minus-control delta must be at least two absolute points with a confidence-interval lower bound of zero or better. An error-rate metric's candidate-minus-control delta must represent at least a five percent relative reduction with a confidence-interval upper bound of zero or better. If the sample minimum is not met, a guardrail exceeds its tolerance, or the primary improvement threshold is not met, the result is gather more data or retain control. Ties remain on the current control.

No winner is a valid result. A model is never promoted merely because it is newer.

## Versioned inference contract

Production and evaluation consume one canonical contract containing:

- prompt identity, version, and content hash;
- JSON schema identity and version;
- normalization identity and version;
- provider and model identifier;
- decoding configuration;
- retry policy;
- language or vocabulary configuration;
- price-table version; and
- release status.

Changing any contract component creates a new version and requires a new evaluation result. Historical runs remain auditable and reconstructable from retained artifacts. They may be rerun only while the input is retained and the provider/model remains available; byte-identical output from a nondeterministic or retired provider is not promised.

Strict JSON Schema output is preferred when the selected provider supports it. Contract failures and semantic failures are measured separately.

## Data ownership

### Inference runs

Each transcription or extraction attempt owns:

- immutable run identifier;
- recording identifier and stage;
- provider, model, and model configuration;
- prompt, schema, and normalizer versions;
- input and output references;
- parent and retry identifiers;
- status and structured failure reason;
- start, finish, and latency;
- input/output usage and audio duration;
- estimated cost and price-table version;
- experiment and rollout cohort; and
- timestamps.

Retries are new attempts linked to the original run. They never overwrite history.

### Note revisions

Each revision owns:

- recording identifier;
- originating inference run when applicable;
- prior revision identifier;
- editor type: model or user;
- complete validated note state;
- correction reason or issue taxonomy when supplied; and
- timestamp.

The current visible note points to the latest accepted revision. Original transcript and structured output remain recoverable.

### Evaluations and reviews

Each evaluation owns:

- user, recording, and originating run references;
- rubric version and evaluated stage;
- quality values and issue taxonomy;
- optional corrected revision;
- improvement-consent snapshot;
- idempotency key; and
- timestamp.

One user cannot receive multiple rewards for the same run and rubric. A separate review record owns reviewer identity, verdict, reason, and corpus assignment.

### Personal preferences

Preferences are structured by type, source corrections, confidence, status, and version. They are user-visible, user-editable, resettable, and protected by account-scoped authorization.

### Entitlements and credits

Subscription state is reconstructed from immutable provider events. Credit balance is derived from an append-only ledger rather than stored as an independently mutable number.

Ledger event types include grant, reserve, spend, expire, reverse, and refund. Every event has an idempotency key and source.

## Feedback experience

The result screen separates:

- transcript accuracy;
- missing task;
- invented task;
- incorrect wording;
- incorrect date or time;
- incorrect priority or context;
- other structured-note problem; and
- overall agent readiness.

A user can give a quick evaluation without editing, or correct the note directly. Editing automatically produces a before-and-after candidate when improvement consent is active.

The app clearly shows whether an evaluation earned credit and why. Ratings are never framed as paying for praise.

Credit eligibility is determined by objective submission validity: the evaluation belongs to a real completed run, satisfies the rubric, is unique for that run and rubric version, and remains within configured earning limits. It does not depend on a high or low score, a reviewer's quality opinion, or agreeing to global improvement use. Without improvement consent, the evaluation can still earn credit but remains account-private and is never exported to the global corpus.

## User-experience states

### First use and consent

Onboarding shows the voice-to-note value before asking for broad commitments. When the user first chooses to record, a concise just-in-time screen identifies the processors, the data sent, and the purpose, then offers allow processing or not now. No audio capture or upload begins before permission.

Improvement consent is requested separately, at the moment the user first evaluates or corrects a result. Declining it does not block recording, editing, or credit eligibility.

### Recording and limit

The recording surface shows elapsed and remaining authorized time. It gives calm, specific warnings before the limit and explains available premium or earned extensions before the user reaches it. Auto-stop preserves the captured thought and transitions directly to processing.

### Processing

Upload, transcription, and extraction appear as understandable progress states. The state survives relaunch. Slow processing never appears as an empty successful note.

### Valid empty result

A reflection with no explicit task is a successful result. The app confirms the note was captured and does not invent an action merely to populate the task area.

### Failure and recovery

A failed upload or provider request keeps the recording in the local outbox and exposes retry. A permanent validation failure preserves the transcript when available and explains what can be recovered.

### Evaluation state

The evaluation surface distinguishes not evaluated, saved, earned credit, already rewarded, and unable to submit. Saved state reloads consistently and cannot accidentally generate duplicate grants.

All copy remains plain, calm, and specific. Credits are presented as recording time earned through contribution, not as a casino-style coin, streak, or pressure mechanic.

## Recording allowances and premium

### Allowance calculation

The server is authoritative. Effective allowance is calculated from:

1. the base free policy;
2. a current premium entitlement; and
3. an explicitly reserved earned extension.

The server validates actual media duration. A client-reported duration is diagnostic only.

The authenticated 60-second base recording remains available offline and is uploaded after the session is restored. Recording beyond the base allowance requires a server-signed premium or credit reservation obtained while online. Without one, the client stops at the base allowance and preserves the file.

The server applies a small configuration-driven encoding tolerance when measured media duration exceeds the reservation. Material overage caused by clock drift or a modified client is accepted only into short-lived durable quarantine, is not sent to an AI provider, and returns allowance required. The user can authorize the additional time and resume processing, or delete the upload. Absolute byte, duration, account-rate, and quarantine-TTL limits reject abuse before durable receipt while the legitimate client retains its local file. The server never silently truncates or charges an over-limit recording.

### Free experience

- Authenticated base allowance: 60 seconds per recording.
- No authenticated daily cap is introduced in this phase.
- The app displays remaining time.
- Warnings occur before the limit.
- The recording auto-stops cleanly at the authorized limit.
- Captured audio is preserved and can still be processed.
- Enforcement remains feature-flagged until premium and credits are ready.

The unauthenticated demo policy remains separate from the authenticated free policy.

### Premium experience

Premium duration and pricing are configuration-driven. Purchase, restore, renewal, cancellation, billing retry, grace period, refund, and device/account changes reconcile to a server-side entitlement history.

A billing-provider outage cannot incorrectly remove an already valid entitlement. Restore purchase remains available from the limit and settings surfaces.

### Earned extensions

An extension is reserved before recording beyond the base allowance. The interface shows the cost before reservation.

Credits are:

- non-transferable;
- not redeemable for cash;
- granted only for unique valid evaluations;
- subject to configurable daily earning limits and abuse controls; and
- governed by an explicit expiry and refund policy.

Cancellation, upload failure, processing failure, and a recording that never exceeds its free allowance each have deterministic reservation release or refund behavior.

The exact credit-to-seconds exchange rate, expiry period, and premium maximum remain open until cost and behavior baselines are decision-grade.

## Reliability and failure behavior

- A captured recording remains in a durable local outbox until confirmed uploaded.
- Upload is idempotent and safely retryable.
- Provider retries are bounded and recorded as separate attempts.
- A provider timeout produces a recoverable pending or failed state, not a fabricated empty note.
- Fallback providers are disabled until they pass the same eval and consent requirements.
- Shadow outputs never alter the user's visible note.
- Schema validation failure is distinguishable from semantic failure.
- A failed processing attempt does not consume earned recording credit.
- A model rollback changes future routing without deleting historical lineage.

## Background workflow contract

Durable background work is represented by database-backed jobs. The API creates an idempotent job record; a least-privilege Supabase worker claims it with a lease; completion commits the result and idempotency key in one transaction. A scheduled reconciler reclaims expired leases. Jobs that exhaust their retry class move to a dead-letter state and alert operations with content-free metadata.

| Workflow | Owner and trigger | Retry and completion rule |
| --- | --- | --- |
| Recording processing | Processing worker after durable upload | Up to three provider attempts with exponential backoff and jitter; complete only when the run and visible revision commit atomically. |
| Reviewed-corpus export | Export worker after an explicit accepted review | Idempotent by review and corpus version; never exports without a valid consent snapshot. |
| Corpus removal | Privacy worker after consent withdrawal, note deletion, or account deletion | High-priority retries until every manifest reports removed; a dead-letter blocks deletion completion and requires remediation and requeue. |
| Reservation expiry | Scheduled allowance reconciler at least every five minutes | Releases an expired reservation exactly once through a ledger reversal. |
| App Store reconciliation | Webhook handler plus nightly subscription reconciler | Provider event ID is the idempotency key; unresolved drift remains open and alerted rather than stripping entitlement. |
| Credit reversal/refund | Ledger service after cancellation or failed processing | One append-only compensating entry per reservation and reason. |
| Account deletion | Privacy orchestrator after a verified account request | Each owned data class records completion; the orchestrator retries incomplete classes and finishes only when the deletion inventory reconciles. |

Review judgment itself remains human-controlled. The worker automates only the authorized export or removal after that decision.

## Observability

Supabase is the canonical source for run, feedback, cost, entitlement, and ledger facts. PostHog receives only allowlisted, content-free aggregate events.

Operational reporting includes:

- successful recordings;
- transcription and extraction success;
- p50 and p95 latency;
- retry and failure rates;
- cost per successful recording and by stage;
- correction-free and accepted-unchanged rates;
- explicit-task precision and recall;
- critical-error rate;
- agent-ready rate;
- evaluation completion and review yield;
- quality by contract version;
- entitlement reconciliation failures;
- credit grants, reservations, refunds, and outstanding liability; and
- deletion and lineage integrity failures.

Low-volume reports stay labeled as directional. Raw audio, transcript text, note text, feedback text, email, and provider credentials never enter product analytics.

### Initial unit-economics baseline

Using Groq's published August 16, 2026 on-demand rates:

- full Whisper v3 costs $0.111 per transcribed hour, or $0.00185 for 60 seconds;
- Turbo costs $0.04 per hour, or about $0.00067 for 60 seconds;
- GPT-OSS-120B costs $0.15 per million input tokens and $0.60 per million output tokens; and
- an assumed 1,500-input-token and 500-output-token extraction costs about $0.00053.

The resulting direct-AI estimate for one successful 60-second note using full Whisper v3 is about $0.00238 before retry, storage, observability, and human review. The initial planning budget is $0.003 per successful one-minute note. Thirty such free notes per month imply about $0.09 in direct AI cost. A premium scenario of 15 transcribed minutes per day is budgeted conservatively at $1.50 per month in direct AI cost until real recording count, transcript length, retries, and extraction output are measured.

Human-review labor, storage, failed attempts, and the future obligation represented by outstanding credits are reported separately. These assumptions use the dated [Groq pricing table](https://groq.com/pricing) and must never replace measured usage or a versioned internal price table.

## Privacy and security

- Processing permission and improvement consent are separate.
- Declining improvement consent does not prevent normal product use.
- Consent is versioned, recorded, revocable, and enforced during export.
- New providers require updated disclosure and consent coverage before receiving user content.
- Raw content is stored at rest only in Throughline's first-party Supabase storage. It is transmitted ephemerally only to processors disclosed for the consented purpose, under documented provider-retention controls, and is available internally only to least-privilege services and reviewers.
- Review tools require service-side authorization and audit logs.
- Account-level rows use account-scoped policies.
- Analytics event properties use strict allowlists.
- Account deletion covers recordings, audio, inference runs, revisions, evaluations, review/export records, preferences, entitlements, and credit data subject to documented financial-retention requirements.
- If an accepted corpus example is later deleted, every removable copy is deleted and the corpus manifest records the removal.
- Append-only means records cannot be silently mutated during their active lifecycle; it does not override deletion rights. Deletion removes user content and account linkage, then leaves only a content-free tombstone when needed to prove reconciliation.
- Subscription or ledger facts that must be retained for financial, fraud, or legal obligations are minimized, de-identified where possible, and governed by a documented retention period.
- Model fine-tuning on personal data is out of scope until deletion, consent, and retraining obligations are explicitly designed.

## Rollout

Each model or contract candidate moves through:

1. offline replay;
2. shadow traffic limited to users whose consent covers the provider and purpose;
3. internal canary;
4. limited deterministic canary;
5. general availability.

Every stage has entry and exit criteria. Promotion and rollback are configuration changes tied to immutable release records. Production changes remain paused during App Review unless a separate critical-fix decision is made.

## End-to-end backlog

### P0 — Release provenance and consent

Preserve release evidence, reconcile Git with submitted and deployed state, separate processing and improvement consent, and align public claims with actual behavior.

### P1 — Evaluation corpus and scorecards

Build consented audio fixtures, verified transcripts, extraction goldens, critical labels, development/holdout separation, and the three scorecards.

### P2 — Versioned inference contract

Make production and evals share one prompt, schema, normalizer, model configuration, retry policy, and price table.

### P3 — Immutable lineage and revisions

Add inference attempts, original outputs, revision history, retry links, model attribution, usage, latency, and cost.

### P4 — Reviewed feedback loop

Add stage-specific evaluation, correction capture, idempotency, service-only review, corpus assignment, and review-yield reporting.

### P5 — Quality and cost observability

Build canonical per-stage quality, reliability, latency, and cost reporting plus strict analytics allowlists and operational alerts.

### P6 — Controlled promotion and rollback

Support offline, shadow, canary, release, and rollback states with evidence-backed human decisions.

### P7 — Bounded personalization

Derive editable, account-private vocabulary and task preferences from accepted personal corrections and compare against the global baseline.

### P8 — Server-authoritative recording allowances

Implement duration verification, free/premium/earned allowance calculation, reservations, warnings, clean auto-stop, and feature-flagged enforcement.

### P9 — Premium subscriptions

Implement StoreKit purchase, restore, management, provider-event reconciliation, grace/refund behavior, and configuration-driven limits.

### P10 — Evaluation-credit ledger

Implement idempotent grants, reservations, spending, expiry, reversals, refunds, abuse controls, balance explanation, and entitlement precedence.

### P11 — Privacy, deletion, and operations

Extend deletion, audit access, provider-outage handling, model rollback, entitlement reconciliation, ledger reconciliation, and weekly operating review across the new system.

## First measurable milestone

The first build milestone is P0 through P3:

1. preserve release provenance;
2. reconcile consent;
3. establish a real audio-to-task baseline;
4. unify and version the inference contract; and
5. preserve every future attempt and edit as attributable lineage.

The first offline challenger compares Groq whisper-large-v3 with the current Turbo baseline while holding extraction constant. Strict structured extraction is then compared while holding transcription constant. This isolates where quality changes come from.

The milestone is complete when Throughline has a blind report with quality, critical errors, latency, and cost for each candidate and a clear promote, reject, or gather-more-data recommendation. It does not require a production model change.

### Milestone acceptance checks

- A release manifest records the submitted version/build, archive receipt, deployed API version/hash, content-safe model configuration, Git state, and every unresolved provenance ambiguity.
- Only the manifest and explicitly identified release files enter a provenance commit; unrelated working-tree changes remain untouched.
- Choosing not now on first-recording processing permission creates and uploads no audio.
- Granting and later withdrawing processing permission is persisted and blocks future upload.
- Declining improvement consent prevents corpus export while preserving normal recording, editing, and valid evaluation-credit behavior.
- Killing and relaunching the app after capture but before confirmed upload restores the pending recording from the local outbox.
- Production and evaluation report the same prompt, schema, and normalizer hashes for the same contract version.
- The model-quality command invokes a real configured provider or fails clearly; the golden-copy plumbing command has a different name and cannot be presented as quality evidence.
- A provider retry creates a linked new attempt without replacing the original run.
- A user edit creates a new revision while the original transcript and structured output remain recoverable.
- The initial audio corpus and scorer produce the three scorecards and a sealed manifest.
- No production model or prompt is changed as part of completing this milestone.

## Non-goals

- Blind online learning or autonomous prompt mutation.
- Fine-tuning on user recordings in this phase.
- Cross-user raw-memory retrieval.
- Paying for positive ratings.
- Activating the 60-second limit before premium and earned recovery work.
- Locking premium price, premium maximum duration, or credit exchange rates before measurement.
- Building a broad provider abstraction that is not required by a real candidate test.
- Task-home redesign, MCP write tools, team collaboration, meeting transcription, or Android.

## Open decisions

These are intentionally deferred until the corresponding evidence exists:

- premium monthly and annual pricing;
- premium maximum recording duration;
- credit-to-seconds exchange rate;
- daily earning cap and credit expiry;
- review-console scope beyond the initial service-only workflow;
- multilingual launch threshold;
- whether the submitted 1.0.4 review should continue unchanged after the consent mismatch is assessed; and
- the cost and latency budgets used as hard promotion gates.

## Acceptance criteria for the complete system

- Every visible note can be traced to immutable transcription and extraction attempts.
- User edits never destroy original model output.
- A real audio-to-task eval can compare any supported candidate with the production control.
- The quality command cannot pass by copying expected fixtures.
- No candidate with any critical holdout failure can be promoted.
- Feedback influences releases only after consent and review.
- Personalization is private, inspectable, removable, and independently disableable.
- Production canary and rollback preserve lineage.
- The server independently enforces recording allowance.
- Purchase restoration and earned-extension refunds pass end to end before the 60-second flag is enabled.
- Credit balance is derivable from an idempotent append-only ledger.
- Account deletion removes or de-identifies every direct and derived artifact according to the documented content, financial-retention, and tombstone rules.
- Content-free dashboards can explain quality, latency, cost, feedback yield, subscription state, and credit integrity by version.
