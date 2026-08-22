// ─── Imports (must be after mocks) ─────────────────────────────────
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createVaultModule, vault } from './index.js'

// ─── Hoisted shared mocks (must be before any vi.mock) ─────────────

const mocks = vi.hoisted(() => {
  const mockConnect = vi.fn()
  const mockEnd = vi.fn().mockResolvedValue(undefined)
  const mockOn = vi.fn()
  const mockQuery = vi.fn()
  const mockMigrateToLatest = vi.fn()
  const mockRunSeeds = vi.fn()
  const mockNeonQuery = vi.fn()
  let kyselyInstance: any = {}
  const setKyselyInstance = (inst: any) => {
    kyselyInstance = inst
  }

  const pgPoolArgs: any[] = []
  const neonPoolArgs: any[] = []
  const neonDialectArgs: any[] = []
  const clearPoolArgs = () => {
    pgPoolArgs.length = 0
    neonPoolArgs.length = 0
    neonDialectArgs.length = 0
  }

  return {
    mockConnect,
    mockEnd,
    mockOn,
    mockQuery,
    mockNeonQuery,
    mockMigrateToLatest,
    mockRunSeeds,
    kyselyInstance,
    setKyselyInstance,
    pgPoolArgs,
    neonPoolArgs,
    neonDialectArgs,
    clearPoolArgs,
  }
})

// ─── Mocks ─────────────────────────────────────────────────────────

vi.mock('pg', () => {
  function Pool(this: any, opts: any) {
    mocks.pgPoolArgs.push(opts)
    return {
      connect: mocks.mockConnect,
      end: mocks.mockEnd,
      on: mocks.mockOn,
      query: mocks.mockQuery,
    }
  }
  return { Pool }
})

vi.mock('@neondatabase/serverless', () => {
  function Pool(this: any, opts: any) {
    mocks.neonPoolArgs.push(opts)
    return {
      connect: mocks.mockConnect,
      end: mocks.mockEnd,
      on: mocks.mockOn,
      query: mocks.mockQuery,
    }
  }
  return { Pool, neon: vi.fn(() => mocks.mockNeonQuery), neonConfig: { fetchConnectionCache: false } }
})

vi.mock('kysely-neon', () => {
  function NeonDialect(this: any, opts: any) {
    mocks.neonDialectArgs.push(opts)
  }
  return { NeonDialect }
})

vi.mock('kysely', () => {
  function Kysely(this: any, opts: any) {
    const inst = {
      _opts: opts,
      selectFrom: () => inst,
      transaction: () => ({ execute: (fn: any) => fn() }),
    }
    mocks.setKyselyInstance(inst)
    return inst
  }
  function PostgresDialect(this: any, _opts: any) {}
  return { Kysely, PostgresDialect }
})

vi.mock('./migrate.js', () => ({
  createMigrator: vi.fn(() => ({
    migrateToLatest: mocks.mockMigrateToLatest,
  })),
  migrateToLatest: mocks.mockMigrateToLatest,
}))

vi.mock('./seed.js', () => ({
  runSeeds: mocks.mockRunSeeds,
}))

// ─── Helpers ───────────────────────────────────────────────────────

const mockContainer = () => ({
  register: vi.fn(),
  get: vi.fn(),
  has: vi.fn(),
  registerFactory: vi.fn(),
})

const mockCtx = (overrides = {}) => ({
  services: mockContainer(),
  config: { modules: {} },
  runtime: { name: 'node-server' as const, isServerless: false },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NODE_ENV
  delete process.env.DATABASE_URL
  mocks.setKyselyInstance({})
  mocks.clearPoolArgs()
})

// ─── Unconfigured proxy (must run first — _vault is module-level) ──

describe('unconfigured vault proxy', () => {
  it('throws on migrate access', () => {
    expect(() => (vault as any).migrate).toThrow('Vault not initialized')
  })

  it('throws on seed access', () => {
    expect(() => (vault as any).seed).toThrow('Vault not initialized')
  })

  it('throws on close access', () => {
    expect(() => (vault as any).close).toThrow('Vault not initialized')
  })
})

// ─── buildProxyUnconfigured (via init with no connection string) ────

