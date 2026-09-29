import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvaluationAggregates,
  buildWeeklySnapshot,
  renderMarkdown,
} from "./product-learning-report.mjs";

const reportAt = new Date("2026-08-07T12:00:00.000Z");
const event = (
  eventName,
  occurredAt,
  authUserId,
  sessionId,
  properties = {},
  attribution = {},
) => ({
  event_name: eventName,
  occurred_at: occurredAt,
  auth_user_id: authUserId,
  session_id: sessionId,
  properties,
  ...attribution,
});

const recording = (id, processingStatus, extra = {}) => ({
  id,
  processing_status: processingStatus,
  ...extra,
});

test("calculates activation, retention, funnel, and guardrails without exposing identifiers", () => {
  const snapshot = buildWeeklySnapshot({
    reportAt,
    events: [
      event("first_opened", "2026-07-28T10:00:00.000Z", null, "session-1"),
      event("demo_recording_completed", "2026-07-28T10:03:00.000Z", null, "session-1"),
      event("auth_succeeded", "2026-07-28T10:05:00.000Z", "user-1", "session-1", {
        mode: "create_account",
        account_state: "new",
      }),
      event("home_viewed", "2026-07-28T10:05:30.000Z", "user-1", "session-1", { state: "empty" }),
      event("recording_processed", "2026-07-28T10:06:00.000Z", "user-1", "session-1", { surface: "onboarding_promotion" }),
      event("recording_processed", "2026-07-28T11:00:00.000Z", "user-1", "session-1", { surface: "home" }),
      event("recording_processed", "2026-08-01T11:00:00.000Z", "user-1", "session-2", { surface: "home" }),
      event("auth_succeeded", "2026-08-04T10:00:00.000Z", "user-2", "session-3", {
        mode: "sign_in",
        account_state: "existing",
      }),
      event("home_viewed", "2026-08-04T10:00:30.000Z", "user-2", "session-3", { state: "populated" }),
      event("recording_processed", "2026-08-04T10:01:00.000Z", "user-2", "session-3", { surface: "onboarding_promotion" }),
      event("recording_failed", "2026-08-05T10:00:00.000Z", "user-2", "session-3"),
    ],
    productFeedback: [{
      id: "pf_1",
      created_at: "2026-08-06T10:00:00.000Z",
      source: "ios",
      category: "problem",
      status: "new",
      contact_allowed: true,
      message: "PRIVATE_FEEDBACK_TOKEN_BASELINE",
    }],
    extractionFeedback: [
      { feedback: { answers: { quality_score: 2, issue_types: ["missing"], agent_ready: false } } },
      { feedback: { answers: { quality_score: 4, issue_types: [], agent_ready: true } } },
    ],
  });

  assert.deepEqual(snapshot.kpis.activation_24h, {
    numerator: 1,
    denominator: 2,
    rate: 0.5,
    definition: "first recording_processed with surface=home within 24 hours of auth_succeeded",
  });
  assert.deepEqual(snapshot.kpis.activation_24h_by_onboarding_path.demo_then_auth, {
    numerator: 1,
    denominator: 1,
    rate: 1,
  });
  assert.deepEqual(snapshot.kpis.activation_24h_by_onboarding_path.auth_without_demo, {
    numerator: 0,
    denominator: 1,
    rate: 0,
  });
  assert.deepEqual(snapshot.kpis.auth_succeeded_by_mode, { create_account: 1, sign_in: 1 });
  assert.deepEqual(snapshot.kpis.auth_succeeded_by_account_state, { new: 1, existing: 1 });
  assert.deepEqual(snapshot.drivers.home_viewed_by_state, { empty: 1, populated: 1 });
  assert.equal(snapshot.drivers.funnel[0].event, "first_opened");
  assert.equal(snapshot.kpis.weekly_activated_users, 1);
  assert.deepEqual(snapshot.kpis.retention_days_2_7, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(snapshot.guardrails.recording_failure_rate_7d, { failed: 1, outcomes: 3, rate: 0.333 });
  assert.equal(snapshot.guardrails.extraction_quality.average_score, 3);
  assert.deepEqual(snapshot.drivers.product_feedback, {
    total: 1,
    by_category: { problem: 1 },
    by_source: { ios: 1 },
    by_status: { new: 1 },
    contact_allowed: 1,
  });

  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.report_schema_version, 2);
  assert.equal(snapshot.query_contract, "measurement_attribution_v2");
  assert.doesNotMatch(serialized, /user-1|user-2|session-1|session-2|session-3/);
  assert.doesNotMatch(serialized, /pf_1|PRIVATE_FEEDBACK_TOKEN_BASELINE/);
});

