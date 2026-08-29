import { describe, expect, it } from 'vitest'

import { DEV_PORT, MAX_PORT_PROBES, devDiagnostic, pickFreePort, portInUse, resolveDevCommand } from './dev.js'

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

/** Occupies `port` on `host` for the duration of `run`. */
async function holding(port: number, host: string, run: () => Promise<void>): Promise<void> {
  const { createServer } = await import('node:net')
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(port, host, resolve))
  try {
    await run()
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

describe('portInUse', () => {
  it('reports a port held on loopback as in use, and free once released', async () => {
    const { createServer } = await import('node:net')
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    // A wildcard-only probe misses this on macOS: the wildcard bind succeeds
    // while the loopback address is taken, so the port looks free.
    expect(await portInUse(port)).toBe(true)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(await portInUse(port)).toBe(false)
  })
})

describe('pickFreePort', () => {
  it('skips occupied ports and returns the first free one', async () => {
    await holding(DEV_PORT, '127.0.0.1', async () => {
      const port = await pickFreePort()
      expect(port).not.toBe(DEV_PORT)
      expect(port).toBeGreaterThanOrEqual(DEV_PORT)
      expect(port).toBeLessThan(DEV_PORT + MAX_PORT_PROBES)
    })
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
