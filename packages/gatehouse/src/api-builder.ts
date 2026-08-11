import type { SignInResult } from './types.js'
import { mapUser } from './map-user.js'

// ─── Mapping: Better Auth method → Gatehouse path ─────────────────
// Every path is a dot-separated sequence of keys.
//
// Each entry declares the source better-auth method, the HTTP verb
// better-auth expects (which decides whether params go in `body` or
// `query`), and an optional `build` function that shapes positional or
// string arguments into the exact better-auth request payload.
//
// Methods whose source does not exist on the running better-auth API are
// skipped at build time, so the exposed surface only ever contains
// working methods.

type Verb = 'GET' | 'POST'

type PayloadBuilder = (headers: Headers, ...args: any[]) => Record<string, unknown>

interface Mapping {
  path: string
  source: string
  verb: Verb
  build?: PayloadBuilder
}

const body = (headers: Headers, payload: Record<string, unknown>): Record<string, unknown> => ({
  headers,
  body: payload,
})

const query = (headers: Headers, params: Record<string, unknown>): Record<string, unknown> => ({
  headers,
  query: params,
})

const MAPPINGS: Mapping[] = [
  // ── Sign In / Sign Up / Sign Out ────────────────────────────────
  { path: 'signIn.email', source: 'signInEmail', verb: 'POST' },
  { path: 'signIn.emailOtp', source: 'signInEmailOTP', verb: 'POST' },
  { path: 'signIn.magicLink', source: 'signInMagicLink', verb: 'POST' },
  { path: 'signIn.phone', source: 'signInPhoneNumber', verb: 'POST' },
  { path: 'signIn.social', source: 'signInSocial', verb: 'POST' },
  { path: 'signUp.email', source: 'signUpEmail', verb: 'POST' },
  { path: 'sessions.signOut', source: 'signOut', verb: 'POST' },

  // ── Sessions ────────────────────────────────────────────────────
  { path: 'sessions.list', source: 'listSessions', verb: 'GET' },
  { path: 'sessions.revoke', source: 'revokeSession', verb: 'POST', build: (h, token) => body(h, { token }) },
  { path: 'sessions.revokeOther', source: 'revokeOtherSessions', verb: 'POST' },
  { path: 'sessions.revokeAll', source: 'revokeSessions', verb: 'POST' },
  { path: 'sessions.update', source: 'updateSession', verb: 'POST' },

  // ── Account (self-service) ──────────────────────────────────────
  { path: 'account.update', source: 'updateUser', verb: 'POST' },
  { path: 'account.delete', source: 'deleteUser', verb: 'POST' },
  {
    path: 'account.setPassword',
    source: 'setPassword',
    verb: 'POST',
    build: (h, newPassword) => body(h, { newPassword }),
  },
  { path: 'account.changeEmail', source: 'changeEmail', verb: 'POST', build: (h, newEmail) => body(h, { newEmail }) },

  // ── Password ────────────────────────────────────────────────────
  { path: 'password.change', source: 'changePassword', verb: 'POST' },
  { path: 'password.confirm', source: 'verifyPassword', verb: 'POST' },
  { path: 'password.forgot', source: 'requestPasswordReset', verb: 'POST' },
  { path: 'password.reset', source: 'resetPassword', verb: 'POST' },

  // ── Email ────────────────────────────────────────────────────────
  { path: 'email.sendVerification', source: 'sendVerificationEmail', verb: 'POST' },
  { path: 'email.verify', source: 'verifyEmail', verb: 'GET' },

  // ── Email OTP ───────────────────────────────────────────────────
  { path: 'email.otp.send', source: 'sendVerificationOTP', verb: 'POST' },
  { path: 'email.otp.confirm', source: 'verifyEmailOTP', verb: 'POST' },
  { path: 'email.otp.verifyEmail', source: 'verifyEmailOTP', verb: 'POST' },
  { path: 'email.otp.check', source: 'checkVerificationOTP', verb: 'POST' },
  { path: 'email.otp.forgotPassword', source: 'forgetPasswordEmailOTP', verb: 'POST' },
  { path: 'email.otp.requestChange', source: 'requestEmailChangeEmailOTP', verb: 'POST' },
  { path: 'email.otp.confirmChange', source: 'changeEmailEmailOTP', verb: 'POST' },
  { path: 'email.otp.requestReset', source: 'requestPasswordResetEmailOTP', verb: 'POST' },
  { path: 'email.otp.resetPassword', source: 'resetPasswordEmailOTP', verb: 'POST' },

  // ── Phone OTP ───────────────────────────────────────────────────
  { path: 'phone.otp.send', source: 'sendPhoneNumberOTP', verb: 'POST' },
  { path: 'phone.otp.confirm', source: 'verifyPhoneNumber', verb: 'POST' },
  { path: 'phone.verify', source: 'verifyPhoneNumber', verb: 'POST' },
  { path: 'phone.otp.requestReset', source: 'requestPasswordResetPhoneNumber', verb: 'POST' },
  { path: 'phone.otp.resetPassword', source: 'resetPasswordPhoneNumber', verb: 'POST' },

  // ── Passkeys ────────────────────────────────────────────────────
  { path: 'passkeys.list', source: 'listPasskeys', verb: 'GET' },
  {
    path: 'passkeys.update',
    source: 'updatePasskey',
    verb: 'POST',
    build: (h, id, params) => body(h, { id, ...params }),
  },
  { path: 'passkeys.delete', source: 'deletePasskey', verb: 'POST', build: (h, id) => body(h, { id }) },
  // ── Users ───────────────────────────────────────────────────────
  { path: 'users.get', source: 'getUser', verb: 'GET', build: (h, id) => query(h, { id }) },
  { path: 'users.findByEmail', source: 'findUserByEmail', verb: 'GET', build: (h, email) => query(h, { email }) },

  // ── Roles ───────────────────────────────────────────────────────
  { path: 'roles.assign', source: 'setRole', verb: 'POST' },
  { path: 'roles.remove', source: 'setRole', verb: 'POST', build: (h, userId) => body(h, { userId, role: '' }) },

  // ── Admin ───────────────────────────────────────────────────────
  { path: 'admin.createUser', source: 'createUser', verb: 'POST' },
  { path: 'admin.getUser', source: 'getUser', verb: 'GET', build: (h, userId) => query(h, { id: userId }) },
  { path: 'admin.listUsers', source: 'listUsers', verb: 'GET' },
  { path: 'admin.removeUser', source: 'removeUser', verb: 'POST', build: (h, userId) => body(h, { userId }) },
  {
    path: 'admin.setUserPassword',
    source: 'setUserPassword',
    verb: 'POST',
    build: (h, userId, newPassword) => body(h, { userId, newPassword }),
  },
  { path: 'admin.setRole', source: 'setRole', verb: 'POST' },
  {
    path: 'admin.banUser',
    source: 'banUser',
    verb: 'POST',
    build: (h, userId, params) => body(h, { userId, ...params }),
  },
  { path: 'admin.unbanUser', source: 'unbanUser', verb: 'POST', build: (h, userId) => body(h, { userId }) },
  { path: 'admin.impersonateUser', source: 'impersonateUser', verb: 'POST', build: (h, userId) => body(h, { userId }) },
  { path: 'admin.stopImpersonating', source: 'stopImpersonating', verb: 'POST' },
  {
    path: 'admin.listUserSessions',
    source: 'listUserSessions',
    verb: 'POST',
    build: (h, userId) => body(h, { userId }),
  },
  {
    path: 'admin.revokeUserSession',
    source: 'revokeUserSession',
    verb: 'POST',
    build: (h, sessionToken) => body(h, { sessionToken }),
  },
  {
    path: 'admin.revokeUserSessions',
    source: 'revokeUserSessions',
    verb: 'POST',
    build: (h, userId) => body(h, { userId }),
  },

  // ── API Keys ────────────────────────────────────────────────────
  { path: 'apiKeys.create', source: 'createApiKey', verb: 'POST' },
  {
    path: 'apiKeys.list',
    source: 'listApiKeys',
    verb: 'GET',
    build: (h, userId, options) => query(h, { userId, ...options }),
  },
  { path: 'apiKeys.get', source: 'getApiKey', verb: 'GET', build: (h, id) => query(h, { id }) },
  {
    path: 'apiKeys.update',
    source: 'updateApiKey',
    verb: 'POST',
    build: (h, id, params) => body(h, { keyId: id, ...params }),
  },
  { path: 'apiKeys.delete', source: 'deleteApiKey', verb: 'POST', build: (h, id) => body(h, { keyId: id }) },
  { path: 'apiKeys.verify', source: 'verifyApiKey', verb: 'POST' },
  { path: 'apiKeys.deleteAllExpired', source: 'deleteAllExpiredApiKeys', verb: 'POST' },

  // ── Identities (social providers) ───────────────────────────────
  { path: 'identities.list', source: 'listUserAccounts', verb: 'GET' },
  { path: 'identities.unlink', source: 'unlinkAccount', verb: 'POST' },
  {
    path: 'identities.link',
    source: 'linkSocialAccount',
    verb: 'POST',
    build: (h, input) =>
      body(
        h,
        typeof input === 'string' ? { provider: input } : { provider: input.provider, callbackURL: input.callbackURL }
      ),
  },
  {
    path: 'identities.getAccessToken',
    source: 'getAccessToken',
    verb: 'POST',
    build: (h, providerId) => body(h, { providerId }),
  },

  // ── TOTP ────────────────────────────────────────────────────────
  {
    path: 'totp.enable',
    source: 'enableTwoFactor',
    verb: 'POST',
    build: (h, p) => body(h, typeof p === 'string' ? { password: p } : (p ?? {})),
  },
  {
    path: 'totp.disable',
    source: 'disableTwoFactor',
    verb: 'POST',
    build: (h, p) => body(h, typeof p === 'string' ? { password: p } : p),
  },
  {
    path: 'totp.verify',
    source: 'verifyTOTP',
    verb: 'POST',
    build: (h, p) => body(h, typeof p === 'string' ? { code: p } : (p ?? {})),
  },
  { path: 'totp.uri', source: 'getTOTPURI', verb: 'POST', build: (h, password) => body(h, { password }) },
  { path: 'totp.otp.send', source: 'sendTwoFactorOTP', verb: 'POST' },
  { path: 'totp.otp.verify', source: 'verifyTwoFactorOTP', verb: 'POST' },

  // ── Backup codes ────────────────────────────────────────────────
  {
    path: 'backupCodes.generate',
    source: 'generateBackupCodes',
    verb: 'POST',
    build: (h, password) => body(h, typeof password === 'string' ? { password } : (password ?? {})),
  },
  { path: 'backupCodes.verify', source: 'verifyBackupCode', verb: 'POST', build: (h, code) => body(h, { code }) },
  { path: 'backupCodes.view', source: 'viewBackupCodes', verb: 'POST' },

  // ── Organizations ───────────────────────────────────────────────
  { path: 'organizations.create', source: 'createOrganization', verb: 'POST' },
  { path: 'organizations.list', source: 'listOrganizations', verb: 'GET' },
  {
    path: 'organizations.getFull',
    source: 'getFullOrganization',
    verb: 'GET',
    build: (h, id) => query(h, { organizationId: id }),
  },
  {
    path: 'organizations.setActive',
    source: 'setActiveOrganization',
    verb: 'POST',
    build: (h, organizationId) => body(h, { organizationId }),
  },
  {
    path: 'organizations.update',
    source: 'updateOrganization',
    verb: 'POST',
    build: (h, id, params) => body(h, { organizationId: id, data: params ?? {} }),
  },
  {
    path: 'organizations.delete',
    source: 'deleteOrganization',
    verb: 'POST',
    build: (h, id) => body(h, { organizationId: id }),
  },
  { path: 'organizations.checkSlug', source: 'checkOrganizationSlug', verb: 'POST' },

  // Members
  {
    path: 'organizations.members.list',
    source: 'listMembers',
    verb: 'GET',
    build: (h, organizationId) => query(h, { organizationId }),
  },
  {
    path: 'organizations.members.add',
    source: 'addMember',
    verb: 'POST',
    build: (h, organizationId, userId, role) => body(h, { organizationId, userId, ...(role ? { role } : {}) }),
  },
  {
    path: 'organizations.members.update',
    source: 'updateMemberRole',
    verb: 'POST',
    build: (h, memberId, role, organizationId) =>
      body(h, { memberId, role, ...(organizationId ? { organizationId } : {}) }),
  },
  {
    path: 'organizations.members.remove',
    source: 'removeMember',
    verb: 'POST',
    build: (h, orgId, memberId) => body(h, { memberIdOrEmail: memberId, organizationId: orgId }),
  },

  // Invitations
  {
    path: 'organizations.invitations.create',
    source: 'createInvitation',
    verb: 'POST',
    build: (h, orgId, params) => body(h, { organizationId: orgId, ...params }),
  },
  {
    path: 'organizations.invitations.list',
    source: 'listInvitations',
    verb: 'GET',
    build: (h, organizationId) => query(h, { organizationId }),
  },
  {
    path: 'organizations.invitations.get',
    source: 'getInvitation',
    verb: 'GET',
    build: (h, invitationId) => query(h, { id: invitationId }),
  },
  {
    path: 'organizations.invitations.accept',
    source: 'acceptInvitation',
    verb: 'POST',
    build: (h, invitationId) => body(h, { invitationId }),
  },
  {
    path: 'organizations.invitations.reject',
    source: 'rejectInvitation',
    verb: 'POST',
    build: (h, invitationId) => body(h, { invitationId }),
  },
  {
    path: 'organizations.invitations.cancel',
    source: 'cancelInvitation',
    verb: 'POST',
    build: (h, invitationId) => body(h, { invitationId }),
  },

  // Organization roles
  { path: 'organizations.roles.create', source: 'createOrgRole', verb: 'POST' },
  {
    path: 'organizations.roles.list',
    source: 'listOrgRoles',
    verb: 'GET',
    build: (h, organizationId) => query(h, organizationId ? { organizationId } : {}),
  },
  { path: 'organizations.roles.get', source: 'getOrgRole', verb: 'GET' },
  {
    path: 'organizations.roles.update',
    source: 'updateOrgRole',
    verb: 'POST',
    build: (h, roleId, params) => body(h, { roleId, data: params ?? {} }),
  },
  { path: 'organizations.roles.delete', source: 'deleteOrgRole', verb: 'POST' },

  // Permissions
  { path: 'organizations.checkPermission', source: 'hasPermission', verb: 'POST' },
]

