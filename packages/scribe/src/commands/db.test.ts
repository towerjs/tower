import { describe, expect, it } from 'vitest'

import { type DbFlags, destructiveDecision, parseDbFlags } from './db.js'

const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv

describe('parseDbFlags', () => {
  it('recognizes supported flags and ignores unknown ones', () => {
    const flags: DbFlags = parseDbFlags(['--pretend', '--unknown', '--force', '-h'])
    expect(flags).toEqual({ force: true, pretend: true, help: true })
  })

  it('defaults everything to false', () => {
    expect(parseDbFlags([])).toEqual({ force: false, pretend: false, help: false })
  })
})

describe('destructiveDecision', () => {
  it('allows destructive commands outside production without prompting', () => {
    const decision = destructiveDecision('fresh', {}, { NODE_ENV: undefined } as unknown as NodeJS.ProcessEnv, false)
    expect(decision).toEqual({ allowed: true, reason: 'not production' })
  })

  it('blocks non-interactive production runs unless --force is passed', () => {
    const blocked = destructiveDecision('fresh', {}, prod, false)
    expect(blocked.allowed).toBe(false)
    expect(blocked.needsPrompt).toBe(false)
    expect(blocked.reason).toContain('--force')

    const forced = destructiveDecision('fresh', { force: true }, prod, false)
    expect(forced).toEqual({ allowed: true, reason: '--force' })
  })

  it('asks for confirmation in interactive production runs', () => {
    const decision = destructiveDecision('rollback', {}, prod, true)
    expect(decision.allowed).toBe(false)
    expect(decision.needsPrompt).toBe(true)
    expect(decision.reason).toContain('destructive')
  })

  it('never prompts for non-destructive subcommands', () => {
    const decision = destructiveDecision('migrate', {}, prod, false)
    expect(decision).toEqual({ allowed: true, reason: 'non-destructive' })
  })
})
