#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const files = new Map<string, string>([
  [
    "tower.config.ts",
    `import { defineApplication } from "@towerjs/blueprint";\n\nexport default defineApplication({\n  framework: "next",\n  database: { provider: "postgres" },\n  auth: { provider: "better-auth" },\n  realtime: { provider: "ably" },\n  storage: { provider: "s3" },\n});\n`,
  ],
  [
    "lib/tower.ts",
    `import { createApplication } from "@towerjs/foundation";\nimport config from "../tower.config";\n\nexport const tower = await createApplication(config);\n`,
  ],
  [
    "package.json",
    `{"scripts":{"dev":"next dev","build":"next build","start":"next start"},"dependencies":{"@towerjs/blueprint":"latest","@towerjs/foundation":"latest","next":"latest","react":"latest","react-dom":"latest"},"devDependencies":{"typescript":"latest"}}\n`,
  ],
  [".env.example", `DATABASE_URL="postgres://user:password@localhost:5432/tower"\n`],
]);

/** Scaffolds the initial hardcoded Tower + Next.js application files. */
export async function scaffold(targetDirectory = process.cwd()): Promise<void> {
  await mkdir(join(targetDirectory, "lib"), { recursive: true });

  for (const [path, contents] of files) {
    await writeFile(join(targetDirectory, path), contents, { flag: "wx" });
  }
}

await scaffold();
console.log("Created a Tower application.");
