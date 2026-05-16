import fs from "node:fs/promises";
import {
  buildExtractionInput,
  normalizeExtraction,
  runCommandExtractor,
  userLocalDateFromTime,
} from "../core/extraction-pipeline.mjs";

export async function extractRecordingNote(recording, options = {}) {
  const transcript = recording.transcript_raw;
  if (!transcript) {
    return {
      status: "needs_transcript",
      note: null,
      error: null,
    };
  }

  if (!options.command) {
    return {
      status: "needs_extractor",
      note: null,
      error: null,
    };
  }

  try {
    const prompt = await fs.readFile(options.promptPath, "utf8");
    const metadata = metadataForRecording(recording);
    const input = buildExtractionInput({
      id: recording.id,
      metadata,
      transcript,
      prompt,
    });
    const raw = runCommandExtractor(options.command, input);

    return {
      status: "processed",
      note: normalizeExtraction(raw, metadata),
      error: null,
      metadata,
    };
  } catch (error) {
    return {
      status: "extraction_failed",
      note: null,
      error: error instanceof Error ? error.message : "Unknown extraction error",
    };
  }
}

function metadataForRecording(recording) {
  return {
    user_local_date: userLocalDateFromTime(recording.user_local_time)
      || new Date(recording.created_at).toISOString().slice(0, 10),
    scenario: recording.type || "freeform",
    recording_context: recording.upload_source || "unknown",
  };
}
