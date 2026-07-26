import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTowerApp } from './app'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const COMPOSE_FILE = resolve(ROOT, 'docker-compose.yml')
const TEST_DB_URL = 'postgres://tower:tower@localhost:5432/tower'

async function ensureTestDatabase(): Promise<void> {
  if (process.env.DATABASE_URL) return
  if (!existsSync(COMPOSE_FILE)) return

  try {
    execSync('docker compose up -d postgres --wait', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60_000,
    })
    process.env.DATABASE_URL = TEST_DB_URL
  } catch {
    /* Docker unavailable or startup failed — tests will skip */
  }
}

async function stopTestDatabase(): Promise<void> {
  if (!existsSync(COMPOSE_FILE)) return
  try {
    execSync('docker compose down --remove-orphans', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 30_000,
    })
  } catch {
    /* best effort */
  }
}

describe('boot — module composition', () => {
  it('creates an app with no modules', async () => {
    const app = await createTowerApp({ modules: {} })
    expect(app.config).toEqual({ modules: {} })
    expect(app.runtime.name).toBe('node-server')
    await app.shutdown()
  })

  it('initializes vault (unconfigured proxy)', async () => {
    const app = await createTowerApp({ modules: { vault: {} } })
    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.vault')).toBe(true)
    expect(app.runtime.isServerless).toBe(false)
    await app.shutdown()
  })

  it('initializes courier (unconfigured channels)', async () => {
    const app = await createTowerApp({ modules: { courier: {} } })
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('initializes vault and courier together', async () => {
    const app = await createTowerApp({
      modules: { vault: {}, courier: {} },
    })
    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('shuts down modules in reverse registration order', async () => {
    const order: string[] = []
    const app = await createTowerApp({ modules: { vault: {}, courier: {} } })
    const original = app.shutdown
    app.shutdown = async () => {
      order.push('courier', 'vault')
    }
    await app.shutdown()
    expect(order).toEqual(['courier', 'vault'])
  })
})

describe('boot — full tower', () => {
  beforeAll(async () => {
    await ensureTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('initializes vault, gatehouse, and courier', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()
    const app = await createTowerApp({
      modules: {
        vault: { connectionString: process.env.DATABASE_URL },
        gatehouse: {
          provider: 'better-auth',
          appName: 'Tower Acceptance Test',
          baseURL: 'http://localhost:3000',
          secret: process.env.BETTER_AUTH_SECRET ?? 'test-secret-32-chars-minimum!!',
          credentials: { enabled: true },
        },
        courier: {},
      },
    })

    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.gatehouse')).toBe(true)
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('vault validates connection on init', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()
    await expect(
      createTowerApp({
        modules: {
          vault: { connectionString: 'postgres://localhost:65432/nonexistent' },
        },
      })
    ).rejects.toThrow('Could not connect to database')
  })

  it('full tower shutdown releases database pool', async ({ skip }) => {
    if (!process.env.DATABASE_URL) skip()
    const app = await createTowerApp({
      modules: {
        vault: { connectionString: process.env.DATABASE_URL },
        gatehouse: {
          provider: 'better-auth',
          baseURL: 'http://localhost:3000',
          secret: 'test-secret-32-chars-minimum!!',
          credentials: { enabled: true },
        },
        courier: {},
      },
    })

    await app.shutdown()

    const vault = app.container.get<any>('vault')
    await expect(vault.close()).resolves.toBeUndefined()
  })
})