test("marks low-volume data as collecting baseline instead of interpreting zeroes", () => {
  const snapshot = buildWeeklySnapshot({
    reportAt,
    events: [event("first_opened", "2026-08-07T10:00:00.000Z", null, "session-only")],
    productFeedback: [],
    extractionFeedback: [],
  });

  assert.equal(snapshot.data_readiness.status, "collecting_baseline");
  assert.equal(snapshot.kpis.activation_24h.rate, null);
  assert.equal(snapshot.kpis.retention_days_2_7.rate, null);
  assert.match(renderMarkdown(snapshot), /collecting baseline/);
  assert.match(snapshot.recommendations.join(" "), /not user drop-off/);
});

test("reconciles schema-v2 outcomes across five isolated cohorts without joining legacy rows", () => {
  const internalUser = "PRIVATE_USER_TOKEN_INTERNAL";
  const externalUser = "PRIVATE_USER_TOKEN_EXTERNAL";
  const legacyUser = "PRIVATE_USER_TOKEN_LEGACY";
  const occurredAt = "2026-08-07T10:00:00.000Z";
  const legacyOccurredAt = "2026-08-06T10:00:00.000Z";
  const attributed = (recordingID, distributionChannel, isInternalUser) => ({
    schema_version: 2,
    recording_id: recordingID,
    distribution_channel: distributionChannel,
    is_internal_user: isInternalUser,
  });

  const snapshot = buildWeeklySnapshot({
    reportAt,
    events: [
      event("recording_processed", occurredAt, internalUser, "debug-match-session", {
        surface: "home",
        processing_status: "processed",
      }, attributed("rec-debug-match", "debug", true)),
      event("recording_processed", occurredAt, externalUser, "debug-event-only-session", {
        surface: "home",
        processing_status: "processed",
      }, attributed(null, "debug", false)),
      event("recording_failed", occurredAt, internalUser, "internal-match-session", {
        stage: "processing",
        processing_status: "extraction_failed",
      }, attributed("rec-internal-match", "testflight", true)),
      event("recording_uploaded", occurredAt, internalUser, "internal-durable-upload-session", {
        surface: "home",
      }, attributed("rec-internal-durable-only", "app_store", true)),
      event("recording_processed", occurredAt, externalUser, "testflight-mismatch-session", {
        surface: "home",
        processing_status: "processed",
      }, attributed("rec-testflight-mismatch", "testflight", false)),
      event("recording_processed", occurredAt, externalUser, "testflight-duplicate-a", {
        surface: "home",
        processing_status: "processed",
      }, attributed("rec-testflight-duplicate", "testflight", false)),
      event("recording_processed", "2026-08-07T10:00:01.000Z", externalUser, "testflight-duplicate-b", {
        surface: "home",
        processing_status: "processed",
      }, attributed("rec-testflight-duplicate", "testflight", false)),
      event("recording_processed", occurredAt, externalUser, "app-store-match-session", {
        surface: "home",
        processing_status: "processed",
      }, attributed("rec-app-store-match", "app_store", false)),
      event("recording_failed", occurredAt, externalUser, "unknown-event-only-session", {
        stage: "processing",
        processing_status: "processing_failed",
      }, attributed(null, "unknown", null)),
      event("recording_uploaded", occurredAt, externalUser, "unknown-durable-upload-session", {
        surface: "home",
      }, attributed("rec-unknown-durable-only", "unknown", null)),
      event("recording_processed", legacyOccurredAt, legacyUser, "legacy-nearby-session", {
        surface: "home",
        processing_status: "processed",
      }, {
        schema_version: 1,
        recording_id: "rec-legacy-nearby",
        distribution_channel: "app_store",
        is_internal_user: false,
      }),
    ],
    recordings: [
      recording("rec-debug-match", "processed"),
      recording("rec-internal-match", "extraction_failed"),
      recording("rec-internal-durable-only", "processed"),
      recording("rec-testflight-mismatch", "extraction_failed"),
      recording("rec-testflight-duplicate", "processed"),
      recording("rec-app-store-match", "processed"),
      recording("rec-unknown-durable-only", "processing_failed"),
      recording("rec-legacy-nearby", "processed"),
      recording("rec-still-uploading", "uploaded"),
    ],
    productFeedback: [],
    extractionFeedback: [],
  });

  assert.deepEqual(snapshot.processing_reconciliation.populations, {
    matched: 3,
    event_only: 2,
    durable_only: 2,
    state_mismatch: 1,
    duplicate: 1,
    total: 9,
  });
  assert.equal(snapshot.processing_reconciliation.correctly_reconciled_rate, 0.333);
  assert.equal(snapshot.processing_reconciliation.duplicate_event_excess, 1);
  assert.deepEqual(snapshot.processing_reconciliation.cohorts.debug, {
    matched: 1,
    event_only: 1,
    durable_only: 0,
    state_mismatch: 0,
    duplicate: 0,
    total: 2,
    correctly_reconciled_rate: 0.5,
  });
  assert.deepEqual(snapshot.processing_reconciliation.cohorts.internal_dogfood, {
    matched: 1,
    event_only: 0,
    durable_only: 1,
    state_mismatch: 0,
    duplicate: 0,
    total: 2,
    correctly_reconciled_rate: 0.5,
  });
  assert.deepEqual(snapshot.processing_reconciliation.cohorts.external_testflight, {
    matched: 0,
    event_only: 0,
    durable_only: 0,
    state_mismatch: 1,
    duplicate: 1,
    total: 2,
    correctly_reconciled_rate: 0,
  });
  assert.deepEqual(snapshot.processing_reconciliation.cohorts.external_app_store, {
    matched: 1,
    event_only: 0,
    durable_only: 0,
    state_mismatch: 0,
    duplicate: 0,
    total: 1,
    correctly_reconciled_rate: 1,
  });
  assert.deepEqual(snapshot.processing_reconciliation.cohorts.unknown, {
    matched: 0,
    event_only: 1,
    durable_only: 1,
    state_mismatch: 0,
    duplicate: 0,
    total: 2,
    correctly_reconciled_rate: 0,
  });
  assert.deepEqual(snapshot.processing_reconciliation.legacy_unattributed, {
    outcome_events: 1,
    final_recordings_without_v2_upload_marker: 1,
  });
  assert.deepEqual(snapshot.processing_reconciliation.public_baseline, {
    eligible_outcomes: 1,
    rule: "external non-internal app_store schema-v2 matched outcomes only",
  });
});

