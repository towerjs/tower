import { createRequire } from 'node:module'

export interface TowerContextProvider {
  run<T>(data: Record<string, unknown>, handler: () => Promise<T>): Promise<T>
  get<T = unknown>(key: string): T | undefined
}

function noop(): TowerContextProvider {
  return {
    run<T>(_data: Record<string, unknown>, handler: () => Promise<T>) {
      return handler()
    },
    get() {
      return undefined
    },
  }
}

function detectEdge(): boolean {
  if (typeof process === 'undefined') return true
  if (process.env?.VERCEL_ENV === 'edge') return true
  if (process.env?.CLOUDFLARE_WORKER) return true
  return false
}

const GLOBAL_KEY = '___tower_context_provider___'

let _towerContext: TowerContextProvider | undefined = (globalThis as any)[GLOBAL_KEY] as
  TowerContextProvider | undefined

if (!_towerContext) {
  if (detectEdge()) {
    _towerContext = noop()
  } else {
    try {
      const require = createRequire(import.meta.url)
      const { AsyncLocalStorage } = require('node:async_hooks') as typeof import('node:async_hooks')
      const storage = new AsyncLocalStorage<Record<string, unknown>>()
      _towerContext = {
        run<T>(data: Record<string, unknown>, handler: () => Promise<T>) {
          return storage.run(data, handler)
        },
        get<T = unknown>(key: string): T | undefined {
          return storage.getStore()?.[key] as T | undefined
        },
      }
    } catch {
      _towerContext = noop()
    }
  }
  ;(globalThis as any)[GLOBAL_KEY] = _towerContext
}

export function getTowerContext(): TowerContextProvider {
  return _towerContext!
}

export const towerContext = _towerContext!

export interface RequestContext {
  headers: Headers
}

type RequestContextResolver = () => Promise<RequestContext>

const RESOLVER_KEY = '___tower_request_context_resolver___'

export function setRequestContextResolver(resolver: RequestContextResolver): void {
  ;(globalThis as any)[RESOLVER_KEY] = resolver
}

export function getRequestContextResolver(): RequestContextResolver | null {
  return (globalThis as any)[RESOLVER_KEY] ?? null
}
