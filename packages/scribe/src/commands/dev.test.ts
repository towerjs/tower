import { describe, expect, it } from 'vitest'

import { DEV_PORT, devDiagnostic, pickFreePort, resolveDevCommand } from './dev.js'

describe('resolveDevCommand', () => {
  it('always passes a port and runs next dev', () => {
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
      const { cmd, args } = resolveDevCommand(pm)
      expect(args).toContain('--port')
      expect(args[args.indexOf('--port') + 1]).toBe(String(DEV_PORT))
      expect(args.join(' ')).toContain('next dev')
      if (pm === 'npm') {
        expect(cmd).toBe('npx')
      } else {
        expect(cmd).toBe(pm)
        expect(args[0]).toBe('exec')
      }
    }
  })

  it('binds the fallback port passed in', () => {
    const { args } = resolveDevCommand('pnpm', 3001)
    expect(args[args.indexOf('--port') + 1]).toBe('3001')
  })
})

describe('pickFreePort', () => {
  it('returns the base port when nothing occupies it', async () => {
    // No listener is bound here; the first probe should win.
    await expect(pickFreePort()).resolves.toBe(DEV_PORT)
  })
})

describe('devDiagnostic', () => {
  it('adds next steps for missing config', () => {
    const message = devDiagnostic(new Error('Could not find tower.config.ts.'))
    expect(message).toContain('tower create')
  })

  it('adds module hints for unknown modules', () => {
    const message = devDiagnostic(new Error('Unknown module "gatehouse". Available: vault'))
    expect(message).toContain('modules array')
  })

  it('passes through unrelated errors untouched', () => {
    expect(devDiagnostic(new Error('boom'))).toBe('boom')
  })
})
