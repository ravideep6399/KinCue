import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      DB: {},
      FILES: {},
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the KinCue product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>KinCue<\/title>/i);
  assert.match(html, /Sharma Family/);
  assert.match(html, /Active Care Shift/);
  assert.match(html, /Today.s timeline/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the runtime skill and removes starter preview files", async () => {
  const skill = await readFile(
    new URL("../src/ai/skills/extract-handover.md", import.meta.url),
    "utf8",
  );
  const packageJson = await readFile(new URL("../package.json", import.meta.url), "utf8");

  assert.match(skill, /Never invent missing information/);
  assert.match(skill, /Never infer, normalize, or change medication/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", root)));
});
