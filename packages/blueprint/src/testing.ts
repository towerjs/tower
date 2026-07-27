import { getModuleFactory } from './internal.js'

/** @internal Clears all registered module factories. Used only in tests. */
export function resetModuleFactories(): void {
  const factories = (getModuleFactory as unknown as { _factories?: Map<string, unknown> })._factories
  if (factories) {
    factories.clear()
  }
}
