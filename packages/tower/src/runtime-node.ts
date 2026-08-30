import { AsyncLocalStorage } from 'node:async_hooks'

import { setTowerContextProvider } from './foundation/context/index.js'
import { resolveConfig } from './foundation/resolve-config.js'
import { registerTowerConfigProvider } from './runtime.js'

const NODE_CONTEXT_KEY = '___tower_node_context_provider___'

/** Installs Tower's concurrency-safe Node execution context. */
export function installNodeContext(): void {
  const globals = globalThis as typeof globalThis & {
    [NODE_CONTEXT_KEY]?: AsyncLocalStorage<Record<string, unknown>>
  }
  const storage = (globals[NODE_CONTEXT_KEY] ??= new AsyncLocalStorage<Record<string, unknown>>())

  setTowerContextProvider({
    run<T>(data: Record<string, unknown>, handler: () => Promise<T>): Promise<T> {
      return storage.run(data, handler)
    },
    get<T = unknown>(key: string): T | undefined {
      return storage.getStore()?.[key] as T | undefined
    },
  })
  registerTowerConfigProvider(resolveConfig)
}
