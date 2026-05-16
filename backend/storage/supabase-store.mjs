import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { extensionForMime, feedbackSummary } from "./file-store.mjs";

const DEFAULT_AUDIO_BUCKET = "throughline-audio";
const DEFAULT_USER_ID = "dev-user";

export class SupabaseStore {
  constructor(options = {}) {
    this.name = "supabase";
    this.supabaseUrl = trimTrailingSlash(options.supabaseUrl || process.env.SUPABASE_URL || "");
    this.serviceRoleKey = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    this.audioBucket = options.audioBucket || process.env.SUPABASE_AUDIO_BUCKET || DEFAULT_AUDIO_BUCKET;
    this.userId = options.userId || process.env.THROUGHLINE_USER_ID || DEFAULT_USER_ID;
  }

  async ensure() {
    this.assertConfigured();
    await this.restRequest("/throughline_recordings?select=id&limit=1");
  }

  async storeAudio({ id, bytes, mimeType }) {
    if (!bytes || bytes.length === 0) return null;
    this.assertConfigured();

    const extension = extensionForMime(mimeType);
    const objectPath = `${this.userId}/${id}.${extension}`;
    const tmpPath = path.join(os.tmpdir(), `throughline-${id}.${extension}`);
    await fs.writeFile(tmpPath, bytes);

    await this.storageRequest(`/object/${this.audioBucket}/${objectPath}`, {
      method: "POST",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "x-upsert": "true",
      },
      body: bytes,
    });

    return {
      stored: true,
      storage: "supabase",
      bucket: this.audioBucket,
      object_path: objectPath,
      mime_type: mimeType,
      bytes: bytes.length,
      path: tmpPath,
    };
  }

  async persistRecording(recording) {
    const persistentRecording = withoutTransientAudioPath(recording);
    await this.upsert("throughline_recordings", {
      id: persistentRecording.id,
      user_id: persistentRecording.user_id || this.userId,
      created_at: persistentRecording.created_at,
      user_local_time: persistentRecording.user_local_time,
      timezone: persistentRecording.timezone,
      duration_seconds: persistentRecording.duration_seconds,
      type: persistentRecording.type,
      status: persistentRecording.status,
      processing_status: persistentRecording.processing_status,
      transcript_raw: persistentRecording.transcript_raw,
      structured_note: persistentRecording.structured_note ?? null,
      audio: persistentRecording.audio ?? null,
      recording: persistentRecording,
    });
  }

  async persistFeedback(feedback) {
    await this.upsert("throughline_feedback", {
      id: feedback.id,
      recording_id: feedback.recording_id,
      user_id: feedback.user_id || this.userId,
      created_at: feedback.created_at,
      status: feedback.status,
      answers: feedback.answers,
      expected: feedback.expected,
      recording_snapshot: feedback.recording_snapshot,
      feedback,
    });
  }

  async readRecording(id) {
    const rows = await this.restRequest(
      `/throughline_recordings?select=recording&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (!rows.length) {
      const error = new Error("Recording not found");
      error.code = "ENOENT";
      throw error;
    }

    return rows[0].recording;
  }

  async deleteRecording(id) {
    const recording = await this.readRecording(id);

    if (recording.audio?.storage === "supabase" && recording.audio?.object_path) {
      try {
        await this.storageRequest(
          `/object/${this.audioBucket}/${recording.audio.object_path}`,
          { method: "DELETE" },
        );
      } catch (error) {
        if (!String(error?.message ?? error).includes("(404)")) {
          throw error;
        }
      }
    }

    await this.restRequest(
      `/throughline_recordings?id=eq.${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }

  async readFeedback(id) {
    const rows = await this.restRequest(
      `/throughline_feedback?select=feedback&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (!rows.length) {
      const error = new Error("Feedback not found");
      error.code = "ENOENT";
      throw error;
    }

    return rows[0].feedback;
  }

  async listFullRecordings() {
    const rows = await this.restRequest(
      "/throughline_recordings?select=recording&order=created_at.desc&limit=1000",
    );
    return rows.map((row) => row.recording);
  }

  async listRecordings() {
    const rows = await this.restRequest(
      [
        "/throughline_recordings",
        "?select=id,created_at,user_local_time,duration_seconds,type,processing_status,transcript_raw,structured_note,audio",
        "&order=created_at.desc",
        "&limit=1000",
      ].join(""),
    );

    return rows.map((recording) => ({
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
    const rows = await this.restRequest(
      "/throughline_feedback?select=feedback&order=created_at.desc&limit=1000",
    );
    return rows.map((row) => feedbackSummary(row.feedback));
  }

  async upsert(table, payload) {
    const rows = await this.restRequest(`/${table}?on_conflict=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([payload]),
    });

    return rows[0] ?? null;
  }

  async restRequest(pathname, options = {}) {
    return this.request(`/rest/v1${pathname}`, options);
  }

  async storageRequest(pathname, options = {}) {
    return this.request(`/storage/v1${pathname}`, options);
  }

  async request(pathname, options = {}) {
    this.assertConfigured();
    const response = await fetch(`${this.supabaseUrl}${pathname}`, {
      ...options,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        ...(options.headers ?? {}),
      },
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status}): ${responseText}`);
    }

    if (!responseText.trim()) return null;
    return JSON.parse(responseText);
  }

  assertConfigured() {
    if (!this.supabaseUrl || !this.serviceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage");
    }
  }
}

function withoutTransientAudioPath(recording) {
  if (!recording.audio?.path || recording.audio.storage !== "supabase") return recording;

  const audio = { ...recording.audio };
  delete audio.path;
  return {
    ...recording,
    audio,
  };
}

function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}
