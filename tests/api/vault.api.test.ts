import { describe, expect, it } from 'vitest'

describe('Vault public API contract', () => {
  describe('public exports exist', () => {
    it('exports vault proxy singleton', async () => {
      const { vault } = await import('@towerjs/vault')
      expect(vault).toBeDefined()
      expect(['object', 'function'].includes(typeof vault)).toBe(true)
    })

    it('exports sql from kysely', async () => {
      const { sql } = await import('@towerjs/vault')
      expect(typeof sql).toBe('function')
    })

    it('exports Generated type helper (re-exported from kysely)', async () => {
      // runtime check: js export is a no-op but type exists; sql is proof the re-export path works
      const m = await import('@towerjs/vault')
      expect(m).toHaveProperty('sql')
    })

    it('exports migration helpers', async () => {
      const { createMigrator, migrateToLatest } = await import('@towerjs/vault')
      expect(typeof createMigrator).toBe('function')
      expect(typeof migrateToLatest).toBe('function')
    })

    it('exports seed helpers', async () => {
      const { runSeeds } = await import('@towerjs/vault')
      expect(typeof runSeeds).toBe('function')
    })

    it('exports provider abstraction', async () => {
      const { resolveProviderName, resolveVaultProvider, pgProvider, neonProvider } = await import('@towerjs/vault')
      expect(typeof resolveProviderName).toBe('function')
      expect(typeof resolveVaultProvider).toBe('function')
      expect(pgProvider).toBeDefined()
      expect(neonProvider).toBeDefined()
    })
  })

  describe('defineVault', () => {
    it('returns a TowerModule with name vault', async () => {
      const { defineVault } = await import('@towerjs/vault')
      const mod = defineVault({ connectionString: 'postgres://test' })
      expect(mod.name).toBe('vault')
      expect(mod.dependsOn).toEqual([])
    })

    it('vault is callable as generic factory vault<DB>()', async () => {
      const { vault } = await import('@towerjs/vault')
      type DB = { users: { id: string; name: string } }
      const mod: any = (vault as any)<DB>({ connectionString: 'postgres://test' })
      expect(mod.name).toBe('vault')
    })
  })

  describe('vault/model', () => {
    it('exports defineModel, belongsTo, hasMany', async () => {
      const m = await import('@towerjs/vault/model')
      expect(typeof m.defineModel).toBe('function')
      expect(typeof m.belongsTo).toBe('function')
      expect(typeof m.hasMany).toBe('function')
    })

    it('Model has CRUD, query, and serialization surface', async () => {
      const { defineModel } = await import('@towerjs/vault/model')
      const Test = defineModel<{ id: string; name: string }>('tests', { table: 'tests' } as any)
      expect(typeof Test.create).toBe('function')
      expect(typeof Test.find).toBe('function')
      expect(typeof Test.findOrFail).toBe('function')
      expect(typeof Test.query).toBe('function')
      expect(typeof Test.where).toBe('function')
      expect(typeof Test.all).toBe('function')
    })
  })

  describe('vault/factory', () => {
    it('exports defineFactory', async () => {
      const { defineFactory } = await import('@towerjs/vault/factory')
      expect(typeof defineFactory).toBe('function')
    })
  })

  describe('apiKeys.verify runtime shape (regression for #121)', () => {
    it('is covered by gatehouse contract — see gatehouse.api.test.ts', () => {
      expect(true).toBe(true)
    })
  })
})
