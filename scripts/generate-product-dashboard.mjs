import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildDashboardCanonicalSource,
  buildDashboardReconciliationRows,
  buildDashboardReconciliationSummary,
  dashboardKpiDecisionStatus,
  hasMeasurementAttributionContract,
} from "./product-learning-report.mjs";

const root = resolve(import.meta.dirname, "..");
const canonicalPath = join(root, ".throughline", "product-learning", "latest.json");
const externalPath = join(root, "product", "dashboard", "external-snapshot.json");
const outputDir = join(root, ".throughline", "dashboard");
const artifactPath = join(outputDir, "artifact.json");
const outputPath = join(outputDir, "index.html");

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Required dashboard source is missing: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function percent(value) {
  return Number.isFinite(value) ? value : 0;
}

function findPortableBuilder() {
  const base = join(homedir(), ".codex", "plugins", "cache", "openai-curated-remote", "data-analytics");
  const versions = readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const version of versions) {
    const candidate = join(base, version, "skills", "build-report", "scripts", "deliver_portable_artifact.mjs");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("The Data Analytics portable dashboard builder is not installed.");
}

const canonical = readJson(canonicalPath);
const external = readJson(externalPath);
const funnel = canonical.drivers?.funnel ?? [];
const activation = canonical.kpis?.activation_24h ?? {};
const retention = canonical.kpis?.retention_days_2_7 ?? {};
const failure = canonical.guardrails?.recording_failure_rate_7d ?? {};
const quality = canonical.guardrails?.extraction_quality ?? {};
const reconciliation = hasMeasurementAttributionContract(canonical)
  ? canonical.processing_reconciliation
  : undefined;
const legacyReconciliation = reconciliation?.legacy_unattributed;
const reconciliationRows = buildDashboardReconciliationRows(reconciliation);
const reconciliationSummary = buildDashboardReconciliationSummary(reconciliation);
const apple = external.apple;
const canaries = external.canaries;

const signedInUsers = canonical.data_readiness?.signed_in_users ?? 0;
const matureActivatedUsers = retention.denominator ?? 0;
const activationFloor = 5;
const retentionFloor = 5;
const recordingSuccessRate = failure.outcomes > 0 ? 1 - percent(failure.rate) : 0;
const canaryPassCount = Number(Boolean(canaries.auth?.passed)) + Number(Boolean(canaries.recording?.passed));
const overallStatus = canaryPassCount === 2 ? "HEALTHY · COLLECTING BASELINE" : "RELIABILITY INCIDENT";

const sources = [
  buildDashboardCanonicalSource(canonical),
  {
    id: "apple",
    label: "App Store Connect aggregate analytics",
    path: "product/dashboard/external-snapshot.json",
    query: {
      engine: "PostgreSQL-compatible reviewed snapshot",
      language: "sql",
      sql: `select * from (values ('${apple.latest_day.date}', ${apple.latest_day.first_time_downloads}, ${apple.latest_day.impressions}, ${apple.latest_day.product_page_views}, ${apple.latest_day.official_conversion_rate}), ('${apple.prior_day.date}', ${apple.prior_day.first_time_downloads}, ${apple.prior_day.impressions}, ${apple.prior_day.product_page_views}, ${apple.prior_day.official_conversion_rate})) as app_store_connect_snapshot(date, first_time_downloads, impressions, product_page_views, official_conversion_rate);`,
      description: "Latest verified acquisition metrics; Apple data can lag and uses UTC days.",
      executed_at: external.generated_at,
      filters: [`Latest complete Apple day: ${apple.freshness_cutoff_utc} UTC`],
      metric_definitions: ["Official conversion rate is App Store Connect's reported metric and is not recomputed from unmatched aggregates."]
    }
  },
  {
    id: "canaries",
    label: "Production auth and recording canaries",
    path: "product/dashboard/external-snapshot.json",
    query: {
      engine: "PostgreSQL-compatible reviewed snapshot",
      language: "sql",
      sql: `select * from (values ('auth', ${Boolean(canaries.auth?.passed)}, ${canaries.auth?.checks_passed ?? 0}, ${canaries.auth?.checks_total ?? 0}), ('recording', ${Boolean(canaries.recording?.passed)}, 1, 1)) as production_canaries(canary, passed, checks_passed, checks_total);`,
      description: "Boolean production checks with counts and warning names only.",
      executed_at: canaries.checked_at,
      filters: ["No authorization URLs, keys, recordings, transcripts, or extracted note text"],
      metric_definitions: ["Healthy means both auth and voice-extraction canaries passed their current production checks."]
    }
  },
  {
    id: "dashboard_model",
    label: "Throughline dashboard metric model",
    path: "scripts/generate-product-dashboard.mjs",
    query: {
      engine: "PostgreSQL-compatible reviewed snapshot",
      language: "sql",
      sql: `select * from (values ('24-hour activation', '${activation.numerator ?? 0}/${activation.denominator ?? 0}', 'collecting baseline'), ('Days 2-7 retention', '${retention.numerator ?? 0}/${retention.denominator ?? 0}', 'collecting baseline'), ('Recording reliability', '${failure.outcomes ?? 0} outcomes', 'healthy')) as dashboard_readiness(metric, current_value, decision_status);`,
      description: "Combines reviewed aggregate sources and applies readiness floors from product/metrics.md.",
      executed_at: new Date().toISOString(),
      filters: ["Activation interpretation floor: 5 signed-in users", "Retention interpretation floor: 5 mature activated users", "Decision-grade floor: 20 for both"],
      tables_used: [".throughline/product-learning/latest.json", "product/dashboard/external-snapshot.json", "product/metrics.md"]
    }
  }
];