test("requires an exact schema-v2 upload marker before counting a durable-only recording", () => {
  const user = "PRIVATE_USER_TOKEN_UPLOAD_MARKER";
  const occurredAt = "2026-08-07T10:00:00.000Z";
  const legacyAt = "2026-08-06T10:00:00.000Z";
  const snapshot = buildWeeklySnapshot({
    reportAt,
    events: [
      event("recording_uploaded", occurredAt, user, "instrumented-upload-session", {
        surface: "home",
      }, {
        schema_version: 2,
        recording_id: "rec-instrumented-upload-only",
        distribution_channel: "app_store",
        is_internal_user: false,
      }),
      event("recording_uploaded", legacyAt, user, "legacy-upload-session", { surface: "home" }),
      event("recording_processed", legacyAt, user, "legacy-outcome-session", {
        surface: "home",
        processing_status: "processed",
      }),
    ],
    recordings: [
      recording("rec-instrumented-upload-only", "processed"),
      recording("rec-legacy-nearby", "processed"),
    ],
    productFeedback: [],
    extractionFeedback: [],
  });

  assert.equal(snapshot.processing_reconciliation.cohorts.external_app_store.durable_only, 1);
  assert.equal(snapshot.processing_reconciliation.cohorts.unknown.durable_only, 0);
  assert.deepEqual(snapshot.processing_reconciliation.legacy_unattributed, {
    outcome_events: 1,
    final_recordings_without_v2_upload_marker: 1,
  });
  assert.equal(snapshot.processing_reconciliation.populations.total, 1);
  assert.equal(snapshot.processing_reconciliation.correctly_reconciled_rate, 0);
});

