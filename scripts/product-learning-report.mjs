import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const DEFAULT_WINDOW_DAYS = 35;
const REPORT_SCHEMA_VERSION = 2;
const REPORT_QUERY_CONTRACT = "measurement_attribution_v2";
const RECONCILIATION_COHORTS = [
  "debug",
  "internal_dogfood",
  "external_testflight",
  "external_app_store",
  "unknown",
];
const OUTCOME_EVENT_NAMES = new Set(["recording_processed", "recording_failed"]);
const RECONCILIATION_EVENT_NAMES = new Set([
  "recording_uploaded",
  ...OUTCOME_EVENT_NAMES,
]);
const FINAL_RECORDING_STATUSES = new Set([
  "processed",
  "needs_transcript",
  "needs_extractor",
  "transcription_failed",
  "extraction_failed",
  "processing_failed",
]);
const FAILED_RECORDING_STATUSES = new Set([
  "needs_transcript",
  "needs_extractor",
  "transcription_failed",
  "extraction_failed",
  "processing_failed",
]);
const AUTH_MODES = new Set(["apple", "google", "create_account", "sign_in"]);
const ACCOUNT_STATES = new Set(["new", "existing", "unknown"]);
const PRODUCT_FEEDBACK_SOURCES = new Set(["ios", "app_store", "email", "x", "reddit", "support"]);
const PRODUCT_FEEDBACK_CATEGORIES = new Set(["general", "idea", "problem", "praise"]);
const PRODUCT_FEEDBACK_STATUSES = new Set(["new", "reviewing", "planned", "shipped", "closed"]);
const EXTRACTION_ISSUE_TYPES = new Set([
  "missed_actions",
  "wrong_importance",
  "invented_detail",
  "weak_summary",
  "transcript_error",
  "missing",
]);
const FUNNEL = [
  "first_opened",
  "onboarding_started",
  "demo_recording_completed",
  "auth_succeeded",
  "home_viewed",
  "recording_started",
  "recording_uploaded",
  "recording_processed",
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function parseArgs(argv) {
  const args = { outputDir: ".throughline/product-learning", stdout: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--stdout") args.stdout = true;
    if (argv[index] === "--output-dir") args.outputDir = argv[++index];
  }
  return args;
}

async function fetchRows(table, params, config) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const query = new URLSearchParams(params);
    query.set("limit", String(PAGE_SIZE));
    query.set("offset", String(offset));
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`${table} query failed (${response.status}): ${await response.text()}`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`${table} query did not return rows`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function asDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function percentage(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function unique(values) {
  return new Set(values.filter(Boolean));
}

function firstEvent(events, eventName) {
  return events.find((event) => event.event_name === eventName) ?? null;
}

function eventSurface(event) {
  return eventProperty(event, "surface");
}

function eventProperty(event, key) {
  return event.properties?.[key] ?? event[key] ?? null;
}

function isFirstRealRecording(event) {
  return event.event_name === "recording_processed" &&
    eventSurface(event) === "home";
}

function pathRate(numerator, denominator) {
  return {
    numerator,
    denominator,
    rate: round(percentage(numerator, denominator)),
  };
}

function formatRate(value) {
  return value === null ? "collecting baseline" : `${Math.round(value * 100)}%`;
}

function formatCount(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

function safeCategory(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

function countByAllowed(rows, key, allowed) {
  const counts = {};
  for (const row of rows) {
    const category = safeCategory(row?.[key], allowed);
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function emptyReconciliationCohort() {
  return {
    matched: 0,
    event_only: 0,
    durable_only: 0,
    state_mismatch: 0,
    duplicate: 0,
  };
}

function eventCohort(event) {
  if (event.distribution_channel === "debug") return "debug";
  if (event.is_internal_user === true) return "internal_dogfood";
  if (event.is_internal_user === false && event.distribution_channel === "testflight") {
    return "external_testflight";
  }
  if (event.is_internal_user === false && event.distribution_channel === "app_store") {
    return "external_app_store";
  }
  return "unknown";
}

function eventGroupCohort(events) {
  const cohorts = new Set(events.map(eventCohort));
  return cohorts.size === 1 ? [...cohorts][0] : "unknown";
}

function isStateConsistent(event, recording) {
  const durableStatus = recording.processing_status;
  const eventStatus = eventProperty(event, "processing_status");
  if (event.event_name === "recording_processed") {
    return durableStatus === "processed" &&
      (eventStatus === null || eventStatus === "processed" || eventStatus === "unknown");
  }
  if (event.event_name !== "recording_failed" || !FAILED_RECORDING_STATUSES.has(durableStatus)) {
    return false;
  }
  return eventStatus === null || eventStatus === "unknown" || eventStatus === durableStatus;
}

export function buildProcessingReconciliation({ events = [], recordings = [] }) {
  const cohorts = Object.fromEntries(
    RECONCILIATION_COHORTS.map((cohort) => [cohort, emptyReconciliationCohort()]),
  );
  const recordingsById = new Map(
    recordings
      .filter((recording) => typeof recording?.id === "string" && recording.id)
      .map((recording) => [recording.id, recording]),
  );
  const eventsByRecording = new Map();
  const uploadEventsByRecording = new Map();
  let legacyOutcomeEvents = 0;
  let finalRecordingsWithoutV2UploadMarker = 0;
  let duplicateEventExcess = 0;

  const add = (cohort, population) => {
    cohorts[cohort][population] += 1;
  };

  for (const event of events) {
    if (
      event.schema_version === 2 && event.event_name === "recording_uploaded" &&
      typeof event.recording_id === "string" && event.recording_id
    ) {
      const existing = uploadEventsByRecording.get(event.recording_id) ?? [];
      existing.push(event);
      uploadEventsByRecording.set(event.recording_id, existing);
    }
    if (!OUTCOME_EVENT_NAMES.has(event.event_name)) continue;
    if (event.schema_version !== 2) {
      legacyOutcomeEvents += 1;
      continue;
    }
    if (typeof event.recording_id !== "string" || !event.recording_id) {
      add(eventCohort(event), "event_only");
      continue;
    }
    const existing = eventsByRecording.get(event.recording_id) ?? [];
    existing.push(event);
    eventsByRecording.set(event.recording_id, existing);
  }

  for (const [recordingId, outcomeEvents] of eventsByRecording) {
    const cohort = eventGroupCohort(outcomeEvents);
    if (outcomeEvents.length > 1) {
      add(cohort, "duplicate");
      duplicateEventExcess += outcomeEvents.length - 1;
      continue;
    }
    const durable = recordingsById.get(recordingId);
    if (!durable) {
      add(cohort, "event_only");
    } else if (isStateConsistent(outcomeEvents[0], durable)) {
      add(cohort, "matched");
    } else {
      add(cohort, "state_mismatch");
    }
  }

  for (const durable of recordingsById.values()) {
    if (!FINAL_RECORDING_STATUSES.has(durable.processing_status) || eventsByRecording.has(durable.id)) {
      continue;
    }
    const uploadMarkers = uploadEventsByRecording.get(durable.id);
    if (!uploadMarkers?.length) {
      finalRecordingsWithoutV2UploadMarker += 1;
      continue;
    }
    const cohort = eventGroupCohort(uploadMarkers);
    add(cohort, "durable_only");
  }

  const finalizedCohorts = Object.fromEntries(RECONCILIATION_COHORTS.map((cohort) => {
    const values = cohorts[cohort];
    const total = Object.values(values).reduce((sum, value) => sum + value, 0);
    return [cohort, {
      ...values,
      total,
      correctly_reconciled_rate: round(percentage(values.matched, total)),
    }];
  }));
  const populations = {
    matched: 0,
    event_only: 0,
    durable_only: 0,
    state_mismatch: 0,
    duplicate: 0,
    total: 0,
  };
  for (const cohort of Object.values(finalizedCohorts)) {
    for (const population of ["matched", "event_only", "durable_only", "state_mismatch", "duplicate"]) {
      populations[population] += cohort[population];
    }
    populations.total += cohort.total;
  }

  return {
    basis: "schema_v2_recording_reference_and_upload_marker_only",
    populations,
    correctly_reconciled_rate: round(percentage(populations.matched, populations.total)),
    duplicate_event_excess: duplicateEventExcess,
    cohorts: finalizedCohorts,
    legacy_unattributed: {
      outcome_events: legacyOutcomeEvents,
      final_recordings_without_v2_upload_marker: finalRecordingsWithoutV2UploadMarker,
    },
    public_baseline: {
      eligible_outcomes: finalizedCohorts.external_app_store.matched,
      rule: "external non-internal app_store schema-v2 matched outcomes only",
    },
  };
}

export function buildDashboardReconciliationRows(reconciliation) {
  if (!reconciliation?.cohorts || typeof reconciliation.cohorts !== "object") return [];
  const labels = {
    debug: "Debug",
    internal_dogfood: "Internal dogfood",
    external_testflight: "External TestFlight",
    external_app_store: "External App Store",
    unknown: "Unknown",
  };
  return RECONCILIATION_COHORTS.map((cohort) => {
    const values = reconciliation.cohorts?.[cohort] ?? {};
    const count = (key) => Number.isFinite(values[key]) ? values[key] : 0;
    return {
      cohort: labels[cohort],
      matched: count("matched"),
      event_only: count("event_only"),
      durable_only: count("durable_only"),
      state_mismatch: count("state_mismatch"),
      duplicate: count("duplicate"),
      total: count("total"),
      correct_rate: Number.isFinite(values.correctly_reconciled_rate)
        ? values.correctly_reconciled_rate
        : null,
    };
  });
}

export function dashboardKpiDecisionStatus(ready, evidenceScope) {
  if (evidenceScope !== "post_cutover_matched") {
    return "Mixed coverage";
  }
  return ready ? "Interpretable" : "Collecting baseline";
}

export function buildDashboardReconciliationSummary(reconciliation) {
  const matched = reconciliation?.populations?.matched;
  const total = reconciliation?.populations?.total;
  if (!Number.isFinite(matched) || !Number.isFinite(total)) {
    return {
      available: false,
      rate: null,
      matched: null,
      total: null,
      current: "not yet generated",
      status: "Unavailable",
    };
  }
  const rate = total > 0
    ? (Number.isFinite(reconciliation.correctly_reconciled_rate)
      ? reconciliation.correctly_reconciled_rate
      : round(matched / total))
    : null;
  return {
    available: true,
    rate,
    matched,
    total,
    current: rate === null
      ? "collecting baseline (0 outcomes)"
      : `${matched}/${total} (${Math.round(rate * 100)}%)`,
    status: total > 0 ? "Post-cutover baseline" : "Collecting baseline",
  };
}

export function hasMeasurementAttributionContract(canonical = {}) {
  return canonical.report_schema_version === REPORT_SCHEMA_VERSION &&
    canonical.query_contract === REPORT_QUERY_CONTRACT;
}

export function buildDashboardCanonicalSource(canonical = {}) {
  const source = {
    id: "canonical",
    label: "Canonical Supabase product-learning report",
    path: ".throughline/product-learning/latest.json",
  };
  const isCurrentContract = hasMeasurementAttributionContract(canonical);

  if (!isCurrentContract) {
    return {
      ...source,
      query: {
        engine: "Local compatibility projection (not executed)",
        language: "sql",
        sql: "select cast(null as text) as unavailable where false; -- SQL-equivalent compatibility signature only; no query was executed",
        executed: false,
        implementation: "Non-executed SQL-equivalent compatibility projection required by the portable dashboard source schema.",
        description: "The query contract was not embedded in this legacy report, so no Task 5 query is attributed to it; the SQL-equivalent signature documents the empty compatibility projection and was not executed.",
        filters: ["Legacy mixed coverage", "No Task 5 reconciliation interpretation"],
        metric_definitions: ["Legacy aggregate values remain descriptive only; missing Task 5 fields are unavailable, not zero."],
      },
    };
  }

  return {
    ...source,
    query: {
      engine: "Supabase PostgREST plus local privacy-safe aggregate transform",
      language: "sql",
      sql: [
        "-- SQL-equivalent signatures for the PostgREST requests below; the event-to-durable join runs only in private local process memory.",
        "select event_name, auth_user_id, session_id, occurred_at, schema_version, distribution_channel, is_internal_user, recording_id, properties->>'surface' as surface, properties->>'processing_status' as processing_status, properties->>'mode' as mode, properties->>'account_state' as account_state, properties->>'state' as state from public.throughline_product_events where occurred_at >= :window_start order by occurred_at, id;",
        "select id, processing_status from public.throughline_recordings where created_at >= :window_start order by created_at, id;",
        "select id, processing_status from public.throughline_recordings where id in (:linked_recording_id_chunk) order by created_at, id;",
        "select source, category, contact_allowed, status from public.throughline_product_feedback where created_at >= :window_start order by created_at desc, id desc;",
        "select answers->'quality_score' as quality_score, answers->'issue_types' as issue_types, answers->'agent_ready' as agent_ready from public.throughline_feedback where created_at >= :window_start order by created_at desc, id desc;",
      ].join("\n"),
      description: "Restricted REST projections feed aggregate product metrics plus a private in-memory event-to-durable reconciliation; row-level join fields are never serialized into report data.",
      executed_at: canonical.generated_at,
      filters: ["Demo promotion excluded from first real activation", "Aggregate output only", "Trailing 7-day reliability window", "Schema-v2 references only; no legacy heuristic join"],
      tables_used: ["throughline_product_events", "throughline_recordings", "throughline_product_feedback", "throughline_feedback"],
      metric_definitions: [
        "24-hour activation = signed-in users with a first non-demo home recording_processed within 24 hours / users with auth_succeeded.",
        "Days 2-7 retention = mature activated users with another recording_processed event 48 hours to 7 days after first activation / mature activated users.",
        "Recording success rate = 1 - recording_failed / (recording_failed + recording_processed).",
        "Correct reconciliation rate = matched state-consistent schema-v2 outcomes / matched, event-only, durable-only, mismatch, and duplicate outcomes.",
      ],
    },
  };
}

export function buildWeeklySnapshot({
  events = [],
  recordings = [],
  productFeedback = [],
  extractionFeedback = [],
  reportAt = new Date(),
}) {
  const now = asDate(reportAt) ?? new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * DAY_MS);
  const normalizedEvents = events
    .map((event) => ({ ...event, date: asDate(event.occurred_at) }))
    .filter((event) => event.date)
    .sort((left, right) => left.date - right.date);

  const eventCounts = Object.fromEntries(
    [...new Set(normalizedEvents.map((event) => event.event_name))]
      .sort()
      .map((eventName) => [
        eventName,
        normalizedEvents.filter((event) => event.event_name === eventName).length,
      ]),
  );
  const signedInEvents = normalizedEvents.filter((event) => event.auth_user_id);
  const signedInUsers = unique(signedInEvents.map((event) => event.auth_user_id));
  const sessions = unique(normalizedEvents.map((event) => event.session_id));

  const eventsByUser = new Map();
  for (const event of signedInEvents) {
    const existing = eventsByUser.get(event.auth_user_id) ?? [];
    existing.push(event);
    eventsByUser.set(event.auth_user_id, existing);
  }

  const eventsBySession = new Map();
  for (const event of normalizedEvents) {
    const existing = eventsBySession.get(event.session_id) ?? [];
    existing.push(event);
    eventsBySession.set(event.session_id, existing);
  }

  let activationDenominator = 0;
  let activationNumerator = 0;
  const activationByOnboardingPath = {
    demo_then_auth: { numerator: 0, denominator: 0 },
    auth_without_demo: { numerator: 0, denominator: 0 },
  };
  const authSucceededByMode = {};
  const authSucceededByAccountState = {};
  for (const userEvents of eventsByUser.values()) {
    const auth = firstEvent(userEvents, "auth_succeeded");
    if (!auth || auth.date < twentyEightDaysAgo || auth.date > now) continue;
    activationDenominator += 1;
    const sessionEvents = eventsBySession.get(auth.session_id) ?? [];
    const completedDemoBeforeAuth = sessionEvents.some(
      (event) => event.event_name === "demo_recording_completed" && event.date <= auth.date,
    );
    const onboardingPath = completedDemoBeforeAuth ? "demo_then_auth" : "auth_without_demo";
    activationByOnboardingPath[onboardingPath].denominator += 1;
    const authMode = safeCategory(eventProperty(auth, "mode"), AUTH_MODES);
    authSucceededByMode[authMode] = (authSucceededByMode[authMode] ?? 0) + 1;
    const accountState = safeCategory(eventProperty(auth, "account_state"), ACCOUNT_STATES);
    authSucceededByAccountState[accountState] =
      (authSucceededByAccountState[accountState] ?? 0) + 1;
    const processed = userEvents.find(
      (event) => isFirstRealRecording(event) &&
        event.date >= auth.date && event.date - auth.date <= DAY_MS,
    );
    if (processed) {
      activationNumerator += 1;
      activationByOnboardingPath[onboardingPath].numerator += 1;
    }
  }

  const weeklyActivatedUsers = unique(
    signedInEvents
      .filter((event) => isFirstRealRecording(event) && event.date >= sevenDaysAgo)
      .map((event) => event.auth_user_id),
  ).size;

  let retentionDenominator = 0;
  let retentionNumerator = 0;
  for (const userEvents of eventsByUser.values()) {
    const activations = userEvents.filter(isFirstRealRecording);
    if (!activations.length || now - activations[0].date < 7 * DAY_MS) continue;
    retentionDenominator += 1;
    if (activations.some((event) => {
      const age = event.date - activations[0].date;
      return age >= 2 * DAY_MS && age <= 7 * DAY_MS;
    })) retentionNumerator += 1;
  }

  const recentOutcomes = normalizedEvents.filter(
    (event) => event.date >= sevenDaysAgo &&
      (event.event_name === "recording_processed" || event.event_name === "recording_failed"),
  );
  const failedOutcomes = recentOutcomes.filter((event) => event.event_name === "recording_failed").length;

  const funnel = FUNNEL.map((eventName) => {
    const matching = normalizedEvents.filter((event) => event.event_name === eventName);
    const entityCount = eventName === "first_opened" || eventName.startsWith("onboarding_") ||
        eventName.startsWith("demo_")
      ? unique(matching.map((event) => event.session_id)).size
      : unique(matching.map((event) => event.auth_user_id)).size;
    return { event: eventName, entities: entityCount, events: matching.length };
  });
  const homeViewedByState = {};
  for (const state of ["empty", "populated"]) {
    const viewers = normalizedEvents.filter(
      (event) => event.event_name === "home_viewed" && eventProperty(event, "state") === state,
    );
    homeViewedByState[state] = unique(
      viewers.map((event) => event.auth_user_id ?? event.session_id),
    ).size;
  }

  const extractionAnswers = extractionFeedback
    .map((row) => row.feedback?.answers ?? row.answers ?? (
      Object.hasOwn(row, "quality_score") || Object.hasOwn(row, "issue_types") ||
        Object.hasOwn(row, "agent_ready")
        ? row
        : null
    ))
    .filter(Boolean);
  const qualityScores = extractionAnswers
    .map((answers) => Number(answers.quality_score))
    .filter((score) => Number.isFinite(score));
  const issueTypes = {};
  for (const answers of extractionAnswers) {
    for (const issue of Array.isArray(answers.issue_types) ? answers.issue_types : []) {
      const safeIssue = safeCategory(issue, EXTRACTION_ISSUE_TYPES);
      issueTypes[safeIssue] = (issueTypes[safeIssue] ?? 0) + 1;
    }
  }

  const productFeedbackAggregate = {
    total: productFeedback.length,
    by_category: countByAllowed(productFeedback, "category", PRODUCT_FEEDBACK_CATEGORIES),
    by_source: countByAllowed(productFeedback, "source", PRODUCT_FEEDBACK_SOURCES),
    by_status: countByAllowed(productFeedback, "status", PRODUCT_FEEDBACK_STATUSES),
    contact_allowed: productFeedback.filter((feedback) => feedback.contact_allowed === true).length,
  };
  const processingReconciliation = buildProcessingReconciliation({
    events: normalizedEvents,
    recordings,
  });

  const observedFunnelEvents = FUNNEL.filter((eventName) => eventCounts[eventName]).length;
  const activationReady = activationDenominator >= 5;
  const retentionReady = retentionDenominator >= 5;
  const recommendations = [];
  if (!signedInUsers.size) {
    recommendations.push("Verify the first real signed-in production journey before diagnosing activation.");
  } else if (!activationReady) {
    recommendations.push("Collect at least five newly signed-in users before treating activation movement as directional.");
  }
  if (!productFeedback.length) {
    recommendations.push("Keep the existing feedback entry point visible; do not add a more aggressive prompt until real usage grows.");
  }
  if (observedFunnelEvents < FUNNEL.length) {
    recommendations.push("Monitor missing funnel events as coverage gaps, not user drop-off, until signed-in traffic reaches them.");
  }

  return {
    report_schema_version: REPORT_SCHEMA_VERSION,
    query_contract: REPORT_QUERY_CONTRACT,
    generated_at: now.toISOString(),
    data_readiness: {
      status: activationReady ? "directional" : "collecting_baseline",
      instrumented_events: normalizedEvents.length,
      sessions: sessions.size,
      signed_in_users: signedInUsers.size,
      observed_funnel_events: observedFunnelEvents,
      expected_funnel_events: FUNNEL.length,
      activation_ready: activationReady,
      retention_ready: retentionReady,
      product_kpi_scope: "mixed_operational_coverage_not_public_baseline",
      august_17_snapshot: "mixed_legacy_non_decision_grade",
      honest_processing_baseline: "post_cutover_schema_v2_only",
    },
    kpis: {
      activation_24h: {
        numerator: activationNumerator,
        denominator: activationDenominator,
        rate: round(percentage(activationNumerator, activationDenominator)),
        definition: "first recording_processed with surface=home within 24 hours of auth_succeeded",
      },
      activation_24h_by_onboarding_path: Object.fromEntries(
        Object.entries(activationByOnboardingPath).map(([path, value]) => [
          path,
          pathRate(value.numerator, value.denominator),
        ]),
      ),
      auth_succeeded_by_mode: authSucceededByMode,
      auth_succeeded_by_account_state: authSucceededByAccountState,
      weekly_activated_users: weeklyActivatedUsers,
      retention_days_2_7: {
        numerator: retentionNumerator,
        denominator: retentionDenominator,
        rate: round(percentage(retentionNumerator, retentionDenominator)),
      },
    },
    drivers: {
      funnel,
      event_counts: eventCounts,
      home_viewed_by_state: homeViewedByState,
      new_product_feedback: productFeedbackAggregate.by_status.new ?? 0,
      product_feedback: productFeedbackAggregate,
    },
    guardrails: {
      recording_failure_rate_7d: {
        failed: failedOutcomes,
        outcomes: recentOutcomes.length,
        rate: round(percentage(failedOutcomes, recentOutcomes.length)),
      },
      extraction_quality: {
        responses: qualityScores.length,
        average_score: qualityScores.length
          ? round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length, 2)
          : null,
        scores_two_or_lower: qualityScores.filter((score) => score <= 2).length,
        agent_not_ready: extractionAnswers.filter((answers) => answers.agent_ready === false).length,
        issue_types: issueTypes,
      },
    },
    processing_reconciliation: processingReconciliation,
    recommendations,
  };
}

export function renderMarkdown(snapshot) {
  const activation = snapshot.kpis.activation_24h;
  const demoActivation = snapshot.kpis.activation_24h_by_onboarding_path.demo_then_auth;
  const directActivation = snapshot.kpis.activation_24h_by_onboarding_path.auth_without_demo;
  const retention = snapshot.kpis.retention_days_2_7;
  const failure = snapshot.guardrails.recording_failure_rate_7d;
  const quality = snapshot.guardrails.extraction_quality;
  const reconciliation = snapshot.processing_reconciliation;
  const productFeedback = snapshot.drivers.product_feedback;
  const lines = [
    "# Throughline weekly product evidence",
    "",
    `Generated: ${snapshot.generated_at}`,
    "",
    "## Decision status",
    "",
    `**${snapshot.data_readiness.status.replaceAll("_", " ")}** — ${formatCount(snapshot.data_readiness.instrumented_events)} events, ${formatCount(snapshot.data_readiness.sessions)} sessions, and ${formatCount(snapshot.data_readiness.signed_in_users)} signed-in users are represented.`,
    "",
    "## Primary KPIs",
    "",
    `- 24-hour first real recording activation: ${formatRate(activation.rate)} (${activation.numerator}/${activation.denominator}); promoted demo notes are excluded`,
    `- Demo → auth → first real recording: ${formatRate(demoActivation.rate)} (${demoActivation.numerator}/${demoActivation.denominator})`,
    `- Auth without demo → first real recording: ${formatRate(directActivation.rate)} (${directActivation.numerator}/${directActivation.denominator})`,
    `- Authenticated users by entry mode: ${Object.keys(snapshot.kpis.auth_succeeded_by_mode).length ? JSON.stringify(snapshot.kpis.auth_succeeded_by_mode) : "collecting baseline"}`,
    `- Authenticated users by account state: ${Object.keys(snapshot.kpis.auth_succeeded_by_account_state).length ? JSON.stringify(snapshot.kpis.auth_succeeded_by_account_state) : "collecting baseline"}`,
    `- Home viewers by state: ${JSON.stringify(snapshot.drivers.home_viewed_by_state)}`,
    `- Weekly activated users: ${formatCount(snapshot.kpis.weekly_activated_users)}`,
    `- Days 2–7 activated retention: ${formatRate(retention.rate)} (${retention.numerator}/${retention.denominator})`,
    `- Scope: mixed operational coverage, not a public-product baseline; the August 17 snapshot remains mixed and legacy`,
    "",
    "## Funnel coverage",
    "",
    "| Step | Unique entities | Events |",
    "| --- | ---: | ---: |",
    ...snapshot.drivers.funnel.map((step) => `| \`${step.event}\` | ${step.entities} | ${step.events} |`),
    "",
    "## Processing reconciliation",
    "",
    `Post-cutover schema-v2 outcomes only; legacy rows are never joined heuristically. Correctly reconciled: ${formatRate(reconciliation.correctly_reconciled_rate)} (${reconciliation.populations.matched}/${reconciliation.populations.total}).`,
    "",
    "| Cohort | Matched | Event only | Durable only | State mismatch | Duplicate | Total | Correct rate |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...RECONCILIATION_COHORTS.map((cohort) => {
      const values = reconciliation.cohorts[cohort];
      return `| ${cohort.replaceAll("_", " ")} | ${values.matched} | ${values.event_only} | ${values.durable_only} | ${values.state_mismatch} | ${values.duplicate} | ${values.total} | ${formatRate(values.correctly_reconciled_rate)} |`;
    }),
    "",
    `- Legacy v1 unattributed outcome rows: ${formatCount(reconciliation.legacy_unattributed.outcome_events)}`,
    `- Final durable recordings without a schema-v2 upload marker: ${formatCount(reconciliation.legacy_unattributed.final_recordings_without_v2_upload_marker)}`,
    `- Public-baseline eligible outcomes: ${formatCount(reconciliation.public_baseline.eligible_outcomes)} (external, confirmed non-internal, App Store, schema v2, and matched only)`,
    "",
    "## Guardrails",
    "",
    `- Recording failure rate, trailing 7 days: ${formatRate(failure.rate)} (${failure.failed}/${failure.outcomes})`,
    `- Extraction quality responses: ${quality.responses}; average: ${quality.average_score ?? "not available"}; scores ≤2: ${quality.scores_two_or_lower}; agent-not-ready: ${quality.agent_not_ready}`,
    `- Extraction issue types: ${Object.keys(quality.issue_types).length ? JSON.stringify(quality.issue_types) : "none reported"}`,
    "",
    "## Product feedback intake",
    "",
    `- Aggregate submissions: ${formatCount(productFeedback.total)}; new: ${formatCount(productFeedback.by_status.new ?? 0)}; contact allowed: ${formatCount(productFeedback.contact_allowed)}`,
    `- By category: ${Object.keys(productFeedback.by_category).length ? JSON.stringify(productFeedback.by_category) : "none reported"}`,
    `- By source: ${Object.keys(productFeedback.by_source).length ? JSON.stringify(productFeedback.by_source) : "none reported"}`,
  ];
  lines.push("", "## Recommended next actions", "");
  for (const recommendation of snapshot.recommendations) lines.push(`- ${recommendation}`);
  return `${lines.join("\n")}\n`;
}

async function fetchReconciliationRecordings(events, earliest, config) {
  const select = "id,processing_status";
  const windowRows = await fetchRows("throughline_recordings", {
    select,
    created_at: `gte.${earliest}`,
    order: "created_at.asc,id.asc",
  }, config);
  const byId = new Map(windowRows.map((row) => [row.id, row]));
  const missingIds = [...new Set(events
    .filter((event) => event.schema_version === 2 && RECONCILIATION_EVENT_NAMES.has(event.event_name))
    .map((event) => event.recording_id)
    .filter((id) => typeof id === "string" && id && !byId.has(id)))];

  for (let index = 0; index < missingIds.length; index += 25) {
    const ids = missingIds.slice(index, index + 25);
    const linkedRows = await fetchRows("throughline_recordings", {
      select,
      id: `in.(${ids.join(",")})`,
      order: "created_at.asc,id.asc",
    }, config);
    for (const row of linkedRows) byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const reportAt = new Date();
  const earliest = new Date(reportAt.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS).toISOString();
  const config = {
    url: requiredEnv("SUPABASE_URL").replace(/\/$/, ""),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
  const [events, productFeedback, extractionFeedback] = await Promise.all([
    fetchRows("throughline_product_events", {
      select: [
        "event_name",
        "auth_user_id",
        "session_id",
        "occurred_at",
        "schema_version",
        "distribution_channel",
        "is_internal_user",
        "recording_id",
        "surface:properties->>surface",
        "processing_status:properties->>processing_status",
        "mode:properties->>mode",
        "account_state:properties->>account_state",
        "state:properties->>state",
      ].join(","),
      occurred_at: `gte.${earliest}`,
      order: "occurred_at.asc,id.asc",
    }, config),
    fetchRows("throughline_product_feedback", {
      select: "source,category,contact_allowed,status",
      created_at: `gte.${earliest}`,
      order: "created_at.desc,id.desc",
    }, config),
    fetchRows("throughline_feedback", {
      select: "quality_score:answers->quality_score,issue_types:answers->issue_types,agent_ready:answers->agent_ready",
      created_at: `gte.${earliest}`,
      order: "created_at.desc,id.desc",
    }, config),
  ]);
  const recordings = await fetchReconciliationRecordings(events, earliest, config);
  const snapshot = buildWeeklySnapshot({
    events,
    recordings,
    productFeedback,
    extractionFeedback,
    reportAt,
  });
  const markdown = renderMarkdown(snapshot);
  if (args.stdout) process.stdout.write(markdown);
  const outputDir = path.resolve(args.outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  const date = reportAt.toISOString().slice(0, 10);
  await Promise.all([
    fs.writeFile(path.join(outputDir, `${date}.md`), markdown),
    fs.writeFile(path.join(outputDir, `${date}.json`), `${JSON.stringify(snapshot, null, 2)}\n`),
    fs.writeFile(path.join(outputDir, "latest.md"), markdown),
    fs.writeFile(path.join(outputDir, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`),
  ]);
  if (!args.stdout) {
    process.stdout.write(`Wrote private product-learning report to ${path.join(outputDir, "latest.md")}\n`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
