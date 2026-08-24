import { beforeEach, describe, expect, it, vi } from 'vitest'

import { courier, defineCourier } from './index.js'

vi.mock('web-push', () => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
}))

vi.mock('twilio', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({
    messages: { create: vi.fn().mockResolvedValue({ sid: 'SM1', status: 'queued' }) },
  }),
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

async function initConsoleCourier() {
  const mod = defineCourier({ email: { provider: 'console' } })
  await mod.initialize!(mockCtx() as any)
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY
})

describe('courier config validation', () => {
  it('accepts an empty config', () => {
    expect(() => defineCourier({})).not.toThrow()
  })

  it('accepts a console email provider', () => {
    expect(() => defineCourier({ email: { provider: 'console', from: 'a@b.com' } })).not.toThrow()
  })

  it('accepts a full multi-channel config', () => {
    expect(() =>
      defineCourier({
        email: { provider: 'resend', apiKey: 're_key' },
        sms: { provider: 'twilio', accountSid: 'ACx', authToken: 'tok' },
        push: { provider: 'web-push', vapid: { subject: 'mailto:x@y.com', publicKey: 'p', privateKey: 'k' } },
      })
    ).not.toThrow()
  })

  it('rejects a typo in the provider name', () => {
    expect(() => defineCourier({ email: { provider: 'resned' as any } })).toThrow(/Invalid configuration/)
  })

  it('rejects an unknown email config key', () => {
    expect(() => defineCourier({ email: { provider: 'console', apikey: 'x' } as any })).toThrow(/Invalid configuration/)
  })

  it('rejects a non-string sms from', () => {
    expect(() => defineCourier({ sms: { provider: 'twilio', from: 42 } as any })).toThrow(/Invalid configuration/)
  })
})

describe('email send param validation', () => {
  it('accepts valid email params', async () => {
    await initConsoleCourier()
    await expect(
      courier.email.send({ to: 'user@example.com', subject: 'Welcome', text: 'Hello' })
    ).resolves.toBeDefined()
  })

  it('accepts attachments', async () => {
    await initConsoleCourier()
    await expect(
      courier.email.send({
        to: ['a@b.com', 'c@d.com'],
        subject: 'Report',
        html: '<p>Hi</p>',
        attachments: [{ filename: 'a.txt', content: 'hello' }],
      })
    ).resolves.toBeDefined()
  })

  it('rejects email without content', async () => {
    await initConsoleCourier()
    await expect(courier.email.send({ to: 'user@example.com', subject: 'Welcome' })).rejects.toThrow(
      /\[courier\.email\] Invalid send params/
    )
    await expect(courier.email.send({ to: 'user@example.com', subject: 'Welcome' })).rejects.toThrow(
      /Email must include text, html, or a react template/
    )
  })

  it('rejects a non-string recipient', async () => {
    await initConsoleCourier()
    await expect(courier.email.send({ to: 42 as any, subject: 'x', text: 'y' })).rejects.toThrow(
      /\[courier\.email\] Invalid send params — to:/
    )
  })

  it('rejects a non-string subject', async () => {
    await initConsoleCourier()
    await expect(courier.email.send({ to: 'a@b.com', subject: 42 as any, text: 'y' })).rejects.toThrow(
      /\[courier\.email\] Invalid send params — subject:/
    )
  })
})

describe('sms send param validation', () => {
  it('accepts valid sms params', async () => {
    const mod = defineCourier({
      sms: { provider: 'twilio', accountSid: 'ACx', authToken: 'tok', from: '+15551234567' },
    })
    await mod.initialize!(mockCtx() as any)
    await expect(courier.sms.send({ to: '+1234567890', body: 'hello' })).resolves.toBeDefined()
  })

  it('rejects sms without a body', async () => {
    const mod = defineCourier({
      sms: { provider: 'twilio', accountSid: 'ACx', authToken: 'tok', from: '+15551234567' },
    })
    await mod.initialize!(mockCtx() as any)
    await expect(courier.sms.send({ to: '+1234567890' } as any)).rejects.toThrow(
      /\[courier\.sms\] Invalid send params — body:/
    )
  })
})

describe('push send param validation', () => {
  it('accepts valid push params', async () => {
    const mod = defineCourier({
      push: { provider: 'web-push', vapid: { subject: 'mailto:x@y.com', publicKey: 'p', privateKey: 'k' } },
    })
    await mod.initialize!(mockCtx() as any)
    await expect(
      courier.push.send({
        subscription: { endpoint: 'https://push.example.com', keys: { p256dh: 'a', auth: 'b' } },
        title: 'Hi',
        body: 'Hello',
      })
    ).resolves.toBeDefined()
  })

  it('rejects an invalid urgency value', async () => {
    const mod = defineCourier({
      push: { provider: 'web-push', vapid: { subject: 'mailto:x@y.com', publicKey: 'p', privateKey: 'k' } },
    })
    await mod.initialize!(mockCtx() as any)
    await expect(
      courier.push.send({
        subscription: { endpoint: 'https://push.example.com', keys: { p256dh: 'a', auth: 'b' } },
        payload: 'hi',
        urgency: 'urgent' as any,
      })
    ).rejects.toThrow(/\[courier\.push\] Invalid send params — urgency:/)
  })

  it('rejects a subscription without keys', async () => {
    const mod = defineCourier({
      push: { provider: 'web-push', vapid: { subject: 'mailto:x@y.com', publicKey: 'p', privateKey: 'k' } },
    })
    await mod.initialize!(mockCtx() as any)
    await expect(
      courier.push.send({ subscription: { endpoint: 'https://push.example.com' } as any, payload: 'hi' })
    ).rejects.toThrow(/\[courier\.push\] Invalid send params — subscription\.keys:/)
  })
})
