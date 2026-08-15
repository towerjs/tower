import { describe, expect, it } from 'vitest'

import { parseVaultConfig } from './schemas.js'

describe('vault config validation', () => {
  it('accepts no config', () => {
    expect(() => parseVaultConfig(undefined)).not.toThrow()
  })

  it('accepts an empty config', () => {
    expect(() => parseVaultConfig({})).not.toThrow()
  })

  it('accepts a minimal connection string config', () => {
    expect(() => parseVaultConfig({ connectionString: 'postgres://u:p@localhost:5432/db' })).not.toThrow()
  })

  it('accepts a full config', () => {
    expect(() =>
      parseVaultConfig({
        provider: 'neon',
        connectionString: 'postgres://u:p@db.neon.tech/db',
        pool: { max: 10, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, ssl: { rejectUnauthorized: false } },
        migrations: { folder: './migrations' },
        seeds: { folder: './seeds' },
      })
    ).not.toThrow()
  })

  it('accepts ssl as a boolean', () => {
    expect(() => parseVaultConfig({ pool: { ssl: false } })).not.toThrow()
  })

  it('rejects an unknown provider', () => {
    expect(() => parseVaultConfig({ provider: 'mysql' as any })).toThrow(/Invalid configuration/)
  })

  it('rejects a non-string connection string', () => {
    expect(() => parseVaultConfig({ connectionString: 42 as any })).toThrow(/Invalid configuration/)
  })

  it('rejects a string pool max', () => {
    expect(() => parseVaultConfig({ pool: { max: '10' } as any })).toThrow(/Invalid configuration/)
  })

  it('rejects a negative pool timeout', () => {
    expect(() => parseVaultConfig({ pool: { idleTimeoutMillis: -1 } as any })).toThrow(/Invalid configuration/)
  })

  it('rejects an unknown top-level key', () => {
    expect(() => parseVaultConfig({ connectionstring: 'postgres://x' } as any)).toThrow(/Invalid configuration/)
  })

  it('rejects an unknown pool key', () => {
    expect(() => parseVaultConfig({ pool: { max: 5, timeouts: 1000 } as any })).toThrow(/Invalid configuration/)
  })

  it('rejects a migration config without a folder', () => {
    expect(() => parseVaultConfig({ migrations: {} } as any)).toThrow(/Invalid configuration/)
  })
})