describe('buildProxyUnconfigured', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // re-init without connection string to get the unconfigured proxy
    const mod = createVaultModule()
    await mod.init!(mockCtx())
  })

  it('throws configured error on migrate', () => {
    expect(() => (vault as any).migrate()).toThrow(
      'Vault not configured. Set DATABASE_URL or pass connectionString to vault().'
    )
  })

  it('throws configured error on migrator', () => {
    expect(() => (vault as any).migrator).toThrow(
      'Vault not configured. Set DATABASE_URL or pass connectionString to vault().'
    )
  })

  it('throws configured error on seed', () => {
    expect(() => (vault as any).seed()).toThrow(
      'Vault not configured. Set DATABASE_URL or pass connectionString to vault().'
    )
  })
})

// ─── Module lifecycle ──────────────────────────────────────────────

describe('createVaultModule', () => {
  it('returns a TowerModule with name vault', () => {
    const mod = createVaultModule()
    expect(mod.name).toBe('vault')
    expect(typeof mod.init).toBe('function')
  })

  it('registers unconfigured proxy when no connection string', async () => {
    const mod = createVaultModule()
    const ctx = mockCtx()
    await mod.init!(ctx)
    expect(ctx.services.register).toHaveBeenCalledWith('vault', expect.anything())
  })

  it('registers configured proxy when connection string provided', async () => {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })

    const mod = createVaultModule({ connectionString: 'postgres://u:p@localhost:5432/db' })
    const ctx = mockCtx()
    await mod.init!(ctx)

    expect(ctx.services.register).toHaveBeenCalledWith('vault', expect.anything())
    expect(mocks.mockConnect).toHaveBeenCalled()
  })

  it('reads DATABASE_URL env var', async () => {
    process.env.DATABASE_URL = 'postgres://u:p@host:5432/db'
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })

    const mod = createVaultModule()
    const ctx = mockCtx()
    await mod.init!(ctx)

    expect(ctx.services.register).toHaveBeenCalledWith('vault', expect.anything())
  })

  it('fails fast when connection fails', async () => {
    mocks.mockConnect.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

    const mod = createVaultModule({ connectionString: 'postgres://u:p@localhost:5432/db' })
    const ctx = mockCtx()

    await expect(mod.init!(ctx)).rejects.toThrow('Could not connect to database')
  })

  it('drains pool on connection failure then throws', async () => {
    mocks.mockConnect.mockRejectedValueOnce(new Error('fail'))

    const mod = createVaultModule({ connectionString: 'postgres://u:p@localhost:5432/db' })
    const ctx = mockCtx()

    await expect(mod.init!(ctx)).rejects.toThrow('Could not connect to database')
    expect(mocks.mockEnd).toHaveBeenCalled()
  })

  it('sanitizes credentials in error message', async () => {
    mocks.mockConnect.mockRejectedValue(new Error('auth failed'))

    const mod = createVaultModule({ connectionString: 'postgres://admin:s3cret@localhost:5432/db' })
    let err: any
    try {
      await mod.init!(mockCtx())
    } catch (e) {
      err = e
    }

    expect(err).toBeDefined()
    expect(err.message).toContain('//***@')
    expect(err.message).not.toContain('s3cret')
  })

  it('surfaces the underlying cause from a pg AggregateError', async () => {
    const aggregate = new AggregateError([new Error('connect ECONNREFUSED ::1:5432')])
    mocks.mockConnect.mockRejectedValueOnce(aggregate)

    const mod = createVaultModule({ connectionString: 'postgres://u:p@localhost:5432/db' })
    let err: any
    try {
      await mod.init!(mockCtx())
    } catch (e) {
      err = e
    }

    expect(err.message).toContain('connect ECONNREFUSED ::1:5432')
  })
})

// ─── vault singleton proxy (after init) ────────────────────────────

describe('vault singleton proxy', () => {
  beforeEach(async () => {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })
    const mod = createVaultModule({ connectionString: 'postgres://u:p@localhost:5432/db' })
    await mod.init!(mockCtx())
  })

  it('forwards Kysely methods', () => {
    expect(typeof (vault as any).selectFrom).toBe('function')
  })
})

// ─── Proxy methods ─────────────────────────────────────────────────

