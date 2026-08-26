import { describe, expect, it } from 'vitest'

import { DEV_PORT, MAX_PORT_PROBES, devDiagnostic, pickFreePort, resolveDevCommand } from './dev.js'

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
  it('skips occupied ports and returns the first free one', async () => {
    const { createServer } = await import('node:net')
    const servers = [createServer(), createServer()]
    await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.listen(0, '127.0.0.1', resolve))))
    const ports = servers.map((s) => (s.address() as { port: number }).port)
    void ports
    // Occupy DEV_PORT itself when it is currently free.
    const blocker = createServer()
    await new Promise<void>((resolve) => blocker.listen(DEV_PORT, '127.0.0.1', resolve))
    try {
      const port = await pickFreePort()
      expect(port).not.toBe(DEV_PORT)
      expect(port).toBeGreaterThanOrEqual(DEV_PORT)
      expect(port).toBeLessThan(DEV_PORT + MAX_PORT_PROBES)
    } finally {
      blocker.close()
      for (const s of servers) s.close()
    }
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
