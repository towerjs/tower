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

const GLOBAL_KEY = '___tower_context_provider___'

function provider(): TowerContextProvider {
  return ((globalThis as any)[GLOBAL_KEY] as TowerContextProvider | undefined) ?? noop()
}

export function getTowerContext(): TowerContextProvider {
  return provider()
}

/** Installs the execution-context implementation for the current runtime. */
export function setTowerContextProvider(contextProvider: TowerContextProvider): void {
  ;(globalThis as any)[GLOBAL_KEY] = contextProvider
}

/**
 * Runtime-neutral context facade.
 *
 * The core intentionally has no Node imports. Node framework adapters install
 * the AsyncLocalStorage implementation from `@towerjs/tower/runtime/node`;
 * Edge code can use explicit per-request module instances.
 */
export const towerContext: TowerContextProvider = {
  run<T>(data: Record<string, unknown>, handler: () => Promise<T>): Promise<T> {
    return provider().run(data, handler)
  },
  get<T = unknown>(key: string): T | undefined {
    return provider().get<T>(key)
  },
}

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