test("serializes aggregate reconciliation without identifiers or user content", () => {
  const secrets = {
    user: "PRIVATE_USER_TOKEN_SERIALIZATION",
    session: "PRIVATE_SESSION_TOKEN_SERIALIZATION",
    recording: "PRIVATE_RECORDING_TOKEN_SERIALIZATION",
    transcript: "PRIVATE_TRANSCRIPT_TOKEN_SERIALIZATION",
    note: "PRIVATE_NOTE_TOKEN_SERIALIZATION",
    feedback: "PRIVATE_FEEDBACK_TOKEN_SERIALIZATION",
  };
  const snapshot = buildWeeklySnapshot({
    reportAt,
    events: [event("recording_processed", "2026-08-07T10:00:00.000Z", secrets.user, secrets.session, {
      surface: "home",
      processing_status: "processed",
      note_text: secrets.note,
    }, {
      schema_version: 2,
      recording_id: secrets.recording,
      distribution_channel: "app_store",
      is_internal_user: false,
    })],
    recordings: [recording(
      secrets.recording,
      "processed",
      {
        auth_user_id: secrets.user,
        created_at: "2026-08-07T10:00:00.000Z",
        transcript_raw: secrets.transcript,
        structured_note: { title: secrets.note },
      },
    )],
    productFeedback: [{
      id: "product-feedback-private-id",
      created_at: "2026-08-07T10:00:00.000Z",
      source: "ios",
      category: "problem",
      status: "new",
      contact_allowed: true,
      message: secrets.feedback,
    }],
    extractionFeedback: [{
      answers: {
        quality_score: 1,
        issue_types: ["missing"],
        agent_ready: false,
        correction: secrets.feedback,
      },
    }],
  });

  const serialized = `${JSON.stringify(snapshot)}\n${renderMarkdown(snapshot)}`;
  for (const secret of Object.values(secrets)) assert.doesNotMatch(serialized, new RegExp(secret));
  assert.doesNotMatch(serialized, /product-feedback-private-id/);
  assert.doesNotMatch(serialized, /auth_user_id|session_id|recording_id|transcript_raw|structured_note|message|excerpt|correction/);
});

test("projects only aggregate cohort rows for the founder dashboard", async () => {
  const reportModule = await import("./product-learning-report.mjs");
  assert.equal(typeof reportModule.buildDashboardReconciliationRows, "function");
  const rows = reportModule.buildDashboardReconciliationRows({
    cohorts: {
      debug: { matched: 1, event_only: 2, durable_only: 3, state_mismatch: 4, duplicate: 5, total: 15, correctly_reconciled_rate: 0.067 },
      internal_dogfood: { matched: 6, event_only: 0, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 6, correctly_reconciled_rate: 1 },
      external_testflight: { matched: 7, event_only: 0, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 7, correctly_reconciled_rate: 1 },
      external_app_store: { matched: 8, event_only: 0, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 8, correctly_reconciled_rate: 1 },
      unknown: { matched: 0, event_only: 9, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 9, correctly_reconciled_rate: 0 },
    },
  });

  assert.deepEqual(rows, [
    { cohort: "Debug", matched: 1, event_only: 2, durable_only: 3, state_mismatch: 4, duplicate: 5, total: 15, correct_rate: 0.067 },
    { cohort: "Internal dogfood", matched: 6, event_only: 0, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 6, correct_rate: 1 },
    { cohort: "External TestFlight", matched: 7, event_only: 0, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 7, correct_rate: 1 },
    { cohort: "External App Store", matched: 8, event_only: 0, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 8, correct_rate: 1 },
    { cohort: "Unknown", matched: 0, event_only: 9, durable_only: 0, state_mismatch: 0, duplicate: 0, total: 9, correct_rate: 0 },
  ]);
});

