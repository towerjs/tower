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

const { Model, defineModel, belongsTo } = await import('./model.js')

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

  it('stubs relations and with', async () => {
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

    // with() is stub — should not throw
    const projects = await Project.query().with('tasks').get()
    expect(Array.isArray(projects)).toBe(true)
  })
})
