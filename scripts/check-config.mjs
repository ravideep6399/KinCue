import { readFile } from "node:fs/promises";

const localValues = await readEnvironmentFile(".env.local");
const value = (name) => process.env[name] ?? localValues.get(name) ?? "";
const supabaseSecret = value("SUPABASE_SECRET_KEY") || value("SUPABASE_SERVICE_ROLE_KEY");

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "SUPABASE_URL",
];

const problems = required
  .filter((name) => !value(name).trim())
  .map((name) => `${name} is missing.`);

if (!supabaseSecret.trim()) {
  problems.push("SUPABASE_SECRET_KEY is missing.");
}

const publicProjectId = value("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const adminProjectId = value("FIREBASE_PROJECT_ID");
if (publicProjectId && adminProjectId && publicProjectId !== adminProjectId) {
  problems.push("The Firebase web and Admin project IDs do not match.");
}

const privateKey = unquote(value("FIREBASE_PRIVATE_KEY")).replace(/\\n/g, "\n");
if (privateKey && !privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
  problems.push("FIREBASE_PRIVATE_KEY does not look like a service-account private key.");
}

const supabaseUrl = value("SUPABASE_URL");
if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl);
    if (["your-project.supabase.co", "example.supabase.co"].includes(parsed.hostname)) {
      problems.push("SUPABASE_URL still contains a placeholder project host.");
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      problems.push("SUPABASE_URL must use HTTPS outside local development.");
    }
  } catch {
    problems.push("SUPABASE_URL is not a valid URL.");
  }
}

if (
  supabaseSecret &&
  !supabaseSecret.startsWith("sb_secret_") &&
  !supabaseSecret.startsWith("eyJ")
) {
  problems.push("SUPABASE_SECRET_KEY is not a Supabase Secret or legacy service_role key.");
}

const bucket = value("SUPABASE_STORAGE_BUCKET") || "kincue-vault";
if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(bucket)) {
  problems.push("SUPABASE_STORAGE_BUCKET contains unsupported characters.");
}

if (problems.length > 0) {
  console.error("KinCue configuration needs attention:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("KinCue configuration is ready.");
  console.log(`- Firebase web and Admin: configured (${publicProjectId})`);
  console.log(`- Supabase private Vault: configured (${bucket})`);
  const aiProviders = [
    value("OPENAI_API_KEY") ? "OpenAI" : null,
    value("GEMINI_API_KEY") ? "Gemini" : null,
  ].filter(Boolean);
  console.log(
    `- Handover extraction: ${aiProviders.length ? `${aiProviders.join(" + ")} enabled` : "local zero-spend mode"}`,
  );
}

async function readEnvironmentFile(path) {
  try {
    const content = await readFile(path, "utf8");
    const entries = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return separator < 1 ? null : [line.slice(0, separator), unquote(line.slice(separator + 1))];
      })
      .filter(Boolean);
    return new Map(entries);
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