test("keeps mixed KPI coverage and empty reconciliation non-decision-grade on the dashboard", async () => {
  const reportModule = await import("./product-learning-report.mjs");
  assert.equal(typeof reportModule.dashboardKpiDecisionStatus, "function");
  assert.equal(typeof reportModule.buildDashboardReconciliationSummary, "function");
  assert.equal(typeof reportModule.buildDashboardCanonicalSource, "function");
  assert.equal(typeof reportModule.hasMeasurementAttributionContract, "function");
  assert.equal(reportModule.hasMeasurementAttributionContract({
    processing_reconciliation: { populations: { matched: 9, total: 9 } },
  }), false);
  assert.equal(reportModule.hasMeasurementAttributionContract({
    report_schema_version: 2,
    query_contract: "measurement_attribution_v2",
  }), true);
  assert.equal(reportModule.dashboardKpiDecisionStatus(
    true,
    "mixed_operational_coverage_not_public_baseline",
  ), "Mixed coverage");
  assert.equal(reportModule.dashboardKpiDecisionStatus(true, undefined), "Mixed coverage");
  assert.equal(reportModule.dashboardKpiDecisionStatus(true, "post_cutover_matched"), "Interpretable");
  assert.deepEqual(reportModule.buildDashboardReconciliationSummary({
    populations: { matched: 0, total: 0 },
    correctly_reconciled_rate: null,
  }), {
    available: true,
    rate: null,
    matched: 0,
    total: 0,
    current: "collecting baseline (0 outcomes)",
    status: "Collecting baseline",
  });
  assert.deepEqual(reportModule.buildDashboardReconciliationRows(undefined), []);
  assert.deepEqual(reportModule.buildDashboardReconciliationSummary(undefined), {
    available: false,
    rate: null,
    matched: null,
    total: null,
    current: "not yet generated",
    status: "Unavailable",
  });

  const legacySource = reportModule.buildDashboardCanonicalSource({
    generated_at: "2026-08-17T15:27:57.680Z",
  });
  assert.match(legacySource.query.description, /query contract was not embedded/i);
  assert.match(legacySource.query.sql, /unavailable/i);
  assert.equal(legacySource.query.executed, false);
  assert.match(legacySource.query.implementation, /compatibility projection/i);
  assert.equal(legacySource.query.executed_at, undefined);
  assert.doesNotMatch(JSON.stringify(legacySource), /auth_user_id|session_id|recording_id/);

  const currentSource = reportModule.buildDashboardCanonicalSource({
    generated_at: "2026-08-18T10:00:00.000Z",
    report_schema_version: 2,
    query_contract: "measurement_attribution_v2",
  });
  assert.equal(currentSource.query.executed_at, "2026-08-18T10:00:00.000Z");
  assert.match(currentSource.query.description, /private in-memory/i);
  assert.match(currentSource.query.sql, /recording_id/);
});

