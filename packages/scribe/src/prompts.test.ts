import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  select: vi.fn(),
  checkbox: vi.fn(),
}))

vi.mock('./checkbox.js', () => ({
  checkbox: vi.fn(),
}))

import { input, select, checkbox as featureCheckbox } from '@inquirer/prompts'
import { checkbox as modulesCheckbox } from './checkbox.js'
import { collectProjectState } from './prompts.js'

describe('collectProjectState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('collects project name, tailwind, deployment, runtime, and modules', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel').mockResolvedValueOnce('neon')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['vault', 'gatehouse'])
    vi.mocked(featureCheckbox).mockResolvedValueOnce(['credentials', 'social'])

    const state = await collectProjectState()

    expect(state.projectName).toBe('my-app')
    expect(state.framework).toBe('next')
    expect(state.frameworkAnswers).toEqual({ tailwind: true })
    expect(state.deployment).toBe('vercel')
    expect(state.runtime).toBe('node')
    expect(state.modules.vault).toEqual({ provider: 'neon', brand: 'neon' })
    expect(state.modules.gatehouse).toEqual({ credentials: true, social: { google: {}, github: {} } })
  })

  it('uses next framework and TypeScript by default', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce([])

    const state = await collectProjectState()

    expect(state.framework).toBe('next')
    expect(state.frameworkAnswers.typescript).toBeUndefined()
  })

  it('derives node runtime for vercel without prompting', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce([])

    const state = await collectProjectState()

    expect(state.deployment).toBe('vercel')
    expect(state.runtime).toBe('node')
    expect(select).not.toHaveBeenCalledWith(expect.objectContaining({ message: 'Runtime' }))
  })

  it('derives edge runtime for cloudflare without prompting', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('cloudflare')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce([])

    const state = await collectProjectState()

    expect(state.deployment).toBe('cloudflare')
    expect(state.runtime).toBe('edge')
  })

  it('derives node runtime for other deployment without prompting', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('other')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce([])

    const state = await collectProjectState()

    expect(state.deployment).toBe('other')
    expect(state.runtime).toBe('node')
  })

  it('skips module providers when no modules selected', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce([])

    const state = await collectProjectState()

    expect(state.modules).toEqual({})
  })

  it('validates project name', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce([])

    await collectProjectState()

    const validateFn = vi.mocked(input).mock.calls[0][0].validate as (v: string) => string | boolean

    expect(validateFn('')).toBe('Project name is required')
    expect(validateFn('My App')).toBe('Use lowercase letters, numbers, and hyphens')
    expect(validateFn('my-app')).toBe(true)
  })

  it('maps vault provider to pg for non-neon', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel').mockResolvedValueOnce('supabase')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['vault'])

    const state = await collectProjectState()

    expect(state.modules.vault).toEqual({ provider: 'pg', brand: 'supabase' })
  })

  it('keeps vault enabled when provider is deferred', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel').mockResolvedValueOnce('skip')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['vault'])

    const state = await collectProjectState()

    expect(state.modules.vault).toEqual({})
  })

  it('prompts for courier email provider when courier is selected', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel').mockResolvedValueOnce('resend')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['courier'])

    const state = await collectProjectState()

    expect(state.modules.courier).toEqual({ email: { provider: 'resend', from: 'My App <onboarding@resend.dev>' } })
  })

  it('keeps courier enabled when email provider is deferred', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel').mockResolvedValueOnce('skip')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['courier'])

    const state = await collectProjectState()

    expect(state.modules.courier).toEqual({})
  })

  it('prompts for sms provider when courier and phone auth are enabled', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce('vercel')
      .mockResolvedValueOnce('resend')
      .mockResolvedValueOnce('twilio')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['gatehouse', 'courier'])
    vi.mocked(featureCheckbox).mockResolvedValueOnce(['phoneNumber'])

    const state = await collectProjectState()

    expect(state.modules.gatehouse).toEqual({ phoneNumber: true })
    expect(state.modules.courier).toEqual({
      email: { provider: 'resend', from: 'My App <onboarding@resend.dev>' },
      sms: { provider: 'twilio' },
    })
  })

  it('does not prompt for sms provider without phone auth', async () => {
    vi.mocked(input).mockResolvedValueOnce('my-app')
    vi.mocked(select).mockResolvedValueOnce(true).mockResolvedValueOnce('vercel').mockResolvedValueOnce('resend')
    vi.mocked(modulesCheckbox).mockResolvedValueOnce(['gatehouse', 'courier'])
    vi.mocked(featureCheckbox).mockResolvedValueOnce(['credentials'])

    const state = await collectProjectState()

    expect(state.modules.gatehouse).toEqual({ credentials: true })
    expect(state.modules.courier).toEqual({
      email: { provider: 'resend', from: 'My App <onboarding@resend.dev>' },
    })
  })
})
