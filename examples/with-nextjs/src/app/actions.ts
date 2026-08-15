'use server'

import { courier } from 'towerjs/courier'
import {
  acceptInvitation as _acceptInvitation,
  assignRole as _assignRole,
  cancelInvitation as _cancelInvitation,
  changePassword as _changePassword,
  createOrganization as _createOrganization,
  deleteOrganization as _deleteOrganization,
  disableTwoFactor as _disableTwoFactor,
  enableTwoFactor as _enableTwoFactor,
  generateBackupCodes as _generateBackupCodes,
  inviteMember as _inviteMember,
  removeMember as _removeMember,
  removeRole as _removeRole,
  requestMagicLink as _requestMagicLink,
  revokeOtherSessions as _revokeOtherSessions,
  revokeSession as _revokeSession,
  sendVerificationOTP as _sendVerificationOTP,
  signIn as _signIn,
  signInWithOTP as _signInWithOTP,
  signOut as _signOut,
  signUp as _signUp,
  updateOrganization as _updateOrganization,
  updateProfile as _updateProfile,
  verifyTwoFactor as _verifyTwoFactor,
} from 'towerjs/gatehouse/actions'
import { action } from 'towerjs/gatehouse/next'

export const signIn = _signIn
export const signUp = _signUp
export const signOut = _signOut
export const requestMagicLink = _requestMagicLink
export const sendVerificationOTP = _sendVerificationOTP
export const signInWithOTP = _signInWithOTP
export const updateProfile = _updateProfile
export const changePassword = _changePassword
export const createOrganization = _createOrganization
export const updateOrganization = _updateOrganization
export const deleteOrganization = _deleteOrganization
export const inviteMember = _inviteMember
export const removeMember = _removeMember
export const cancelInvitation = _cancelInvitation
export const acceptInvitation = _acceptInvitation
export const revokeSession = _revokeSession
export const revokeOtherSessions = _revokeOtherSessions
export const enableTwoFactor = _enableTwoFactor
export const verifyTwoFactor = _verifyTwoFactor
export const disableTwoFactor = _disableTwoFactor
export const generateBackupCodes = _generateBackupCodes
export const assignRole = _assignRole
export const removeRole = _removeRole

export const sendCourierEmail = action(async (formData: FormData) => {
  const result = await courier.email.send({
    to: formData.get('to') as string,
    subject: (formData.get('subject') as string) || 'Tower Courier test',
    text: (formData.get('body') as string) || 'This is a test email from Tower.',
  })
  return { id: result.id, provider: result.provider }
})
