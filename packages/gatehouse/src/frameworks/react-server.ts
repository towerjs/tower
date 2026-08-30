import type { TowerBlueprint } from '@towerjs/tower'
import { setRequestContextResolver } from '@towerjs/tower/foundation'
import { createLazyModule, initTower } from '@towerjs/tower/runtime'
import { installNodeContext } from '@towerjs/tower/runtime/node'

import type { GatehouseInstance, GatehouseModule } from '../index.js'
import type { ApiKeyInfo, GatehouseSession, GatehouseUser, Organization, OrganizationFull, Session } from '../types.js'

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

installNodeContext()

setRequestContextResolver(async () => {
  const { headers } = await import('next/headers.js')
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
async function markDynamicAndInit(config?: TowerBlueprint): Promise<any> {
  const { headers } = await import('next/headers.js')
  await headers()
  if (config) await initTower(config.modules, config)
  // The lazy module will trigger initialization via getTowerApp()
  return gatehouseReactServer
}

function createDeepCall(path: string[], config?: TowerBlueprint) {
  return new Proxy(
    (...args: any[]) =>
      markDynamicAndInit(config).then((r) => {
        let v = r
        for (const p of path) v = v[p]
        if (typeof v === 'function') return v(...args)
        return v
      }),
    {
      get(_, subProp) {
        if (typeof subProp === 'symbol' || subProp === 'then') return undefined
        return createDeepCall([...path, String(subProp)], config)
      },
    }
  )
}

const gatehouseReactServer = createLazyModule<GatehouseAPI>('gatehouse')

/** Creates a React Server Component facade bound to an imported blueprint. */
export function createGatehouse(config?: TowerBlueprint): GatehouseAPI {
  return new Proxy({} as GatehouseAPI, {
    get(_target, prop) {
      if (typeof prop === 'symbol' || prop === 'then') return undefined
      return createDeepCall([String(prop)], config)
    },
  }) as GatehouseAPI
}

/** Discovery-backed facade for traditional Node deployments. */
export const gatehouse: GatehouseAPI = createGatehouse()
