import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_DATA_DIR = "backend/data";

export class FileStore {
  constructor(options = {}) {
    this.name = "file";
    this.dataDir = options.dataDir || process.env.THROUGHLINE_STUB_DATA_DIR || DEFAULT_DATA_DIR;
    this.recordingsDir = path.join(this.dataDir, "recordings");
    this.audioDir = path.join(this.dataDir, "audio");
    this.feedbackDir = path.join(this.dataDir, "feedback");
  }

  async ensure() {
    await fs.mkdir(this.recordingsDir, { recursive: true });
    await fs.mkdir(this.audioDir, { recursive: true });
    await fs.mkdir(this.feedbackDir, { recursive: true });
  }

  async storeAudio({ id, bytes, mimeType }) {
    if (!bytes || bytes.length === 0) return null;

    const extension = extensionForMime(mimeType);
    const fileName = `${id}.${extension}`;
    const filePath = path.join(this.audioDir, fileName);
    await fs.writeFile(filePath, bytes);

    return {
      stored: true,
      storage: "file",
      mime_type: mimeType,
      bytes: bytes.length,
      path: filePath,
    };
  }

  async persistRecording(recording) {
    const filePath = path.join(this.recordingsDir, `${recording.id}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(recording, null, 2)}\n`);
  }

  async persistFeedback(feedback) {
    const filePath = path.join(this.feedbackDir, `${feedback.id}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(feedback, null, 2)}\n`);
  }

  async readRecording(id) {
    const filePath = path.join(this.recordingsDir, `${id}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  async deleteRecording(id) {
    const recording = await this.readRecording(id);
    const filePath = path.join(this.recordingsDir, `${id}.json`);
    await fs.rm(filePath);

    if (recording.audio?.path) {
      await fs.rm(recording.audio.path, { force: true });
    }
  }

  async readFeedback(id) {
    const filePath = path.join(this.feedbackDir, `${id}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  async listFullRecordings() {
    const files = await fs.readdir(this.recordingsDir);
    const recordings = [];

    for (const file of files.filter((item) => item.endsWith(".json")).sort()) {
      const recording = JSON.parse(await fs.readFile(path.join(this.recordingsDir, file), "utf8"));
      recordings.push(recording);
    }

    return recordings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async listRecordings() {
    const recordings = await this.listFullRecordings();
    return recordings.map((recording) => ({
      id: recording.id,
      created_at: recording.created_at,
      user_local_time: recording.user_local_time,
      duration_seconds: recording.duration_seconds,
      type: recording.type,
      processing_status: recording.processing_status,
      has_audio: Boolean(recording.audio?.stored),
      has_transcript: Boolean(recording.transcript_raw),
      has_note: Boolean(recording.structured_note),
    }));
  }

  async listFeedback() {
    const files = await fs.readdir(this.feedbackDir);
    const feedback = [];

    for (const file of files.filter((item) => item.endsWith(".json")).sort()) {
      const item = JSON.parse(await fs.readFile(path.join(this.feedbackDir, file), "utf8"));
      feedback.push(feedbackSummary(item));
    }

    return feedback;
  }
}

export function extensionForMime(mimeType) {
  if (mimeType === "audio/m4a" || mimeType === "audio/x-m4a") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav" || mimeType === "audio/wave") return "wav";
  if (mimeType === "audio/aac") return "aac";
  if (mimeType === "audio/mp4") return "m4a";
  return "bin";
}

export function feedbackSummary(item) {
  return {
    id: item.id,
    recording_id: item.recording_id,
    created_at: item.created_at,
    status: item.status,
    agent_ready: item.answers?.agent_ready ?? null,
    has_missing: Boolean(item.answers?.missing),
    has_invented: Boolean(item.answers?.invented),
    has_expected: Boolean(item.expected),
  };
}