test("complete lineage excludes contributions with a non-current evaluation policy", () => {
  const aggregates = buildEvaluationAggregates({
    recordings: [{ id: "recording-a" }],
    contracts: [{ id: "contract-a" }],
    operations: [{
      operation_id: "operation-a",
      recording_id: "recording-a",
      inference_contract_id: "contract-a",
      status: "succeeded",
    }],
    attempts: [
      { operation_id: "operation-a", stage: "transcription", status: "succeeded" },
      { operation_id: "operation-a", stage: "extraction", status: "succeeded" },
    ],
    revisions: [
      {
        revision_id: "original-a",
        recording_id: "recording-a",
        processing_operation_id: "operation-a",
        revision_kind: "original_model",
      },
      {
        revision_id: "evaluated-a",
        recording_id: "recording-a",
        processing_operation_id: "operation-a",
        revision_kind: "user_content_correction",
      },
    ],
    evaluations: [{
      evaluation_id: "evaluation-a",
      recording_id: "recording-a",
      processing_operation_id: "operation-a",
      evaluated_revision_id: "evaluated-a",
      evaluator_kind: "recording_user",
      notice_version: "private_evaluation_notice_v1",
      disclosure_version: "private_evaluation_disclosure_v1",
    }],
    contributions: [{
      contribution_id: "contribution-a",
      evaluation_id: "evaluation-a",
      note_revision_id: "evaluated-a",
      event_kind: "created",
      notice_version: "private_evaluation_notice_v1",
      disclosure_version: "private_evaluation_disclosure_v1",
      policy_version: "superseded_policy",
    }],
  });

  assert.deepEqual(aggregates.complete_lineage, { complete: 0, total: 0 });
});

test("diagnostic and reviewed counts require a linked active current contribution", () => {
  const aggregates = buildEvaluationAggregates({
    contributions: [
      {
        contribution_id: "active-contribution",
        event_kind: "created",
        notice_version: "private_evaluation_notice_v1",
        disclosure_version: "private_evaluation_disclosure_v1",
        policy_version: "private_evaluation_policy_v1",
      },
      {
        contribution_id: "withdrawn-contribution",
        event_kind: "created",
        notice_version: "private_evaluation_notice_v1",
        disclosure_version: "private_evaluation_disclosure_v1",
        policy_version: "private_evaluation_policy_v1",
      },
      {
        contribution_id: "withdrawal-event",
        supersedes_contribution_id: "withdrawn-contribution",
        event_kind: "withdrawn",
        notice_version: "private_evaluation_notice_v1",
        disclosure_version: "private_evaluation_disclosure_v1",
        policy_version: "private_evaluation_policy_v1",
      },
    ],
    corpusCases: [
      {
        case_id: "active-case",
        contribution_id: "active-contribution",
        label_kind: "diagnostic_grade",
        label_completeness: "diagnostic_only",
      },
      {
        case_id: "withdrawn-case-with-missed-invalidation",
        contribution_id: "withdrawn-contribution",
        label_kind: "diagnostic_grade",
        label_completeness: "diagnostic_only",
      },
      {
        case_id: "unlinked-case",
        contribution_id: "missing-contribution",
        label_kind: "reviewed_fields",
        label_completeness: "reviewed_fields_only",
        editable_correction_mask: ["summary"],
      },
    ],
  });

  assert.equal(aggregates.diagnostic_grade_cases, 1);
  assert.deepEqual(aggregates.reviewed_fields, {
    distinct_cases: 0,
    reviewed_fields: 0,
    transcript_explicit_cases: 0,
  });
});

test("quality benchmark claim requires complete lineage and independent prediction coverage", () => {
  const snapshot = buildWeeklySnapshot({
    reportAt,
    evaluationAggregates: {
      available: true,
      complete_lineage: { complete: 9, total: 10 },
    },
    benchmarkSummary: {
      available: true,
      purpose: "real_private_quality",
      status: "quality_result",
      winner: "candidate",
      minimum_accepted_full_output_cases: 20,
      holdout_passed: true,
      integrity_conditions_passed: true,
      accepted_full_output: {
        eligible_cases: 20,
        independently_predicted_cases: 20,
        full_frozen_schema_valid_cases: 20,
        exact_contract_cases: 20,
        preview_bound_cases: 20,
        manifest_matching_cases: 20,
        sandboxed_cases: 20,
        sealed_cases: 20,
        current_cases: 20,
        revalidated_cases: 20,
      },
    },
  });

  assert.deepEqual(snapshot.quality_evidence.complete_lineage_coverage, {
    numerator: 9,
    denominator: 10,
    rate: 0.9,
  });
  assert.deepEqual(snapshot.quality_evidence.independent_prediction_coverage, {
    numerator: 20,
    denominator: 20,
    rate: 1,
  });
  assert.equal(snapshot.quality_evidence.integrity_gate, "fail");
  assert.equal(snapshot.quality_evidence.winner, null);
});

