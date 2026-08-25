import { describe, expect, it } from 'vitest'

import { isSecretKey, redactValue, scanConfigFileSecrets } from './config.js'

describe('isSecretKey', () => {
  it('matches secret-shaped keys case-insensitively', () => {
    expect(isSecretKey('secret')).toBe(true)
    expect(isSecretKey('GATEHOUSE_SECRET')).toBe(true)
    expect(isSecretKey('password')).toBe(true)
    expect(isSecretKey('apiKey')).toBe(true)
    expect(isSecretKey('api_key')).toBe(true)
    expect(isSecretKey('privateKey')).toBe(true)
    expect(isSecretKey('clientSecret')).toBe(true)
  })

  it('does not flag ordinary config keys', () => {
    expect(isSecretKey('provider')).toBe(false)
    expect(isSecretKey('emailVerification')).toBe(false)
    expect(isSecretKey('baseURL')).toBe(false)
    // bare "key" alone is not treated as a secret — too many false positives
    expect(isSecretKey('key')).toBe(false)
  })
})

describe('redactValue', () => {
  it('masks secret values while preserving structure and non-secret data', () => {
    const config = {
      provider: 'better-auth',
      credentials: { enabled: true, password: 'hunter2' },
      passThrough: {
        secret: 'super-secret-value',
        advanced: { database: 'pg', tokens: ['a', 'b'] },
      },
      retries: 3,
      enabled: false,
    }

    const redacted = redactValue(config) as any
    expect(redacted.provider).toBe('better-auth')
    expect(redacted.credentials.enabled).toBe(true)
    expect(redacted.credentials.password).toBe('••••••••')
    expect(redacted.passThrough.secret).toBe('••••••••')
    // nested secret-keyed structures keep their shape; string leaves get masked
    expect(redacted.passThrough.advanced.tokens).toEqual(['a', 'b'])
    expect(redacted.retries).toBe(3)
    expect(redacted.enabled).toBe(false)
  })

  it('keeps nullish and primitive secret values as-is', () => {
    expect(redactValue(undefined, 'secret')).toBeUndefined()
    expect(redactValue(null, 'secret')).toBeNull()
    expect(redactValue(42, 'apiKey')).toBe(42)
    expect(redactValue(true, 'secretEnabled')).toBe(true)
  })
})

describe('scanConfigFileSecrets', () => {
  it('finds literal assignments and masks them', () => {
    const source = [
      'export default defineTower({',
      '  modules: [',
      '    gatehouse({',
      "      appName: 'My App',",
      "      secret: 'dev-secret-do-not-use',",
      '      passThrough: {',
      "        secret: 'nested-secret',",
      '      },',
      '    }),',
      '  ],',
      '})',
    ].join('\n')

    const entries = scanConfigFileSecrets(source)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ key: 'secret', preview: "secret: '••••••••'" })
    expect(JSON.stringify(entries)).not.toContain('dev-secret-do-not-use')
    expect(JSON.stringify(entries)).not.toContain('nested-secret')
  })

  it('leaves function calls visible and ignores non-secret keys', () => {
    const source = [
      "    vault({ connectionString: env.string('DATABASE_URL') }),",
      "    gatehouse({ appName: 'App' }),",
    ].join('\n')

    expect(scanConfigFileSecrets(source)).toEqual([])
  })

  it('flags nested secret object declarations', () => {
    const source = [
      '    betterAuth({',
      '      social: {}],',
      '      clientSecret: {',
      "        google: 'x',",
      '      },',
    ].join('\n')
    const entries = scanConfigFileSecrets(source)
    expect(entries.some((e) => e.key === 'clientSecret')).toBe(true)
  })
})
