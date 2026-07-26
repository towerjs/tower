export { signIn, signUp, signOut } from 'towerjs/gatehouse/next'

import { action } from 'towerjs/next'
import { gatehouse } from 'towerjs/gatehouse'
import { courier } from 'towerjs/courier'

export const updateProfile = action(async (formData: FormData) => {
  await gatehouse.account.update({
    name: formData.get('name') as string,
  })
})

export const changePassword = action(async (formData: FormData) => {
  await gatehouse.password.change({
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
  })
})

export const createOrganization = action(async (formData: FormData) => {
  await gatehouse.organizations.create({
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
  })
})

export const updateOrganization = action(async (formData: FormData) => {
  const id = formData.get('id') as string
  await gatehouse.organizations.update(id, {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
  })
})

export const deleteOrganization = action(async (formData: FormData) => {
  await gatehouse.organizations.delete(formData.get('id') as string)
})

export const inviteMember = action(async (formData: FormData) => {
  await gatehouse.organizations.invitations.create(formData.get('orgId') as string, {
    email: formData.get('email') as string,
    role: (formData.get('role') as string) || 'member',
  })
})

export const removeMember = action(async (formData: FormData) => {
  const orgId = formData.get('orgId') as string
  const memberId = formData.get('memberId') as string
  await gatehouse.organizations.members.remove(orgId, memberId)
})

export const cancelInvitation = action(async (formData: FormData) => {
  await gatehouse.organizations.invitations.cancel(formData.get('invitationId') as string)
})

export const acceptInvitation = action(async (formData: FormData) => {
  await gatehouse.organizations.invitations.accept(formData.get('invitationId') as string)
})

export const enableTwoFactor = action(async (formData: FormData) => {
  const password = formData.get('password') as string
  const result = await gatehouse.totp.enable(password)
  return result
})

export const verifyTwoFactor = action(async (formData: FormData) => {
  const code = formData.get('code') as string
  await gatehouse.totp.verify(code, formData.get('trustDevice') === 'true')
})

export const disableTwoFactor = action(async (formData: FormData) => {
  await gatehouse.totp.disable(formData.get('password') as string)
})

export const generateBackupCodes = action(async (formData: FormData) => {
  const codes = await gatehouse.backupCodes.generate(formData.get('password') as string)
  return codes
})

export const createApiKey = action(async (formData: FormData) => {
  const key = await gatehouse.apiKeys.create({
    name: formData.get('name') as string,
    userId: formData.get('userId') as string,
  })
  return key
})

export const revokeApiKey = action(async (formData: FormData) => {
  await gatehouse.apiKeys.delete(formData.get('keyId') as string)
})

export const revokeSession = action(async (formData: FormData) => {
  await gatehouse.sessions.revoke(formData.get('token') as string)
})

export const revokeOtherSessions = action(async () => {
  await gatehouse.sessions.revokeOther()
})

export const sendCourierEmail = action(async (formData: FormData) => {
  const result = await courier.email.send({
    to: formData.get('to') as string,
    subject: (formData.get('subject') as string) || 'Tower Courier test',
    text: (formData.get('body') as string) || 'This is a test email from Tower.',
  })
  return { id: result.id, provider: result.provider }
})

export const sendCourierSms = action(async (formData: FormData) => {
  const result = await courier.sms.send({
    to: formData.get('to') as string,
    body: (formData.get('body') as string) || 'This is a test SMS from Tower.',
  })
  return { id: result.id, provider: result.provider, status: result.status }
})

export const sendCourierPush = action(async (formData: FormData) => {
  const subscription = JSON.parse(formData.get('subscription') as string)
  const result = await courier.push.send({
    subscription,
    title: (formData.get('title') as string) || 'Tower test',
    body: (formData.get('body') as string) || 'Push is working.',
  })
  return { provider: result.provider, status: result.status }
})