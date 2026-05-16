#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_FIXTURE_DIR = "evals/fixtures/labeled";

const FIELD_WEIGHTS = {
  type: 8,
  title: 4,
  summary: 8,
  todos: 16,
  priorities: 10,
  intentions: 8,
  accomplishments: 8,
  tomorrow_todos: 10,
  mood: 6,
  people: 5,
  projects: 5,
  tags: 6,
  centers_of_balance: 6,
};

const SCORE_PROFILES = {
  full: {
    weights: FIELD_WEIGHTS,
    criticalFields: new Set([
      "todos",
      "priorities",
      "intentions",
      "accomplishments",
      "tomorrow_todos",
      "people",
      "projects",
      "tags",
      "centers_of_balance",
    ]),
  },
  action: {
    weights: {
      type: 6,
      todos: 30,
      priorities: 14,
      intentions: 12,
      accomplishments: 12,
      tomorrow_todos: 18,
      people: 6,
      mood: 2,
    },
    criticalFields: new Set([
      "todos",
      "priorities",
      "intentions",
      "accomplishments",
      "tomorrow_todos",
      "people",
    ]),
  },
  memory: {
    weights: {
      title: 8,
      summary: 18,
      accomplishments: 14,
      mood: 6,
      people: 10,
      projects: 14,
      tags: 18,
      centers_of_balance: 12,
    },
    criticalFields: new Set([
      "accomplishments",
      "people",
      "projects",
      "tags",
      "centers_of_balance",
    ]),
  },
};

const CRITICAL_ARRAY_FIELDS = new Set([
  "priorities",
  "intentions",
  "accomplishments",
  "tomorrow_todos",
  "people",
  "projects",
  "tags",
  "centers_of_balance",
]);

const TODO_CRITICAL_FIELDS = new Set(["text", "priority", "due", "for_date"]);
const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

const TOKEN_ALIASES = new Map([
  ["completed", "complete"],
  ["ending", "end"],
  ["overbuilding", "overbuild"],
  ["perfecting", "perfect"],
  ["shipped", "ship"],
  ["solved", "solve"],
]);

function parseArgs(argv) {
  const args = {
    fixtures: DEFAULT_FIXTURE_DIR,
    predictions: null,
    profile: "full",
    threshold: 90,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixtures") {
      args.fixtures = argv[++index];
    } else if (arg === "--predictions") {
      args.predictions = argv[++index];
    } else if (arg === "--profile") {
      args.profile = argv[++index];
    } else if (arg === "--threshold") {
      args.threshold = Number(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.threshold)) {
    throw new Error("--threshold must be a number");
  }

  if (!SCORE_PROFILES[args.profile]) {
    throw new Error(`--profile must be one of: ${Object.keys(SCORE_PROFILES).join(", ")}`);
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node evals/score-extraction.mjs
  node evals/score-extraction.mjs --predictions evals/runs/latest

Options:
  --fixtures <dir>      Labeled fixture directory. Defaults to ${DEFAULT_FIXTURE_DIR}
  --predictions <dir>   Directory containing {fixture_id}.json prediction files.
  --profile <profile>   Pass/fail profile: full, action, or memory. Defaults to full.
  --threshold <number>  Overall pass threshold. Defaults to 90.
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(directory, file));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bdon't\b/g, "avoid")
    .replace(/\bdo not\b/g, "avoid")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  const normalized = normalizeText(value);
  return normalized
    ? normalized.split(" ").map((token) => TOKEN_ALIASES.get(token) ?? token)
    : [];
}

function contentTokens(value) {
  return tokens(value).filter((token) => !STOPWORDS.has(token));
}

