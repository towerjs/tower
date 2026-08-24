import type { Model } from './model.js'
import type { Vault } from './types.js'

/**
 * Factories are downstream of the Model layer (`Factory → Model → Vault`).
 * They build valid rows through `Model.create`, so they honor casts and go
 * through the same provider boundary.
 */

/** Helpers handed to a factory definition. */
export interface FactoryHelpers {
  /** Monotonic counter starting at 1, scoped to this factory. */
  seq: number
}

export type FactoryDefinition<T extends Record<string, any>> = (helpers: FactoryHelpers) => Partial<T>

export interface CreateOptions {
  trx?: Vault
}

export interface FactoryState<T extends Record<string, any>> {
  /** Builds an instance without persisting it. */
  make(overrides?: Partial<T>): Model<T>
  /** Inserts through `Model.create` and returns the persisted instance. */
  create(overrides?: Partial<T>, opts?: CreateOptions): Promise<Model<T>>
  /** Inserts `count` instances and returns them in order. */
  createMany(count: number, overrides?: Partial<T>, opts?: CreateOptions): Promise<Array<Model<T>>>
}

export interface ModelFactory<T extends Record<string, any>> extends FactoryState<T> {
  /**
   * Returns a variant of this factory with preset attributes. Each state is
   * itself usable as `factory.create()` / `factory.make()` / etc.
   */
  states<S extends Record<string, Partial<T>>>(states: S): ModelFactory<T> & { [K in keyof S]: FactoryState<T> }
}

function createState<T extends Record<string, any>>(
  modelClass: typeof Model<T>,
  definition: FactoryDefinition<T>,
  base: Partial<T>,
  counter: { value: number }
): FactoryState<T> {
  function resolve(overrides?: Partial<T>): Partial<T> {
    counter.value += 1
    // State/base presets win over the definition's defaults; per-call
    // overrides win over both.
    return { ...definition({ seq: counter.value }), ...base, ...overrides }
  }

  return {
    make(overrides?: Partial<T>): Model<T> {
      return new (modelClass as any)(resolve(overrides)) as Model<T>
    },

    async create(overrides?: Partial<T>, opts?: CreateOptions): Promise<Model<T>> {
      return (modelClass as any).create(resolve(overrides), opts)
    },

    async createMany(count: number, overrides?: Partial<T>, opts?: CreateOptions): Promise<Array<Model<T>>> {
      const out: Array<Model<T>> = []
      for (let i = 0; i < count; i++) {
        out.push(await (modelClass as any).create(resolve(overrides), opts))
      }
      return out
    },
  }
}

/**
 * Defines a factory for a model. The definition receives helpers and returns
 * the default attributes; call sites can override any attribute per use.
 *
 * @example
 * ```ts
 * export const ProjectFactory = defineFactory(Project, ({ seq }) => ({
 *   name: `Project ${seq}`,
 * }))
 *
 * await ProjectFactory.create()
 * await ProjectFactory.create({ name: 'Override' })
 * await ProjectFactory.createMany(5)
 * ProjectFactory.make() // not persisted
 * ```
 */
export function defineFactory<T extends Record<string, any>>(
  modelClass: typeof Model<T>,
  definition: FactoryDefinition<T>
): ModelFactory<T> {
  const counter = { value: 0 }

  const state = createState(modelClass, definition, {}, counter)

  const factory: ModelFactory<T> = {
    make: state.make,
    create: state.create,
    createMany: state.createMany,

    states<S extends Record<string, Partial<T>>>(statesMap: S): ModelFactory<T> & { [K in keyof S]: FactoryState<T> } {
      const variants: Record<string, FactoryState<T>> = {}
      for (const [name, attrs] of Object.entries(statesMap)) {
        variants[name] = createState(modelClass, definition, { ...attrs }, counter)
      }
      return Object.assign(Object.create(Object.getPrototypeOf(factory)), factory, variants) as ModelFactory<T> &
        { [K in keyof S]: FactoryState<T> }
    },
  }

  return factory
}
