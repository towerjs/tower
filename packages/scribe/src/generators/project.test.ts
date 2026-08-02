import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockNextAdapter: {
    generate: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../frameworks/next.js', () => ({
  nextAdapter: mocks.mockNextAdapter,
}))

import { generateProject } from './project.js'

describe('generateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the next adapter for next framework', async () => {
    const state = {
      projectName: 'my-app',
      framework: 'next' as const,
      modules: {},
      frameworkAnswers: {},
    }

    await generateProject(state, '/target')

    expect(mocks.mockNextAdapter.generate).toHaveBeenCalledWith(state, '/target')
  })

  it('throws for unsupported frameworks', async () => {
    const state = {
      projectName: 'my-app',
      framework: 'unknown' as any,
      modules: {},
      frameworkAnswers: {},
    }

    await expect(generateProject(state, '/target')).rejects.toThrow('Unsupported framework: "unknown"')
  })
})
