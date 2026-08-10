import { describe, expect, it } from 'vitest'
import { parseGatehouseConfig } from './schemas.js'

describe('gatehouse config validation', () => {
  it('accepts a minimal config', () => {
    expect(() => parseGatehouseConfig({ provider: 'better-auth' })).not.toThrow()
  })

  it('accepts the example app config', () => {
    expect(() =>
      parseGatehouseConfig({
        provider: 'better-auth',
        appName: 'Tower Example',
        credentials: { enabled: true, autoSignIn: true },
        emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true },
        social: { google: { clientId: 'x', clientSecret: 'y' } },
        passkeys: true,
        twoFactor: true,
        organization: true,
      })
    ).not.toThrow()
  })

  it('accepts all feature toggles and passthrough keys', () => {
    expect(() =>
      parseGatehouseConfig({
        provider: 'better-auth',
        credentials: { sendResetPassword: () => {} },
        magicLinks: { sendMagicLink: () => {} },
        phoneNumber: { sendOTP: () => {} },
        emailVerification: { method: 'otp', sendVerificationOTP: () => {} },
        baseURL: { allowedHosts: ['localhost'], protocol: 'http', fallback: 'http://localhost:3000' },
        trustedOrigins: ['http://localhost:3000'],
        plugins: [{ id: 'custom-plugin' }],
        customUnknownOption: { anything: true },
        advanced: { useSecureCookies: true },
      })
    ).not.toThrow()
  })

  it('accepts social as a string array', () => {
    expect(() => parseGatehouseConfig({ provider: 'better-auth', social: ['google', 'github'] })).not.toThrow()
  })

  it('rejects a missing provider', () => {
    expect(() => parseGatehouseConfig({})).toThrow(/Invalid configuration/)
  })

  it('rejects an unknown provider', () => {
    expect(() => parseGatehouseConfig({ provider: 'auth0' })).toThrow(/Invalid configuration/)
  })

  it('rejects an invalid email verification method', () => {
    expect(() =>
      parseGatehouseConfig({ provider: 'better-auth', emailVerification: { method: 'sms' } })
    ).toThrow(/Invalid configuration/)
  })

  it('rejects social as a plain string', () => {
    expect(() => parseGatehouseConfig({ provider: 'better-auth', social: 'google' as any })).toThrow(
      /Invalid configuration/
    )
  })

  it('rejects baseURL without an allowedHosts array', () => {
    expect(() =>
      parseGatehouseConfig({ provider: 'better-auth', baseURL: { allowedHosts: 'localhost' } as any })
    ).toThrow(/Invalid configuration/)
  })

  it('rejects a non-string appName', () => {
    expect(() => parseGatehouseConfig({ provider: 'better-auth', appName: 42 as any })).toThrow(/Invalid configuration/)
  })

  it('rejects a negative rate limit window', () => {
    expect(() =>
      parseGatehouseConfig({ provider: 'better-auth', rateLimit: { window: -1 } as any })
    ).toThrow(/Invalid configuration/)
  })
})
