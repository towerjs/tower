import type { TowerModule } from './types.js'

export interface DependencyError {
  type: 'missing' | 'circular' | 'self-reference'
  module: string
  dependency?: string
  message: string
}

export interface DependencyValidationResult {
  valid: boolean
  order: string[]
  errors: DependencyError[]
}

export function resolveDependencyOrder(modules: TowerModule[]): DependencyValidationResult {
  const errors: DependencyError[] = []
  const nameToModule = new Map<string, TowerModule>()

  for (const mod of modules) {
    if (nameToModule.has(mod.name)) {
      errors.push({
        type: 'self-reference',
        module: mod.name,
        message: `Duplicate module name "${mod.name}". Module names must be unique.`,
      })
    }
    nameToModule.set(mod.name, mod)
  }

  if (errors.length > 0) return { valid: false, order: [], errors }

  const visited = new Set<string>()
  const inStack = new Set<string>()
  const order: string[] = []

  function visit(name: string, path: string[]): void {
    if (inStack.has(name)) {
      const cycle = [...path.slice(path.indexOf(name)), name].join(' -> ')
      errors.push({
        type: 'circular',
        module: name,
        message: `Circular dependency detected: ${cycle}`,
      })
      return
    }

    if (visited.has(name)) return

    const mod = nameToModule.get(name)
    if (!mod) {
      errors.push({
        type: 'missing',
        module: name,
        message: `Module "${name}" not found among registered modules.`,
      })
      return
    }

    visited.add(name)
    inStack.add(name)
    path.push(name)

    const deps = mod.dependsOn ?? []
    for (const dep of deps) {
      visit(dep, path)
    }

    path.pop()
    inStack.delete(name)
    order.push(name)
  }

  const moduleNames = Array.from(nameToModule.keys())
  for (const name of moduleNames) {
    visit(name, [])
  }

  if (errors.length > 0) return { valid: false, order: [], errors }

  return { valid: true, order, errors }
}
