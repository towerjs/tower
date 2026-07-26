import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  checkbox: vi.fn(),
}))

import { input, select, checkbox } from '@inquirer/prompts'
import { collectProjectState } from './prompts.js'

describe('collectProjectState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('collects project name, framework, modules, and deployment', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select)
      .mockResolvedValueOnce('next')
      .mockResolvedValueOnce('neon')
      .mockResolvedValueOnce('better-auth')
      .mockResolvedValueOnce('vercel')
    vi.mocked(checkbox).mockResolvedValueOnce(['vault', 'gatehouse']).mockResolvedValueOnce(['credentials', 'social'])

    const state = await collectProjectState()

    expect(state.projectName).toBe('my-app')
    expect(state.framework).toBe('next')
    expect(state.modules.vault).toEqual({ provider: 'neon', brand: 'neon' })
    expect(state.modules.gatehouse).toMatchObject({ provider: 'better-auth', credentials: true })
    expect(state.deployment).toBe('vercel')
  })

  it('skips module providers when no modules selected', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce('next').mockResolvedValueOnce('vercel')
    vi.mocked(checkbox).mockResolvedValueOnce([])

    const state = await collectProjectState()

    expect(state.modules).toEqual({})
  })

  it('validates project name', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce('next').mockResolvedValueOnce('vercel')
    vi.mocked(checkbox).mockResolvedValueOnce([])

    await collectProjectState()

    const validateFn = vi.mocked(input).mock.calls[0][0].validate as (v: string) => string | boolean

    expect(validateFn('')).toBe('Project name is required')
    expect(validateFn('My App')).toBe('Use lowercase letters, numbers, and hyphens')
    expect(validateFn('my-app')).toBe(true)
  })

  it('maps vault provider to pg for non-neon', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce('next').mockResolvedValueOnce('supabase').mockResolvedValueOnce('vercel')
    vi.mocked(checkbox).mockResolvedValueOnce(['vault'])

    const state = await collectProjectState()

    expect(state.modules.vault).toEqual({ provider: 'pg', brand: 'supabase' })
  })

  it('maps beacon provider', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce('next').mockResolvedValueOnce('ably').mockResolvedValueOnce('vercel')
    vi.mocked(checkbox).mockResolvedValueOnce(['beacon'])

    const state = await collectProjectState()

    expect(state.modules.beacon).toEqual({ provider: 'ably' })
  })

  it('defaults module to empty object for unknown modules', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce('next').mockResolvedValueOnce('vercel')
    vi.mocked(checkbox).mockResolvedValueOnce(['courier'])

    const state = await collectProjectState()

    expect(state.modules.courier).toEqual({})
  })
})
