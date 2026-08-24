import { vault } from './index.js'
import type { Vault } from './types.js'

type CastType = 'string' | 'number' | 'boolean' | 'datetime' | 'json'
type Casts = Record<string, CastType>
type Hidden = string[]

interface ModelOptions {
  casts?: Casts
  hidden?: Hidden
}

// --- helpers for casts ---

function castFromDb(value: any, type: CastType): any {
  if (value == null) return value
  switch (type) {
    case 'datetime':
      return value instanceof Date ? value : new Date(value)
    case 'json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    case 'number':
      return typeof value === 'string' ? Number(value) : value
    case 'boolean':
      return Boolean(value)
    default:
      return value
  }
}

function castToDb(value: any, type: CastType): any {
  if (value == null) return value
  switch (type) {
    case 'datetime':
      return value instanceof Date ? value.toISOString() : value
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value)
    default:
      return value
  }
}

function applyCastsFromDb<T extends Record<string, any>>(row: T, casts: Casts): T {
  const out: any = { ...row }
  for (const [key, type] of Object.entries(casts)) {
    if (key in out) out[key] = castFromDb(out[key], type as CastType)
  }
  return out
}

function applyCastsToDb<T extends Record<string, any>>(attrs: Partial<T>, casts: Casts): Partial<T> {
  const out: any = { ...attrs }
  for (const [key, type] of Object.entries(casts)) {
    if (key in out) out[key] = castToDb(out[key], type as CastType)
  }
  return out
}

// --- relation descriptors ---

/**
 * A `belongsTo` relation: this model's table holds a foreign key column
 * pointing at the related model's table.
 */
export interface BelongsToRelation {
  type: 'belongsTo'
  relatedModel: typeof Model<any>
  /** Column on this model's table holding the related record's key. */
  foreignKey: string
  /** Column on the related model's table (defaults to its primary key). */
  references?: string
}

/**
 * A `hasMany` relation: the related model's table holds a foreign key column
 * pointing back at this model.
 */
export interface HasManyRelation {
  type: 'hasMany'
  relatedModel: typeof Model<any>
  /** Column on the related model's table holding this record's key. */
  foreignKey: string
  /** Column on this model's table (defaults to its primary key). */
  references?: string
}

export type RelationDescriptor = BelongsToRelation | HasManyRelation

export function belongsTo(
  relatedModel: typeof Model<any>,
  opts: { foreignKey: string; references?: string }
): BelongsToRelation {
  return { type: 'belongsTo', relatedModel, foreignKey: opts.foreignKey, references: opts.references }
}

export function hasMany(
  relatedModel: typeof Model<any>,
  opts: { foreignKey: string; references?: string }
): HasManyRelation {
  return { type: 'hasMany', relatedModel, foreignKey: opts.foreignKey, references: opts.references }
}

/** Symbol-keyed bag for relations hydrated via `.with()` / `related()`. */
const LOADED_RELATIONS = Symbol('towerLoadedRelations')

function setLoadedRelation(instance: Model<any>, name: string, value: unknown): void {
  const bag = (instance as any)[LOADED_RELATIONS] ?? {}
  bag[name] = value
  ;(instance as any)[LOADED_RELATIONS] = bag
}

// --- query builder ---

export class ModelQueryBuilder<T extends Record<string, any>> {
  private table: string
  private modelClass: typeof Model<T>
  private trx?: Vault
  private builder: any
  private eager: string[] = []
  private wheres: any[][] = []

  constructor(modelClass: typeof Model<T>, trx?: Vault) {
    this.modelClass = modelClass
    this.table = (modelClass as any).table
    this.trx = trx
    const db: any = trx ?? (vault as any)
    // start with selectAll; further chaining delegates
    this.builder = db.selectFrom(this.table).selectAll()
  }

  where(...args: any[]): this {
    this.builder = this.builder.where(...args)
    this.wheres.push(args)
    return this
  }

  whereIn(column: string, values: any[]): this {
    this.builder = this.builder.where(column as any, 'in', values)
    this.wheres.push([column, 'in', values])
    return this
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.builder = this.builder.orderBy(column as any, direction)
    return this
  }

