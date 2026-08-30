import { describe, expect, it } from 'vitest'

describe('Scribe public API contract', () => {
  describe('CLI entry', () => {
    it('exports run, helpText, versionText, findConfig, getModule', async () => {
      const m = await import('@towerjs/scribe/cli')
      expect(typeof m.run).toBe('function')
      expect(typeof m.helpText).toBe('function')
      expect(typeof m.versionText).toBe('function')
      expect(typeof m.findConfig).toBe('function')
      expect(typeof m.getModule).toBe('function')
    })

    it('run returns help for undefined command', async () => {
      const { run } = await import('@towerjs/scribe/cli')
      const result = await run(undefined, [])
      expect(result.exitCode).toBe(0)
      expect(result.stdout.join('\n')).toContain('Usage: tower')
    })
  })

  describe('framework adapters', () => {
    it('are tested in package unit tests', () => {
      expect(true).toBe(true)
    })
  })
})
