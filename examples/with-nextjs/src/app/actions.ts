'use server'

import { action } from 'towerjs/gatehouse/next'
import { courier } from 'towerjs/courier'

import {
  signIn as _signIn,
  signUp as _signUp,
  signOut as _signOut,
  requestMagicLink as _requestMagicLink,
  sendVerificationOTP as _sendVerificationOTP,
  signInWithOTP as _signInWithOTP,
  updateProfile as _updateProfile,
  changePassword as _changePassword,
  createOrganization as _createOrganization,
  updateOrganization as _updateOrganization,
  deleteOrganization as _deleteOrganization,
  inviteMember as _inviteMember,
  removeMember as _removeMember,
  cancelInvitation as _cancelInvitation,
  acceptInvitation as _acceptInvitation,
  revokeSession as _revokeSession,
  revokeOtherSessions as _revokeOtherSessions,
  enableTwoFactor as _enableTwoFactor,
  verifyTwoFactor as _verifyTwoFactor,
  disableTwoFactor as _disableTwoFactor,
  generateBackupCodes as _generateBackupCodes,
  assignRole as _assignRole,
  removeRole as _removeRole,
} from 'towerjs/gatehouse/actions'

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
