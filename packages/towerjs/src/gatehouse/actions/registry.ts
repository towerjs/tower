export type AuthActionConfig = {
  name: string
  path: string
  fields?: string[]
  /**
   * True when the underlying method takes an identifier as its first
   * positional argument and an optional rest-object second: `fn(id, params)`.
   */
  idFirst?: boolean
  /**
   * True when the underlying method takes multiple positional string
   * arguments in the order declared by `fields`: `fn(...values)`.
   */
  positional?: boolean
  noForm?: boolean
}

export const authActions: AuthActionConfig[] = [
  // ── Sign in / up / out ───────────────────────────────────────────
  { name: 'signIn', path: 'signIn.email', fields: ['email', 'password'] },
  { name: 'signUp', path: 'signUp.email', fields: ['name', 'email', 'password'] },
  { name: 'signOut', path: 'sessions.signOut', noForm: true },
  { name: 'signInWithOTP', path: 'signIn.emailOtp', fields: ['email', 'otp'] },
  { name: 'signInWithPhone', path: 'signIn.phone', fields: ['phoneNumber', 'code'] },
  { name: 'requestMagicLink', path: 'signIn.magicLink', fields: ['email'] },

  // ── Sessions ─────────────────────────────────────────────────────
  { name: 'revokeSession', path: 'sessions.revoke', fields: ['token'], idFirst: true },
  { name: 'revokeOtherSessions', path: 'sessions.revokeOther', noForm: true },

  // ── Account ──────────────────────────────────────────────────────
  { name: 'updateProfile', path: 'account.update', fields: ['name', 'image'] },
  { name: 'deleteAccount', path: 'account.delete', fields: ['password'] },
  { name: 'setPassword', path: 'account.setPassword', fields: ['newPassword'], idFirst: true },
  { name: 'changeEmail', path: 'account.changeEmail', fields: ['newEmail'], idFirst: true },

  // ── Password ─────────────────────────────────────────────────────
  { name: 'changePassword', path: 'password.change', fields: ['currentPassword', 'newPassword'] },
  { name: 'verifyPassword', path: 'password.confirm', fields: ['password'] },
  { name: 'requestPasswordReset', path: 'password.forgot', fields: ['email'] },
  { name: 'resetPassword', path: 'password.reset', fields: ['newPassword', 'token'] },

  // ── Email ────────────────────────────────────────────────────────
  { name: 'sendVerificationEmail', path: 'email.sendVerification', fields: ['email'] },
  { name: 'verifyEmail', path: 'email.verify', fields: ['token'] },

  // ── Email OTP ────────────────────────────────────────────────────
  { name: 'sendVerificationOTP', path: 'email.otp.send', fields: ['email', 'type'] },
  { name: 'verifyVerificationOTP', path: 'email.otp.confirm', fields: ['email', 'otp'] },

  // ── Phone OTP ────────────────────────────────────────────────────
  { name: 'sendPhoneOTP', path: 'phone.otp.send', fields: ['phoneNumber'] },
  { name: 'verifyPhoneOTP', path: 'phone.otp.confirm', fields: ['phoneNumber', 'code'] },

  // ── Passkeys ─────────────────────────────────────────────────────
  { name: 'updatePasskey', path: 'passkeys.update', fields: ['id', 'name'], idFirst: true },
  { name: 'deletePasskey', path: 'passkeys.delete', fields: ['id'], idFirst: true },

  // ── Admin ────────────────────────────────────────────────────────
  { name: 'createUser', path: 'admin.createUser', fields: ['name', 'email', 'password'] },
  { name: 'removeUser', path: 'admin.removeUser', fields: ['userId'], idFirst: true },
  { name: 'setUserPassword', path: 'admin.setUserPassword', fields: ['userId', 'newPassword'], positional: true },
  { name: 'setRole', path: 'admin.setRole', fields: ['userId', 'role'] },
  { name: 'banUser', path: 'admin.banUser', fields: ['userId', 'banReason', 'banExpiresIn'], idFirst: true },
  { name: 'unbanUser', path: 'admin.unbanUser', fields: ['userId'], idFirst: true },
  { name: 'impersonateUser', path: 'admin.impersonateUser', fields: ['userId'], idFirst: true },
  { name: 'stopImpersonating', path: 'admin.stopImpersonating', noForm: true },
  { name: 'revokeUserSession', path: 'admin.revokeUserSession', fields: ['sessionToken'], idFirst: true },
  { name: 'revokeUserSessions', path: 'admin.revokeUserSessions', fields: ['userId'], idFirst: true },

  // ── API keys ─────────────────────────────────────────────────────
  { name: 'createApiKey', path: 'apiKeys.create', fields: ['name', 'expiresIn'] },
  { name: 'updateApiKey', path: 'apiKeys.update', fields: ['id', 'name'], idFirst: true },
  { name: 'deleteApiKey', path: 'apiKeys.delete', fields: ['id'], idFirst: true },
  { name: 'verifyApiKey', path: 'apiKeys.verify', fields: ['key'] },
  { name: 'deleteExpiredApiKeys', path: 'apiKeys.deleteAllExpired', noForm: true },

  // ── Identities ───────────────────────────────────────────────────
  { name: 'unlinkAccount', path: 'identities.unlink', fields: ['providerId', 'accountId'] },

  // ── TOTP / 2FA ───────────────────────────────────────────────────
  { name: 'disableTwoFactor', path: 'totp.disable', fields: ['password'] },
  { name: 'generateTOTP', path: 'totp.uri', fields: ['password'], idFirst: true },
  { name: 'sendTwoFactorOTP', path: 'totp.otp.send', fields: ['trustDevice'] },
  { name: 'verifyTwoFactorOTP', path: 'totp.otp.verify', fields: ['code', 'trustDevice'] },

  // ── Backup codes ─────────────────────────────────────────────────
  { name: 'verifyBackupCode', path: 'backupCodes.verify', fields: ['code'], idFirst: true },

  // ── Organizations ────────────────────────────────────────────────
  { name: 'createOrganization', path: 'organizations.create', fields: ['name', 'slug'] },
  { name: 'updateOrganization', path: 'organizations.update', fields: ['id', 'name', 'slug'], idFirst: true },
  { name: 'deleteOrganization', path: 'organizations.delete', fields: ['id'], idFirst: true },
  { name: 'setActiveOrganization', path: 'organizations.setActive', fields: ['organizationId'], idFirst: true },

  // ── Members ──────────────────────────────────────────────────────
  {
    name: 'addMember',
    path: 'organizations.members.add',
    fields: ['organizationId', 'userId', 'role'],
    positional: true,
  },
  {
    name: 'updateMemberRole',
    path: 'organizations.members.update',
    fields: ['memberId', 'role', 'organizationId'],
    positional: true,
  },
  { name: 'removeMember', path: 'organizations.members.remove', fields: ['orgId', 'memberId'], positional: true },

  // ── Invitations ──────────────────────────────────────────────────
  { name: 'inviteMember', path: 'organizations.invitations.create', fields: ['orgId', 'email', 'role'], idFirst: true },
  { name: 'cancelInvitation', path: 'organizations.invitations.cancel', fields: ['invitationId'], idFirst: true },
  { name: 'acceptInvitation', path: 'organizations.invitations.accept', fields: ['invitationId'], idFirst: true },
  { name: 'rejectInvitation', path: 'organizations.invitations.reject', fields: ['invitationId'], idFirst: true },
]
