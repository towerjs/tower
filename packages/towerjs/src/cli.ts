import { createJiti } from "jiti";
import { createTowerApp } from "@towerjs/foundation";
import path from "node:path";
import fs from "node:fs";

export interface CliResult {
  stdout: string[]
  stderr: string[]
  exitCode: number
}

function ok(lines: string[]): CliResult {
  return { stdout: lines, stderr: [], exitCode: 0 }
}

function fail(msg: string): CliResult {
  return { stdout: [], stderr: [msg], exitCode: 1 }
}

/** Runs a CLI command (migrate, seed, or help). */
export async function run(command: string | undefined, flags: string[], configPath?: string): Promise<CliResult> {
  const runSeed = flags.includes("--seed") || flags.includes("-s");
  const skipMigrate = flags.includes("--skip-migrate");

  switch (command) {
    case "migrate":
      return runMigrate(runSeed, configPath);
    case "seed":
      return runSeedCmd(skipMigrate, configPath);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return ok(helpText());
    default:
      return fail(`Unknown command: ${command}`);
  }
}

async function runMigrate(runSeed: boolean, configPath?: string): Promise<CliResult> {
  const lines: string[] = [];
  const app = await loadApp(configPath);

  const vault = getModule(app, "vault");
  if (vault?.migrate) {
    lines.push("Running vault migrations...");
    await vault.migrate();
  }

  const gatehouse = getModule(app, "gatehouse");
  if (gatehouse?.migrate) {
    lines.push("Running auth migrations...");
    await gatehouse.migrate();
  }

  if (runSeed && vault?.seed) {
    lines.push("Running seeds...");
    await vault.seed();
  }

  await closeModules(app);
  lines.push("Done.");
  return ok(lines);
}

async function runSeedCmd(skipMigrate: boolean, configPath?: string): Promise<CliResult> {
  const lines: string[] = [];
  const app = await loadApp(configPath);

  const vault = getModule(app, "vault");
  if (!vault?.seed) {
    return fail("Vault not configured or seeds not available.");
  }

  if (!skipMigrate && vault.migrate) {
    lines.push("Running vault migrations...");
    await vault.migrate();
  }

  lines.push("Running seeds...");
  await vault.seed();

  await closeModules(app);
  lines.push("Done.");
  return ok(lines);
}

export function getModule(app: any, name: string): any {
  return app.container.has(name)
    ? app.container.get(name)
    : app.container.get(`module.${name}`);
}

export async function loadApp(configPath?: string) {
  if (!configPath) configPath = findConfig();
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const config = (await jiti.import(configPath)) as any;
  return createTowerApp(config);
}

export async function closeModules(app: any) {
  const vault = getModule(app, "vault");
  if (vault?.close) {
    await vault.close();
  }
}

/** Searches up from cwd to find tower.config.ts. */
export function findConfig(cwd?: string): string {
  let dir = cwd ?? process.cwd();
  for (let i = 0; i < 20; i++) {
    for (const name of ["tower.config.ts", "tower.config.mjs", "tower.config.js"]) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) return fullPath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find tower.config.ts in this or any parent directory.");
}



export function helpText(): string[] {
  return [
    "",
    "Usage: tower <command>",
    "",
    "Commands:",
    "  migrate          Run database and auth migrations",
    "  migrate --seed   Run migrations, then seeds",
    "  seed             Run seeds (runs migrations first unless --skip-migrate)",
    "  seed --skip-migrate  Run seeds without running migrations first",
    "  help             Show this message",
    "",
  ];
}

const entryUrl = process.argv[1];
if (entryUrl && (entryUrl.endsWith("/cli.ts") || entryUrl.endsWith("/cli.js") || entryUrl.endsWith("\\cli.js"))) {
  const [command, ...flags] = process.argv.slice(2);
  const result = await run(command, flags);
  for (const line of result.stdout) process.stdout.write(line + "\n");
  for (const line of result.stderr) process.stderr.write(line + "\n");
  process.exit(result.exitCode);
}
