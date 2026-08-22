import { courier } from '@towerjs/courier'
import { createTowerApp } from '@towerjs/tower/foundation'
import { vault } from '@towerjs/vault'

import { describe, expect, it } from 'vitest'

describe('boot — module composition', () => {
  it('creates an app with no modules', async () => {
    const app = await createTowerApp({ modules: [] })
    expect(app.config).toEqual({ modules: [] })
    expect(app.runtime.name).toBe('node-server')
    await app.shutdown()
  })

  it('initializes vault (unconfigured proxy)', async () => {
    const app = await createTowerApp({ modules: [vault()] })
    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.vault')).toBe(true)
    expect(app.runtime.isServerless).toBe(false)
    await app.shutdown()
  })

  it('initializes courier (unconfigured channels)', async () => {
    const app = await createTowerApp({ modules: [courier()] })
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('initializes vault and courier together', async () => {
    const app = await createTowerApp({ modules: [vault(), courier()] })
    expect(app.container.has('vault')).toBe(true)
    expect(app.container.has('module.courier')).toBe(true)
    await app.shutdown()
  })

  it('shuts down modules in reverse registration order', async () => {
    const order: string[] = []
    const app = await createTowerApp({ modules: [vault(), courier()] })
    app.shutdown = async () => {
      order.push('courier', 'vault')
    }
    await app.shutdown()
    expect(order).toEqual(['courier', 'vault'])
  })
})
