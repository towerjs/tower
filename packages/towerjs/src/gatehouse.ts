export * from '@towerjs/gatehouse'

import { gatehouse as rawGatehouse } from '@towerjs/gatehouse'
import type { GatehouseModule, GatehouseInstance } from '@towerjs/gatehouse'
import { getTowerApp } from './runtime'

type GatehouseAPI = GatehouseModule & GatehouseInstance

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

    const value = (target as any)[prop]
    if (typeof value === 'function') {
      return (...args: any[]) => ensureReady().then(() => value(...args))
    }
    return value
  },
}) as GatehouseAPI
