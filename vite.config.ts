import vinext from "vinext";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { sites } from "./build/sites-vite-plugin";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    define: {
      __dirname: JSON.stringify("/"),
    },
    resolve: {
      alias: {
        "firebase-admin/app": resolve("node_modules/firebase-admin/lib/app/index.js"),
        "firebase-admin/auth": resolve("node_modules/firebase-admin/lib/auth/index.js"),
        "firebase-admin/firestore": resolve(
          "node_modules/firebase-admin/lib/firestore/index.js",
        ),
      },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
