import { describe, expect, it } from 'vitest'

import type { GatehouseProvider } from './provider.js'
import { AuthenticationError } from './types.js'

/**
 * Reusable contract suite for Gatehouse providers.
 *
 * The suite is written against the Gatehouse contract — never against a
 * specific provider's SDK. Every curated provider must pass it. Run it
 * hermetically against the TestProvider, and against real providers in the
 * integration tier.
 */
export interface ProviderContractHarness {
  /** Human-readable provider name for the describe block. */
  label: string
  createProvider(): Promise<GatehouseProvider>
  /** Builds headers carrying the provider's session credential for a token. */
  authHeaders(token: string): Headers
  /**
   * Whether the harness can drive fully authenticated request-scoped flows
   * (user/session/signOut) without a live HTTP round-trip. Providers whose
   * sessions ride on framework-managed cookies may disable these specs;
   * those flows are covered by E2E tests instead.
   */
  supportsAuthenticatedSpecs: boolean
}

export function defineGatehouseProviderContract(harness: ProviderContractHarness): void {
  describe(`Gatehouse provider contract — ${harness.label}`, () => {
    let provider: GatehouseProvider

    it('initializes and declares its capabilities', async () => {
      provider = await harness.createProvider()
      await provider.init()
      expect(typeof provider.name).toBe('string')
      expect(provider.capabilities.runtime).toHaveProperty('node')
      expect(provider.capabilities.runtime).toHaveProperty('edge')
      expect(provider.capabilities.authentication).toBeInstanceOf(Object)
      expect(provider.capabilities.sessions).toBeInstanceOf(Object)
    })

    it('returns null session and user when unauthenticated', async () => {
      const instance = await provider.from({ headers: new Headers() })
      expect(await instance.session()).toBeNull()
      expect(await instance.user()).toBeNull()
    })

    it('requireUser throws AuthenticationError when unauthenticated', async () => {
      const instance = await provider.from({ headers: new Headers() })
      await expect(instance.requireUser()).rejects.toThrow(AuthenticationError)
    })

    it('signUp.email returns a Tower-owned SignInResult', async () => {
      const email = `contract-${Date.now()}@example.com`
      const instance = await provider.from({ headers: new Headers() })
      const result = await instance.signUp.email({ name: 'Contract User', email, password: 'Password123!' })
      expect(result.user.id).toBeTruthy()
      expect(result.user.email).toBe(email)
      expect(typeof result.token).toBe('string')
    })

    it('signIn.email throws AuthenticationError on bad credentials', async () => {
      const email = `contract-bad-${Date.now()}@example.com`
      const setup = await provider.from({ headers: new Headers() })
      await setup.signUp.email({ name: 'Bad Creds', email, password: 'Password123!' })

      const instance = await provider.from({ headers: new Headers() })
      await expect(instance.signIn.email({ email, password: 'wrong' })).rejects.toThrow(AuthenticationError)
    })

    it.runIf(harness.supportsAuthenticatedSpecs)('resolves user/session from credentials and signs out', async () => {
      const email = `contract-auth-${Date.now()}@example.com`
      const setup = await provider.from({ headers: new Headers() })
      await setup.signUp.email({ name: 'Authed', email, password: 'Password123!' })

      // Sign in to obtain a fresh token, then use it as the request credential.
      const signInInstance = await provider.from({ headers: new Headers() })
      const result = await signInInstance.signIn.email({ email, password: 'Password123!' })
      expect(result.token).toBeTruthy()

      const authed = await provider.from({ headers: harness.authHeaders(result.token) })
      const user = await authed.user()
      expect(user?.email).toBe(email)

      const session = await authed.session()
      expect(session?.user.id).toBe(user!.id)
      expect(session?.session.token).toBeTruthy()
      expect(await authed.requireUser()).toMatchObject({ email })

      await authed.signOut()
      const afterSignOut = await provider.from({ headers: harness.authHeaders(result.token) })
      expect(await afterSignOut.session()).toBeNull()
    })

    it.runIf(harness.supportsAuthenticatedSpecs)('users.get and users.findByEmail resolve created users', async () => {
      const email = `contract-lookup-${Date.now()}@example.com`
      const setup = await provider.from({ headers: new Headers() })
      const created = await setup.signUp.email({ name: 'Lookup', email, password: 'Password123!' })

      const instance = await provider.from({ headers: new Headers() })
      expect((await instance.users!.get(created.user.id))?.email).toBe(email)
      expect((await instance.users!.findByEmail(email))?.id).toBe(created.user.id)
    })
  })
}
