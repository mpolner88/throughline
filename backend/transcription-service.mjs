import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 3;

export async function transcribeRecordingAudio(recording, options = {}) {
  if (recording.transcript_raw) {
    return {
      status: "transcribed",
      transcript: recording.transcript_raw,
      provider: "existing",
      error: null,
    };
  }

  if (!recording.audio?.stored || !recording.audio?.path) {
    return {
      status: "needs_transcript",
      transcript: null,
      provider: null,
      error: null,
    };
  }

  if (options.provider !== "groq") {
    return {
      status: "needs_transcript",
      transcript: null,
      provider: null,
      error: null,
    };
  }

  try {
    const transcript = await transcribeWithGroq(recording, options);
    return {
      status: "transcribed",
      transcript,
      provider: "groq",
      error: null,
    };
  } catch (error) {
    return {
      status: "transcription_failed",
      transcript: null,
      provider: "groq",
      error: error instanceof Error ? error.message : "Unknown transcription error",
    };
  }
}

async function transcribeWithGroq(recording, options) {
  await loadLocalEnv();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for Groq transcription");
  }

  const baseUrl = options.baseUrl || process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL;
  const model = options.model || process.env.GROQ_TRANSCRIPTION_MODEL || DEFAULT_GROQ_TRANSCRIPTION_MODEL;
  const timeoutMs = Number(process.env.GROQ_TRANSCRIPTION_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const maxRetries = Number(process.env.GROQ_TRANSCRIPTION_MAX_RETRIES || DEFAULT_MAX_RETRIES);
  const audioBytes = await fs.readFile(recording.audio.path);
  const fileName = path.basename(recording.audio.path);

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const form = new FormData();
    form.append("model", model);
    form.append("response_format", "json");
    form.append(
      "file",
      new Blob([audioBytes], { type: recording.audio.mime_type || "application/octet-stream" }),
      fileName,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
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
      await sleep(retryDelayMs(responseText, attempt));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Groq transcription failed (${response.status}): ${responseText}`);
    }

    const payload = JSON.parse(responseText);
    if (typeof payload.text !== "string" || !payload.text.trim()) {
      throw new Error("Groq transcription response did not include text");
    }

    return payload.text.trim();
  }

  throw new Error("Groq transcription failed after retries");
}

function loadLocalEnv() {
  if (process.env.GROQ_API_KEY) return;

  return fs.readFile(".env.local", "utf8")
    .then((contents) => {
      const line = contents.split(/\r?\n/).find((entry) => entry.startsWith("GROQ_API_KEY="));
      if (!line) return;
      process.env.GROQ_API_KEY = line.replace(/^GROQ_API_KEY=/, "").trim().replace(/^['"]|['"]$/g, "");
    })
    .catch(() => {});
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
