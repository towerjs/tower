import { getTowerApp } from './runtime'

export function createLazyModule<T>(moduleName: string): T {
  function getModule(path: string[]) {
    return getTowerApp().then((app) => {
      let current: any = app.container.get(`module.${moduleName}`)
      for (const key of path) current = current?.[key]
      return current
    })
  }

  function proxy(path: string[] = []): any {
    return new Proxy(function () {} as any, {
      get(_, prop) {
        if (prop === Symbol.toPrimitive) return undefined
        if (prop === 'then') {
          return (resolve: (v: any) => void) => getModule(path).then(resolve)
        }
        return proxy([...path, prop as string])
      },
      apply(_, thisArg, args) {
        return getModule(path).then((value) => {
          if (typeof value !== 'function') {
            throw new TypeError(`${moduleName}.${path.join('.')} is not a function`)
          }
          return value(...args)
        })
      },
    })
  }

  return proxy() as T
}
