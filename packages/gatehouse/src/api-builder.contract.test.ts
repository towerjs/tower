import { describe, it, expect, vi } from 'vitest'
import { buildApi } from './api-builder.js'

// These tests verify the HTTP contract between Gatehouse and Better Auth
// WITHOUT needing a live server. They catch the class of bug where the wrong
// HTTP verb or wrong parameter location (query vs body) is used — the exact
// failure mode behind issues #14 and #15.

function makeMockApi(methodNames: string[]): Record<string, Function> {
  const api: Record<string, Function> = {}
  for (const name of methodNames) {
    api[name] = vi.fn().mockResolvedValue({ ok: true })
  }
  return api
}

// SignIn methods are wrapped in toSignInResult which expects { user, token, redirect, url }
function makeSignInMockApi(methodNames: string[]): Record<string, Function> {
  const api: Record<string, Function> = {}
  for (const name of methodNames) {
    api[name] = vi.fn().mockResolvedValue({
      user: {
        id: 'u1',
        name: 'Test',
        email: 'a@b.com',
        emailVerified: true,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      token: 'tok-123',
      redirect: false,
      url: null,
    })
  }
  return api
}

const headers = new Headers({ cookie: 'session=abc' })

describe('Gatehouse → Better Auth HTTP contract', () => {
  describe('signIn', () => {
    it('signIn.email sends POST with body', async () => {
      const api = makeSignInMockApi(['signInEmail'])
      const gh = buildApi(api, headers)
      const result = await gh.signIn.email({ email: 'a@b.com', password: 'pw' })
      expect(api.signInEmail).toHaveBeenCalledWith({
        headers,
        body: { email: 'a@b.com', password: 'pw' },
      })
      expect(result.user.email).toBe('a@b.com')
      expect(result.token).toBe('tok-123')
    })

    it('signIn.social sends POST with body', async () => {
      const api = makeSignInMockApi(['signInSocial'])
      const gh = buildApi(api, headers)
      await gh.signIn.social({ provider: 'google' })
      expect(api.signInSocial).toHaveBeenCalledWith({
        headers,
        body: { provider: 'google' },
      })
    })
  })

  describe('users', () => {
    it('users.get sends GET with query {id}', async () => {
      const api = makeMockApi(['getUser'])
      const gh = buildApi(api, headers)
      await gh.users.get('user-123')
      expect(api.getUser).toHaveBeenCalledWith({
        headers,
        query: { id: 'user-123' },
      })
    })
  })

  describe('email', () => {
    it('email.verify sends GET with query {token}', async () => {
      // This is the contract that issue #14 fixed: GET + query{token}, not POST + body
      const api = makeMockApi(['verifyEmail'])
      const gh = buildApi(api, headers)
      await gh.email.verify({ token: 'tok-123' })
      expect(api.verifyEmail).toHaveBeenCalledWith({
        headers,
        query: { token: 'tok-123' },
      })
    })
  })

  describe('organizations.invitations', () => {
    it('invitations.get sends GET with query {id}', async () => {
      // This is the contract that issue #15 fixed: query{id}, not query{invitationId}
      const api = makeMockApi(['getInvitation'])
      const gh = buildApi(api, headers)
      await gh.organizations.invitations.get('inv-123')
      expect(api.getInvitation).toHaveBeenCalledWith({
        headers,
        query: { id: 'inv-123' },
      })
    })
  })

  describe('sessions', () => {
    it('sessions.revoke sends POST with body {token}', async () => {
      const api = makeMockApi(['revokeSession'])
      const gh = buildApi(api, headers)
      await gh.sessions.revoke('tok-123')
      expect(api.revokeSession).toHaveBeenCalledWith({
        headers,
        body: { token: 'tok-123' },
      })
    })
  })
})
