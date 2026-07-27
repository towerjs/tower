import { gatehouse as rawGatehouse } from '@towerjs/gatehouse'
import type { GatehouseModule, GatehouseInstance } from '@towerjs/gatehouse'
import type {
  Session,
  GatehouseUser,
  GatehouseSession,
  ApiKeyInfo,
  Organization,
  OrganizationFull,
} from '@towerjs/gatehouse'
import { getTowerApp } from './runtime'

type GatehouseFacadeMethods = {
  getSession(): Promise<Session | null>
  session(): Promise<Session | null>
  user(): Promise<GatehouseUser | null>
  requireUser(): Promise<GatehouseUser>
  getUserSessions(): Promise<GatehouseSession[]>
  getApiKeys(userId: string): Promise<ApiKeyInfo[]>
  getOrganizations(): Promise<Organization[]>
  getOrganization(id: string): Promise<OrganizationFull | null>
}

type GatehouseAPI = GatehouseModule & Omit<GatehouseInstance, keyof GatehouseFacadeMethods> & GatehouseFacadeMethods

let _ready: Promise<void> | undefined

function ensureReady(): Promise<void> {
  if (!_ready) {
    _ready = getTowerApp().then(() => {})
  }
  return _ready
}

export const gatehouse: GatehouseAPI = new Proxy(rawGatehouse, {
  get(target, prop) {
    if (typeof prop === 'symbol') return undefined

    let value: any
    try {
      value = (target as any)[prop]
    } catch {
      return (...args: any[]) =>
        ensureReady().then(() => {
          const v = (target as any)[prop]
          if (typeof v === 'function') return v(...args)
          return v
        })
    }

    if (typeof value === 'function') {
      return (...args: any[]) => ensureReady().then(() => value(...args))
    }
    return value
  },
}) as GatehouseAPI
