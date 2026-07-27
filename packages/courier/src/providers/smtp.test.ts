import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SmtpEmailProvider } from './smtp.js'

const mockSendMail = vi.fn()
const mockClose = vi.fn()

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
      close: mockClose,
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: mockSendMail,
    close: mockClose,
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.SMTP_HOST
  delete process.env.SMTP_PORT
  delete process.env.COURIER_EMAIL_FROM
})

describe('SmtpEmailProvider', () => {
  describe('constructor', () => {
    it('uses host from config', () => {
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587 })
      expect(p).toBeInstanceOf(SmtpEmailProvider)
    })

    it('uses host from env', () => {
      process.env.SMTP_HOST = 'smtp.env.com'
      process.env.SMTP_PORT = '465'
      const p = new SmtpEmailProvider({ provider: 'smtp' })
      expect(p).toBeInstanceOf(SmtpEmailProvider)
    })

    it('throws when host missing', async () => {
      const p = new SmtpEmailProvider({ provider: 'smtp' })
      await expect(p.send({ from: 'a@b.com', to: 'a@b.com', subject: 'x', text: 'y' })).rejects.toThrow(
        '[courier.email] Missing SMTP host'
      )
    })
  })

  describe('send', () => {
    it('sends mail with correct params', async () => {
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587 })
      mockSendMail.mockResolvedValue({ messageId: '<abc@example.com>' })

      const result = await p.send({
        from: 'from@example.com',
        to: 'to@example.com',
        subject: 'Hello',
        html: '<p>html</p>',
        text: 'text',
      })

      expect(result).toEqual({ id: '<abc@example.com>', provider: 'smtp' })
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'from@example.com',
          to: ['to@example.com'],
          subject: 'Hello',
          html: '<p>html</p>',
          text: 'text',
        })
      )
    })

    it('throws when from missing', async () => {
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587 })
      await expect(p.send({ to: 'a@b.com', subject: 'hi', text: 'hello' })).rejects.toThrow(
        '[courier.email] Missing from address'
      )
    })

    it('uses from from config', async () => {
      const p = new SmtpEmailProvider({
        provider: 'smtp',
        host: 'smtp.example.com',
        port: 587,
        from: 'config@example.com',
      })
      mockSendMail.mockResolvedValue({ messageId: '1' })

      await p.send({ to: 'a@b.com', subject: 'hi', text: 'hello' })
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'config@example.com' }))
    })

    it('uses from from env', async () => {
      process.env.COURIER_EMAIL_FROM = 'env@example.com'
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587 })
      mockSendMail.mockResolvedValue({ messageId: '1' })

      await p.send({ to: 'a@b.com', subject: 'hi', text: 'hello' })
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'env@example.com' }))
    })

    it('passes attachments', async () => {
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587, from: 'noreply@x.com' })
      mockSendMail.mockResolvedValue({ messageId: '1' })

      await p.send({
        to: 'a@b.com',
        subject: 's',
        text: 'body',
        attachments: [{ filename: 'f.pdf', content: Buffer.from('data'), contentType: 'application/pdf' }],
      })

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: 'f.pdf', content: expect.any(Uint8Array), contentType: 'application/pdf' }],
        })
      )
    })

    it('throws on sendMail error', async () => {
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587, from: 'noreply@x.com' })
      mockSendMail.mockRejectedValue(new Error('Connection refused'))

      await expect(p.send({ to: 'a@b.com', subject: 'hi', text: 'hello' })).rejects.toThrow('Connection refused')
    })

    it('passes replyTo, cc, bcc', async () => {
      const p = new SmtpEmailProvider({ provider: 'smtp', host: 'smtp.example.com', port: 587, from: 'noreply@x.com' })
      mockSendMail.mockResolvedValue({ messageId: '1' })

      await p.send({
        to: ['a@b.com', 'b@c.com'],
        cc: 'cc@example.com',
        bcc: ['bcc1@x.com', 'bcc2@y.com'],
        replyTo: 'reply@example.com',
        subject: 's',
        text: 'body',
      })

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['a@b.com', 'b@c.com'],
          cc: ['cc@example.com'],
          bcc: ['bcc1@x.com', 'bcc2@y.com'],
          replyTo: 'reply@example.com',
        })
      )
    })
  })
})