test("grade-only and partial corrections never enter the winner denominator", () => {
  const snapshot = buildWeeklySnapshot({
    reportAt,
    evaluationAggregates: {
      available: true,
      complete_lineage: { complete: 70, total: 70 },
      diagnostic_grade_cases: 40,
      reviewed_fields: {
        distinct_cases: 30,
        reviewed_fields: 54,
      },
    },
    benchmarkSummary: {
      available: true,
      purpose: "real_private_quality",
      status: "insufficient_sample_size",
      winner: "candidate",
      minimum_accepted_full_output_cases: 20,
      holdout_passed: true,
      integrity_conditions_passed: true,
      diagnostic_grade_cases: 40,
      reviewed_field_cases: 30,
      accepted_full_output: {
        eligible_cases: 0,
        independently_predicted_cases: 0,
      },
    },
  });

  assert.equal(snapshot.quality_evidence.diagnostic_grade_cases, 40);
  assert.equal(snapshot.quality_evidence.reviewed_field_coverage.distinct_cases, 30);
  assert.equal(snapshot.quality_evidence.reviewed_field_coverage.denominator, 54);
  assert.equal(snapshot.quality_evidence.independent_prediction_coverage.denominator, 0);
  assert.equal(snapshot.quality_evidence.integrity_gate, "insufficient_sample_size");
  assert.equal(snapshot.quality_evidence.winner, null);
});

test("incomplete or contract-drifted full outputs never enter independent coverage", () => {
  const snapshot = buildWeeklySnapshot({
    reportAt,
    evaluationAggregates: {
      available: true,
      complete_lineage: { complete: 20, total: 20 },
    },
    benchmarkSummary: {
      available: true,
      purpose: "real_private_quality",
      status: "quality_result",
      winner: "candidate",
      minimum_accepted_full_output_cases: 20,
      holdout_passed: true,
      integrity_conditions_passed: true,
      accepted_full_output: {
        eligible_cases: 20,
        independently_predicted_cases: 20,
        full_frozen_schema_valid_cases: 18,
        exact_contract_cases: 0,
      },
      rejection_counts: {
        incomplete_keyset: 1,
        extra_key: 1,
        contract_drift: 20,
      },
    },
  });

  assert.equal(snapshot.quality_evidence.independent_prediction_coverage.numerator, 0);
  assert.deepEqual(snapshot.quality_evidence.contract_integrity_rejections, {
    contract_drift: 20,
    extra_key: 1,
    incomplete_keyset: 1,
  });
  assert.equal(snapshot.quality_evidence.integrity_gate, "fail");
  assert.equal(snapshot.quality_evidence.winner, null);
});

