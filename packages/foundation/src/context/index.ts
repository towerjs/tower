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

async function loadContext(): Promise<TowerContextProvider> {
  if (detectEdge()) return noop()

  try {
    const { AsyncLocalStorage } = await import('node:async_hooks')
    const storage = new AsyncLocalStorage<Record<string, unknown>>()
    return {
      run<T>(data: Record<string, unknown>, handler: () => Promise<T>) {
        return storage.run(data, handler)
      },
      get<T = unknown>(key: string): T | undefined {
        return storage.getStore()?.[key] as T | undefined
      },
    }
  } catch {
    return noop()
  }
}

export const towerContext = await loadContext()

export interface RequestContext {
  headers: Headers
}

type RequestContextResolver = () => Promise<RequestContext>

let _requestContextResolver: RequestContextResolver | null = null

export function setRequestContextResolver(resolver: RequestContextResolver): void {
  _requestContextResolver = resolver
}

export function getRequestContextResolver(): RequestContextResolver | null {
  return _requestContextResolver
}
