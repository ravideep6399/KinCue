import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const values = await readEnvironmentFile(".env.local");
const supabaseUrl = process.env.SUPABASE_URL || values.get("SUPABASE_URL") || "";
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  values.get("SUPABASE_SECRET_KEY") ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  values.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const bucketName =
  process.env.SUPABASE_STORAGE_BUCKET ||
  values.get("SUPABASE_STORAGE_BUCKET") ||
  "kincue-vault";
const createOrRepair = process.argv.includes("--create");

if (!supabaseUrl || !secretKey) {
  console.error("Run npm run check:config and add the missing Supabase values first.");
  process.exit(1);
}

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  console.error("SUPABASE_URL is not a valid project URL.");
  process.exit(1);
}
if (["your-project.supabase.co", "example.supabase.co"].includes(parsedSupabaseUrl.hostname)) {
  console.error("SUPABASE_URL still contains a placeholder. Copy the Project URL from Supabase.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let { data: bucket, error: bucketError } = await supabase.storage.getBucket(bucketName);
if (createOrRepair && (bucketError || !bucket)) {
  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    allowedMimeTypes: ["image/*", "audio/*", "application/pdf"],
    fileSizeLimit: "10MB",
  });
  if (createError) {
    console.error(`The private Supabase bucket '${bucketName}' could not be created: ${createError.message}`);
    process.exit(1);
  }
  ({ data: bucket, error: bucketError } = await supabase.storage.getBucket(bucketName));
} else if (createOrRepair && bucket) {
  const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
    public: false,
    allowedMimeTypes: ["image/*", "audio/*", "application/pdf"],
    fileSizeLimit: "10MB",
  });
  if (updateError) {
    console.error(`The Supabase bucket '${bucketName}' could not be secured: ${updateError.message}`);
    process.exit(1);
  }
  ({ data: bucket, error: bucketError } = await supabase.storage.getBucket(bucketName));
}
if (bucketError || !bucket) {
  console.error(`The private Supabase bucket '${bucketName}' could not be found.`);
  process.exit(1);
}
if (bucket.public) {
  console.error(`The Supabase bucket '${bucketName}' is public. Make it private before continuing.`);
  process.exit(1);
}

const path = `_kincue_checks/${randomUUID()}.png`;
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const storage = supabase.storage.from(bucketName);

try {
  const { error: uploadError } = await storage.upload(path, onePixelPng, {
    contentType: "image/png",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: signed, error: signedError } = await storage.createSignedUrl(path, 30);
  if (signedError) throw signedError;

  const response = await fetch(signed.signedUrl);
  if (!response.ok || (await response.arrayBuffer()).byteLength !== onePixelPng.length) {
    throw new Error("The signed download did not return the temporary image.");
  }

  console.log(`Supabase Vault is ready and private (${bucketName}).`);
} catch (error) {
  console.error(
    error instanceof Error ? `Supabase Vault check failed: ${error.message}` : "Supabase Vault check failed.",
  );
  process.exitCode = 1;
} finally {
  const { error: cleanupError } = await storage.remove([path]);
  if (cleanupError) {
    console.error("The temporary Vault check file could not be removed.");
    process.exitCode = 1;
  }
}

async function readEnvironmentFile(path) {
  try {
    const content = await readFile(path, "utf8");
    return new Map(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return separator < 1 ? null : [line.slice(0, separator), unquote(line.slice(separator + 1))];
        })
        .filter(Boolean),
    );
  } catch {
    return new Map();
  }
}

function unquote(input) {
  const trimmed = input.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