function tokenF1(expected, actual) {
  const expectedTokens = tokens(expected);
  const actualTokens = tokens(actual);

  if (expectedTokens.length === 0 && actualTokens.length === 0) return 1;
  if (expectedTokens.length === 0 || actualTokens.length === 0) return 0;

  const actualCounts = new Map();
  for (const token of actualTokens) {
    actualCounts.set(token, (actualCounts.get(token) ?? 0) + 1);
  }

  let overlap = 0;
  for (const token of expectedTokens) {
    const count = actualCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      actualCounts.set(token, count - 1);
    }
  }

  if (overlap === 0) return 0;

  const precision = overlap / actualTokens.length;
  const recall = overlap / expectedTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function contentTokenF1(expected, actual) {
  const expectedTokens = contentTokens(expected);
  const actualTokens = contentTokens(actual);

  if (expectedTokens.length === 0 && actualTokens.length === 0) return 1;
  if (expectedTokens.length === 0 || actualTokens.length === 0) return 0;

  const actualCounts = new Map();
  for (const token of actualTokens) {
    actualCounts.set(token, (actualCounts.get(token) ?? 0) + 1);
  }

  let overlap = 0;
  for (const token of expectedTokens) {
    const count = actualCounts.get(token) ?? 0;
    if (count > 0) {
      overlap += 1;
      actualCounts.set(token, count - 1);
    }
  }

  if (overlap === 0) return 0;

  const precision = overlap / actualTokens.length;
  const recall = overlap / expectedTokens.length;
  return (2 * precision * recall) / (precision + recall);
}

function fuzzyTextScore(expected, actual) {
  return Math.max(tokenF1(expected, actual), contentTokenF1(expected, actual));
}

function transcriptSupportScore(value, transcript) {
  const valueTokens = contentTokens(value);
  const transcriptTokens = new Set(contentTokens(transcript));

  if (valueTokens.length === 0) return 0;
  if (transcriptTokens.size === 0) return 0;

  const matched = valueTokens.filter((token) => transcriptTokens.has(token)).length;
  return matched / valueTokens.length;
}

function isSupportedByTranscript(value, transcript) {
  return transcriptSupportScore(value, transcript) >= 0.5;
}

function exactEnumScore(expected, actual) {
  if ((expected ?? null) === (actual ?? null)) return 1;
  return 0;
}

function textScore(expected, actual) {
  return fuzzyTextScore(expected, actual);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function scoreStringArray(expectedValue, actualValue) {
  const expected = toArray(expectedValue);
  const actual = toArray(actualValue);

  if (expected.length === 0 && actual.length === 0) {
    return { score: 1, hallucinations: 0 };
  }

  if (expected.length === 0) {
    return { score: 0, hallucinations: actual.length };
  }

  if (actual.length === 0) {
    return { score: 0, hallucinations: 0 };
  }

  const usedActualIndexes = new Set();
  let recallTotal = 0;

  for (const expectedItem of expected) {
    let bestIndex = -1;
    let bestScore = 0;

    actual.forEach((actualItem, actualIndex) => {
      if (usedActualIndexes.has(actualIndex)) return;
      const candidateScore = fuzzyTextScore(expectedItem, actualItem);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestIndex = actualIndex;
      }
    });

    if (bestIndex >= 0 && bestScore >= 0.5) {
      usedActualIndexes.add(bestIndex);
      recallTotal += bestScore;
    }
  }

  const recall = recallTotal / expected.length;
  const precision = usedActualIndexes.size / actual.length;
  const unmatchedActual = actual.length - usedActualIndexes.size;
  const score = 0.65 * recall + 0.35 * precision;

  return {
    score,
    hallucinations: unmatchedActual,
  };
}

function nullableDateScore(expected, actual, metadata) {
  if ((expected ?? null) === (actual ?? null)) return 1;
  if ((expected ?? null) === null && actual === metadata?.user_local_date) return 1;
  return 0;
}

