#!/usr/bin/env node

import process from "node:process";
import fs from "node:fs";

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 5;

function loadLocalEnv() {
  if (process.env.GROQ_API_KEY || !fs.existsSync(".env.local")) return;

  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^GROQ_API_KEY=(.*)$/);
    if (!match) continue;

    process.env.GROQ_API_KEY = match[1].trim().replace(/^['"]|['"]$/g, "");
    return;
  }
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

function parseInput(rawInput) {
  if (!rawInput.trim()) {
    throw new Error("Expected eval runner JSON on stdin");
  }

  const parsed = JSON.parse(rawInput);
  if (!parsed.transcript || !parsed.prompt) {
    throw new Error("Input must include transcript and prompt");
  }

  return parsed;
}

function buildMessages(input, attempt = 0) {
  const retryGuard = attempt > 0
    ? [
      "",
      "Retry guard:",
      "- Return syntactically valid JSON only.",
      "- Do not include markdown, comments, or trailing text.",
      "- `tomorrow_todos` must be an array of strings, never todo objects.",
      "- Use double quotes for every JSON string and close every string.",
    ].join("\n")
    : "";

  return [
    {
      role: "system",
      content: `${input.prompt}${retryGuard}`,
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          id: input.id,
          metadata: input.metadata ?? {},
          transcript: input.transcript,
        },
        null,
        2,
      ),
    },
  ];
}

async function requestGroq(input) {
  loadLocalEnv();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required");
  }

  const baseUrl = process.env.GROQ_BASE_URL || DEFAULT_BASE_URL;
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const maxRetries = Number(process.env.GROQ_MAX_RETRIES || DEFAULT_MAX_RETRIES);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: buildMessages(input, attempt),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        await sleep(retryDelayMs("", attempt));
        continue;
      }
      throw error;
    }
    clearTimeout(timeout);

    const responseText = await response.text();
    if (response.status === 429 && attempt < maxRetries) {
      const retryMs = retryDelayMs(responseText, attempt);
      await sleep(retryMs);
      continue;
    }

    if (isJsonValidationFailure(response.status, responseText) && attempt < maxRetries) {
      await sleep(500);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Groq request failed (${response.status}): ${responseText}`);
    }

    const payload = JSON.parse(responseText);
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq response did not include message content");
    }

    JSON.parse(content);
    return content;
  }

  throw new Error("Groq request failed after retries");
}

function isJsonValidationFailure(status, responseText) {
  if (status !== 400) return false;

  try {
    const payload = JSON.parse(responseText);
    return payload?.error?.code === "json_validate_failed";
  } catch {
    return /json_validate_failed/i.test(responseText);
  }
}

function retryDelayMs(responseText, attempt) {
  const match = responseText.match(/try again in ([0-9.]+)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1000) + 1000;
  }

  return Math.min(15000, 2000 * 2 ** attempt);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

try {
  const input = parseInput(await readStdin());
  const output = await requestGroq(input);
  process.stdout.write(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
