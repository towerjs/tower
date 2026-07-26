// ─── Mapping: Better Auth method → Gatehouse path ─────────────────
// Every path is a dot-separated sequence of object keys.
// Methods not in this table or SKIP_INTERNAL are exposed via
// gatehouse.api[methodName]().

const MAPPINGS: Record<string, string> = {
  // ── Sign In / Sign Up / Sign Out ────────────────────────────────
  signInEmail: 'signIn.email',
  signUpEmail: 'signUp.email',
  signOut: 'sessions.signOut',
  refreshToken: 'sessions.refresh',
  signInEmailOTP: 'signIn.emailOtp',
  signInPhoneNumber: 'signIn.phone',
  signInSocial: 'signIn.social',
  signInMagicLink: 'signIn.magicLink',

  // ── Sessions ────────────────────────────────────────────────────
  listSessions: 'sessions.list',
  revokeSession: 'sessions.revoke',
  revokeOtherSessions: 'sessions.revokeOther',
  revokeSessions: 'sessions.revokeAll',
  updateSession: 'sessions.update',

  // ── Account (self-service) ──────────────────────────────────────
  accountInfo: 'account.info',
  updateUser: 'account.update',
  deleteUser: 'account.delete',
  setPassword: 'account.setPassword',
  changeEmail: 'account.changeEmail',

  // ── Password ────────────────────────────────────────────────────
  changePassword: 'password.change',
  verifyPassword: 'password.confirm',
  requestPasswordReset: 'password.forgot',
  resetPassword: 'password.reset',

  // ── Email ────────────────────────────────────────────────────────
  sendVerificationEmail: 'email.sendVerification',
  verifyEmail: 'email.verify',

  // ── Email OTP ───────────────────────────────────────────────────
  sendVerificationOTP: 'email.otp.send',
  verifyVerificationOTP: 'email.otp.confirm',
  verifyEmailOTP: 'email.otp.verifyEmail',
  checkVerificationOTP: 'email.otp.check',
  createVerificationOTP: 'email.otp.create',
  getVerificationOTP: 'email.otp.get',
  forgetPasswordEmailOTP: 'email.otp.forgotPassword',
  requestEmailChangeEmailOTP: 'email.otp.requestChange',
  changeEmailEmailOTP: 'email.otp.confirmChange',
  requestPasswordResetEmailOTP: 'email.otp.requestReset',
  resetPasswordEmailOTP: 'email.otp.resetPassword',

  // ── Phone OTP ───────────────────────────────────────────────────
  sendPhoneNumberOTP: 'phone.otp.send',
  verifyPhoneNumberOTP: 'phone.otp.confirm',
  verifyPhoneNumber: 'phone.verify',
  requestPasswordResetPhoneNumber: 'phone.otp.requestReset',
  resetPasswordPhoneNumber: 'phone.otp.resetPassword',

  // ── Passkeys ────────────────────────────────────────────────────
  listPasskeys: 'passkeys.list',
  addPasskey: 'passkeys.add',
  updatePasskey: 'passkeys.update',
  removePasskey: 'passkeys.remove',
  deletePasskey: 'passkeys.delete',
  generatePasskeyAuthenticationOptions: 'passkeys.authOptions',
  generatePasskeyRegistrationOptions: 'passkeys.regOptions',
  verifyPasskeyAuthentication: 'passkeys.verifyAuth',
  verifyPasskeyRegistration: 'passkeys.verifyReg',

  // ── Admin ───────────────────────────────────────────────────────
  createUser: 'admin.createUser',
  listUsers: 'admin.listUsers',
  getUser: 'admin.getUser',
  removeUser: 'admin.removeUser',
  adminUpdateUser: 'admin.updateUser',
  setUserPassword: 'admin.setUserPassword',
  setRole: 'admin.setRole',
  banUser: 'admin.banUser',
  unbanUser: 'admin.unbanUser',
  impersonateUser: 'admin.impersonateUser',
  stopImpersonating: 'admin.stopImpersonating',
  listUserSessions: 'admin.listUserSessions',
  revokeUserSession: 'admin.revokeUserSession',
  revokeUserSessions: 'admin.revokeUserSessions',
  userHasPermission: 'admin.checkPermission',

  // ── API Keys ────────────────────────────────────────────────────
  createApiKey: 'apiKeys.create',
  listApiKeys: 'apiKeys.list',
  getApiKey: 'apiKeys.get',
  updateApiKey: 'apiKeys.update',
  deleteApiKey: 'apiKeys.delete',
  verifyApiKey: 'apiKeys.verify',
  deleteAllExpiredApiKeys: 'apiKeys.removeExpired',

  // ── Identities (social providers) ───────────────────────────────
  listUserAccounts: 'identities.list',
  unlinkAccount: 'identities.unlink',
  linkSocialAccount: 'identities.link',
  getAccessToken: 'identities.getToken',

  // ── TOTP ────────────────────────────────────────────────────────
  enableTwoFactor: 'totp.enable',
  disableTwoFactor: 'totp.disable',
  generateTOTP: 'totp.generate',
  verifyTOTP: 'totp.verify',
  getTOTPURI: 'totp.uri',
  sendTwoFactorOTP: 'totp.otp.send',
  verifyTwoFactorOTP: 'totp.otp.verify',

  // ── Backup codes ────────────────────────────────────────────────
  generateBackupCodes: 'backupCodes.generate',
  verifyBackupCode: 'backupCodes.verify',
  viewBackupCodes: 'backupCodes.view',

  // ── Organizations ───────────────────────────────────────────────
  createOrganization: 'organizations.create',
  listOrganizations: 'organizations.list',
  getOrganization: 'organizations.get',
  getFullOrganization: 'organizations.getFull',
  updateOrganization: 'organizations.update',
  deleteOrganization: 'organizations.delete',
  setActiveOrganization: 'organizations.setActive',
  checkOrganizationSlug: 'organizations.checkSlug',
  leaveOrganization: 'organizations.leave',

  // Organization roles
  createOrgRole: 'organizations.roles.create',
  listOrgRoles: 'organizations.roles.list',
  getOrgRole: 'organizations.roles.get',
  updateOrgRole: 'organizations.roles.update',
  deleteOrgRole: 'organizations.roles.delete',

  // Members
  addMember: 'organizations.members.add',
  listMembers: 'organizations.members.list',
  updateMemberRole: 'organizations.members.update',
  removeMember: 'organizations.members.remove',
  getActiveMember: 'organizations.members.active',
  getActiveMemberRole: 'organizations.members.activeRole',

  // Invitations
  createInvitation: 'organizations.invitations.create',
  listInvitations: 'organizations.invitations.list',
  getInvitation: 'organizations.invitations.get',
  acceptInvitation: 'organizations.invitations.accept',
  rejectInvitation: 'organizations.invitations.reject',
  cancelInvitation: 'organizations.invitations.cancel',
  listUserInvitations: 'organizations.invitations.userList',

  // Permissions
  hasPermission: 'organizations.checkPermission',
}

