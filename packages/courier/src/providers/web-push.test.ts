import { describe, expect, it, vi, beforeEach } from 'vitest'
import { WebPushProvider } from './web-push.js'

const { mockSendNotification, mockSetVapidDetails } = vi.hoisted(() => ({
  mockSendNotification: vi.fn(),
  mockSetVapidDetails: vi.fn(),
}))

vi.mock('web-push', () => ({
  setVapidDetails: mockSetVapidDetails,
  sendNotification: mockSendNotification,
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.WEB_PUSH_VAPID_SUBJECT
  delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY
  delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY
})

describe('WebPushProvider', () => {
  describe('initialization', () => {
    it('uses VAPID from config', () => {
      const p = new WebPushProvider({
        provider: 'web-push',
        vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' },
      })
      expect(p).toBeInstanceOf(WebPushProvider)
    })

    it('uses VAPID from env', () => {
      process.env.WEB_PUSH_VAPID_SUBJECT = 'mailto:env@x.com'
      process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'envpub'
      process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'envpriv'
      const p = new WebPushProvider({ provider: 'web-push' })
      expect(p).toBeInstanceOf(WebPushProvider)
    })

    it('throws when VAPID config missing entirely', async () => {
      const p = new WebPushProvider({ provider: 'web-push' })
      await expect(p.send({ subscription: { endpoint: '', keys: { auth: '', p256dh: '' } } } as any)).rejects.toThrow(
        '[courier.push] Missing VAPID config'
      )
    })
  })

  describe('send', () => {
    const sub = { endpoint: 'https://fcm.example.com/abc', keys: { auth: 'authkey', p256dh: 'p256key' } }

    it('sends string payload', async () => {
      const p = new WebPushProvider({
        provider: 'web-push',
        vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' },
      })
      mockSendNotification.mockResolvedValue({ statusCode: 201 })

      const result = await p.send({ subscription: sub, payload: 'hello' })

      expect(result).toEqual({ status: 201, provider: 'web-push' })
      expect(mockSendNotification).toHaveBeenCalledWith(sub, 'hello', {})
    })

    it('sends object payload as JSON string', async () => {
      const p = new WebPushProvider({
        provider: 'web-push',
        vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' },
      })
      mockSendNotification.mockResolvedValue({ statusCode: 201 })

      await p.send({ subscription: sub, payload: { title: 'Alert', body: 'Hi' } })

      expect(mockSendNotification).toHaveBeenCalledWith(sub, '{"title":"Alert","body":"Hi"}', {})
    })

    it('builds payload from title/body/data when no payload given', async () => {
      const p = new WebPushProvider({
        provider: 'web-push',
        vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' },
      })
      mockSendNotification.mockResolvedValue({ statusCode: 201 })

      await p.send({ subscription: sub, title: 'Hello', body: 'World', data: { url: '/foo' } })

      expect(mockSendNotification).toHaveBeenCalledWith(
        sub,
        JSON.stringify({ title: 'Hello', body: 'World', data: { url: '/foo' } }),
        {}
      )
    })

    it('throws when payload, title, body, and data are all missing', async () => {
      const p = new WebPushProvider({
        provider: 'web-push',
        vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' },
      })

      await expect(p.send({ subscription: sub } as any)).rejects.toThrow('[courier.push] Missing payload')
    })

    it('throws on sendNotification error', async () => {
      const p = new WebPushProvider({
        provider: 'web-push',
        vapid: { subject: 'mailto:x@y.com', publicKey: 'pub', privateKey: 'priv' },
      })
      mockSendNotification.mockRejectedValue(new Error('410 Gone'))

      await expect(p.send({ subscription: sub, payload: 'hi' })).rejects.toThrow('410 Gone')
    })
  })
})
