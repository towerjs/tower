import { describe, expect, it } from 'vitest'

import { type SocialIdentity, type SocialProvider, SocialProviderError, mergeScopes } from './social.js'

/**
 * Reusable contract suite for social providers (#82), mirroring the S6
 * provider contract pattern. Written against the SocialProvider contract —
 * never a vendor SDK — so Google, GitHub, a future Clerk adapter, and the
 * TestSocialProvider all prove themselves with the same specs.
 */
export interface SocialProviderContractHarness {
  label: string
  createProvider(): Promise<SocialProvider>
  /**
   * Drives one successful callback in whatever way the provider requires
   * (mocked network for hermetic adapters, scripted responses for fakes).
   */
  succeedCallback(provider: SocialProvider): Promise<SocialIdentity>
  /** Drives a failing callback (upstream provider failure). */
  failCallback(provider: SocialProvider): Promise<unknown>
}

export function defineSocialProviderContract(harness: SocialProviderContractHarness): void {
  describe(`Social provider contract — ${harness.label}`, () => {
    let provider: SocialProvider

    it('declares id, capabilities, and Tower-required identity scopes', async () => {
      provider = await harness.createProvider()
      expect(typeof provider.id).toBe('string')
      // Every provider must request enough scope to build a usable identity.
      expect(provider.requiredScopes.length).toBeGreaterThan(0)
      expect(provider.capabilities).toBeInstanceOf(Object)
    })

    it('redirect returns an authorization URL carrying merged scopes', async () => {
      const redirect = await provider.redirect({ scopes: ['calendar.readonly'] })
      expect(redirect.url.startsWith('https://')).toBe(true)

      const parsed = new URL(redirect.url)
      expect(parsed.searchParams.get('client_id')).toBeTruthy()
      expect(parsed.searchParams.get('response_type')).toBe('code')

      // Tower-required scopes always present, app scopes merged without duplicates.
      const scopes = parsed.searchParams
        .getAll('scope')
        .flatMap((s) => s.split(' '))
        .filter(Boolean)
      for (const required of provider.requiredScopes) {
        expect(scopes).toContain(required)
      }
      for (const requested of mergeScopes([], ['calendar.readonly'])) {
        expect(scopes).toContain(requested)
      }
      expect(scopes.filter((s) => s === 'calendar.readonly')).toHaveLength(1)
    })

    it('redirect generates CSRF state when supported', async () => {
      if (!provider.capabilities.state) return
      const redirect = await provider.redirect()
      expect(redirect.state).toBeTruthy()
      expect(typeof redirect.state).toBe('string')
    })

    it('callback resolves a normalized Tower-owned identity', async () => {
      const identity = await harness.succeedCallback(provider)
      expect(identity.provider).toBe(provider.id)
      expect(typeof identity.providerAccountId).toBe('string')
      expect(identity.providerAccountId).not.toContain('@')
      if (identity.email) {
        expect(typeof identity.email.value).toBe('string')
        expect(typeof identity.email.verified).toBe('boolean')
      }
    })

    it('callback surfaces upstream failures as SocialProviderError', async () => {
      const err = await harness.failCallback(provider)
      expect(err).toBeInstanceOf(SocialProviderError)
    })
  })
}
