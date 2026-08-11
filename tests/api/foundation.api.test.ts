import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTowerApp, createTower, ServiceContainer, detectRuntime } from '@towerjs/foundation'

const OLD_ENV = process.env

beforeEach(() => {
  process.env = { ...OLD_ENV }
  delete process.env.VERCEL
  delete process.env.VERCEL_ENV
  delete process.env.AWS_LAMBDA_FUNCTION_NAME
  delete process.env.AWS_EXECUTION_ENV
  delete process.env.NETLIFY
  delete process.env.CLOUDFLARE_WORKER
})

afterEach(() => {
  process.env = OLD_ENV
})

describe('Foundation public API contract', () => {
  describe('createTowerApp', () => {
    it('returns an object with config, container, runtime, shutdown', async () => {
      const app = await createTowerApp({ modules: {} })
      expect(app).toHaveProperty('config')
      expect(app).toHaveProperty('container')
      expect(app).toHaveProperty('runtime')
      expect(app).toHaveProperty('shutdown')
      expect(typeof app.shutdown).toBe('function')
    })

    it('exposes the config that was passed in', async () => {
      const config = { modules: {} }
      const app = await createTowerApp(config)
      expect(app.config).toBe(config)
    })

    it('detects and exposes the runtime', async () => {
      const app = await createTowerApp({ modules: {} })
      expect(app.runtime).toHaveProperty('name')
      expect(app.runtime).toHaveProperty('isServerless')
      expect(app.runtime.name).toBe('node-server')
      expect(app.runtime.isServerless).toBe(false)
    })

    it('returns a ServiceContainer as container', async () => {
      const app = await createTowerApp({ modules: {} })
      expect(app.container).toBeInstanceOf(ServiceContainer)
    })

    it('throws for an unknown module when a factory function is provided', async () => {
      const factory = (_name: string) => undefined
      await expect(createTowerApp({ modules: { nonexistent: {} } }, factory)).rejects.toThrow(
        'Unknown module "nonexistent"'
      )
    })

    it('silently ignores unknown modules when no factory function is provided', async () => {
      const app = await createTowerApp({ modules: { nonexistent: {} } })
      expect(app).toHaveProperty('config')
      expect(app.container.has('nonexistent')).toBe(false)
    })

    it('runs shutdown without throwing when no modules have shutdown hooks', async () => {
      const app = await createTowerApp({ modules: {} })
      await expect(app.shutdown()).resolves.toBeUndefined()
    })
  })

  describe('createTower', () => {
    it('returns a real TowerApp augmented with module services', async () => {
      const tower = await createTower({ modules: {} })
      expect(tower).toHaveProperty('config')
      expect(tower).toHaveProperty('container')
      expect(tower).toHaveProperty('runtime')
      expect(tower).toHaveProperty('shutdown')
    })
  })

  describe('detectRuntime', () => {
    it('returns node-server by default', () => {
      expect(detectRuntime()).toEqual({ name: 'node-server', isServerless: false })
    })

    it('returns vercel-serverless when VERCEL is set without VERCEL_ENV=edge', () => {
      process.env.VERCEL = '1'
      expect(detectRuntime()).toEqual({ name: 'vercel-serverless', isServerless: true })
    })

    it('returns edge when VERCEL_ENV=edge', () => {
      process.env.VERCEL = '1'
      process.env.VERCEL_ENV = 'edge'
      expect(detectRuntime()).toEqual({ name: 'edge', isServerless: true })
    })

    it('returns edge for Cloudflare Workers', () => {
      process.env.CLOUDFLARE_WORKER = '1'
      expect(detectRuntime()).toEqual({ name: 'edge', isServerless: true })
    })

    it('returns vercel-serverless for AWS Lambda (not edge)', () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function'
      expect(detectRuntime()).toEqual({ name: 'vercel-serverless', isServerless: true })
    })

    it('returns vercel-serverless for Netlify (not edge)', () => {
      process.env.NETLIFY = '1'
      expect(detectRuntime()).toEqual({ name: 'vercel-serverless', isServerless: true })
    })

    it('gives VERCEL priority over AWS when both are set', () => {
      process.env.VERCEL = '1'
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function'
      expect(detectRuntime()).toEqual({ name: 'vercel-serverless', isServerless: true })
    })
  })

  describe('ServiceContainer', () => {
    it('registers and retrieves a service by name', () => {
      const c = new ServiceContainer()
      c.register('foo', { value: 42 })
      expect(c.get('foo')).toEqual({ value: 42 })
    })

    it('reports has() correctly', () => {
      const c = new ServiceContainer()
      expect(c.has('foo')).toBe(false)
      c.register('foo', 'bar')
      expect(c.has('foo')).toBe(true)
    })

    it('throws for an unregistered service', () => {
      const c = new ServiceContainer()
      expect(() => c.get('missing')).toThrow('Service "missing" is not registered')
    })

    it('supports lazy factories that cache their result', () => {
      const c = new ServiceContainer()
      let calls = 0
      c.registerFactory('lazy', () => ({ calls: ++calls }))
      expect(c.get('lazy')).toEqual({ calls: 1 })
      expect(c.get('lazy')).toEqual({ calls: 1 }) // cached
      expect(calls).toBe(1)
    })
  })
})
