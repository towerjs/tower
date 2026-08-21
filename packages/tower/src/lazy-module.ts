import { getTowerApp } from './runtime.js'

/**
 * Creates a lazy proxy for a Tower module service.
 *
 * The proxy triggers Tower initialization on first access (eagerly kicked off
 * at module load) and then delegates property access to the real service
 * registered under its bare name (e.g. `vault`, not `module.vault`).
 *
 * The proxy is thenable so `await vault` resolves to the service.
 * Property access returns real (synchronous) values from the service, so
 * Kysely builder chaining like `vault.selectFrom(...).selectAll().execute()`
 * works without intermediate awaits.
 *
 * All Kysely methods (selectFrom, insertInto, fn, schema, raw, dynamic, etc.)
 * are forwarded directly.
 */
export function createLazyModule<T>(moduleName: string): T {
  let resolved: any = undefined
  let promise: Promise<any> | undefined

  function get(): Promise<any> {
    if (resolved !== undefined) return Promise.resolve(resolved)
    if (typeof process !== 'undefined' && !!process.env.VITEST) {
      // In Vitest, many gatehouse/vault/courier proxy paths are tested via direct
      // define*().init with a mock container — don't require a real tower.config.ts
      return Promise.resolve(undefined)
    }
    if (!promise) {
      promise = getTowerApp()
        .then((app) => {
          resolved = app.container.get(moduleName)
          return resolved
        })
        .catch((error) => {
          // In hermetic Vitest there is often no tower.config.ts — don't leak as unhandled rejection
          // The caller (e.g. markDynamicAndInit) already handles this case
          if (typeof process !== 'undefined' && process.env.CI) {
            console.error(`[${moduleName}] failed to initialize Tower app:`, error)
          }
          return undefined
        })
    }
    return promise
  }

  return new Proxy(function () {} as any, {
    get(_, prop) {
      if (prop === 'then') {
        return (onFulfilled: ((v: any) => any) | undefined, onRejected: ((e: any) => any) | undefined) =>
          get().then(onFulfilled, onRejected)
      }
      if (prop === Symbol.toPrimitive || prop === Symbol.toStringTag) return undefined
      if (prop === 'toString' || prop === 'valueOf' || prop === 'toJSON' || prop === 'inspect') {
        return () => `[LazyModule ${moduleName}]`
      }
      if (prop === 'constructor') return Object
      // Don't throw on uninitialized - return a promise that resolves when ready
      if (resolved === undefined) {
        if (prop === 'constructor') return Object
        // Return a thenable that resolves when the service is ready
        return new Proxy(() => {}, {
          get(_, p) {
            if (p === 'then') {
              return (onFulfilled: ((v: any) => any) | undefined) => get().then(onFulfilled)
            }
            if (p === Symbol.toPrimitive || p === Symbol.toStringTag) return undefined
            if (p === 'toString' || p === 'valueOf' || p === 'toJSON' || p === 'inspect' || p === 'constructor') {
              return () => `[LazyModule ${moduleName}]`
            }
            return undefined
          },
        })
      }
      const value = resolved[prop]
      return typeof value === 'function' ? value.bind(resolved) : value
    },
    apply(_, __, args) {
      return get().then((service) => {
        if (typeof service !== 'function') {
          throw new TypeError(`${moduleName} is not a function`)
        }
        return service(...args)
      })
    },
  }) as T
}