const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: "ready",
  datasets: {
    objective: [{
      overall_status: overallStatus,
      signed_in_users: signedInUsers,
      activation_floor: activationFloor,
      activation_rate: percent(activation.rate),
      activated_users: activation.numerator ?? 0,
      weekly_activated_users: canonical.kpis?.weekly_activated_users ?? 0,
      mature_activated_users: matureActivatedUsers,
      retention_floor: retentionFloor,
      retention_rate: percent(retention.rate),
      recording_success_rate: recordingSuccessRate,
      recording_outcomes: failure.outcomes ?? 0,
      reconciliation_rate: reconciliationSummary.rate,
      reconciled_outcomes: reconciliationSummary.matched,
      reconciliation_outcomes: reconciliationSummary.total,
      public_baseline_eligible_outcomes: reconciliationSummary.available
        ? reconciliation?.public_baseline?.eligible_outcomes ?? 0
        : null,
      canaries_passed: canaryPassCount,
      canaries_total: 2
    }],
    acquisition: [{
      cumulative_downloads: apple.cumulative.first_time_downloads,
      cumulative_impressions: apple.cumulative.impressions,
      cumulative_page_views: apple.cumulative.product_page_views,
      cumulative_conversion: apple.cumulative.official_conversion_rate,
      latest_downloads: apple.latest_day.first_time_downloads,
      prior_downloads: apple.prior_day.first_time_downloads,
      latest_impressions: apple.latest_day.impressions,
      prior_impressions: apple.prior_day.impressions
    }],
    funnel: funnel.map((row, index) => ({
      order: index + 1,
      stage: row.event.replaceAll("_", " "),
      entities: row.entities,
      events: row.events
    })),
    processing_reconciliation: reconciliationRows,
    acquisition_days: [apple.prior_day, apple.latest_day].map((row) => ({
      date: row.date,
      first_time_downloads: row.first_time_downloads,
      impressions: row.impressions,
      product_page_views: row.product_page_views,
      official_conversion_rate: row.official_conversion_rate
    })),
    operating_health: [
      {
        metric: "Production auth",
        current: canaries.auth.passed ? `${canaries.auth.checks_passed}/${canaries.auth.checks_total} checks passed` : "Failed",
        target_or_floor: "All checks pass",
        decision_status: canaries.auth.passed ? "Healthy" : "Incident",
        freshness: canaries.checked_at
      },
      {
        metric: "Voice extraction",
        current: canaries.recording.passed ? "Pipeline passed" : "Failed",
        target_or_floor: "Canary passes",
        decision_status: canaries.recording.passed ? "Healthy" : "Incident",
        freshness: canaries.checked_at
      },
      {
        metric: "24-hour activation",
        current: `${activation.numerator ?? 0}/${activation.denominator ?? 0} (${Math.round(percent(activation.rate) * 100)}%)`,
        target_or_floor: "5 users to interpret; 20 decision-grade",
        decision_status: dashboardKpiDecisionStatus(
          canonical.data_readiness?.activation_ready,
          canonical.data_readiness?.product_kpi_scope,
        ),
        freshness: canonical.generated_at
      },
      {
        metric: "Days 2-7 retention",
        current: `${retention.numerator ?? 0}/${retention.denominator ?? 0}`,
        target_or_floor: "5 mature users to interpret; 20 decision-grade",
        decision_status: dashboardKpiDecisionStatus(
          canonical.data_readiness?.retention_ready,
          canonical.data_readiness?.product_kpi_scope,
        ),
        freshness: canonical.generated_at
      },
      {
        metric: "Processing reconciliation",
        current: reconciliationSummary.current,
        target_or_floor: "Controlled canaries must reach 100%",
        decision_status: reconciliationSummary.status,
        freshness: canonical.generated_at
      },
      {
        metric: "Legacy / unattributed processing coverage",
        current: reconciliationSummary.available
          ? `${legacyReconciliation?.outcome_events ?? 0} outcome events; ${legacyReconciliation?.final_recordings_without_v2_upload_marker ?? 0} final recordings`
          : "not yet generated",
        target_or_floor: "Excluded from post-cutover denominator",
        decision_status: reconciliationSummary.available ? "Coverage only" : "Unavailable",
        freshness: canonical.generated_at
      },
      {
        metric: "Extraction quality",
        current: `${quality.average_score ?? 0}/5 from ${quality.responses ?? 0} responses`,
        target_or_floor: "Directional only while sample is small",
        decision_status: (quality.responses ?? 0) > 0 ? "Early signal" : "Unavailable",
        freshness: canonical.generated_at
      },
      {
        metric: "App Store acquisition",
        current: `${apple.cumulative.first_time_downloads} downloads`,
        target_or_floor: "Traffic input; no target set",
        decision_status: "Descriptive",
        freshness: `${apple.freshness_cutoff_utc} UTC`
      }
    ]
  }
};

