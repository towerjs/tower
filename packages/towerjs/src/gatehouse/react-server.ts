import type { GatehouseModule, GatehouseInstance } from '@towerjs/gatehouse'
import type {
  Session,
  GatehouseUser,
  GatehouseSession,
  ApiKeyInfo,
  Organization,
  OrganizationFull,
} from '@towerjs/gatehouse'
import { setRequestContextResolver } from '@towerjs/foundation'
import { getTowerApp, importModule } from '../runtime'

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

setRequestContextResolver(async () => {
  const { headers } = await import('next/headers')
  const h = await headers()
  return { headers: h }
})

/**
 * Marks the route as dynamic before initializing the app.
 *
 * During static prerendering, awaiting `headers()` throws a
 * DynamicServerError which makes Next.js treat the route as dynamic,
 * so the tower app (and its DB connection) is never initialized at build time.
 */
async function markDynamicAndInit(): Promise<any> {
  const { headers } = await import('next/headers')
  await headers()
  await getTowerApp()
  return (await importModule('@towerjs/gatehouse')).gatehouse
}

function createDeepCall(path: string[]) {
  return new Proxy(
    (...args: any[]) =>
      markDynamicAndInit().then((r) => {
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
    },
  )
}

export const gatehouse: GatehouseAPI = new Proxy({} as GatehouseAPI, {
  get(_target, prop) {
    if (typeof prop === 'symbol' || prop === 'then') return undefined
    return createDeepCall([String(prop)])
  },
}) as GatehouseAPI
