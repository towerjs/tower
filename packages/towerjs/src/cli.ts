import { createJiti } from "jiti";
import { createTowerApp } from "@towerjs/foundation";
import path from "node:path";
import fs from "node:fs";

const [command] = process.argv.slice(2);

switch (command) {
  case "migrate":
    await migrate();
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default:
    if (command) console.error(`Unknown command: ${command}`);
    help();
    process.exit(1);
}

async function migrate() {
  console.log("Running Tower migration...");
  try {
    const configPath = findConfig();
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const config = (await jiti.import(configPath)) as any;
    const app = await createTowerApp(config);
    const gatehouse = app.container.get<any>("module.gatehouse");
    await gatehouse.migrate();
    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", (err as Error).message);
    process.exit(1);
  }
}

function findConfig(): string {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    for (const name of ["tower.config.ts", "tower.config.mjs", "tower.config.js"]) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) return fullPath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.error("Could not find tower.config.ts in this or any parent directory.");
  process.exit(1);
}

function help() {
  console.log(`
Usage: tower <command>

Commands:
  migrate   Create auth database tables (idempotent)
  help      Show this message
`);
}
