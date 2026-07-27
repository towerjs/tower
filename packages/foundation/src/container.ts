import type { ServiceRegistry } from './types.js'

export class ServiceContainer implements ServiceRegistry {
  private instances = new Map<string, unknown>()
  private factories = new Map<string, () => unknown>()

  register<T>(name: string, instance: T): void {
    this.instances.set(name, instance)
  }

  registerFactory<T>(name: string, factory: () => T): void {
    this.factories.set(name, factory)
  }

  get<T>(name: string): T {
    if (this.instances.has(name)) return this.instances.get(name) as T

    const factory = this.factories.get(name)
    if (factory) {
      const created = factory()
      this.instances.set(name, created)
      return created as T
    }

    throw new Error(`Service "${name}" is not registered`)
  }

  has(name: string): boolean {
    return this.instances.has(name) || this.factories.has(name)
  }
}
