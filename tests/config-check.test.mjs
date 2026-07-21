import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("validates complete zero-spend configuration without printing secrets", () => {
  const secret = "sb_secret_value_that_must_not_appear";
  const result = spawnSync(process.execPath, ["scripts/check-config.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_FIREBASE_API_KEY: "public-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "example.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "kincue-test",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:test",
      FIREBASE_PROJECT_ID: "kincue-test",
      FIREBASE_CLIENT_EMAIL: "firebase-admin@example.test",
      FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----",
      SUPABASE_URL: "https://kincue-test.supabase.co",
      SUPABASE_SECRET_KEY: secret,
      SUPABASE_STORAGE_BUCKET: "kincue-vault",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Supabase private Vault: configured/);
  assert.match(result.stdout, /local zero-spend mode/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(secret));
});
