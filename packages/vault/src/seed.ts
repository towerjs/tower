import * as nodeFs from "node:fs"
import * as nodePath from "node:path"
import type { VaultDb, VaultSeedConfig } from "./types.js"

export async function runSeeds(
  db: VaultDb,
  config: VaultSeedConfig,
  name?: string,
): Promise<void> {
  const seedFolder = nodePath.resolve(config.folder)

  if (!nodeFs.existsSync(seedFolder)) {
    console.log(`Seed folder not found: ${seedFolder}`)
    return
  }

  const all = await nodeFs.promises.readdir(seedFolder)
  const entries = all
    .filter(f => f.endsWith(".js") || f.endsWith(".ts"))
    .sort()

  const files = name
    ? entries.filter(e => e.includes(name))
    : entries

  if (files.length === 0) {
    console.log(name ? `No seed file matching "${name}"` : "No seed files found")
    return
  }

  for (const file of files) {
    const seedPath = nodePath.join(seedFolder, file)
    console.log(`Running seed: ${file}`)
    try {
      const mod = await import(seedPath)
      const run = mod.default ?? mod.seed
      if (typeof run !== "function") {
        console.warn(`Seed "${file}" has no default export or named "seed" export`)
        continue
      }
      await run(db)
      console.log(`Seed "${file}" applied`)
    } catch (err) {
      console.error(`Seed "${file}" failed:`, err)
      throw err
    }
  }
}
