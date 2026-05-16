import { FileStore } from "./file-store.mjs";
import { SupabaseStore } from "./supabase-store.mjs";

export function createStorage(options = {}) {
  const kind = options.kind || process.env.THROUGHLINE_STORAGE || "file";

  if (kind === "file") {
    return new FileStore(options);
  }

  if (kind === "supabase") {
    return new SupabaseStore(options);
  }

  throw new Error(`Unknown THROUGHLINE_STORAGE value: ${kind}`);
}
