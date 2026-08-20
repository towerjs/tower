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

let _towerContext: TowerContextProvider | undefined

async function loadContext(): Promise<TowerContextProvider> {
  if (detectEdge()) return noop()

  const GLOBAL_KEY = '___tower_context_provider___'
  const existing = (globalThis as any)[GLOBAL_KEY]
  if (existing) return existing

  try {
    const { AsyncLocalStorage } = await import('node:async_hooks')
    const storage = new AsyncLocalStorage<Record<string, unknown>>()
    const provider = {
      run<T>(data: Record<string, unknown>, handler: () => Promise<T>) {
        return storage.run(data, handler)
      },
      get<T = unknown>(key: string): T | undefined {
        return storage.getStore()?.[key] as T | undefined
      },
    }
    ;(globalThis as any)[GLOBAL_KEY] = provider
    return provider
  } catch {
    return noop()
  }
}

/**
 * Lazily-initialized tower context provider.
 * Avoids top-level await for CJS/SSR compatibility.
 */
export function getTowerContext(): TowerContextProvider {
  if (!_towerContext) {
    // This is called synchronously, so we need to handle the async case
    // by returning a noop immediately and initializing async
    loadContext().then((ctx) => { _towerContext = ctx })
    return noop()
  }
  return _towerContext
}

export const towerContext = new Proxy({} as TowerContextProvider, {
  get(_, prop) {
    const ctx = getTowerContext()
    return (ctx as any)[prop]
  },
}) as TowerContextProvider

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