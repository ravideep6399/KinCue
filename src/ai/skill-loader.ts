import "server-only";
import { readFileSync } from "node:fs";

const extractHandover = readFileSync(
  new URL("./skills/extract-handover.md", import.meta.url),
  "utf8",
);

export const runtimeSkills = {
  extractHandover,
} as const;
