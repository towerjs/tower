import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateCommand = vi.fn()

vi.mock('@towerjs/scribe', () => ({
  createCommand: mockCreateCommand,
}))

describe('create-tower CLI entrypoint', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('imports and calls createCommand', async () => {
    mockCreateCommand.mockResolvedValue(undefined)

    const { createCommand } = await import('@towerjs/scribe')
    await import('./index.js')
    expect(createCommand).toHaveBeenCalledOnce()
  })

  it('propagates createCommand rejection', async () => {
    mockCreateCommand.mockRejectedValue(new Error('db error'))

    await expect(import('./index.js')).rejects.toThrow('db error')
  })
})
