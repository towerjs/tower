export type AuthActionConfig = {
  name: string
  path: string
  fields?: string[]
  idFirst?: boolean
  noForm?: boolean
  fieldMap?: Record<string, string>
}

export const authActions: AuthActionConfig[] = [
  // ── Sign In / Sign Up / Sign Out ────────────────────────────────
  { name: 'signIn',                path: 'signIn.email',             fields: ['email', 'password'] },
  { name: 'signUp',                path: 'signUp.email',             fields: ['name', 'email', 'password'] },
  { name: 'signOut',               path: 'sessions.signOut',                                noForm: true },
  { name: 'refreshSession',        path: 'sessions.refresh',         fields: ['refreshToken'] },
  { name: 'signInWithOTP',         path: 'signIn.emailOtp',          fields: ['email'] },
  { name: 'signInWithPhone',       path: 'signIn.phone',             fields: ['phoneNumber'] },
  { name: 'requestMagicLink',      path: 'signIn.magicLink',         fields: ['email'] },

  // ── Sessions ────────────────────────────────────────────────────
  { name: 'revokeSession',         path: 'sessions.revoke',          fields: ['token'],     idFirst: true },
  { name: 'revokeOtherSessions',   path: 'sessions.revokeOther',                            noForm: true },
  { name: 'revokeAllSessions',     path: 'sessions.revokeAll',                              noForm: true },
  { name: 'updateSession',         path: 'sessions.update',          fields: ['currentSessionToken'] },

  // ── Account ─────────────────────────────────────────────────────
  { name: 'updateProfile',         path: 'account.update',           fields: ['name'] },
  { name: 'deleteAccount',         path: 'account.delete',           fields: ['password'] },
  { name: 'setPassword',           path: 'account.setPassword',      fields: ['newPassword', 'currentPassword'] },
  { name: 'changeEmail',           path: 'account.changeEmail',      fields: ['newEmail'] },

  // ── Password ────────────────────────────────────────────────────
  { name: 'changePassword',        path: 'password.change',          fields: ['currentPassword', 'newPassword'] },
  { name: 'verifyPassword',        path: 'password.confirm',         fields: ['password'] },
  { name: 'requestPasswordReset',  path: 'password.forgot',          fields: ['email'] },
  { name: 'resetPassword',         path: 'password.reset',           fields: ['newPassword', 'token'] },

  // ── Email ───────────────────────────────────────────────────────
  { name: 'sendVerificationEmail', path: 'email.sendVerification',   fields: ['email'] },
  { name: 'verifyEmail',           path: 'email.verify',             fields: ['token'] },

  // ── Email OTP ───────────────────────────────────────────────────
  { name: 'sendVerificationOTP',               path: 'email.otp.send',             fields: ['email', 'type'] },
  { name: 'verifyVerificationOTP',             path: 'email.otp.confirm',          fields: ['email', 'otp'] },
  { name: 'verifyEmailOTP',                    path: 'email.otp.verifyEmail',      fields: ['email', 'otp'] },
  { name: 'checkVerificationOTP',              path: 'email.otp.check',            fields: ['email', 'otp'] },
  { name: 'createVerificationOTP',             path: 'email.otp.create',           fields: ['email', 'type'] },
  { name: 'forgotPasswordOTP',                 path: 'email.otp.forgotPassword',   fields: ['email'] },
  { name: 'requestEmailChangeOTP',             path: 'email.otp.requestChange',    fields: ['email', 'newEmail'] },
  { name: 'confirmEmailChangeOTP',             path: 'email.otp.confirmChange',    fields: ['email', 'newEmail', 'otp'] },
  { name: 'requestPasswordResetOTP',           path: 'email.otp.requestReset',     fields: ['email'] },
  { name: 'resetPasswordOTP',                  path: 'email.otp.resetPassword',    fields: ['email', 'otp', 'newPassword'] },

  // ── Phone OTP ───────────────────────────────────────────────────
  { name: 'sendPhoneOTP',                      path: 'phone.otp.send',             fields: ['phoneNumber'] },
  { name: 'verifyPhoneOTP',                    path: 'phone.otp.confirm',           fields: ['phoneNumber', 'otp'] },
  { name: 'verifyPhone',                       path: 'phone.verify',               fields: ['phoneNumber'] },
  { name: 'requestPasswordResetPhoneOTP',      path: 'phone.otp.requestReset',     fields: ['phoneNumber'] },
  { name: 'resetPasswordPhoneOTP',             path: 'phone.otp.resetPassword',    fields: ['phoneNumber', 'otp', 'newPassword'] },

  // ── Passkeys ────────────────────────────────────────────────────
  { name: 'updatePasskey',         path: 'passkeys.update',          fields: ['id', 'name'] },
  { name: 'removePasskey',         path: 'passkeys.remove',          fields: ['id'] },
  { name: 'deletePasskey',         path: 'passkeys.delete',          fields: ['id'] },

  // ── Admin ───────────────────────────────────────────────────────
  { name: 'createUser',            path: 'admin.createUser',         fields: ['name', 'email', 'password'] },
  { name: 'removeUser',            path: 'admin.removeUser',         fields: ['userId'] },
  { name: 'adminUpdateUser',       path: 'admin.updateUser',         fields: ['userId'] },
  { name: 'setUserPassword',       path: 'admin.setUserPassword',    fields: ['userId', 'newPassword'] },
  { name: 'setRole',               path: 'admin.setRole',            fields: ['userId', 'role'] },
  { name: 'banUser',               path: 'admin.banUser',            fields: ['userId', 'banReason', 'banExpiresIn'] },
  { name: 'unbanUser',             path: 'admin.unbanUser',          fields: ['userId'] },
  { name: 'impersonateUser',       path: 'admin.impersonateUser',    fields: ['userId'] },
  { name: 'stopImpersonating',     path: 'admin.stopImpersonating',                        noForm: true },
  { name: 'revokeUserSession',     path: 'admin.revokeUserSession',  fields: ['sessionToken'] },
  { name: 'revokeUserSessions',    path: 'admin.revokeUserSessions', fields: ['userId'] },
  { name: 'userHasPermission',     path: 'admin.checkPermission',    fields: ['userId', 'permission', 'organizationId'] },

  // ── API Keys ────────────────────────────────────────────────────
  { name: 'createApiKey',          path: 'apiKeys.create',           fields: ['name', 'expiresIn'] },
  { name: 'updateApiKey',          path: 'apiKeys.update',           fields: ['id', 'name'] },
  { name: 'deleteApiKey',          path: 'apiKeys.delete',           fields: ['id'] },
  { name: 'verifyApiKey',          path: 'apiKeys.verify',           fields: ['key'] },
  { name: 'deleteExpiredApiKeys',  path: 'apiKeys.removeExpired',                           noForm: true },

  // ── Identities (social) ─────────────────────────────────────────
  { name: 'unlinkAccount',         path: 'identities.unlink',        fields: ['providerId', 'accountId'] },

  // ── TOTP / 2FA ──────────────────────────────────────────────────
  { name: 'disableTwoFactor',      path: 'totp.disable',             fields: ['password'] },
  { name: 'generateTOTP',          path: 'totp.generate',            fields: ['password'] },
  { name: 'sendTwoFactorOTP',      path: 'totp.otp.send',            fields: ['email', 'password'] },
  { name: 'verifyTwoFactorOTP',    path: 'totp.otp.verify',          fields: ['email', 'otp'] },

  // ── Backup codes ────────────────────────────────────────────────
  { name: 'verifyBackupCode',      path: 'backupCodes.verify',       fields: ['code'] },

  // ── Organizations ───────────────────────────────────────────────
  { name: 'createOrganization',    path: 'organizations.create',     fields: ['name', 'slug'] },
  { name: 'updateOrganization',    path: 'organizations.update',     fields: ['id', 'name', 'slug'], fieldMap: { id: 'organizationId', name: 'data.name', slug: 'data.slug' } },
  { name: 'deleteOrganization',    path: 'organizations.delete',     fields: ['id'],            fieldMap: { id: 'organizationId' } },
  { name: 'setActiveOrganization', path: 'organizations.setActive',  fields: ['organizationId'] },
  { name: 'leaveOrganization',     path: 'organizations.leave',      fields: ['organizationId'] },

  // ── Organization roles ──────────────────────────────────────────
  { name: 'createOrgRole',         path: 'organizations.roles.create',   fields: ['name', 'permissions'] },
  { name: 'updateOrgRole',         path: 'organizations.roles.update',   fields: ['id', 'name', 'permissions'] },
  { name: 'deleteOrgRole',         path: 'organizations.roles.delete',   fields: ['id'] },

  // ── Members ─────────────────────────────────────────────────────
  { name: 'addMember',             path: 'organizations.members.add',    fields: ['organizationId', 'email', 'role'] },
  { name: 'updateMemberRole',      path: 'organizations.members.update', fields: ['memberId', 'role'], fieldMap: { memberId: 'memberIdOrEmail' } },
  { name: 'removeMember',          path: 'organizations.members.remove', fields: ['orgId', 'memberId'], fieldMap: { orgId: 'organizationId', memberId: 'memberIdOrEmail' } },

  // ── Invitations ─────────────────────────────────────────────────
  { name: 'inviteMember',          path: 'organizations.invitations.create', fields: ['orgId', 'email', 'role'], fieldMap: { orgId: 'organizationId' } },
  { name: 'cancelInvitation',      path: 'organizations.invitations.cancel', fields: ['invitationId'] },
  { name: 'acceptInvitation',      path: 'organizations.invitations.accept', fields: ['invitationId'] },
  { name: 'rejectInvitation',      path: 'organizations.invitations.reject', fields: ['invitationId'] },

  // ── Permissions ─────────────────────────────────────────────────
  { name: 'hasPermission',         path: 'organizations.checkPermission', fields: ['userId', 'permission', 'organizationId'] },
]
