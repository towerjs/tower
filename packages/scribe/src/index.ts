#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const files = new Map<string, string>([
  [
    "tower.config.ts",
    `import { defineTower, vault, gatehouse } from "towerjs";\n\nexport default defineTower({\n  framework: "next",\n  modules: [\n    vault({ provider: "neon" }),\n    gatehouse(),\n  ],\n});\n`,
  ],
  [
    "src/tower.ts",
    `import { createTowerApp } from "towerjs";\nimport type { VaultModule, GatehouseModule } from "towerjs";\nimport config from "../tower.config";\n\nconst app = await createTowerApp(config);\n\nexport const tower = {\n  vault: app.container.get<VaultModule>("vault"),\n  gatehouse: app.container.get<GatehouseModule>("gatehouse"),\n};\n`,
  ],
  [
    "package.json",
    `{"private":true,"type":"module","scripts":{"dev":"next dev","build":"next build","start":"next start"},"dependencies":{"towerjs":"latest","next":"latest","react":"latest","react-dom":"latest"},"devDependencies":{"typescript":"latest"}}\n`,
  ],
  [".env.example", `DATABASE_URL="postgres://user:password@localhost:5432/tower"\n`],
]);

export async function scaffold(targetDirectory = process.cwd()): Promise<void> {
  await mkdir(join(targetDirectory, "src"), { recursive: true });

  for (const [path, contents] of files) {
    await writeFile(join(targetDirectory, path), contents, { flag: "wx" });
  }
}

await scaffold();
console.log("Created a Tower application.");