  limit(n: number): this {
    this.builder = this.builder.limit(n)
    return this
  }

  offset(n: number): this {
    this.builder = this.builder.offset(n)
    return this
  }

  select(columns: (keyof T)[] | string[]): this {
    this.builder = (this.trx ?? (vault as any)).selectFrom(this.table).select(columns as any)
    return this
  }

  with(...relations: string[]): this {
    for (const name of relations) {
      if (!(this.modelClass as any).relations?.[name]) {
        throw new Error(`Unknown relation "${name}" on ${this.table}`)
      }
    }
    this.eager.push(...relations)
    return this
  }

  /**
   * Hydrates the requested relations on already-fetched instances.
   *
   * Runs exactly one additional query per relation (batched with `whereIn`),
   * never one query per row.
   */
  private async eagerLoad(instances: Array<Model<T>>): Promise<void> {
    if (instances.length === 0) return
    const ctor = this.modelClass as any
    for (const name of this.eager) {
      const relFn = ctor.relations?.[name]
      if (!relFn) throw new Error(`Unknown relation "${name}" on ${this.table}`)
      const rel: RelationDescriptor = relFn()
      const related = rel.relatedModel as any

      if (rel.type === 'belongsTo') {
        const refs = rel.references ?? related.primaryKey ?? 'id'
        const fkValues = [
          ...new Set(instances.map((i) => (i.attributes as any)[rel.foreignKey]).filter((v) => v != null)),
        ]
        const parents = fkValues.length > 0 ? await related.query(this.trx).whereIn(refs, fkValues).get() : []
        const byKey = new Map<any, Model<any>>(parents.map((p: Model<any>) => [(p.attributes as any)[refs], p]))
        for (const inst of instances) {
          setLoadedRelation(inst, name, byKey.get((inst.attributes as any)[rel.foreignKey]) ?? null)
        }
      } else {
        const localKey = rel.references ?? ctor.primaryKey ?? 'id'
        const keys = [...new Set(instances.map((i) => (i.attributes as any)[localKey]).filter((v) => v != null))]
        const children = keys.length > 0 ? await related.query(this.trx).whereIn(rel.foreignKey, keys).get() : []
        const grouped = new Map<any, Array<Model<any>>>()
        for (const child of children) {
          const key = (child.attributes as any)[rel.foreignKey]
          const group = grouped.get(key)
          if (group) group.push(child)
          else grouped.set(key, [child])
        }
        for (const inst of instances) {
          setLoadedRelation(inst, name, grouped.get((inst.attributes as any)[localKey]) ?? [])
        }
      }
    }
    this.eager = []
  }

  /**
   * Applies a named scope. Scopes are either `(q) => q.where(...)` for
   * zero-argument scopes or `(arg) => (q) => q.where(...)` when they take
   * parameters.
   */
  scope(name: string, ...args: any[]): this {
    const scopes = (this.modelClass as any).scopes ?? {}
    const fn = scopes[name]
    if (typeof fn !== 'function') throw new Error(`Unknown scope "${name}" on ${this.table}`)
    // Zero-arg scopes are `(q) => q.where(...)`; parameterized scopes are
    // `(arg) => (q) => q.where(...)`.
    const apply = args.length > 0 ? fn(...args) : fn
    if (typeof apply !== 'function') throw new Error(`Scope "${name}" did not resolve to a query function`)
    const result = apply(this)
    if (result instanceof ModelQueryBuilder) return result as unknown as this
    return this
  }

  async get(): Promise<Array<Model<T>>> {
    const rows: T[] = await this.builder.execute()
    const instances = rows.map((r) => {
      const casted = applyCastsFromDb(r as any, (this.modelClass as any).casts ?? {})
      return new (this.modelClass as any)(casted) as Model<T>
    })
    await this.eagerLoad(instances)
    return instances
  }

  async first(): Promise<Model<T> | null> {
    this.builder = this.builder.limit(1)
    const instances = await this.get()
    return instances[0] ?? null
  }

