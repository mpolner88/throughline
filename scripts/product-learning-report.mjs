import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const DEFAULT_WINDOW_DAYS = 35;
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

function redactFeedback(value) {
  return String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/https?:\/\/\S+/gi, "[url redacted]")
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

function unique(values) {
  return new Set(values.filter(Boolean));
}

function firstEvent(events, eventName) {
  return events.find((event) => event.event_name === eventName) ?? null;
}

function eventSurface(event) {
  return event.properties?.surface ?? null;
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

export function buildWeeklySnapshot({
  events,
  productFeedback,
  extractionFeedback,
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
    const authMode = auth.properties?.mode ?? "unknown";
    authSucceededByMode[authMode] = (authSucceededByMode[authMode] ?? 0) + 1;
    const accountState = auth.properties?.account_state ?? "unknown";
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
      (event) => event.event_name === "home_viewed" && event.properties?.state === state,
    );
    homeViewedByState[state] = unique(
      viewers.map((event) => event.auth_user_id ?? event.session_id),
    ).size;
  }

  const extractionAnswers = extractionFeedback
    .map((row) => row.feedback?.answers ?? row.answers ?? null)
    .filter(Boolean);
  const qualityScores = extractionAnswers
    .map((answers) => Number(answers.quality_score))
    .filter((score) => Number.isFinite(score));
  const issueTypes = {};
  for (const answers of extractionAnswers) {
    for (const issue of Array.isArray(answers.issue_types) ? answers.issue_types : []) {
      issueTypes[issue] = (issueTypes[issue] ?? 0) + 1;
    }
  }

  const feedbackInbox = productFeedback.map((feedback) => ({
    id: feedback.id,
    created_at: feedback.created_at,
    source: feedback.source,
    category: feedback.category,
    status: feedback.status,
    contact_allowed: Boolean(feedback.contact_allowed),
    excerpt: redactFeedback(feedback.message),
  }));

  const observedFunnelEvents = FUNNEL.filter((eventName) => eventCounts[eventName]).length;
  const activationReady = activationDenominator >= 5;
  const retentionReady = retentionDenominator >= 5;
  const recommendations = [];
  if (!signedInUsers.size) {
    recommendations.push("Verify the first real signed-in production journey before diagnosing activation.");
  } else if (!activationReady) {
    recommendations.push("Collect at least five newly signed-in users before treating activation movement as directional.");
  }
  if (!feedbackInbox.length) {
    recommendations.push("Keep the existing feedback entry point visible; do not add a more aggressive prompt until real usage grows.");
  }
  if (observedFunnelEvents < FUNNEL.length) {
    recommendations.push("Monitor missing funnel events as coverage gaps, not user drop-off, until signed-in traffic reaches them.");
  }

  return {
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
      new_product_feedback: feedbackInbox.filter((item) => item.status === "new").length,
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
    feedback_inbox: feedbackInbox,
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
    "",
    "## Funnel coverage",
    "",
    "| Step | Unique entities | Events |",
    "| --- | ---: | ---: |",
    ...snapshot.drivers.funnel.map((step) => `| \`${step.event}\` | ${step.entities} | ${step.events} |`),
    "",
    "## Guardrails",
    "",
    `- Recording failure rate, trailing 7 days: ${formatRate(failure.rate)} (${failure.failed}/${failure.outcomes})`,
    `- Extraction quality responses: ${quality.responses}; average: ${quality.average_score ?? "not available"}; scores ≤2: ${quality.scores_two_or_lower}; agent-not-ready: ${quality.agent_not_ready}`,
    `- Extraction issue types: ${Object.keys(quality.issue_types).length ? JSON.stringify(quality.issue_types) : "none reported"}`,
    "",
    "## Product feedback inbox",
    "",
  ];
  if (snapshot.feedback_inbox.length) {
    for (const item of snapshot.feedback_inbox) {
      lines.push(`- ${item.created_at} · ${item.category} · ${item.status} · ${item.excerpt}`);
    }
  } else {
    lines.push("No product-feedback submissions yet.");
  }
  lines.push("", "## Recommended next actions", "");
  for (const recommendation of snapshot.recommendations) lines.push(`- ${recommendation}`);
  return `${lines.join("\n")}\n`;
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
      select: "event_name,auth_user_id,session_id,occurred_at,app_version,build_number,properties",
      occurred_at: `gte.${earliest}`,
      order: "occurred_at.asc",
    }, config),
    fetchRows("throughline_product_feedback", {
      select: "id,created_at,source,category,message,contact_allowed,status,app_version,build_number",
      created_at: `gte.${earliest}`,
      order: "created_at.desc",
    }, config),
    fetchRows("throughline_feedback", {
      select: "created_at,status,feedback",
      created_at: `gte.${earliest}`,
      order: "created_at.desc",
    }, config),
  ]);
  const snapshot = buildWeeklySnapshot({ events, productFeedback, extractionFeedback, reportAt });
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
