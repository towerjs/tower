import type { GatehouseModule, GatehouseInstance } from '@towerjs/gatehouse'
import type {
  Session,
  GatehouseUser,
  GatehouseSession,
  ApiKeyInfo,
  Organization,
  OrganizationFull,
} from '@towerjs/gatehouse'
import { getTowerApp, importModule } from './runtime.js'

type GatehouseApiMethods = {
  getSession(): Promise<Session | null>
  session(): Promise<Session | null>
  user(): Promise<GatehouseUser | null>
  requireUser(): Promise<GatehouseUser>
  getUserSessions(): Promise<GatehouseSession[]>
  getApiKeys(userId: string): Promise<ApiKeyInfo[]>
  getOrganizations(): Promise<Organization[]>
  getOrganization(id: string): Promise<OrganizationFull | null>
}

type GatehouseAPI = GatehouseModule & Omit<GatehouseInstance, keyof GatehouseApiMethods> & GatehouseApiMethods

let _raw: any

async function raw() {
  if (!_raw) {
    if (typeof window !== 'undefined') {
      const { gatehouse: rawGatehouse } = await import('@towerjs/gatehouse')
      _raw = rawGatehouse
    } else {
      await getTowerApp()
      _raw = (await importModule('@towerjs/gatehouse')).gatehouse
    }
  }
  return _raw
}

function createDeepCall(path: string[]) {
  return new Proxy(
    (...args: any[]) =>
      raw().then((r) => {
        let v = r
        for (const p of path) v = v[p]
        if (typeof v === 'function') return v(...args)
        return v
      }),
    {
      get(_, subProp) {
        if (typeof subProp === 'symbol' || subProp === 'then') return undefined
        return createDeepCall([...path, String(subProp)])
      },
    }
  )
}

export const gatehouse: GatehouseAPI = new Proxy({} as GatehouseAPI, {
  get(_target, prop) {
    if (typeof prop === 'symbol' || prop === 'then') return undefined
    return createDeepCall([String(prop)])
  },
}) as GatehouseAPI
