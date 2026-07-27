import type { EmailSendParams, EmailSendResult, ResendEmailConfig } from '../types.js'
import { toAddressList } from './email-shared.js'

export class ResendEmailProvider {
  private config: ResendEmailConfig
  private _client: any

  constructor(config: ResendEmailConfig) {
    this.config = config
  }

  private async client(): Promise<any> {
    if (!this._client) {
      const apiKey = this.config.apiKey ?? (typeof process !== 'undefined' ? process.env.RESEND_API_KEY : undefined)
      if (!apiKey) {
        throw new Error('[courier.email] Missing RESEND_API_KEY for resend provider.')
      }
      const { Resend } = await import('resend')
      this._client = new Resend(apiKey)
    }
    return this._client
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const from =
      params.from ?? this.config.from ?? (typeof process !== 'undefined' ? process.env.COURIER_EMAIL_FROM : undefined)
    if (!from) {
      throw new Error('[courier.email] Missing from address. Set modules.courier.email.from or params.from.')
    }

    const c = await this.client()
    const payload: Record<string, unknown> = {
      from,
      to: toAddressList(params.to),
      subject: params.subject,
      text: params.text,
      html: params.html,
      react: params.react,
      cc: toAddressList(params.cc),
      bcc: toAddressList(params.bcc),
      replyTo: params.replyTo,
      headers: params.headers,
      attachments: params.attachments,
    }

    const result = await c.emails.send(payload as any)
    if (result.error) {
      throw new Error(`[courier.email] ${result.error.message}`)
    }

    return {
      id: result.data?.id,
      provider: 'resend',
    }
  }
}
