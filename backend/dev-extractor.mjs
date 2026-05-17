#!/usr/bin/env node

import process from "node:process";

const VALID_TYPES = new Set(["morning", "evening", "weekly_review", "freeform"]);

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

function inferType(metadata) {
  return VALID_TYPES.has(metadata?.scenario) ? metadata.scenario : "freeform";
}

function titleFromTranscript(transcript) {
  const words = transcript
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 7);

  return words.length ? words.join(" ") : "Untitled note";
}

function inferMood(transcript) {
  const lower = transcript.toLowerCase();
  if (lower.includes("anxious") || lower.includes("worried") || lower.includes("nervous")) return "anxious";
  if (lower.includes("frustrated")) return "frustrated";
  if (lower.includes("sad")) return "sad";
  if (lower.includes("tired") || lower.includes("drained")) return "tired";
  if (lower.includes("grateful")) return "grateful";
  if (lower.includes("calm") || lower.includes("relieved")) return "calm";
  return "neutral";
}

function inferTomorrowTodos(transcript) {
  const match = transcript.match(/\btomorrow\b\s*(?:i\s+need\s+to|please|maybe|,)?\s*([^.!?]+)/i);
  if (!match) return [];

  return match[1]
    .split(/\s+and\s+|,/i)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^(to\s+)/i, ""))
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

function todosFromTomorrow(tomorrowTodos, userLocalDate) {
  const tomorrowDate = nextIsoDate(userLocalDate);
  return tomorrowTodos.map((text) => ({
    text,
    status: "open",
    priority: "medium",
    due: null,
    for_date: tomorrowDate,
    context: "tomorrow",
  }));
}

function nextIsoDate(isoDate) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

try {
  const input = JSON.parse(await readStdin());
  const transcript = String(input.transcript ?? "");
  const tomorrowTodos = inferTomorrowTodos(transcript);
  const output = {
    type: inferType(input.metadata),
    title: titleFromTranscript(transcript),
    summary: transcript.slice(0, 220),
    most_important: tomorrowTodos.length ? tomorrowTodos.slice(0, 5) : [],
    todos: todosFromTomorrow(tomorrowTodos, input.metadata?.user_local_date),
    priorities: [],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: tomorrowTodos,
    mood: inferMood(transcript),
    people: [],
    projects: [],
    tags: [],
    centers_of_balance: [],
  };

  process.stdout.write(JSON.stringify(output));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