function scoreTodo(expectedTodo, actualTodo, metadata) {
  const text = fuzzyTextScore(expectedTodo?.text, actualTodo?.text);
  const priority = exactEnumScore(expectedTodo?.priority ?? null, actualTodo?.priority ?? null);
  const due = exactEnumScore(expectedTodo?.due ?? null, actualTodo?.due ?? null);
  const forDate = nullableDateScore(expectedTodo?.for_date ?? null, actualTodo?.for_date ?? null, metadata);

  return 0.7 * text + 0.1 * priority + 0.1 * due + 0.1 * forDate;
}

function scoreTodos(expectedValue, actualValue, metadata) {
  const expected = toArray(expectedValue);
  const actual = toArray(actualValue);

  if (expected.length === 0 && actual.length === 0) {
    return { score: 1, hallucinations: 0 };
  }

  if (expected.length === 0) {
    return { score: 0, hallucinations: actual.length };
  }

  if (actual.length === 0) {
    return { score: 0, hallucinations: 0 };
  }

  const usedActualIndexes = new Set();
  let recallTotal = 0;

  for (const expectedTodo of expected) {
    let bestIndex = -1;
    let bestScore = 0;

    actual.forEach((actualTodo, actualIndex) => {
      if (usedActualIndexes.has(actualIndex)) return;
      const candidateScore = scoreTodo(expectedTodo, actualTodo, metadata);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestIndex = actualIndex;
      }
    });

    if (bestIndex >= 0 && bestScore >= 0.5) {
      usedActualIndexes.add(bestIndex);
      recallTotal += bestScore;
    }
  }

  const recall = recallTotal / expected.length;
  const precision = usedActualIndexes.size / actual.length;
  const unmatchedActual = actual.length - usedActualIndexes.size;
  const score = 0.7 * recall + 0.3 * precision;

  return {
    score,
    hallucinations: unmatchedActual,
  };
}

function criticalHallucinationDetails(field, expectedValue, actualValue, hallucinationCount, transcript) {
  if (hallucinationCount <= 0) return [];

  if (field === "todos") {
    const expectedTodos = toArray(expectedValue);
    const actualTodos = toArray(actualValue);
    const expectedTexts = expectedTodos.map((todo) => normalizeText(todo.text));
    return actualTodos
      .filter((todo) => !expectedTexts.some((text) => fuzzyTextScore(text, todo.text) >= 0.45))
      .filter((todo) => !isSupportedByTranscript(todo.text, transcript))
      .map((todo) => ({ field, value: todo.text, criticalFields: Array.from(TODO_CRITICAL_FIELDS) }));
  }

  if (!CRITICAL_ARRAY_FIELDS.has(field)) return [];

  const expected = toArray(expectedValue);
  const actual = toArray(actualValue);
  return actual
    .filter((item) => !expected.some((expectedItem) => fuzzyTextScore(expectedItem, item) >= 0.45))
    .filter((item) => !isSupportedByTranscript(item, transcript))
    .map((item) => ({ field, value: item }));
}

function scoreField(field, expected, actual, transcript, metadata) {
  if (field === "type" || field === "mood") {
    return {
      score: exactEnumScore(expected[field] ?? null, actual[field] ?? null),
      hallucinations: 0,
      hallucinationDetails: [],
    };
  }

  if (field === "title" || field === "summary") {
    return {
      score: textScore(expected[field], actual[field]),
      hallucinations: 0,
      hallucinationDetails: [],
    };
  }

  const result = field === "todos"
    ? scoreTodos(expected[field], actual[field], metadata)
    : scoreStringArray(expected[field], actual[field]);

  return {
    ...result,
    hallucinationDetails: criticalHallucinationDetails(
      field,
      expected[field],
      actual[field],
      result.hallucinations,
      transcript,
    ),
  };
}

function loadPrediction(predictionsDir, fixture) {
  if (!predictionsDir) {
    return fixture.expected;
  }

  const predictionPath = path.join(predictionsDir, `${fixture.id}.json`);
  if (!fs.existsSync(predictionPath)) {
    return null;
  }

  const prediction = readJson(predictionPath);
  return prediction.actual ?? prediction;
}