  async firstOrFail(): Promise<Model<T>> {
    const row = await this.first()
    if (!row) throw new Error(`${this.table} not found`)
    return row
  }

  async count(): Promise<number> {
    const db: any = this.trx ?? (vault as any)
    // Rebuild the query with the tracked filters so totals reflect them.
    let q = db.selectFrom(this.table)
    for (const w of this.wheres) q = q.where(...w)
    const res: any = await q.select(db.fn.countAll().as('count')).executeTakeFirst()
    return Number(res?.count ?? 0)
  }

  async find(id: any): Promise<Model<T> | null> {
    const pk = (this.modelClass as any).primaryKey ?? 'id'
    return this.where(pk as any, '=', id).first()
  }

  async findOrFail(id: any): Promise<Model<T>> {
    const found = await this.find(id)
    if (!found) throw new Error(`${this.table} ${id} not found`)
    return found
  }

  /** Finds the first record matching every attribute in `attrs`. */
  async findBy(attrs: Partial<T>): Promise<Model<T> | null> {
    const entries = Object.entries(attrs)
    if (entries.length === 0) return this.first()
    let q = this.where(entries[0][0] as any, '=', entries[0][1])
    for (const [key, value] of entries.slice(1)) {
      q = q.where(key as any, '=', value)
    }
    return q.first()
  }

  async findByOrFail(attrs: Partial<T>): Promise<Model<T>> {
    const found = await this.findBy(attrs)
    if (!found) throw new Error(`${this.table} not found matching ${JSON.stringify(attrs)}`)
    return found
  }

  /**
   * Returns one page of results plus pagination metadata. `count()` runs
   * before the limit/offset are applied so totals stay accurate.
   */
  async paginate(page = 1, perPage = 15): Promise<PaginatedResult<Model<T>>> {
    if (!Number.isInteger(page) || page < 1) throw new Error(`Page must be an integer >= 1, got ${page}`)
    if (!Number.isInteger(perPage) || perPage < 1) {
      throw new Error(`Per page must be an integer >= 1, got ${perPage}`)
    }
    const total = await this.count()
    if (total === 0) return { data: [], total: 0, page, perPage, lastPage: 1 }
    const data = await this.limit(perPage).offset((page - 1) * perPage).get()
    return { data, total, page, perPage, lastPage: Math.ceil(total / perPage) }
  }
}

export interface PaginatedResult<T> {
  data: Array<T>
  total: number
  page: number
  perPage: number
  lastPage: number
}

// --- Model base ---

export class Model<T extends Record<string, any> = Record<string, any>> {
  static table: string = ''
  static primaryKey: string = 'id'
  static casts: Casts = {}
  static hidden: Hidden = []
  static scopes: Record<string, (...args: any[]) => any> = {}
  static relations: Record<string, () => RelationDescriptor> = {}

  attributes: T
  original: T

