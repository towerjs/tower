import { describe, expect, it } from 'vitest'

import { parseCreateFlags } from './create-flags.js'

describe('parseCreateFlags', () => {
  it('parses project name as positional argument', () => {
    expect(parseCreateFlags(['test-app'])).toEqual({ name: 'test-app' })
  })

  it('parses --name flag', () => {
    expect(parseCreateFlags(['--name', 'test-app'])).toEqual({ name: 'test-app' })
  })

  it('parses --project-name alias', () => {
    expect(parseCreateFlags(['--project-name', 'test-app'])).toEqual({ name: 'test-app' })
  })

  it('parses tailwind and no-tailwind', () => {
    expect(parseCreateFlags(['--tailwind'])).toEqual({ tailwind: true })
    expect(parseCreateFlags(['--no-tailwind'])).toEqual({ tailwind: false })
  })

  it('parses deployment', () => {
    expect(parseCreateFlags(['--deployment', 'cloudflare'])).toEqual({ deployment: 'cloudflare' })
  })

  it('parses modules as comma-separated list', () => {
    expect(parseCreateFlags(['--modules', 'vault,gatehouse,courier'])).toEqual({
      modules: ['vault', 'gatehouse', 'courier'],
    })
  })

  it('parses vault provider', () => {
    expect(parseCreateFlags(['--vault', 'neon'])).toEqual({ vault: 'neon' })
  })

  it('parses auth features', () => {
    expect(parseCreateFlags(['--features', 'credentials,social'])).toEqual({
      features: ['credentials', 'social'],
    })
  })

  it('parses email and sms providers', () => {
    expect(parseCreateFlags(['--email', 'resend', '--sms', 'twilio'])).toEqual({
      email: 'resend',
      sms: 'twilio',
    })
  })

  it('combines all flags', () => {
    expect(
      parseCreateFlags([
        'test-app',
        '--no-tailwind',
        '--deployment',
        'vercel',
        '--modules',
        'vault,gatehouse',
        '--vault',
        'neon',
        '--features',
        'credentials',
        '--email',
        'resend',
      ])
    ).toEqual({
      name: 'test-app',
      tailwind: false,
      deployment: 'vercel',
      modules: ['vault', 'gatehouse'],
      vault: 'neon',
      features: ['credentials'],
      email: 'resend',
    })
  })

  it('throws on unknown deployment', () => {
    expect(() => parseCreateFlags(['--deployment', 'mars'])).toThrow('Unknown deployment: mars')
  })

  it('throws on unknown vault provider', () => {
    expect(() => parseCreateFlags(['--vault', 'oracle'])).toThrow('Unknown vault provider: oracle')
  })

  it('throws on unknown auth feature', () => {
    expect(() => parseCreateFlags(['--features', 'magic'])).toThrow('Unknown auth feature: magic')
  })

  it('throws on unknown email provider', () => {
    expect(() => parseCreateFlags(['--email', 'sendgrid'])).toThrow('Unknown email provider: sendgrid')
  })

  it('throws on unknown sms provider', () => {
    expect(() => parseCreateFlags(['--sms', 'vonage'])).toThrow('Unknown sms provider: vonage')
  })

  it('throws on missing value', () => {
    expect(() => parseCreateFlags(['--modules'])).toThrow('Missing value for --modules')
  })

  it('throws on unknown flag', () => {
    expect(() => parseCreateFlags(['--wat'])).toThrow('Unknown flag: --wat')
  })
})
