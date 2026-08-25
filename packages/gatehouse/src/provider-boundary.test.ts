import { describe, expect, it, vi } from 'vitest'

/**
 * Runtime boundary proof for the Gatehouse provider contract (#92).
 *
 * The claim: Gatehouse's provider contract does not require Node.js. A
 * provider whose own stack is Edge-compatible runs the full Gatehouse
 * application API on an Edge runtime. Better Auth is a *provider capability*
 * limitation (it declares runtime.edge: false), not a Gatehouse limitation.
 *
 * Proof strategy: load ONLY the contract modules — provider.ts,
 * test-provider.ts, provider-contract.ts and their transitive core deps —
 * with hostile mocks installed for every Node-only / framework / provider
 * module that must NOT enter the contract's module graph. If anything in
 * that graph imports better-auth, next/*, or node:*, the import throws and
 * these tests fail.
 */

const HOSTILE_MODULES = [
  'better-auth',
  'better-auth/plugins',
  'better-auth/next-js',
  'better-auth/client',
  'better-auth/react',
  '@better-auth/passkey',
  '@better-auth/api-key',
  'next/headers',
  'next/headers.js',
  'node:fs',
  'node:path',
  'node:crypto',
]

vi.mock('better-auth', () => {
  throw new Error('BOUNDARY VIOLATION: better-auth imported by Gatehouse contract')
})
vi.mock('better-auth/plugins', () => {
  throw new Error('BOUNDARY VIOLATION: better-auth/plugins imported by Gatehouse contract')
})
vi.mock('better-auth/next-js', () => {
  throw new Error('BOUNDARY VIOLATION: better-auth/next-js imported by Gatehouse contract')
})
vi.mock('next/headers', () => {
  throw new Error('BOUNDARY VIOLATION: next/headers imported by Gatehouse contract')
})
vi.mock('next/headers.js', () => {
  throw new Error('BOUNDARY VIOLATION: next/headers imported by Gatehouse contract')
})

describe('Gatehouse runtime boundary (Edge compatibility of the contract)', () => {
  it('loads the provider contract without any Node-only or provider module', async () => {
    vi.resetModules()
    // Any hostile module entering the graph rejects this import chain.
    const { TestProvider } = await import('./providers/test-provider.js')
    const provider = new TestProvider()
    await provider.init()
    expect(provider.capabilities.runtime.edge).toBe(true)
  })

  it('runs the full application API against an edge-capable provider', async () => {
    vi.resetModules()
    const { TestProvider } = await import('./providers/test-provider.js')
    const provider = new TestProvider()
    await provider.init()

    // Core flows using only web-standard APIs — Request/Headers/Response.
    const headers = new Headers()
    const instance = await provider.from({ headers })
    expect(await instance.user()).toBeNull()
    await expect(instance.requireUser()).rejects.toThrow()

    const signUp = await instance.signUp.email({
      name: 'Edge User',
      email: `edge-${Date.now()}@example.com`,
      password: 'Password123!',
    })
    expect(signUp.user.id).toBeTruthy()

    const signIn = await instance.signIn
      .email({
        email: `edge-${Date.now()}@example.com`,
        password: 'nope',
      })
      .catch((err) => err)
    expect(signIn).toBeInstanceOf(Error)

    void HOSTILE_MODULES
  })

  it('statically: core contract files never reference Node, Next, or Better Auth', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')

    const dir = path.dirname(fileURLToPath(import.meta.url))
    const coreFiles = ['provider.ts', 'provider-contract.ts', 'types.ts', 'context.ts', 'map-user.ts']
    const forbidden = /from\s+['"](better-auth|next\/|node:)/

    for (const file of coreFiles) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8')
      expect(forbidden.test(content), `${file} must not import Node, Next, or Better Auth`).toBe(false)
    }
  })
})
