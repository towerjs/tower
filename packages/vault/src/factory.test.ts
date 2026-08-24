import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fakeVault, store } = vi.hoisted(() => {
  type Row = Record<string, any>
  const store = new Map<string, Map<string, Row>>()
  function getTableStore(table: string): Map<string, Row> {
    if (!store.has(table)) store.set(table, new Map())
    return store.get(table)!
  }
  const fakeVault: any = {
    insertInto(t: string) {
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
          }
        },
      }
    },
  }
  return { fakeVault, store }
})

vi.mock('./index.js', () => ({
  vault: fakeVault,
}))

const { Model } = await import('./model.js')
const { defineFactory } = await import('./factory.js')

beforeEach(() => {
  store.clear()
})

class Project extends Model<{ id: string; name: string; description: string | null }> {
  static table = 'projects'
}

describe('defineFactory', () => {
  it('creates persisted instances with defaults and overrides', async () => {
    const ProjectFactory = defineFactory(Project, ({ seq }) => ({
      name: `Project ${seq}`,
      description: null,
    }))

    const p1 = await ProjectFactory.create()
    expect(p1.get('name')).toBe('Project 1')
    expect(store.get('projects')!.size).toBe(1)

    const p2 = await ProjectFactory.create({ name: 'Override' })
    expect(p2.get('name')).toBe('Override')
    expect(p2).toBeInstanceOf(Project)
  })

  it('createMany inserts the requested count in order', async () => {
    const ProjectFactory = defineFactory(Project, ({ seq }) => ({ name: `P${seq}`, description: null }))
    const items = await ProjectFactory.createMany(3)
    expect(items.map((p) => p.get('name'))).toEqual(['P1', 'P2', 'P3'])
    expect(await Promise.resolve(store.get('projects')!.size)).toBe(3)
  })

  it('make builds an instance without persisting it', async () => {
    const ProjectFactory = defineFactory(Project, ({ seq }) => ({ name: `P${seq}`, description: null }))
    const p = ProjectFactory.make()
    expect(p.get('name')).toBe('P1')
    expect(p).toBeInstanceOf(Project)
    expect(store.has('projects') ? store.get('projects')!.size : 0).toBe(0)
  })

  it('states preset attributes and stay usable as factories', async () => {
    const ProjectFactory = defineFactory(Project, ({ seq }) => ({
      name: `Project ${seq}`,
      description: 'fresh',
    })).states({
      archived: { description: '[archived]' },
      blank: { description: null },
    })

    const archived = await ProjectFactory.archived.create()
    expect(archived.get('description')).toBe('[archived]')
    expect(archived.get('name')).toBe('Project 1')

    // states compose with per-call overrides
    const named = await ProjectFactory.archived.create({ name: 'Custom' })
    expect(named.get('name')).toBe('Custom')
    expect(named.get('description')).toBe('[archived]')

    expect(ProjectFactory.blank.make().get('description')).toBeNull()

    // base factory keeps its original defaults
    const base = await ProjectFactory.create()
    expect(base.get('description')).toBe('fresh')
  })
})