// Methods used internally by their wrappers — not user-facing.
const SKIP_INTERNAL = new Set([
  'getSession',
  'callbackOAuth',
  'deleteUserCallback',
  'requestPasswordResetCallback',
  'error',
  'ok',
])

// Better Auth methods that use query params instead of body (raw passthrough only).
const GET_METHODS = new Set([
  'getSession',
  'listSessions',
  'listPasskeys',
  'listOrganizations',
  'listMembers',
  'listInvitations',
  'listOrgRoles',
  'listUsers',
  'getUser',
  'getFullOrganization',
  'getInvitation',
  'getOrganization',
  'getOrgRole',
  'getApiKey',
  'listApiKeys',
  'listUserAccounts',
  'listUserSessions',
  'getAccessToken',
  'getTOTPURI',
  'accountInfo',
  'getActiveMember',
  'getActiveMemberRole',
  'getVerificationOTP',
  'listUserInvitations',
  'viewBackupCodes',
  'checkOrganizationSlug',
])

const BA_TOP_LEVEL = new Set(['body', 'query', 'asResponse', 'returnHeaders', 'returnStatus', 'headers', 'method'])

/**
 * Wraps a Better Auth API object to auto-inject headers and route raw params
 * to query/body based on the HTTP verb convention. Used for the passthrough
 * `gatehouse.api` surface, where callers provide verb-level params directly.
 */
