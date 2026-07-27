import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TwilioSmsProvider } from './twilio.js'

const mockMessagesCreate = vi.fn()

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.TWILIO_MESSAGING_SERVICE_SID
  delete process.env.COURIER_SMS_FROM
})

describe('TwilioSmsProvider', () => {
  describe('constructor', () => {
    it('uses credentials from config', () => {
      const p = new TwilioSmsProvider({
        provider: 'twilio',
        accountSid: 'ACxxx',
        authToken: 'tok',
        messagingServiceSid: 'MGxxx',
      })
      expect(p).toBeInstanceOf(TwilioSmsProvider)
    })

    it('uses credentials from env', () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACenv'
      process.env.TWILIO_AUTH_TOKEN = 'tokenv'
      process.env.TWILIO_MESSAGING_SERVICE_SID = 'MGenv'
      const p = new TwilioSmsProvider({ provider: 'twilio' })
      expect(p).toBeInstanceOf(TwilioSmsProvider)
    })

    it('throws when accountSid missing', async () => {
      delete process.env.TWILIO_ACCOUNT_SID
      const p = new TwilioSmsProvider({ provider: 'twilio', authToken: 'tok', messagingServiceSid: 'MGx' })
      await expect(p.send({ to: '+1234', body: 'hello' })).rejects.toThrow('[courier.sms] Missing Twilio credentials')
    })

    it('throws when authToken missing', async () => {
      const p = new TwilioSmsProvider({ provider: 'twilio', accountSid: 'ACx', messagingServiceSid: 'MGx' })
      await expect(p.send({ to: '+1234', body: 'hello' })).rejects.toThrow('[courier.sms] Missing Twilio credentials')
    })
  })

  describe('send', () => {
    it('sends SMS with messagingServiceSid and body', async () => {
      const p = new TwilioSmsProvider({
        provider: 'twilio',
        accountSid: 'ACx',
        authToken: 'tok',
        messagingServiceSid: 'MGx',
      })
      mockMessagesCreate.mockResolvedValue({ sid: 'SMabc', status: 'queued' })

      const result = await p.send({ to: '+1234567890', body: 'Hello' })

      expect(result).toEqual({ id: 'SMabc', status: 'queued', provider: 'twilio' })
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        to: '+1234567890',
        body: 'Hello',
        messagingServiceSid: 'MGx',
      })
    })

    it('uses from when messagingServiceSid not set', async () => {
      const p = new TwilioSmsProvider({ provider: 'twilio', accountSid: 'ACx', authToken: 'tok', from: '+1987654321' })
      mockMessagesCreate.mockResolvedValue({ sid: 'SMx', status: 'sent' })

      await p.send({ to: '+1234567890', body: 'Hello' })

      expect(mockMessagesCreate).toHaveBeenCalledWith(expect.objectContaining({ from: '+1987654321' }))
    })

    it('throws when messagingServiceSid and from both missing', async () => {
      const p = new TwilioSmsProvider({ provider: 'twilio', accountSid: 'ACx', authToken: 'tok' })
      await expect(p.send({ to: '+1234567890', body: 'Hello' })).rejects.toThrow('[courier.sms] Missing sender')
    })

    it('throws when body is empty', async () => {
      const p = new TwilioSmsProvider({
        provider: 'twilio',
        accountSid: 'ACx',
        authToken: 'tok',
        messagingServiceSid: 'MGx',
      })
      await expect(p.send({ to: '+1234567890', body: '' })).rejects.toThrow(
        '[courier.sms] Message body must not be empty.'
      )
    })

    it('throws on Twilio API error', async () => {
      const p = new TwilioSmsProvider({
        provider: 'twilio',
        accountSid: 'ACx',
        authToken: 'tok',
        messagingServiceSid: 'MGx',
      })
      mockMessagesCreate.mockRejectedValue(new Error('Twilio error: 21610 - Unreachable'))

      await expect(p.send({ to: '+1234567890', body: 'Hello' })).rejects.toThrow('Twilio error: 21610 - Unreachable')
    })
  })
})
