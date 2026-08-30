import { beforeEach, describe, expect, it, vi } from 'vitest'

import { defineCourier } from './index.js'

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}))

function mockCtx() {
  return {
    services: {
      register: vi.fn(),
      registerFactory: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
    },
    config: { modules: {} },
    runtime: { name: 'node-server' as const, isServerless: false },
  }
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.COURIER_EMAIL_FROM
  delete process.env.SMTP_HOST
  delete process.env.SMTP_PORT
  delete process.env.AWS_REGION
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.TWILIO_MESSAGING_SERVICE_SID
  delete process.env.WEB_PUSH_VAPID_SUBJECT
  delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY
  delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY
})

function initAndGetModule(config: any) {
  const mod = defineCourier(config)
  const ctx = mockCtx()
  return { mod, ctx }
}

describe('courier module service', () => {
  it('throws if accessed before init', () => {
    const { mod } = initAndGetModule({})
    expect(() => mod.email).toThrow('Courier not initialized')
    expect(() => mod.sms).toThrow('Courier not initialized')
    expect(() => mod.push).toThrow('Courier not initialized')
  })

  it('forwards property access through proxy after init', async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: 'resend', apiKey: 're_test', from: 'noreply@example.com' },
    })
    await mod.initialize?.(ctx as any)

    expect(typeof mod.email.send).toBe('function')
    expect(typeof mod.sms.send).toBe('function')
    expect(typeof mod.push.send).toBe('function')
  })
})

describe('defineCourier', () => {
  it('returns a module with name and init', () => {
    const mod = defineCourier({})
    expect(mod.name).toBe('courier')
    expect(typeof mod.initialize).toBe('function')
  })

  it('registers courier in the container on init', async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.initialize?.(ctx as any)
    expect(ctx.services.register).toHaveBeenCalledWith('courier', expect.anything())
  })

  it('throws unconfigured errors for email when not configured', async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.initialize?.(ctx as any)
    await expect(mod.email.send({ to: 'a@b.com', subject: 'x', text: 'y' })).rejects.toThrow(
      '[courier.email] Not configured'
    )
  })

  it('throws unconfigured errors for sms when not configured', async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.initialize?.(ctx as any)
    await expect(mod.sms.send({ to: '+1234', body: 'hello' })).rejects.toThrow('[courier.sms] Not configured')
  })

  it('throws unconfigured errors for push when not configured', async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.initialize?.(ctx as any)
    await expect(mod.push.send({ subscription: {} as any, payload: 'hi' })).rejects.toThrow(
      '[courier.push] Not configured'
    )
  })
})

describe('email provider resolution', () => {
  it('creates Resend provider from config', async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: 'resend', apiKey: 're_key', from: 'noreply@example.com' },
    })
    await mod.initialize?.(ctx as any)
    expect(mod.email.send).toBeDefined()
  })

  it('creates SMTP provider from config', async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: 'smtp', host: 'smtp.example.com', port: 587 },
    })
    await mod.initialize?.(ctx as any)
    expect(mod.email.send).toBeDefined()
  })

  it('creates SES provider from config', async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: 'ses', region: 'us-east-1' },
    })
    await mod.initialize?.(ctx as any)
    expect(mod.email.send).toBeDefined()
  })

  it('creates Console provider from config', async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: 'console', from: 'test@example.com' },
    })
    await mod.initialize?.(ctx as any)
    expect(mod.email.send).toBeDefined()
  })

  it('rejects an unsupported email provider in config', () => {
    expect(() => defineCourier({ email: { provider: 'mailgun' as any } })).toThrow(/Invalid configuration/)
  })
})

describe('sms provider resolution', () => {
  it('creates Twilio provider from config', async () => {
    const { mod, ctx } = initAndGetModule({
      sms: { provider: 'twilio', accountSid: 'ACx', authToken: 'tok', messagingServiceSid: 'MGx' },
    })
    await mod.initialize?.(ctx as any)
    expect(mod.sms.send).toBeDefined()
  })

  it('rejects an unsupported sms provider in config', () => {
    expect(() => defineCourier({ sms: { provider: 'vonage' as any } })).toThrow(/Invalid configuration/)
  })
})

describe('push provider resolution', () => {
  it('creates Web Push provider from config', async () => {
    const { mod, ctx } = initAndGetModule({
      push: { provider: 'web-push', vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' } },
    })
    await mod.initialize?.(ctx as any)
    expect(mod.push.send).toBeDefined()
  })

  it('rejects an unsupported push provider in config', () => {
    expect(() => defineCourier({ push: { provider: 'firebase' as any } })).toThrow(/Invalid configuration/)
  })
})

describe('multiple channels', () => {
  it('configures all three channels simultaneously', async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: 'resend', apiKey: 're_test', from: 'noreply@example.com' },
      sms: { provider: 'twilio', accountSid: 'ACx', authToken: 'tok', messagingServiceSid: 'MGx' },
      push: { provider: 'web-push', vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' } },
    })
    await mod.initialize?.(ctx as any)

    expect(typeof mod.email.send).toBe('function')
    expect(typeof mod.sms.send).toBe('function')
    expect(typeof mod.push.send).toBe('function')
  })
})
