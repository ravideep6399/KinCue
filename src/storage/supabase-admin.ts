import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET || "kincue-vault";
export const supabaseStorageConfigured = Boolean(supabaseUrl && secretKey);

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!supabaseStorageConfigured) {
    throw new Error("Supabase Storage is not configured.");
  }

  client ??= createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}
