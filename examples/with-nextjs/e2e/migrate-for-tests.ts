import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadLocalEnv() {
  const envPath = resolve(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
}

if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = 'dev-secret-do-not-use-in-production-32chars'
}

async function main() {
  loadLocalEnv()

  const { Pool } = await import('pg')
  const databaseUrl = process.env.DATABASE_URL || 'postgres://tower:tower@localhost:5432/tower'
  const pool = new Pool({ connectionString: databaseUrl })

  console.log('[setup] Resetting database schema...')
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
  await pool.query('CREATE SCHEMA public')
  await pool.end()
  console.log('[setup] Schema reset complete')

  // Use the application's own Tower config so migrations match the exact
  // module set (and every provider plugin) the dev server runs with.
  const { createTowerApp } = await import('@towerjs/tower/foundation')
  const config = (await import('../tower.config')).default
  await createTowerApp(config)
  const gatehouseModule = (config.modules as Array<{ name: string; migrate?: () => Promise<void> }>).find(
    (m) => m.name === 'gatehouse'
  )
  if (!gatehouseModule?.migrate) throw new Error('Gatehouse module not found in tower.config.ts')
  await gatehouseModule.migrate()
  console.log('[setup] Migration complete')
}

main().catch((err) => {
  console.error('[setup] Failed:', err)
  process.exit(1)
})