describe('vault proxy methods', () => {
  beforeEach(async () => {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })
    const mod = createVaultModule({ connectionString: 'postgres://u:p@localhost:5432/db' })
    await mod.init!(mockCtx())
  })

  it('migrate calls migrateToLatest', async () => {
    mocks.mockMigrateToLatest.mockResolvedValueOnce({ error: null, results: [] })
    await (vault as any).migrate()
    expect(mocks.mockMigrateToLatest).toHaveBeenCalled()
  })

  it('migrate throws on migration error', async () => {
    mocks.mockMigrateToLatest.mockRejectedValueOnce(new Error('fail'))
    await expect((vault as any).migrate()).rejects.toThrow('fail')
  })

  it('seed calls runSeeds', async () => {
    await (vault as any).seed()
    expect(mocks.mockRunSeeds).toHaveBeenCalledWith(
      expect.any(Object),
      { folder: expect.stringContaining('seeds') },
      undefined
    )
  })

  it('seed passes optional name filter', async () => {
    await (vault as any).seed('users')
    expect(mocks.mockRunSeeds).toHaveBeenCalledWith(
      expect.any(Object),
      { folder: expect.stringContaining('seeds') },
      'users'
    )
  })

  it('close drains pool', async () => {
    await (vault as any).close()
    expect(mocks.mockEnd).toHaveBeenCalled()
  })

  it('transaction delegates to Kysely', async () => {
    const trxFn = vi.fn().mockResolvedValue('ok')
    const result = await (vault as any).transaction(trxFn)
    expect(result).toBe('ok')
    expect(trxFn).toHaveBeenCalled()
  })

  it('exposes migrator', () => {
    expect((vault as any).migrator).toBeDefined()
    expect(typeof (vault as any).migrator.migrateToLatest).toBe('function')
  })
})

// ─── Provider detection ────────────────────────────────────────────

describe('provider detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function initWithUrl(url: string, provider?: string) {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })
    const mod = createVaultModule(
      provider ? { connectionString: url, provider: provider as any } : { connectionString: url }
    )
    await mod.init!(mockCtx())
  }

  it('defaults to pg for standard URLs', async () => {
    await initWithUrl('postgres://u:p@localhost:5432/db')
    expect(mocks.pgPoolArgs.length).toBeGreaterThanOrEqual(1)
  })

  it('uses kysely-neon for neon.tech URLs', async () => {
    await initWithUrl('postgres://u:p@db.neon.tech/db')
    expect(mocks.neonDialectArgs).toHaveLength(1)
    expect(mocks.pgPoolArgs).toHaveLength(0)
    expect(mocks.neonDialectArgs[0].neon).toEqual(expect.any(Function))
  })

  it('honours explicit provider config over URL detection', async () => {
    await initWithUrl('postgres://u:p@db.neon.tech/db', 'pg')
    expect(mocks.pgPoolArgs.length).toBeGreaterThanOrEqual(1)
    expect(mocks.neonDialectArgs).toHaveLength(0)
  })
})

// ─── SSL ───────────────────────────────────────────────────────────

describe('SSL resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function initWithUrl(url: string, pool?: any) {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })
    mocks.clearPoolArgs()
    const mod = createVaultModule({ connectionString: url, pool } as any)
    await mod.init!(mockCtx())
    return mocks.pgPoolArgs[0]
  }

  it('no SSL in dev without sslmode', async () => {
    const args = await initWithUrl('postgres://localhost/db')
    expect(args.ssl).toBeUndefined()
  })

  it('SSL in production', async () => {
    process.env.NODE_ENV = 'production'
    const args = await initWithUrl('postgres://localhost/db')
    expect(args.ssl).toBe(true)
  })

  it('SSL from sslmode=require', async () => {
    const args = await initWithUrl('postgres://localhost/db?sslmode=require')
    expect(args.ssl).toBe(true)
  })

  it('self-signed certs from sslmode=no-verify', async () => {
    const args = await initWithUrl('postgres://localhost/db?sslmode=no-verify')
    expect(args.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('no SSL from sslmode=disable even in production', async () => {
    process.env.NODE_ENV = 'production'
    const args = await initWithUrl('postgres://localhost/db?sslmode=disable')
    expect(args.ssl).toBe(false)
  })

  it('explicit pool.ssl overrides everything', async () => {
    process.env.NODE_ENV = 'production'
    const args = await initWithUrl('postgres://localhost/db?sslmode=require', { ssl: false })
    expect(args.ssl).toBe(false)
  })
})

// ─── Pool error handler ────────────────────────────────────────────

describe('pool error handler', () => {
  it('attaches error listener to pool', async () => {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })

    const mod = createVaultModule({ connectionString: 'postgres://localhost/db' })
    await mod.init!(mockCtx())

    expect(mocks.mockOn).toHaveBeenCalledWith('error', expect.any(Function))
  })

  it('does not crash on pool errors', async () => {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })

    const mod = createVaultModule({ connectionString: 'postgres://localhost/db' })
    await mod.init!(mockCtx())

    const handler = mocks.mockOn.mock.calls.find((c: any[]) => c[0] === 'error')?.[1]
    expect(handler).toBeDefined()
    expect(() => handler(new Error('connection lost'))).not.toThrow()
  })
})

