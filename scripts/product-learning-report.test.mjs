import assert from "node:assert/strict";
import test from "node:test";

import { buildWeeklySnapshot, renderMarkdown } from "./product-learning-report.mjs";

const reportAt = new Date("2026-08-07T12:00:00.000Z");
const event = (eventName, occurredAt, authUserId, sessionId, properties = {}) => ({
  event_name: eventName,
  occurred_at: occurredAt,
  auth_user_id: authUserId,
  session_id: sessionId,
  properties,
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
      message: "Email me@example.com or see https://example.com because upload failed.",
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
  assert.match(snapshot.feedback_inbox[0].excerpt, /\[email redacted\]/);
  assert.match(snapshot.feedback_inbox[0].excerpt, /\[url redacted\]/);

  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /user-1|user-2|session-1|session-2|session-3/);
  assert.doesNotMatch(serialized, /me@example\.com|https:\/\/example\.com/);
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
