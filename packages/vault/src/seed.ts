import type { Vault, VaultSeedConfig } from './types.js'

/** Runs seed files from the configured seed folder. Pass a name to run a single seed file. */
export async function runSeeds(db: Vault, config: VaultSeedConfig, name?: string): Promise<{ applied: string[] }> {
  let nodeFs: typeof import('node:fs')
  let nodePath: typeof import('node:path')
  try {
    nodeFs = await import('node:fs')
    nodePath = await import('node:path')
  } catch {
    throw new Error('Filesystem access not available in this runtime. Seed files cannot be loaded.')
  }

  const seedFolder = nodePath.resolve(config.folder)
  const applied: string[] = []

  if (!nodeFs.existsSync(seedFolder)) {
    return { applied }
  }

  const all = await nodeFs.promises.readdir(seedFolder)
  const entries = all.filter((f) => f.endsWith('.js') || f.endsWith('.ts')).sort()

  const files = name ? entries.filter((e) => e.includes(name)) : entries

  if (files.length === 0) {
    return { applied }
  }

  for (const file of files) {
    const seedPath = nodePath.join(seedFolder, file)
    const mod = await import(seedPath)
    const run = mod.default ?? mod.seed
    if (typeof run !== 'function') {
      throw new Error(`Seed "${file}" has no default export or named "seed" export`)
    }
    await run(db)
    applied.push(file)
  }

  return { applied }
}
