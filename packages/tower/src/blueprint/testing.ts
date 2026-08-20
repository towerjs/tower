import { resetModuleFactories as _reset } from './internal.js'

/** @internal Clears all registered module factories. Used only in tests. */
export function resetModuleFactories(): void {
  _reset()
}