// ─── Pool config passthrough ───────────────────────────────────────

describe('pool config passthrough', () => {
  it('forwards pool config options', async () => {
    mocks.mockConnect.mockResolvedValueOnce({
      query: vi.fn().mockResolvedValueOnce(undefined),
      release: vi.fn(),
    })

    mocks.clearPoolArgs()
    await createVaultModule({
      connectionString: 'postgres://localhost/db',
      pool: { max: 10, idleTimeoutMillis: 5000, connectionTimeoutMillis: 3000 },
    }).init!(mockCtx())

    const args = mocks.pgPoolArgs[0]
    expect(args.max).toBe(10)
    expect(args.idleTimeoutMillis).toBe(5000)
    expect(args.connectionTimeoutMillis).toBe(3000)
  })
})

// ─── Multiple init calls ───────────────────────────────────────────

describe('multiple init calls', () => {
  it('closes previous instance on re-init', async () => {
    mocks.mockConnect.mockResolvedValue({
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    })

    const mod = createVaultModule({ connectionString: 'postgres://localhost/db' })
    await mod.init!(mockCtx())

    // second init should close the first pool
    const callsBefore = mocks.mockEnd.mock.calls.length
    await mod.init!(mockCtx())
    expect(mocks.mockEnd.mock.calls.length).toBeGreaterThan(callsBefore)
  })
})

// ─── Neon ──────────────────────────────────────────────────────────

describe('neon', () => {
  it('uses the kysely-neon HTTP dialect without a connection pool', async () => {
    mocks.mockConnect.mockResolvedValue({
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    })

    const mod = createVaultModule({ connectionString: 'postgres://u:p@db.neon.tech/db' })
    await mod.init!(mockCtx())

    expect(mocks.neonDialectArgs).toHaveLength(1)
    expect(mocks.neonPoolArgs).toHaveLength(0)
    expect(mocks.pgPoolArgs).toHaveLength(0)
    expect(mocks.neonDialectArgs[0].neon).toEqual(expect.any(Function))
    expect(mocks.mockConnect).not.toHaveBeenCalled()
  })
})

// ─── Edge Runtime ─────────────────────────────────────────────────

describe('edge runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.clearPoolArgs()
  })

  it('uses the Neon HTTP dialect for neon on edge', async () => {
    const mod = createVaultModule({ connectionString: 'postgres://u:p@db.neon.tech/db' })
    await mod.init!(mockCtx({ runtime: { name: 'edge', isServerless: true } }))

    expect(mocks.neonDialectArgs).toHaveLength(1)
    expect(mocks.neonPoolArgs).toHaveLength(0)
    expect(mocks.neonDialectArgs[0].neon).toEqual(expect.any(Function))
  })

  it('skips connection validation on edge', async () => {
    const mod = createVaultModule({ connectionString: 'postgres://u:p@db.neon.tech/db' })
    await mod.init!(mockCtx({ runtime: { name: 'edge', isServerless: true } }))

    expect(mocks.mockConnect).not.toHaveBeenCalled()
  })

  it('registers configured proxy on edge', async () => {
    const mod = createVaultModule({ connectionString: 'postgres://u:p@db.neon.tech/db' })
    const ctx = mockCtx({ runtime: { name: 'edge', isServerless: true } })
    await mod.init!(ctx)

    expect(ctx.services.register).toHaveBeenCalledWith('vault', expect.anything())
  })

  it('throws for pg provider on edge', async () => {
    const mod = createVaultModule({
      connectionString: 'postgres://u:p@localhost:5432/db',
      provider: 'pg',
    })

    await expect(mod.init!(mockCtx({ runtime: { name: 'edge', isServerless: true } }))).rejects.toThrow(
      'pg provider requires a TCP connection'
    )
  })
})

// ─── Auto-registration (new callable API) ───────────────────────────

describe('auto-registration', () => {
  it('vault() returns a TowerModule with name vault', () => {
    const mod = vault({})
    expect(mod).toBeDefined()
    expect(mod.name).toBe('vault')
  })

  it('vault() without args returns vault module', () => {
    const mod = vault()
    expect(mod.name).toBe('vault')
  })
})
