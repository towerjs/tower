import { afterEach, describe, expect, it, vi } from 'vitest'

import { defineSocialProviderContract } from '../../social-contract.js'
import { SocialProviderError } from '../../social.js'
import { GoogleSocialProvider } from './google.js'

/**
 * Runs the social provider contract against the real Google adapter with
 * its network boundary mocked. Proves the adapter speaks OAuth/OIDC over
 * web-standard fetch and maps responses into Tower's normalized identity —
 * without Better Auth anywhere in the flow.
 */

const tokenRequests: Array<{ url: string; body: URLSearchParams }> = []
const userinfoRequests: Array<{ url: string; headers: Headers }> = []

function mockGoogleFetch(overrides: { tokenOk?: boolean; userinfoOk?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: any, init?: any) => {
      const url = String(input)
      if (url.includes('oauth2.googleapis.com/token')) {
        tokenRequests.push({ url, body: new URLSearchParams(init.body) })
        if (overrides.tokenOk === false) return new Response('server_error', { status: 500 })
        return Response.json({
          access_token: 'at-123',
          refresh_token: 'rt-456',
          expires_in: 3599,
          token_type: 'Bearer',
        })
      }
      if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
        userinfoRequests.push({ url, headers: new Headers(init.headers) })
        if (overrides.userinfoOk === false) return new Response('unauthorized', { status: 401 })
        return Response.json({
          sub: 'google-sub-42',
          email: 'jasper@example.com',
          email_verified: true,
          name: 'Jasper',
          picture: 'https://photos.example.com/jasper.png',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
  )
}

function makeProvider() {
  return new GoogleSocialProvider({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/api/auth/social/google/callback',
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  tokenRequests.length = 0
  userinfoRequests.length = 0
})

// The shared contract suite, run against the real adapter. The harness
// installs the mocked network before driving callbacks.
defineSocialProviderContract({
  label: 'GoogleSocialProvider (mocked network)',
  async createProvider() {
    return makeProvider()
  },
  async succeedCallback(p) {
    mockGoogleFetch()
    return p.callback({ code: 'auth-code-123' })
  },
  async failCallback(p) {
    mockGoogleFetch({ tokenOk: false })
    return p.callback({ code: 'bad' }).catch((err) => err)
  },
})

describe('GoogleSocialProvider', () => {
  it('throws an actionable error without credentials', () => {
    const keep = { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET }
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    try {
      expect(() => new GoogleSocialProvider()).toThrow('GOOGLE_CLIENT_ID')
    } finally {
      if (keep.id) process.env.GOOGLE_CLIENT_ID = keep.id
      if (keep.secret) process.env.GOOGLE_CLIENT_SECRET = keep.secret
    }
  })

  it('exchanges the code at the token endpoint and maps OIDC claims', async () => {
    mockGoogleFetch()
    const p = makeProvider()
    const redirect = p.redirect({ redirectTo: 'http://localhost:3000/after' })
    expect(new URL(redirect.url).searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/social/google/callback'
    )

    const identity = await p.callback({ code: 'auth-code-123', state: redirect.state })

    // Token exchange shape
    expect(tokenRequests).toHaveLength(1)
    expect(tokenRequests[0].body.get('grant_type')).toBe('authorization_code')
    expect(tokenRequests[0].body.get('code')).toBe('auth-code-123')
    expect(tokenRequests[0].body.get('client_id')).toBe('test-client-id')
    expect(tokenRequests[0].body.get('redirect_uri')).toBe('http://localhost:3000/api/auth/social/google/callback')

    // Userinfo called with bearer token
    expect(userinfoRequests[0].headers.get('authorization')).toBe('Bearer at-123')

    // Normalized, Tower-owned identity — not Better Auth's account shape.
    expect(identity.provider).toBe('google')
    expect(identity.providerAccountId).toBe('google-sub-42')
    expect(identity.email).toEqual({ value: 'jasper@example.com', verified: true })
    expect(identity.name).toBe('Jasper')
    expect(identity.avatarUrl).toBe('https://photos.example.com/jasper.png')
    expect(identity.tokens?.accessToken).toBe('at-123')
    expect(identity.tokens?.refreshToken).toBe('rt-456')
    expect((identity.raw as any).sub).toBe('google-sub-42')
  })

  it('maps token-exchange failures to SocialProviderError', async () => {
    mockGoogleFetch({ tokenOk: false })
    const p = makeProvider()
    await expect(p.callback({ code: 'bad' })).rejects.toBeInstanceOf(SocialProviderError)
  })

  it('maps userinfo failures to SocialProviderError', async () => {
    mockGoogleFetch({ userinfoOk: false })
    const p = makeProvider()
    await expect(p.callback({ code: 'ok-but-userinfo-fails' })).rejects.toBeInstanceOf(SocialProviderError)
  })

  it('derives the redirect URI from baseURL when not given explicitly', () => {
    const p = new GoogleSocialProvider({
      clientId: 'c',
      clientSecret: 's',
      baseURL: 'https://myapp.com/',
    })
    const { url } = p.redirect()
    expect(new URL(url).searchParams.get('redirect_uri')).toBe('https://myapp.com/api/auth/social/google/callback')
  })

  it('merges application scopes over Tower-required scopes without duplicates', async () => {
    const p = makeProvider()
    const redirect = await p.redirect({ scopes: ['openid', 'calendar.readonly'] })
    const scopes = new URL(redirect.url).searchParams.get('scope')!.split(' ')
    expect(scopes.filter((s) => s === 'openid')).toHaveLength(1)
    expect(scopes).toContain('calendar.readonly')
  })
})
