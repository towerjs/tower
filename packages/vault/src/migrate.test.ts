import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMigrateToLatest, mockMigrator } = vi.hoisted(() => {
  const fn = vi.fn()
  return {
    mockMigrateToLatest: fn,
    mockMigrator: { migrateToLatest: fn },
  }
})

vi.mock('kysely/migration', () => ({
  Migrator: class {
    constructor() {
      return mockMigrator
    }
  },
  FileMigrationProvider: class {},
}))

vi.mock('node:path', () => ({
  resolve: vi.fn((_: string, folder: string) => `/resolved/${folder}`),
  default: { resolve: vi.fn((_: string, folder: string) => `/resolved/${folder}`) },
}))

import { createMigrator, migrateToLatest } from './migrate.js'

describe('createMigrator', () => {
  it('creates a Migrator with FileMigrationProvider', () => {
    const db = {} as any
    const config = { folder: 'migrations' }
    const result = createMigrator(db, config)

    expect(result).toBe(mockMigrator)
  })
})

describe('migrateToLatest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls migrator.migrateToLatest', async () => {
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: [
        { migrationName: '001_create_users', status: 'Success' },
        { migrationName: '002_add_roles', status: 'Success' },
      ],
    })

    await migrateToLatest({} as any, { folder: 'migrations' })

    expect(mockMigrateToLatest).toHaveBeenCalledOnce()
  })

  it('throws on failed migration', async () => {
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: [
        { migrationName: '001_create_users', status: 'Success' },
        { migrationName: '002_broken', status: 'Error' },
      ],
    })

    await expect(migrateToLatest({} as any, { folder: 'migrations' })).rejects.toThrow('Migration "002_broken" failed')
  })

  it('throws when migrator returns an error', async () => {
    mockMigrateToLatest.mockResolvedValueOnce({
      error: new Error('Migration failed'),
      results: [],
    })

    await expect(migrateToLatest({} as any, { folder: 'migrations' })).rejects.toThrow('Migration failed')
  })

  it('handles empty results array', async () => {
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: [],
    })

    await expect(migrateToLatest({} as any, { folder: 'migrations' })).resolves.toBeUndefined()
  })

  it('handles null results gracefully', async () => {
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: null,
    })

    await expect(migrateToLatest({} as any, { folder: 'migrations' })).resolves.toBeUndefined()
  })
})
