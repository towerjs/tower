import { describe, expect, it } from 'vitest'

import { devDiagnostic, formatPortDiagnostic, resolveDevCommand } from './dev.js'

describe('resolveDevCommand', () => {
  it('always pins port 3000', () => {
    for (const pm of ['npm', 'pnpm', 'yarn', 'bun'] as const) {
      const { cmd, args } = resolveDevCommand(pm)
      expect(args).toContain('--port')
      expect(args[args.indexOf('--port') + 1]).toBe('3000')
      expect(args.join(' ')).toContain('next dev')
      if (pm === 'npm') {
        expect(cmd).toBe('npx')
      } else {
        expect(cmd).toBe(pm)
        expect(args[0]).toBe('exec')
      }
    }
  })
})

describe('formatPortDiagnostic', () => {
  it('states the invariant and includes the PID when known', () => {
    const base = formatPortDiagnostic(3000)
    expect(base).toContain('Port 3000 is already in use')
    expect(base).toContain('port 3000')

    const withPid = formatPortDiagnostic(3000, 4242)
    expect(withPid).toContain('PID 4242')
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
