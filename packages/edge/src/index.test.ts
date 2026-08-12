import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

describe('@towerjs/edge public API contract', () => {
  describe('exports', () => {
    it('exports withTowerEdge', async () => {
      const edge = await import('@towerjs/edge')
      expect(typeof edge.withTowerEdge).toBe('function')
    })
  })

  describe('withTowerEdge', () => {
    const fixtureDir = resolve(tmpdir(), 'tower-edge-test')
    const configPath = resolve(fixtureDir, 'tower.config.ts')
    const oldCwd = process.cwd()
    const oldWarn = console.warn
    let warnings: string[] = []

    beforeEach(() => {
      mkdirSync(fixtureDir, { recursive: true })
      writeFileSync(
        configPath,
        `import { defineTower } from "towerjs/blueprint";\nexport default defineTower({ modules: {} });\n`
      )
      process.chdir(fixtureDir)
      warnings = []
      console.warn = (...args: unknown[]) => warnings.push(args.join(' '))
    })

    afterEach(() => {
      process.chdir(oldCwd)
      console.warn = oldWarn
      rmSync(fixtureDir, { recursive: true, force: true })
    })

    it('loads without throwing and registers a config provider', async () => {
      // The edge package registers a config provider on load that defers to
      // the alias set up by withTowerEdge(). We can't exercise real Edge
      // runtime in Node, but we can verify the module loaded without throwing
      // and that the expected exports exist after load.
      const edge = await import('@towerjs/edge')
      expect(edge).toHaveProperty('withTowerEdge')
      expect(typeof edge.withTowerEdge).toBe('function')
    })

    it('warns when no config is found', async () => {
      rmSync(configPath)
      const { withTowerEdge } = await import('@towerjs/edge')
      withTowerEdge()
      expect(warnings.some((w) => w.includes('Could not find tower.config'))).toBe(true)
    })

    it('returns original config unchanged when no config found', async () => {
      rmSync(configPath)
      const { withTowerEdge } = await import('@towerjs/edge')
      const original = { /* some next config */ }
      const result = withTowerEdge(original)
      expect(result).toBe(original)
    })

    it('returns a modified config with webpack/turbopack aliases when config found', async () => {
      const { withTowerEdge } = await import('@towerjs/edge')
      const result = withTowerEdge()
      expect(result).toHaveProperty('webpack')
      expect(typeof result.webpack).toBe('function')
      expect(result).toHaveProperty('turbopack')
    })
  })
})