function scoreProfile(fieldResults, profileName) {
  const profile = SCORE_PROFILES[profileName];
  const fieldScores = {};
  const hallucinationDetails = [];
  let weightedTotal = 0;
  let weightTotal = 0;

  for (const [field, weight] of Object.entries(profile.weights)) {
    const result = fieldResults[field] ?? { score: 0, hallucinationDetails: [] };

    fieldScores[field] = Number((result.score * 100).toFixed(1));
    weightedTotal += result.score * weight;
    weightTotal += weight;

    if (profile.criticalFields.has(field)) {
      hallucinationDetails.push(...result.hallucinationDetails);
    }
  }

  return {
    score: Number(((weightedTotal / weightTotal) * 100).toFixed(1)),
    fieldScores,
    criticalHallucinations: hallucinationDetails,
  };
}

function scoreFixture(fixture, actual) {
  const fieldResults = {};

  for (const field of Object.keys(FIELD_WEIGHTS)) {
    fieldResults[field] = actual
      ? scoreField(field, fixture.expected, actual, fixture.transcript, fixture.metadata ?? {})
      : { score: 0, hallucinationDetails: [] };
  }

  const profiles = Object.fromEntries(
    Object.keys(SCORE_PROFILES).map((profileName) => [
      profileName,
      scoreProfile(fieldResults, profileName),
    ]),
  );

  const compactProfiles = Object.fromEntries(
    Object.entries(profiles).map(([profileName, profile]) => [
      profileName,
      {
        score: profile.score,
        criticalHallucinationCount: profile.criticalHallucinations.length,
      },
    ]),
  );

  return {
    id: fixture.id,
    title: fixture.title,
    score: profiles.full.score,
    fieldScores: profiles.full.fieldScores,
    criticalHallucinations: profiles.full.criticalHallucinations,
    profiles: compactProfiles,
  };
}

function aggregate(results, profileName) {
  const profile = SCORE_PROFILES[profileName];
  const profileResults = results.map((result) => result.profiles[profileName]);
  const overall = profileResults.reduce((sum, result) => sum + result.score, 0) / profileResults.length;
  const fieldTotals = {};

  for (const field of Object.keys(profile.weights)) {
    fieldTotals[field] = results.reduce((sum, result) => sum + result.fieldScores[field], 0) / results.length;
  }

  return {
    overall: Number(overall.toFixed(1)),
    fields: Object.fromEntries(
      Object.entries(fieldTotals).map(([field, score]) => [field, Number(score.toFixed(1))]),
    ),
    criticalHallucinationCount: profileResults.reduce(
      (sum, result) => sum + result.criticalHallucinationCount,
      0,
    ),
  };
}

function main() {
  const args = parseArgs(process.argv);
  const fixtureFiles = listJsonFiles(args.fixtures);

  if (fixtureFiles.length === 0) {
    throw new Error(`No JSON fixtures found in ${args.fixtures}`);
  }

  const results = fixtureFiles.map((fixturePath) => {
    const fixture = readJson(fixturePath);
    const actual = loadPrediction(args.predictions, fixture);
    return scoreFixture(fixture, actual);
  });

  const profileSummaries = Object.fromEntries(
    Object.keys(SCORE_PROFILES).map((profileName) => [
      profileName,
      aggregate(results, profileName),
    ]),
  );
  const selectedSummary = profileSummaries[args.profile];
  const pass = selectedSummary.overall >= args.threshold && selectedSummary.criticalHallucinationCount === 0;

  const report = {
    mode: args.predictions ? "predictions" : "golden_self_check",
    profile: args.profile,
    fixtures: fixtureFiles.length,
    threshold: args.threshold,
    pass,
    summary: {
      ...profileSummaries.full,
      selectedProfile: args.profile,
      selected: selectedSummary,
      profiles: profileSummaries,
    },
    results,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!pass) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