// Methods used internally by Tier 2 — not user-facing.
const SKIP_INTERNAL = new Set([
  'getSession',
  'callbackOAuth',
  'deleteUserCallback',
  'requestPasswordResetCallback',
  'error',
  'ok',
])

// Better Auth methods that use query params instead of body.
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
  'getOrganization',
  'getFullOrganization',
  'getInvitation',
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

// ─── Proxied API ──────────────────────────────────────────────────
// Wraps the raw Better Auth API to inject headers on every call and
// route params to query/body based on the HTTP verb convention.

const BA_TOP_LEVEL = new Set(['body', 'query', 'asResponse', 'headers', 'method'])

/** Wraps a Better Auth API object to auto-inject headers and route params to query/body. */
export function buildProxiedApi(api: any, headers: Headers) {
  return new Proxy(api, {
    get(target: any, prop: string) {
      if (typeof target[prop] !== 'function') return target[prop]
      const useQuery = GET_METHODS.has(prop)
      return (params?: Record<string, unknown>) => {
        const callParams: Record<string, unknown> = { headers }
        if (params) {
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

// ─── Facade builder ───────────────────────────────────────────────
// Takes a proxied Better Auth API and returns a nested facade object
// that maps BA method names to Gatehouse paths.

/** Builds a nested facade object from a Better Auth API, mapping method names to dot-separated paths. */
export function buildFacade(api: Record<string, Function>): Record<string, any> {
  const facade: Record<string, any> = {}

  for (const [source, targetPath] of Object.entries(MAPPINGS)) {
    const fn = api[source]
    if (typeof fn !== 'function') continue

    const segments = targetPath.split('.')
    const key = segments.pop()!
    let current = facade

    for (const seg of segments) {
      current[seg] ??= {}
      current = current[seg]
    }

    current[key] = (...args: any[]) => fn(...args)
  }

  const passthrough: Record<string, any> = {}
  for (const key of Object.keys(api)) {
    if (typeof api[key] !== 'function') continue
    if (key in MAPPINGS) continue
    if (SKIP_INTERNAL.has(key)) continue
    passthrough[key] = (...args: any[]) => api[key](...args)
  }
  if (Object.keys(passthrough).length > 0) {
    facade.api = passthrough
  }

  return facade
}
