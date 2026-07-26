import { Resend } from 'resend'
import type { EmailSendParams, EmailSendResult, ResendEmailConfig } from '../types.js'
import { toAddressList } from './email-shared.js'

/** Email provider that sends via the Resend API. */
export class ResendEmailProvider {
  private client: Resend
  private from?: string

  constructor(config: ResendEmailConfig) {
    const apiKey = config.apiKey ?? process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('[courier.email] Missing RESEND_API_KEY for resend provider.')
    }
    this.client = new Resend(apiKey)
    this.from = config.from ?? process.env.COURIER_EMAIL_FROM
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const from = params.from ?? this.from
    if (!from) {
      throw new Error('[courier.email] Missing from address. Set modules.courier.email.from or params.from.')
    }

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

    const result = await this.client.emails.send(payload as any)
    if (result.error) {
      throw new Error(`[courier.email] ${result.error.message}`)
    }

    return {
      id: result.data?.id,
      provider: 'resend',
    }
  }
}
