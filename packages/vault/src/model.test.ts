import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fakeVault, store } = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = new Map<string, Map<string, Row>>()
  function getTableStore(table: string): Map<string, Row> {
    if (!store.has(table)) store.set(table, new Map())
    return store.get(table)!
  }
  function makeKyselyFake() {
    let table = ''
    let whereClauses: Array<(row: Row) => boolean> = []
    let orderByCol: string | null = null
    let orderDir: 'asc' | 'desc' = 'asc'
    let limitVal: number | null = null
    let selectCols: string[] | null = null

    const builder: any = {
      where(...args: any[]) {
        const [col, op, val] = args
        if (op === '=') whereClauses.push((r) => r[col] === val)
        else if (op === 'in') whereClauses.push((r) => (val as any[]).includes(r[col]))
        else whereClauses.push(() => true)
        return builder
      },
      orderBy(col: string, dir: 'asc' | 'desc' = 'asc') {
        orderByCol = col
        orderDir = dir
        return builder
      },
      limit(n: number) {
        limitVal = n
        return builder
      },
      offset(_n: number) {
        return builder
      },
      select(cols: string[]) {
        selectCols = cols
        return builder
      },
      selectAll() {
        return builder
      },
      async execute() {
        const t = getTableStore(table)
        let rows = Array.from(t.values()).filter((r) => whereClauses.every((fn) => fn(r)))
        if (orderByCol) {
          rows = [...rows].sort((a, b) => {
            const av = a[orderByCol!]
            const bv = b[orderByCol!]
            if (av < bv) return orderDir === 'asc' ? -1 : 1
            if (av > bv) return orderDir === 'asc' ? 1 : -1
            return 0
          })
        }
        if (limitVal != null) rows = rows.slice(0, limitVal)
        if (selectCols)
          rows = rows.map((r) => {
            const o: any = {}
            for (const c of selectCols!) o[c] = r[c]
            return o
          })
        whereClauses = []
        orderByCol = null
        limitVal = null
        selectCols = null
        return rows
      },
      async executeTakeFirst() {
        const rows = await builder.execute()
        return rows[0] ?? undefined
      },
      async executeTakeFirstOrThrow() {
        const row = await builder.executeTakeFirst()
        if (!row) throw new Error('not found')
        return row
      },
    }

    const fakeVault: any = {
      selectFrom(t: string) {
        table = t
        whereClauses = []
        orderByCol = null
        limitVal = null
        selectCols = null
        return {
          selectAll() {
            return builder
          },
          select(cols: any) {
            selectCols = cols
            return builder
          },
        }
      },
      insertInto(t: string) {
        table = t
        return {
          values(vals: any) {
            return {
              returningAll() {
                return {
                  async executeTakeFirstOrThrow() {
                    const s = getTableStore(t)
                    const id = vals.id ?? `id-${s.size + 1}`
                    const row = { id, ...vals }
                    s.set(id, row)
                    return row
                  },
                }
              },
              async execute() {
                const s = getTableStore(t)
                const id = vals.id ?? `id-${s.size + 1}`
                const row = { id, ...vals }
                s.set(id, row)
                return row
              },
            }
          },
        }
      },
      updateTable(t: string) {
        table = t
        let setVals: any = {}
        let whereFn: (r: Row) => boolean = () => true
        return {
          set(vals: any) {
            setVals = vals
            return this
          },
          where(col: string, op: string, val: any) {
            if (op === '=') whereFn = (r) => r[col] === val
            return this
          },
          async execute() {
            const s = getTableStore(t)
            for (const [id, row] of s.entries()) if (whereFn(row)) s.set(id, { ...row, ...setVals })
          },
        }
      },
      deleteFrom(t: string) {
        let whereFn: (r: Row) => boolean = () => true
        return {
          where(col: string, op: string, val: any) {
            if (op === '=') whereFn = (r) => r[col] === val
            return this
          },
          async execute() {
            const s = getTableStore(t)
            for (const [id, row] of Array.from(s.entries())) if (whereFn(row)) s.delete(id)
          },
        }
      },
      fn: {
        countAll() {
          return {
            as(_alias: string) {
              return {}
            },
          }
        },
      },
      transaction: (fn: (trx: any) => Promise<any>) => fn(fakeVault),
    }
    return fakeVault
  }
  return { fakeVault: makeKyselyFake(), store }
})

