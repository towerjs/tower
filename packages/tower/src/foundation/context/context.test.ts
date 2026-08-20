import { describe, expect, it } from 'vitest'

import { towerContext } from './index.ts'

describe('towerContext (ALS provider)', () => {
  it('stores data and retrieves it within the handler', async () => {
    const result = await towerContext.run({ user: 'Alice' }, async () => {
      return towerContext.get('user')
    })
    expect(result).toBe('Alice')
  })

  it('returns undefined for keys not in the store', async () => {
    const result = await towerContext.run({ user: 'Alice' }, async () => {
      return towerContext.get('nonexistent')
    })
    expect(result).toBeUndefined()
  })

  it('isolates data between concurrent runs', async () => {
    const results = await Promise.all([
      towerContext.run({ id: 1 }, async () => {
        await new Promise((r) => setTimeout(r, 5))
        return towerContext.get('id')
      }),
      towerContext.run({ id: 2 }, async () => {
        await new Promise((r) => setTimeout(r, 5))
        return towerContext.get('id')
      }),
    ])
    expect(results).toEqual([1, 2])
  })

  it('restores previous data after nested run', async () => {
    const result = await towerContext.run({ outer: true }, async () => {
      await towerContext.run({ inner: true }, async () => {
        // inner context
      })
      return towerContext.get('outer')
    })
    expect(result).toBe(true)
  })

  it('inner context can override keys without affecting outer', async () => {
    const outerVal = await towerContext.run({ value: 'original' }, async () => {
      await towerContext.run({ value: 'override' }, async () => {
        // inner
      })
      return towerContext.get('value')
    })
    expect(outerVal).toBe('original')
  })

  it('supports storing multiple keys', async () => {
    const result = await towerContext.run({ a: 1, b: 'two', c: [3] }, async () => ({
      a: towerContext.get('a'),
      b: towerContext.get('b'),
      c: towerContext.get('c'),
    }))
    expect(result).toEqual({ a: 1, b: 'two', c: [3] })
  })

  it('cleans up data after the handler resolves', async () => {
    await towerContext.run({ temp: 'data' }, async () => {
      // inside context
    })
    const result = towerContext.get('temp')
    expect(result).toBeUndefined()
  })

  it('cleans up data when the handler throws', async () => {
    await expect(
      towerContext.run({ temp: 'data' }, async () => {
        throw new Error('fail')
      })
    ).rejects.toThrow('fail')

    expect(towerContext.get('temp')).toBeUndefined()
  })

  it('returns undefined when called outside a run handler', () => {
    expect(towerContext.get('anything')).toBeUndefined()
  })
})
