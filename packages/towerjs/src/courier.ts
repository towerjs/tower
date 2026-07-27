import type { CourierModule } from '@towerjs/courier'
import { getService } from '@towerjs/foundation'

function createLazyCourier(): CourierModule {
  return new Proxy({} as CourierModule, {
    get(target, prop) {
      if (prop === 'then') return undefined
      return new Proxy(
        {},
        {
          get(_, method) {
            return async (...args: unknown[]) => {
              const service = getService<CourierModule>('courier')
              if (!service) throw new Error('[courier] Not initialized. Tower must be started first.')
              const value = service[prop as keyof CourierModule]
              if (typeof value === 'function') {
                return (value as Function)(...args)
              }
              if (value && typeof (value as any)[method] === 'function') {
                return (value as any)[method](...args)
              }
              throw new Error(`[courier] ${String(prop)}.${String(method)} is not available.`)
            }
          },
        }
      )
    },
  })
}

export const courier = createLazyCourier()
