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
  try {
    const configPath = findConfig();
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const config = (await jiti.import(configPath)) as any;
    const app = await createTowerApp(config);

    const vault = app.container.has("vault")
      ? app.container.get<any>("vault")
      : app.container.get<any>("module.vault");

    if (vault?.migrate) {
      console.log("Running vault migrations...");
      await vault.migrate();
    }

    const gatehouse = app.container.has("gatehouse")
      ? app.container.get<any>("gatehouse")
      : app.container.get<any>("module.gatehouse");

    if (gatehouse?.migrate) {
      console.log("Running auth migrations...");
      await gatehouse.migrate();
    }

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
  migrate   Run database and auth migrations
  help      Show this message
`);
}
