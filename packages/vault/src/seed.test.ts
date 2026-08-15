import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runSeeds } from './seed.js'

const mocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  seedCallback: vi.fn(),
  seedOrder: [] as string[],
}))

vi.mock('node:fs', () => ({
  existsSync: mocks.mockExistsSync,
  promises: {
    readdir: mocks.mockReaddir,
    readFile: mocks.mockReadFile,
    writeFile: mocks.mockWriteFile,
  },
}))

vi.mock('node:path', () => ({
  resolve: vi.fn((...args: string[]) => `/resolved/${args.filter(Boolean).pop() ?? 'unknown'}`),
  join: vi.fn((...parts: string[]) => parts.join('/')),
  default: {
    resolve: vi.fn((...args: string[]) => `/resolved/${args.filter(Boolean).pop() ?? 'unknown'}`),
    join: vi.fn((...parts: string[]) => parts.join('/')),
  },
}))

vi.mock('/resolved/seeds/users.ts', () => ({
  default: mocks.seedCallback,
}))

vi.mock('/resolved/seeds/001_first.ts', () => ({
  default: vi.fn().mockImplementation(async () => {
    mocks.seedOrder.push('001_first')
  }),
}))

vi.mock('/resolved/seeds/002_second.ts', () => ({
  default: vi.fn().mockImplementation(async () => {
    mocks.seedOrder.push('002_second')
  }),
}))

vi.mock('/resolved/seeds/empty.ts', () => ({ default: 'notafunction' }))

vi.mock('/resolved/seeds/crash.ts', () => ({
  default: vi.fn().mockRejectedValue(new Error('seed error')),
}))

describe('runSeeds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.seedOrder.length = 0
    // Manifest file does not exist by default (fresh seed folder).
    mocks.mockExistsSync.mockImplementation((p: string) => !String(p).includes('.tower-seeds.json'))
    mocks.mockReadFile.mockResolvedValue('{"applied":[]}')
  })

  it('returns empty when seed folder does not exist', async () => {
    mocks.mockExistsSync.mockReturnValue(false)

    const result = await runSeeds({} as any, { folder: 'seeds' })

    expect(result).toEqual({ applied: [] })
  })

  it('returns empty when no seed files found', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue([])

    const result = await runSeeds({} as any, { folder: 'seeds' })

    expect(result).toEqual({ applied: [] })
  })

  it('returns empty when no seed files match the name filter', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(['users.ts', 'posts.ts'])

    const result = await runSeeds({} as any, { folder: 'seeds' }, 'nonexistent')

    expect(result).toEqual({ applied: [] })
  })

  it('imports and executes default export', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(['users.ts'])
    mocks.seedCallback.mockResolvedValue(undefined)

    const result = await runSeeds({ some: 'db' } as any, { folder: 'seeds' })

    expect(mocks.seedCallback).toHaveBeenCalledWith({ some: 'db' })
    expect(result).toEqual({ applied: ['users.ts'] })
    expect(mocks.mockWriteFile).toHaveBeenCalled()
  })

  it('throws when seed file has no function default or named seed export', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(['empty.ts'])

    await expect(runSeeds({} as any, { folder: 'seeds' })).rejects.toThrow(
      'Seed "empty.ts" has no default export or named "seed" export'
    )
  })

  it('rethrows when seed execution throws', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(['crash.ts'])

    await expect(runSeeds({} as any, { folder: 'seeds' })).rejects.toThrow('seed error')
  })

  it('runs seed files in sorted order', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(['002_second.ts', '001_first.ts'])

    const result = await runSeeds({} as any, { folder: 'seeds' })

    expect(mocks.seedOrder).toEqual(['001_first', '002_second'])
    expect(result).toEqual({ applied: ['001_first.ts', '002_second.ts'] })
  })

  it('skips seeds that were already applied (idempotent)', async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(['001_first.ts', '002_second.ts'])
    // Manifest shows 001_first.ts was already applied on a prior run.
    mocks.mockReadFile.mockResolvedValue('{"applied":["001_first.ts"]}')

    const result = await runSeeds({} as any, { folder: 'seeds' })

    expect(mocks.seedOrder).toEqual(['002_second'])
    expect(result).toEqual({ applied: ['002_second.ts'] })
  })
})
