'use server'

import { gatehouse } from '@towerjs/gatehouse'

import { FormActionFn, action } from '../next.js'
import { authActions } from './registry.js'

function resolve(path: string) {
  const parts = path.split('.')
  let obj: any = gatehouse
  for (const p of parts) obj = obj[p]
  return obj
}

const built: Record<string, FormActionFn> = {}

for (const def of authActions) {
  if (def.noForm) {
    built[def.name] = action.form(async () => {
      const fn = resolve(def.path)
      await fn()
    })
  } else if (def.positional) {
    built[def.name] = action.form(async (data: Record<string, string>) => {
      const fn = resolve(def.path)
      await fn(...def.fields!.map((f) => data[f]))
    })
  } else if (def.idFirst) {
    built[def.name] = action.form(async (data: Record<string, string>) => {
      const fn = resolve(def.path)
      const id = data[def.fields![0]]
      const rest = Object.fromEntries(def.fields!.slice(1).map((f) => [f, data[f]]))
      if (Object.keys(rest).length === 0) {
        await fn(id)
      } else {
        await fn(id, rest)
      }
    })
  } else {
    built[def.name] = action.form(async (data: Record<string, string>) => {
      const fn = resolve(def.path)
      await fn(data)
    })
  }
}

export const {
  // Sign in / up / out
  signIn,
  signUp,
  signOut,
  signInWithOTP,
  signInWithPhone,
  requestMagicLink,

  // Sessions
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,

  // Account
  updateProfile,
  deleteAccount,
  setPassword,
  changeEmail,

  // Password
  changePassword,
  verifyPassword,
  requestPasswordReset,
  resetPassword,

  // Email
  sendVerificationEmail,
  verifyEmail,

  // Email OTP
  sendVerificationOTP,
  verifyVerificationOTP,

  // Phone OTP
  sendPhoneOTP,
  verifyPhoneOTP,

  // Passkeys
  updatePasskey,
  deletePasskey,

  // Admin
  createUser,
  removeUser,
  setUserPassword,
  setRole,
  banUser,
  unbanUser,
  impersonateUser,
  stopImpersonating,
  revokeUserSession,
  revokeUserSessions,

  // API Keys
  createApiKey,
  updateApiKey,
  deleteApiKey,
  verifyApiKey,

  // Identities
  unlinkAccount,

  // TOTP / 2FA
  disableTwoFactor,
  sendTwoFactorOTP,
  verifyTwoFactorOTP,

  // Backup codes
  verifyBackupCode,

  // Organizations
  createOrganization,
  updateOrganization,
  deleteOrganization,
  setActiveOrganization,

  // Members
  addMember,
  updateMemberRole,
  removeMember,

  // Invitations
  inviteMember,
  cancelInvitation,
  acceptInvitation,
  rejectInvitation,
} = built

export const verifyTwoFactor = action.form(async ({ code, trustDevice }: Record<string, string>) => {
  await gatehouse.totp.verify({ code, trustDevice: trustDevice === 'true' })
})

export const enableTwoFactor = action(async (formData: FormData) => {
  return gatehouse.totp.enable({ password: formData.get('password') as string })
})

export const generateBackupCodes = action(async (formData: FormData) => {
  return gatehouse.backupCodes.generate({ password: formData.get('password') as string })
})

export const assignRole = action.form(async ({ userId, role }: Record<string, string>) => {
  await gatehouse.roles.assign(userId, role)
})

export const removeRole = action.form(async ({ userId }: Record<string, string>) => {
  await gatehouse.roles.remove(userId)
})