vi.mock('./index.js', () => ({
  vault: fakeVault,
}))

const { Model, defineModel, belongsTo, hasMany } = await import('./model.js')

beforeEach(() => {
  store.clear()
})

type ProjectRow = {
  id: string
  name: string
  description: string | null
  owner_id: string | null
  created_at: string
}

class Project extends Model<ProjectRow> {
  static table = 'projects'
  static casts = { created_at: 'datetime' } as const
  static hidden = ['owner_id'] as const
}

type UserRow = { id: string; name: string }
class User extends Model<UserRow> {
  static table = 'users'
}

class Post extends Model<{ id: string; title: string; user_id: string }> {
  static table = 'posts'
  static relations = {
    author: () => belongsTo(User, { foreignKey: 'user_id' }),
  } as const
}

class Task extends Model<{ id: string; title: string; project_id: string }> {
  static table = 'tasks'
  static relations = {
    project: () => belongsTo(Project, { foreignKey: 'project_id' }),
  } as const
}

Project.relations = {
  tasks: () => hasMany(Task, { foreignKey: 'project_id' }),
} as const

describe('Model — typed fields & CRUD', () => {
  it('creates and finds', async () => {
    const p = await Project.create({
      name: 'Acme',
      description: 'test',
      owner_id: 'u1',
      created_at: new Date().toISOString(),
    } as any)
    expect(p.get('name')).toBe('Acme')
    expect(p.attributes.name).toBe('Acme')

    const found = await Project.find(p.get('id'))
    expect(found?.get('name')).toBe('Acme')

    const fail = await Project.find('nope')
    expect(fail).toBeNull()

    await expect(Project.findOrFail('nope')).rejects.toThrow()
  })

  it('updates and deletes', async () => {
    const p = await Project.create({
      name: 'A',
      description: null,
      owner_id: null,
      created_at: new Date().toISOString(),
    } as any)
    await p.update({ name: 'B' })
    expect(p.get('name')).toBe('B')
    const refreshed = await Project.find(p.get('id'))
    expect(refreshed?.get('name')).toBe('B')

    await p.delete()
    expect(await Project.find(p.get('id'))).toBeNull()
  })

  it('all and where query', async () => {
    await Project.create({ name: 'A', description: null, owner_id: null, created_at: new Date().toISOString() } as any)
    await Project.create({ name: 'B', description: null, owner_id: null, created_at: new Date().toISOString() } as any)
    const all = await Project.all()
    expect(all).toHaveLength(2)
    const filtered = await Project.where('name', '=', 'A').get()
    expect(filtered).toHaveLength(1)
    expect(filtered[0].get('name')).toBe('A')
  })

  it('casts datetime and hides fields in toJSON', async () => {
    const now = new Date()
    const p = await Project.create({
      name: 'C',
      description: null,
      owner_id: 'secret',
      created_at: now.toISOString(),
    } as any)
    const found = await Project.find(p.get('id'))
    expect(found?.get('created_at')).toBeInstanceOf(Date)
    const json: any = found?.toJSON()
    expect(json.created_at).toBeDefined()
    expect(json.owner_id).toBeUndefined()
    expect(json.name).toBe('C')
  })

  it('supports defineModel helper', async () => {
    type TaskRow = { id: string; title: string }
    const Task = defineModel<TaskRow>('tasks')
    const t = await Task.create({ title: 'hello' } as any)
    expect(t.get('title')).toBe('hello')
    const found = await Task.find(t.get('id'))
    expect(found?.get('title')).toBe('hello')
  })

  it('supports transaction', async () => {
    await Project.transaction(async (trx) => {
      await Project.create(
        { name: 'Tx', description: null, owner_id: null, created_at: new Date().toISOString() } as any,
        { trx }
      )
    })
    expect(await Project.all()).toHaveLength(1)
  })

  it('lazily loads a belongsTo relation', async () => {
    type UserRow = { id: string; name: string }
    class User extends Model<UserRow> {
      static table = 'users'
    }
    class TaskWithRel extends Model<{ id: string; title: string; owner_id: string }> {
      static table = 'tasks_rel'
      static relations = {
        owner: () => belongsTo(User as any, { foreignKey: 'owner_id' }),
      } as const
    }

    const u = await User.create({ name: 'Alice' } as any)
    const t = await TaskWithRel.create({ title: 'T', owner_id: u.get('id') } as any)
    const owner: any = await t.related('owner')
    expect(owner.get('name')).toBe('Alice')
    // loaded relation is cached on the instance
    expect((t as any).owner.get('name')).toBe('Alice')
  })

  it('returns null/empty for missing relation keys', async () => {
    class Orphan extends Model<{ id: string; owner_id: string | null }> {
      static table = 'orphans'
      static relations = {
        owner: () => belongsTo(User, { foreignKey: 'owner_id' }),
        pets: () => hasMany(Pet, { foreignKey: 'orphan_id' }),
      } as const
    }
    class Pet extends Model<{ id: string; orphan_id: string }> {
      static table = 'pets'
    }

    const o = await Orphan.create({ id: 'o1', owner_id: null } as any)
    expect(await o.related('owner')).toBeNull()
    expect(await o.related('pets')).toEqual([])
  })

  it('eager loads belongsTo with a single batched query', async () => {
    const u1 = await User.create({ name: 'A' } as any)
    const u2 = await User.create({ name: 'B' } as any)
    await Post.create({ title: 'p1', user_id: u1.get('id') } as any)
    await Post.create({ title: 'p2', user_id: u2.get('id') } as any)
    await Post.create({ title: 'p3', user_id: u2.get('id') } as any)

    const posts = await Post.query().with('author').orderBy('title').get()

    expect((posts[0] as any).author.get('name')).toBe('A')
    expect((posts[1] as any).author.get('name')).toBe('B')
    expect((posts[2] as any).author.get('name')).toBe('B')
  })

  it('eager loads hasMany grouped by parent key', async () => {
    const p1 = await Project.create({ name: 'P1', description: null, owner_id: null, created_at: '' } as any)
    const p2 = await Project.create({ name: 'P2', description: null, owner_id: null, created_at: '' } as any)
    await Task.create({ title: 't1', project_id: p1.get('id') } as any)
    await Task.create({ title: 't2', project_id: p1.get('id') } as any)
    await Task.create({ title: 't3', project_id: p2.get('id') } as any)

    const projects = await Project.query().with('tasks').orderBy('name').get()
    expect(projects).toHaveLength(2)
    expect((projects[0] as any).tasks.map((t: any) => t.get('title'))).toEqual(['t1', 't2'])
    expect((projects[1] as any).tasks.map((t: any) => t.get('title'))).toEqual(['t3'])

    const one = await Project.query().with('tasks').findOrFail(p1.get('id'))
    expect((one as any).tasks).toHaveLength(2)
  })

  it('eager loads with empty results without querying', async () => {
    const posts = await Post.query().with('author').get()
    expect(posts).toEqual([])
  })

  it('throws for an unknown relation in with()', () => {
    expect(() => Project.query().with('nonexistent')).toThrow('Unknown relation "nonexistent"')
  })

  it('supports custom references keys on relations', async () => {
    class Account extends Model<{ id: string; handle: string }> {
      static table = 'accounts'
      static primaryKey = 'handle'
    }
    class Session extends Model<{ id: string; account_handle: string }> {
      static table = 'sessions'
      static relations = {
        account: () => belongsTo(Account, { foreignKey: 'account_handle', references: 'handle' }),
      } as const
    }

    await Account.create({ id: 'a1', handle: '@jasper' } as any)
    const s = await Session.create({ id: 's1', account_handle: '@jasper' } as any)

    const loaded = await Session.query().with('account').findOrFail('s1')
    expect((loaded as any).account.get('id')).toBe('a1')

    const lazy: any = await s.related('account')
    expect(lazy.get('handle')).toBe('@jasper')
  })
})
