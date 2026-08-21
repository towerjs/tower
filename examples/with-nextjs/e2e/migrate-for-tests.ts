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

  const { initTower } = await import('@towerjs/tower/runtime')
  const { vault } = await import('@towerjs/vault')
  const { gatehouse } = await import('@towerjs/gatehouse')
  const { courier } = await import('@towerjs/courier')
  await initTower([vault({ connectionString: databaseUrl }), gatehouse({ provider: 'better-auth' }), courier({ email: { provider: 'console' } })])
  const { Gatehouse } = await import('@towerjs/gatehouse')
  await Gatehouse.migrate()
  console.log('[setup] Migration complete')
}

main().catch((err) => {
  console.error('[setup] Failed:', err)
  process.exit(1)
})
