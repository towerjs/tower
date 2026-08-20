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
    if (!promise) {
      promise = getTowerApp().then((app) => {
        resolved = app.container.get(moduleName)
        return resolved
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
      if (prop === Symbol.toPrimitive) return undefined
      // Don't throw on uninitialized - return a promise that resolves when ready
      if (resolved === undefined) {
        // Return a thenable that resolves when the service is ready
        return new Proxy(() => {}, {
          get(_, p) {
            if (p === 'then') {
              return (onFulfilled: ((v: any) => any) | undefined) =>
                get().then(onFulfilled)
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