const manifest = {
  version: 1,
  surface: "dashboard",
  title: "Throughline founder dashboard",
  description: "OKR-style product health and growth readiness at a glance.",
  generatedAt: snapshot.generatedAt,
  sources,
  cards: [
    {
      id: "activation_evidence",
      dataset: "objective",
      sourceId: "canonical",
      description: "Newly signed-in users observed in mixed operational coverage; cohort and reconciliation gates must pass before interpretation.",
      metrics: [
        { label: "Signed-in users", field: "signed_in_users", format: "number" },
        { label: "Interpretation floor", field: "activation_floor", format: "number" }
      ]
    },
    {
      id: "activation_rate",
      dataset: "objective",
      sourceId: "canonical",
      description: "First non-demo home recording processed within 24 hours of sign-in.",
      metrics: [
        { label: "Operational activation (mixed)", field: "activation_rate", format: "percent" },
        { label: "Activated users", field: "activated_users", format: "number" }
      ]
    },
    {
      id: "retention_evidence",
      dataset: "objective",
      sourceId: "canonical",
      description: "Mature activated users in mixed operational coverage; this is not a public retention baseline.",
      metrics: [
        { label: "Mature activated users", field: "mature_activated_users", format: "number" },
        { label: "Interpretation floor", field: "retention_floor", format: "number" }
      ]
    },
    {
      id: "reliability",
      dataset: "objective",
      sourceId: "canonical",
      description: "Successful recording outcomes in the trailing seven days.",
      metrics: [
        { label: "Recording success", field: "recording_success_rate", format: "percent" },
        { label: "Outcomes observed", field: "recording_outcomes", format: "number" }
      ]
    },
    {
      id: "reconciliation",
      dataset: "objective",
      sourceId: "canonical",
      description: "State-consistent schema-v2 processing outcomes matched to durable recordings; legacy rows are excluded.",
      metrics: [
        { label: "Correctly reconciled", field: "reconciliation_rate", format: "percent" },
        { label: "Matched outcomes", field: "reconciled_outcomes", format: "number" },
        { label: "Public-baseline eligible", field: "public_baseline_eligible_outcomes", format: "number" }
      ]
    },
    {
      id: "downloads",
      dataset: "acquisition",
      sourceId: "apple",
      description: "First-time downloads reported by App Store Connect through the latest complete UTC day.",
      metrics: [
        { label: "First-time downloads", field: "cumulative_downloads", format: "number" },
        { label: "Latest complete day", field: "latest_downloads", format: "number" },
        { label: "Prior day", field: "prior_downloads", format: "number" }
      ]
    },
    {
      id: "appstore_conversion",
      dataset: "acquisition",
      sourceId: "apple",
      description: "Official App Store Connect conversion rate; Apple data can lag.",
      metrics: [
        { label: "App Store conversion", field: "cumulative_conversion", format: "percent" },
        { label: "Product-page views", field: "cumulative_page_views", format: "number" },
        { label: "Impressions", field: "cumulative_impressions", format: "number" }
      ]
    }
  ],
  charts: [
    {
      id: "value_path",
      title: "Observed path to product value",
      subtitle: "Counts show observed entities at each instrumented stage; stages use different entity grains and are not a matched conversion funnel.",
      intent: "funnel",
      question: "Where is evidence accumulating across the path from app open to processed recording?",
      rationale: "A funnel view makes stage coverage and relative volume scannable while preserving the grain caveat.",
      type: "horizontalBar",
      dataset: "funnel",
      sourceId: "canonical",
      encodings: {
        x: { field: "stage", type: "ordinal", label: "Stage" },
        y: { field: "entities", type: "quantitative", label: "Observed entities", format: "number" },
        tooltip: [
          { field: "entities", type: "quantitative", label: "Entities", format: "number" },
          { field: "events", type: "quantitative", label: "Events", format: "number" }
        ]
      },
      valueFormat: "number",
      layout: "full",
      maxRows: 12
    }
  ],
  tables: [
    {
      id: "processing_reconciliation",
      title: "Post-cutover processing reconciliation by cohort",
      subtitle: "Five cohorts stay separate; legacy rows are excluded and never matched heuristically.",
      dataset: "processing_reconciliation",
      sourceId: "canonical",
      density: "compact",
      defaultSort: { field: "cohort", direction: "asc" },
      columns: [
        { field: "cohort", label: "Cohort", type: "text" },
        { field: "matched", label: "Matched", type: "number" },
        { field: "event_only", label: "Event only", type: "number" },
        { field: "durable_only", label: "Durable only", type: "number" },
        { field: "state_mismatch", label: "State mismatch", type: "number" },
        { field: "duplicate", label: "Duplicate", type: "number" },
        { field: "correct_rate", label: "Correct rate", type: "percent" }
      ]
    },
    {
      id: "operating_health",
      title: "KPI readiness and source health",
      subtitle: "A metric can be healthy but still not decision-grade.",
      dataset: "operating_health",
      sourceId: "dashboard_model",
      density: "spacious",
      defaultSort: { field: "metric", direction: "asc" },
      columns: [
        { field: "metric", label: "Metric", type: "text" },
        { field: "current", label: "Current", type: "text" },
        { field: "target_or_floor", label: "Target / readiness floor", type: "text" },
        { field: "decision_status", label: "Decision status", type: "text" },
        { field: "freshness", label: "Freshness", type: "text" }
      ]
    }
  ],
  blocks: [
    {
      id: "title",
      type: "markdown",
      body: `# Throughline founder dashboard\n\n**${overallStatus}** · Objective: prove that Throughline turns voice into reliable, repeated, agent-ready value.`
    },
    {
      id: "okr_heading",
      type: "markdown",
      body: "## Objective 1 · Establish repeatable product value\n\nActivation and retention remain mixed operational coverage, not a public baseline. The first honest processing baseline begins with post-cutover schema-v2 reconciliation."
    },
    {
      id: "okr_metrics",
      type: "metric-strip",
      cardIds: ["activation_evidence", "activation_rate", "retention_evidence", "reliability", "reconciliation"]
    },
    {
      id: "funnel_heading",
      type: "markdown",
      body: "## Product value path"
    },
    {
      id: "funnel",
      type: "chart",
      chartId: "value_path"
    },
    {
      id: "reconciliation_heading",
      type: "markdown",
      body: "## Processing evidence"
    },
    {
      id: "reconciliation_table",
      type: "table",
      tableId: "processing_reconciliation"
    },
    {
      id: "growth_heading",
      type: "markdown",
      body: `## Objective 2 · Build qualified traffic\n\nApple acquisition is current through ${apple.freshness_cutoff_utc} UTC. The screenshot PPO remains the conversion experiment; traffic is the binding growth constraint.`
    },
    {
      id: "growth_metrics",
      type: "metric-strip",
      cardIds: ["downloads", "appstore_conversion"]
    },
    {
      id: "health_heading",
      type: "markdown",
      body: "## Operating health"
    },
    {
      id: "health_table",
      type: "table",
      tableId: "operating_health"
    },
    {
      id: "action",
      type: "markdown",
      body: "## One operating action\n\nLaunch the dedicated Throughline X account with a tracked App Store campaign link and begin the first content cadence; keep the current screenshot PPO unchanged while traffic accumulates."
    },
    {
      id: "definitions",
      type: "markdown",
      body: "## Reading the dashboard\n\n**Healthy** describes current reliability. **Interpretable** begins at five eligible users. **Decision-grade** begins at 20. The August 17 snapshot remains mixed, legacy, and non-decision-grade. Only external, confirmed non-internal, App Store, schema-v2 matched outcomes enter the public-baseline population. All values are aggregate-only."
    }
  ]
};

const artifact = { surface: "dashboard", manifest, snapshot, sources };
mkdirSync(outputDir, { recursive: true });
cpSync(join(root, "product", "dashboard", "DESIGN.md"), join(outputDir, "DESIGN.md"));
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const builder = findPortableBuilder();
execFileSync(process.execPath, [builder, "--input", artifactPath, "--output", outputPath], {
  cwd: root,
  stdio: "inherit"
});

console.log(JSON.stringify({
  ok: true,
  output: ".throughline/dashboard/index.html",
  source_generated_at: canonical.generated_at,
  apple_cutoff_utc: apple.freshness_cutoff_utc,
  status: overallStatus
}, null, 2));