  constructor(attrs: T) {
    // apply casts from db on construction (when coming from db)
    // assume attrs already casted by query; for direct construction keep raw
    this.attributes = { ...attrs }
    this.original = { ...attrs }
    // proxy for property access: model.name -> attributes.name
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target as any, prop, receiver)
        if (typeof prop === 'string') {
          const loaded = (target as any)[LOADED_RELATIONS]
          if (loaded && prop in loaded) return loaded[prop]
          if (prop in (target.attributes as any)) return (target.attributes as any)[prop]
        }
        return undefined
      },
      set(target, prop, value, receiver) {
        if (typeof prop === 'string' && !(prop in target)) {
          // treat unknown props as attribute writes if key exists in original or is string
          ;(target.attributes as any)[prop] = value
          return true
        }
        return Reflect.set(target as any, prop, value, receiver)
      },
    })
  }

  // --- static helpers ---

  static getTable(): string {
    return (this as any).table
  }

  static query<T extends Record<string, any>>(this: typeof Model<T>, trx?: Vault): ModelQueryBuilder<T> {
    return new ModelQueryBuilder<T>(this as any, trx)
  }

  static where<T extends Record<string, any>>(this: typeof Model<T>, ...args: any[]): ModelQueryBuilder<T> {
    return (this as any).query().where(...args)
  }

  static scope<T extends Record<string, any>>(
    this: typeof Model<T>,
    name: string,
    ...args: any[]
  ): ModelQueryBuilder<T> {
    return (this as any).query().scope(name, ...args)
  }

  static with<T extends Record<string, any>>(this: typeof Model<T>, ...relations: string[]): ModelQueryBuilder<T> {
    return (this as any).query().with(...relations)
  }

  static async create<T extends Record<string, any>>(
    this: typeof Model<T>,
    attrs: Partial<T>,
    opts?: { trx?: Vault }
  ): Promise<Model<T>> {
    const table = (this as any).table
    const casts = (this as any).casts ?? {}
    const db: any = opts?.trx ?? (vault as any)
    const toInsert = applyCastsToDb(attrs as any, casts)
    const row: T = await db.insertInto(table).values(toInsert).returningAll().executeTakeFirstOrThrow()
    const casted = applyCastsFromDb(row as any, casts)
    return new (this as any)(casted) as Model<T>
  }

  static async find<T extends Record<string, any>>(
    this: typeof Model<T>,
    id: any,
    opts?: { trx?: Vault }
  ): Promise<Model<T> | null> {
    return (this as any).query(opts?.trx).find(id)
  }

  static async findOrFail<T extends Record<string, any>>(
    this: typeof Model<T>,
    id: any,
    opts?: { trx?: Vault }
  ): Promise<Model<T>> {
    return (this as any).query(opts?.trx).findOrFail(id)
  }

  /** Finds the first record matching every attribute in `attrs`. */
  static async findBy<T extends Record<string, any>>(
    this: typeof Model<T>,
    attrs: Partial<T>,
    opts?: { trx?: Vault }
  ): Promise<Model<T> | null> {
    return (this as any).query(opts?.trx).findBy(attrs)
  }

  static async findByOrFail<T extends Record<string, any>>(
    this: typeof Model<T>,
    attrs: Partial<T>,
    opts?: { trx?: Vault }
  ): Promise<Model<T>> {
    return (this as any).query(opts?.trx).findByOrFail(attrs)
  }

  static paginate<T extends Record<string, any>>(
    this: typeof Model<T>,
    page = 1,
    perPage = 15
  ): Promise<PaginatedResult<Model<T>>> {
    return (this as any).query().paginate(page, perPage)
  }

  static async all<T extends Record<string, any>>(
    this: typeof Model<T>,
    opts?: { trx?: Vault }
  ): Promise<Array<Model<T>>> {
    return (this as any).query(opts?.trx).get()
  }

  static async destroy<T extends Record<string, any>>(
    this: typeof Model<T>,
    id: any,
    opts?: { trx?: Vault }
  ): Promise<void> {
    const table = (this as any).table
    const pk = (this as any).primaryKey ?? 'id'
    const db: any = opts?.trx ?? (vault as any)
    await db
      .deleteFrom(table)
      .where(pk as any, '=', id)
      .execute()
  }

  static async transaction<T>(fn: (trx: Vault) => Promise<T>): Promise<T> {
    const db: any = vault as any
    return db.transaction(async (trx: Vault) => fn(trx))
  }

  // --- instance helpers ---

  get<K extends keyof T>(key: K): T[K] {
    return this.attributes[key]
  }

  set(attrs: Partial<T>): void {
    Object.assign(this.attributes, attrs)
  }

  async save(opts?: { trx?: Vault }): Promise<void> {
    const ctor: any = (this as any).constructor
    const table = ctor.table
    const pk = ctor.primaryKey ?? 'id'
    const casts = ctor.casts ?? {}
    const id = (this.attributes as any)[pk]
    if (!id) throw new Error(`Cannot save model without primary key ${pk}`)
    // compute dirty
    const changes: Partial<T> = {}
    for (const k of Object.keys(this.attributes) as (keyof T)[]) {
      if ((this.attributes as any)[k] !== (this.original as any)[k]) (changes as any)[k] = (this.attributes as any)[k]
    }
    if (Object.keys(changes).length === 0) return
    const toUpdate = applyCastsToDb(changes as any, casts)
    const db: any = opts?.trx ?? (vault as any)
    await db
      .updateTable(table)
      .set(toUpdate)
      .where(pk as any, '=', id)
      .execute()
    this.original = { ...this.attributes }
  }

  async update(attrs: Partial<T>, opts?: { trx?: Vault }): Promise<void> {
    this.set(attrs)
    await this.save(opts)
  }

  async delete(opts?: { trx?: Vault }): Promise<void> {
    const ctor: any = (this as any).constructor
    const table = ctor.table
    const pk = ctor.primaryKey ?? 'id'
    const id = (this.attributes as any)[pk]
    const db: any = opts?.trx ?? (vault as any)
    await db
      .deleteFrom(table)
      .where(pk as any, '=', id)
      .execute()
  }

  async refresh(opts?: { trx?: Vault }): Promise<void> {
    const ctor: any = (this as any).constructor
    const pk = ctor.primaryKey ?? 'id'
    const id = (this.attributes as any)[pk]
    const fresh = await (ctor as any).find(id, opts)
    if (!fresh) throw new Error(`${ctor.table} ${id} not found on refresh`)
    this.attributes = { ...fresh.attributes }
    this.original = { ...fresh.attributes }
  }

  /**
   * Lazily loads a single relation declared in `static relations`.
   * Prefer `.with(name)` when loading for many instances — it batches.
   */
  async related<R extends Record<string, any> = any>(name: string): Promise<Model<R> | Array<Model<R>> | null> {
    const ctor: any = (this as any).constructor
    const relFn = ctor.relations?.[name]
    if (!relFn) throw new Error(`Unknown relation "${name}" on ${ctor.table}`)
    const rel: RelationDescriptor = relFn()
    const related = rel.relatedModel as any

    if (rel.type === 'belongsTo') {
      const refs = rel.references ?? related.primaryKey ?? 'id'
      const fkVal = (this.attributes as any)[rel.foreignKey]
      if (fkVal == null) {
        setLoadedRelation(this as any, name, null)
        return null
      }
      const parent =
        refs === (related.primaryKey ?? 'id')
          ? await related.find(fkVal)
          : await related.where(refs as any, '=', fkVal).first()
      setLoadedRelation(this as any, name, parent)
      return parent
    }

    // hasMany
    const localKey = rel.references ?? ctor.primaryKey ?? 'id'
    const id = (this.attributes as any)[localKey]
    if (id == null) {
      setLoadedRelation(this as any, name, [])
      return []
    }
    const children = await related.where(rel.foreignKey as any, '=', id).get()
    setLoadedRelation(this as any, name, children)
    return children
  }

  toJSON(): Record<string, any> {
    const ctor: any = (this as any).constructor
    const hidden: string[] = ctor.hidden ?? []
    const casts: Casts = ctor.casts ?? {}
    const out: any = {}
    for (const [k, v] of Object.entries(this.attributes as any)) {
      if (hidden.includes(k)) continue
      out[k] = v
      // casts already applied on attributes; keep as is
      // ensure datetime is serialized as ISO if Date
      if (casts[k] === 'datetime' && v instanceof Date) out[k] = v.toISOString()
    }
    return out
  }

  toArray(): Record<string, any> {
    return this.toJSON()
  }
}

export function defineModel<T extends Record<string, any>>(
  table: string,
  opts: ModelOptions & {
    primaryKey?: string
    scopes?: Record<string, any>
    relations?: Record<string, () => RelationDescriptor>
  } = {}
): typeof Model<T> {
  class Defined extends Model<T> {
    static table = table
    static primaryKey = opts.primaryKey ?? 'id'
    static casts = (opts.casts ?? {}) as Casts
    static hidden = (opts.hidden ?? []) as Hidden
    static scopes = (opts.scopes ?? {}) as any
    static relations = (opts.relations ?? {}) as any
  }
  return Defined as any
}