test("quality evidence reports aggregate lifecycle and retention counts only", () => {
  const privateTokens = {
    id: "PRIVATE_ID",
    receipt: "PRIVATE_RECEIPT_HASH",
    path: "PRIVATE_PATH",
    transcript: "PRIVATE_TRANSCRIPT",
    note: "PRIVATE_NOTE",
    reference: "PRIVATE_REFERENCE",
    prediction: "PRIVATE_PREDICTION",
    prompt: "PRIVATE_PROMPT",
    feedback: "PRIVATE_FEEDBACK",
    credential: "PRIVATE_CREDENTIAL",
    provider_response: "PRIVATE_PROVIDER_RESPONSE",
  };
  const snapshot = buildWeeklySnapshot({
    reportAt,
    evaluationAggregates: {
      available: true,
      complete_lineage: { complete: 20, total: 20 },
      operations_by_status: { started: 2, succeeded: 18, failed: 1 },
      corpus_events_by_kind: {
        materialized: 20,
        revalidated: 20,
        invalidated: 3,
        raw_artifacts_deleted: 3,
      },
      retention_by_reason: {
        standard_expired: 4,
        evaluation_protected: 5,
        eligibility_ended: 2,
      },
      quarantine_count: 6,
      private_values: privateTokens,
    },
    benchmarkSummary: {
      available: true,
      purpose: "real_private_quality",
      status: "quality_result",
      winner: "candidate",
      minimum_accepted_full_output_cases: 20,
      holdout_passed: true,
      integrity_conditions_passed: true,
      accepted_full_output: {
        eligible_cases: 20,
        independently_predicted_cases: 20,
        full_frozen_schema_valid_cases: 20,
        exact_contract_cases: 20,
        preview_bound_cases: 20,
        manifest_matching_cases: 20,
        sandboxed_cases: 20,
        sealed_cases: 20,
        current_cases: 20,
        revalidated_cases: 20,
      },
      isolation_failures: { adapter_isolation_unavailable: 2 },
      private_values: privateTokens,
    },
  });

  assert.deepEqual(snapshot.quality_evidence.operations, {
    started: 2,
    succeeded: 18,
    failed: 1,
    total: 21,
  });
  assert.deepEqual(snapshot.quality_evidence.corpus_lifecycle, {
    materialized: 20,
    revalidated: 20,
    invalidated: 3,
    raw_artifacts_deleted: 3,
  });
  assert.deepEqual(snapshot.quality_evidence.retention, {
    standard_expired: 4,
    evaluation_protected: 5,
    eligibility_ended: 2,
  });
  assert.deepEqual(snapshot.quality_evidence.quarantine, { count: 6 });
  assert.deepEqual(snapshot.quality_evidence.isolation_failures, {
    adapter_isolation_unavailable: 2,
  });
  assert.equal(snapshot.quality_evidence.integrity_gate, "pass");
  assert.equal(snapshot.quality_evidence.winner, "candidate");

  const serialized = `${JSON.stringify(snapshot)}\n${renderMarkdown(snapshot)}`;
  for (const token of Object.values(privateTokens)) {
    assert.doesNotMatch(serialized, new RegExp(token));
  }
});

test("winner requires every counted full-output case to be manifest-matching and sandboxed", () => {
  const snapshot = buildWeeklySnapshot({
    reportAt,
    evaluationAggregates: {
      available: true,
      complete_lineage: { complete: 20, total: 20 },
    },
    benchmarkSummary: {
      available: true,
      purpose: "real_private_quality",
      status: "quality_result",
      winner: "candidate",
      minimum_accepted_full_output_cases: 20,
      holdout_passed: true,
      integrity_conditions_passed: true,
      accepted_full_output: {
        eligible_cases: 20,
        independently_predicted_cases: 20,
        full_frozen_schema_valid_cases: 20,
        exact_contract_cases: 20,
        preview_bound_cases: 20,
        sealed_cases: 20,
        current_cases: 20,
        revalidated_cases: 20,
      },
    },
  });

  assert.equal(snapshot.quality_evidence.independent_prediction_coverage.numerator, 0);
  assert.equal(snapshot.quality_evidence.integrity_gate, "fail");
  assert.equal(snapshot.quality_evidence.winner, null);
});

test("missing evaluation tables and benchmark data remain a coverage gap", () => {
  const snapshot = buildWeeklySnapshot({ reportAt });

  assert.equal(snapshot.quality_evidence.availability, "coverage_gap");
  assert.deepEqual(snapshot.quality_evidence.complete_lineage_coverage, {
    numerator: null,
    denominator: null,
    rate: null,
  });
  assert.deepEqual(snapshot.quality_evidence.independent_prediction_coverage, {
    numerator: null,
    denominator: null,
    rate: null,
  });
  assert.equal(snapshot.quality_evidence.integrity_gate, "insufficient_sample_size");
  assert.equal(snapshot.quality_evidence.winner, null);
  assert.match(renderMarkdown(snapshot), /quality evidence.*coverage gap/i);
});
