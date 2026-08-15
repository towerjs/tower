import type { Vault, VaultSeedConfig } from './types.js'

type NodeFs = typeof import('node:fs')
type NodePath = typeof import('node:path')

/** Runs seed files from the configured seed folder. Pass a name to run a single seed file. */
export async function runSeeds(db: Vault, config: VaultSeedConfig, name?: string): Promise<{ applied: string[] }> {
  let nodeFs: NodeFs
  let nodePath: NodePath
  try {
    nodeFs = await import('node:fs')
    nodePath = await import('node:path')
  } catch {
    throw new Error('Filesystem access not available in this runtime. Seed files cannot be loaded.')
  }

  const seedFolder = nodePath.resolve(config.folder)
  const manifestPath = nodePath.join(seedFolder, '.tower-seeds.json')

  if (!nodeFs.existsSync(seedFolder)) {
    return { applied: [] }
  }

  // Seeds that have already been applied on a prior run are skipped so that
  // re-running `tower seed` does not duplicate data.
  const applied = await readManifest(nodeFs, manifestPath)

  const all = await nodeFs.promises.readdir(seedFolder)
  const entries = all.filter((f) => (f.endsWith('.js') || f.endsWith('.ts')) && f !== '.tower-seeds.json').sort()

  const files = name ? entries.filter((e) => e.includes(name)) : entries

  if (files.length === 0) {
    return { applied: [] }
  }

  const newlyApplied: string[] = []
  for (const file of files) {
    if (applied.includes(file)) continue
    const seedPath = nodePath.join(seedFolder, file)
    const mod = await import(seedPath)
    const run = mod.default ?? mod.seed
    if (typeof run !== 'function') {
      throw new Error(`Seed "${file}" has no default export or named "seed" export`)
    }
    await run(db)
    applied.push(file)
    newlyApplied.push(file)
  }

  await writeManifest(nodeFs, manifestPath, applied)

  return { applied: newlyApplied }
}

async function readManifest(nodeFs: NodeFs, manifestPath: string): Promise<string[]> {
  if (!nodeFs.existsSync(manifestPath)) return []
  try {
    const raw = await nodeFs.promises.readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(raw) as { applied?: unknown }
    return Array.isArray(parsed.applied) ? parsed.applied.filter((f): f is string => typeof f === 'string') : []
  } catch {
    return []
  }
}

async function writeManifest(nodeFs: NodeFs, manifestPath: string, applied: string[]): Promise<void> {
  await nodeFs.promises.writeFile(manifestPath, JSON.stringify({ applied }, null, 2))
}
