export { action, withGatehouse, GET, POST } from '@towerjs/gatehouse/next-js'

export { signIn, signUp, signOut } from './auth-actions'

import { Gatehouse } from '@towerjs/gatehouse'
import type { ApiKeyInfo, GatehouseSession, Organization, OrganizationFull, Session } from '@towerjs/gatehouse'
import { getTowerApp } from '../runtime'

async function getRequestInstance() {
  try {
    const { cookies } = await import('next/headers' as string)
    const c = await cookies()
    await getTowerApp()
    return Gatehouse.from({ headers: new Headers({ Cookie: c.toString() }) })
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const gh = await getRequestInstance()
  if (!gh) return null
  return gh.session()
}

export async function getUserSessions(): Promise<GatehouseSession[]> {
  const gh = await getRequestInstance()
  if (!gh) return []
  return gh.sessions.list()
}

export async function getApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const gh = await getRequestInstance()
  if (!gh) return []
  const { keys } = await gh.apiKeys.list(userId)
  return keys
}

export async function getOrganizations(): Promise<Organization[]> {
  const gh = await getRequestInstance()
  if (!gh) return []
  return gh.organizations.list()
}

export async function getOrganization(id: string): Promise<OrganizationFull | null> {
  const gh = await getRequestInstance()
  if (!gh) return null
  return gh.organizations.getFull(id)
}
