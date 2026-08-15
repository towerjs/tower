import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SesEmailProvider } from './ses.js'

const { mockSesSend, mockNodemailerSendMail } = vi.hoisted(() => ({
  mockSesSend: vi.fn(),
  mockNodemailerSendMail: vi.fn(),
}))

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    send = mockSesSend
  },
  SendEmailCommand: class {
    constructor(args: any) {
      return args
    }
  },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockNodemailerSendMail })),
  },
  createTransport: vi.fn(() => ({ sendMail: mockNodemailerSendMail })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.AWS_REGION
  delete process.env.AWS_DEFAULT_REGION
  delete process.env.AWS_ACCESS_KEY_ID
  delete process.env.AWS_SECRET_ACCESS_KEY
  delete process.env.COURIER_EMAIL_FROM
})

describe('SesEmailProvider', () => {
  describe('constructor', () => {
    it('uses region from config', () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1' })
      expect(p).toBeInstanceOf(SesEmailProvider)
    })

    it('uses region from env', () => {
      process.env.AWS_REGION = 'eu-west-1'
      const p = new SesEmailProvider({ provider: 'ses' })
      expect(p).toBeInstanceOf(SesEmailProvider)
    })

    it('uses AWS_DEFAULT_REGION fallback', () => {
      process.env.AWS_DEFAULT_REGION = 'ap-southeast-2'
      const p = new SesEmailProvider({ provider: 'ses' })
      expect(p).toBeInstanceOf(SesEmailProvider)
    })

    it('throws when region missing', async () => {
      const p = new SesEmailProvider({ provider: 'ses' })
      await expect(p.send({ from: 'a@b.com', to: 'a@b.com', subject: 'x', text: 'y' })).rejects.toThrow(
        '[courier.email] Missing AWS region'
      )
    })
  })

  describe('send', () => {
    it('sends via Raw content using nodemailer', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'noreply@example.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw mime', 'utf-8') })
      mockSesSend.mockResolvedValue({ MessageId: 'ses123' })

      const result = await p.send({
        to: 'a@b.com',
        subject: 'Hello',
        html: '<p>html</p>',
      })

      const command = mockSesSend.mock.calls[0][0]
      expect(command.Content.Raw).toBeDefined()
      expect(command.Content.Raw.Data).toBeInstanceOf(Uint8Array)
      expect(result).toEqual({ id: 'ses123', provider: 'ses' })
    })

    it('passes body parts to nodemailer', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'noreply@example.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw', 'utf-8') })
      mockSesSend.mockResolvedValue({ MessageId: '1' })

      await p.send({ to: 'a@b.com', subject: 'S', html: '<p>html</p>', text: 'text' })

      expect(mockNodemailerSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          subject: 'S',
          html: '<p>html</p>',
          text: 'text',
        })
      )
    })

    it('passes attachments to nodemailer', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'noreply@example.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw', 'utf-8') })
      mockSesSend.mockResolvedValue({ MessageId: '1' })

      await p.send({
        to: 'a@b.com',
        subject: 'S',
        text: 'body',
        attachments: [{ filename: 'f.pdf', content: Buffer.from('data'), contentType: 'application/pdf' }],
      })

      expect(mockNodemailerSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: 'f.pdf', content: expect.any(Buffer), contentType: 'application/pdf' }],
        })
      )
    })

    it('creates Raw with Uint8Array', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'noreply@example.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw mime', 'utf-8') })
      mockSesSend.mockResolvedValue({ MessageId: 'ses456' })

      const result = await p.send({
        to: 'a@b.com',
        subject: 'Hello',
        text: 'body',
        attachments: [{ filename: 'f.pdf', content: Buffer.from('data') }],
      })

      const command = mockSesSend.mock.calls[0][0]
      expect(command.Content.Raw.Data).toBeInstanceOf(Uint8Array)
      expect(result).toEqual({ id: 'ses456', provider: 'ses' })
    })

    it('throws when from missing', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1' })
      await expect(p.send({ to: 'a@b.com', subject: 'hi', text: 'hello' })).rejects.toThrow(
        '[courier.email] Missing from address'
      )
    })

    it('uses from from config', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'config@example.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw', 'utf-8') })
      mockSesSend.mockResolvedValue({ MessageId: '1' })

      await p.send({ to: 'a@b.com', subject: 's', text: 'body' })
      const command = mockSesSend.mock.calls[0][0]
      expect(command.FromEmailAddress).toBe('config@example.com')
    })

    it('passes destination details to SES command', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'noreply@x.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw', 'utf-8') })
      mockSesSend.mockResolvedValue({ MessageId: '1' })

      await p.send({
        to: ['a@b.com', 'b@c.com'],
        cc: 'cc@x.com',
        bcc: ['bcc1@y.com'],
        replyTo: 'reply@x.com',
        subject: 's',
        text: 'body',
      })

      const command = mockSesSend.mock.calls[0][0]
      expect(command.Destination.ToAddresses).toEqual(['a@b.com', 'b@c.com'])
      expect(command.Destination.CcAddresses).toEqual(['cc@x.com'])
      expect(command.Destination.BccAddresses).toEqual(['bcc1@y.com'])
      expect(command.ReplyToAddresses).toEqual(['reply@x.com'])
    })

    it('throws on SES send error', async () => {
      const p = new SesEmailProvider({ provider: 'ses', region: 'us-east-1', from: 'noreply@x.com' })
      mockNodemailerSendMail.mockResolvedValue({ message: Buffer.from('raw', 'utf-8') })
      mockSesSend.mockRejectedValue(new Error('AccessDenied'))

      await expect(p.send({ to: 'a@b.com', subject: 's', text: 'body' })).rejects.toThrow('AccessDenied')
    })
  })
})