export function buildProxiedApi(api: any, headers: Headers) {
  return new Proxy(api, {
    get(target: any, prop: string) {
      if (typeof target[prop] !== 'function') return target[prop]
      const useQuery = GET_METHODS.has(prop)
      return (params?: Record<string, unknown>) => {
        const callParams: Record<string, unknown> = { headers }
        if (params && typeof params === 'object' && !Array.isArray(params)) {
          const hasRaw = Object.keys(params).some((k) => BA_TOP_LEVEL.has(k))
          if (hasRaw) {
            Object.assign(callParams, params)
          } else {
            callParams[useQuery ? 'query' : 'body'] = params
          }
        }
        return target[prop](callParams)
      }
    },
  })
}

/**
 * Builds the nested, typed Gatehouse API from a Better Auth API object.
 *
 * Methods are matched against the mapping table above. Each exposed method
 * sends the exact request payload better-auth expects: a single params object
 * becomes `query` (GET) or `body` (POST), and methods with positional or
 * string arguments are shaped by their `build` function.
 */
// Paths whose better-auth response ({ token, user, redirect, url }) should be
// normalized into a SignInResult. Everything else is returned as-is.
const SIGN_IN_RESULT_PATHS = new Set([
  'signIn.email',
  'signIn.emailOtp',
  'signIn.phone',
  'signIn.social',
  'signUp.email',
  'email.otp.confirm',
  'phone.otp.confirm',
])

