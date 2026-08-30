'use server'

import * as gatehouseActions from '@towerjs/gatehouse/actions'
import { initTower } from '@towerjs/tower/runtime'

import tower from '../../tower.config'

function configured<T extends (...args: any[]) => Promise<any>>(action: T): T {
  return (async (...args: Parameters<T>) => {
    await initTower(tower.modules, tower)
    return action(...args)
  }) as T
}

export const banUser = configured(gatehouseActions.banUser)
export const cancelInvitation = configured(gatehouseActions.cancelInvitation)
export const changePassword = configured(gatehouseActions.changePassword)
export const createOrganization = configured(gatehouseActions.createOrganization)
export const deleteOrganization = configured(gatehouseActions.deleteOrganization)
export const disableTwoFactor = configured(gatehouseActions.disableTwoFactor)
export const enableTwoFactor = configured(gatehouseActions.enableTwoFactor)
export const generateBackupCodes = configured(gatehouseActions.generateBackupCodes)
export const inviteMember = configured(gatehouseActions.inviteMember)
export const rejectInvitation = configured(gatehouseActions.rejectInvitation)
export const removeMember = configured(gatehouseActions.removeMember)
export const requestMagicLink = configured(gatehouseActions.requestMagicLink)
export const revokeOtherSessions = configured(gatehouseActions.revokeOtherSessions)
export const revokeSession = configured(gatehouseActions.revokeSession)
export const sendVerificationOTP = configured(gatehouseActions.sendVerificationOTP)
export const setActiveOrganization = configured(gatehouseActions.setActiveOrganization)
export const signIn = configured(gatehouseActions.signIn)
export const signInWithOTP = configured(gatehouseActions.signInWithOTP)
export const signOut = configured(gatehouseActions.signOut)
export const signUp = configured(gatehouseActions.signUp)
export const updateMemberRole = configured(gatehouseActions.updateMemberRole)
export const updateOrganization = configured(gatehouseActions.updateOrganization)
export const updateProfile = configured(gatehouseActions.updateProfile)
export const verifyTwoFactor = configured(gatehouseActions.verifyTwoFactor)
