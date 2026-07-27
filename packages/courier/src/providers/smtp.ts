import type { EmailSendParams, EmailSendResult, SmtpEmailConfig } from '../types.js'
import { resolveEmailContent, toAddressList } from './email-shared.js'

export class SmtpEmailProvider {
  private config: SmtpEmailConfig
  private _transporter: any

  constructor(config: SmtpEmailConfig) {
    this.config = config
  }

  private async transporter(): Promise<any> {
    if (!this._transporter) {
      const host = this.config.host ?? (typeof process !== 'undefined' ? process.env.SMTP_HOST : undefined)
      if (!host) {
        throw new Error('[courier.email] Missing SMTP host. Set modules.courier.email.host or SMTP_HOST.')
      }

      const port = this.config.port ?? (typeof process !== 'undefined' ? Number(process.env.SMTP_PORT ?? 587) : 587)
      const user = this.config.user ?? (typeof process !== 'undefined' ? process.env.SMTP_USER : undefined)
      const password = this.config.password ?? (typeof process !== 'undefined' ? process.env.SMTP_PASSWORD : undefined)

      const { default: nodemailer } = await import('nodemailer')
      this._transporter = nodemailer.createTransport({
        host,
        port,
        secure: this.config.secure ?? port === 465,
        ignoreTLS: this.config.ignoreTLS,
        auth: user ? { user, pass: password } : undefined,
      })
    }
    return this._transporter
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const from =
      params.from ?? this.config.from ?? (typeof process !== 'undefined' ? process.env.COURIER_EMAIL_FROM : undefined)
    if (!from) {
      throw new Error('[courier.email] Missing from address. Set modules.courier.email.from or params.from.')
    }

    const { html, text } = await resolveEmailContent(params)
    const t = await this.transporter()
    const info = await t.sendMail({
      from,
      to: toAddressList(params.to),
      subject: params.subject,
      html,
      text,
      cc: toAddressList(params.cc),
      bcc: toAddressList(params.bcc),
      replyTo: params.replyTo,
      headers: params.headers,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: typeof attachment.content === 'string' ? attachment.content : new Uint8Array(attachment.content),
        contentType: attachment.contentType,
        cid: attachment.cid,
      })),
    })

    return {
      id: info.messageId,
      provider: 'smtp',
    }
  }
}