function toSignInResult(raw: Record<string, unknown>): SignInResult {
  return {
    user: mapUser(raw.user as Record<string, unknown>),
    token: raw.token as string,
    redirect: !!raw.redirect,
    url: (raw.url as string | null) ?? null,
  }
}

export function buildApi(api: Record<string, Function>, headers: Headers): Record<string, any> {
  const built: Record<string, any> = {}

  for (const mapping of MAPPINGS) {
    const fn = api[mapping.source]
    if (typeof fn !== 'function') continue

    const segments = mapping.path.split('.')
    const key = segments.pop()!
    let current = built

    for (const seg of segments) {
      current[seg] ??= {}
      current = current[seg]
    }

    if (mapping.build) {
      const builtFn = (...args: any[]) => fn(mapping.build!(headers, ...args))
      current[key] = SIGN_IN_RESULT_PATHS.has(mapping.path)
        ? async (...args: any[]) => toSignInResult((await builtFn(...args)) as Record<string, unknown>)
        : builtFn
    } else {
      const putIn = mapping.verb === 'GET' ? 'query' : 'body'
      const bareFn = (params?: Record<string, unknown>) => fn({ headers, [putIn]: params ?? {} })
      current[key] = SIGN_IN_RESULT_PATHS.has(mapping.path)
        ? async (params?: Record<string, unknown>) =>
            toSignInResult((await bareFn(params)) as Record<string, unknown>)
        : bareFn
    }
  }

  const proxied = buildProxiedApi(api, headers)
  const passthrough: Record<string, any> = {}
  for (const key of Object.keys(api)) {
    if (typeof api[key] !== 'function') continue
    if (MAPPINGS.some((m) => m.source === key)) continue
    if (SKIP_INTERNAL.has(key)) continue
    passthrough[key] = (...args: any[]) => proxied[key](...args)
  }
  if (Object.keys(passthrough).length > 0) {
    built.api = passthrough
  }

  return built
}
