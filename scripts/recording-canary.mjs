#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_API_URL = "https://ywsenspsfyrdhgyxgcrv.supabase.co/functions/v1/api";
const apiURL = (process.env.THROUGHLINE_BACKEND_URL || DEFAULT_API_URL).replace(/\/+$/, "");
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "throughline-canary-"));
const aiffPath = path.join(tempDirectory, "recording.aiff");
const wavPath = path.join(tempDirectory, "recording.wav");
const sentence = [
  "Throughline system check.",
  "Today I need to call the dentist, send the launch update, and review the onboarding analytics.",
  "The top priority is to verify the recording flow before shipping.",
].join(" ");

try {
  execFileSync("say", ["-r", "145", "-o", aiffPath, sentence], { stdio: "ignore" });
  execFileSync("afconvert", [aiffPath, wavPath, "-f", "WAVE", "-d", "LEI16@16000"], { stdio: "ignore" });

  const audio = fs.readFileSync(wavPath);
  const response = await fetch(`${apiURL}/demo/recordings`, {
    method: "POST",
    headers: {
      "Content-Type": "audio/wav",
      "X-Throughline-Duration-Seconds": "15",
      "X-Throughline-Recording-Type": "freeform",
      "X-Throughline-Timezone": "America/Los_Angeles",
    },
    body: audio,
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json();
  const note = payload?.recording?.structured_note;
  const structuredItems = (note?.most_important?.length ?? 0) + (note?.todos?.length ?? 0);
  const narrativeTodoCount = (note?.todos ?? []).filter((todo) =>
    /^(?:the )?user (?:wants|needs|should|has|plans|would like)\b|^i (?:want|need|should|have|plan)\b/i
      .test(todo?.text?.trim() ?? "")
  ).length;
  const nonTodoActionItemCount = (note?.action_items ?? []).filter(
    (item) => item?.source !== "todo",
  ).length;
  const checks = {
    http_ok: response.ok,
    processing_status: payload?.processing_status,
    has_note: payload?.has_note === true,
    has_transcript: Boolean(payload?.recording?.transcript_raw?.trim()),
    has_title: Boolean(note?.title?.trim()),
    has_summary: Boolean(note?.summary?.trim()),
    todo_count: note?.todos?.length ?? 0,
    narrative_todo_count: narrativeTodoCount,
    non_todo_action_item_count: nonTodoActionItemCount,
    structured_items: structuredItems,
  };

  const pipelinePassed = checks.http_ok
    && checks.processing_status === "processed"
    && checks.has_note
    && checks.has_transcript
    && checks.structured_items > 0;
  const qualityComplete = checks.has_title
    && checks.has_summary
    && checks.todo_count >= 3
    && checks.narrative_todo_count === 0
    && checks.non_todo_action_item_count === 0;
  const warnings = [];
  if (!checks.has_title) warnings.push("missing_title");
  if (!checks.has_summary) warnings.push("missing_summary");
  if (checks.todo_count < 3) warnings.push("explicit_todos_missed");
  if (checks.narrative_todo_count > 0) warnings.push("narrative_todo_copy");
  if (checks.non_todo_action_item_count > 0) warnings.push("non_todo_action_item");

  console.log(JSON.stringify({
    passed: pipelinePassed && qualityComplete,
    pipeline_passed: pipelinePassed,
    quality_complete: qualityComplete,
    warnings,
    ...checks,
  }, null, 2));
  if (!pipelinePassed || !qualityComplete) process.exitCode = 1;
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
