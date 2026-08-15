import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const COMPOSE_FILE = resolve(ROOT, 'docker-compose.yml')
const TEST_DB_URL = 'postgres://tower:tower@localhost:5432/tower'

let startedBySetup = false

export async function setup(): Promise<void> {
  if (process.env.DATABASE_URL) return

  if (!existsSync(COMPOSE_FILE)) return

  try {
    execSync('docker compose up -d postgres --wait', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 90_000,
    })
    process.env.DATABASE_URL = TEST_DB_URL
    startedBySetup = true
  } catch {
    /* Docker unavailable or startup failed — DB tests will skip */
  }
}

export async function teardown(): Promise<void> {
  if (!startedBySetup) return
  try {
    execSync('docker compose down', { cwd: ROOT, stdio: 'pipe', timeout: 30_000 })
  } catch {
    /* best effort */
  }
}
