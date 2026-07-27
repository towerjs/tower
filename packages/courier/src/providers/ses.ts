import type { EmailSendParams, EmailSendResult, SesEmailConfig } from '../types.js'
import { resolveEmailContent, toAddressList } from './email-shared.js'

export class SesEmailProvider {
  private config: SesEmailConfig
  private _client: any

  constructor(config: SesEmailConfig) {
    this.config = config
  }

  private async client(): Promise<any> {
    if (!this._client) {
      const region =
        this.config.region ??
        (typeof process !== 'undefined' ? (process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION) : undefined)
      if (!region) {
        throw new Error('[courier.email] Missing AWS region. Set modules.courier.email.region or AWS_REGION.')
      }

      const { SESv2Client } = await import('@aws-sdk/client-sesv2')
      this._client = new SESv2Client({
        region,
        credentials:
          this.config.accessKeyId || (typeof process !== 'undefined' ? process.env.AWS_ACCESS_KEY_ID : undefined)
            ? {
                accessKeyId:
                  this.config.accessKeyId ??
                  (typeof process !== 'undefined' ? process.env.AWS_ACCESS_KEY_ID : undefined) ??
                  '',
                secretAccessKey:
                  this.config.secretAccessKey ??
                  (typeof process !== 'undefined' ? process.env.AWS_SECRET_ACCESS_KEY : undefined) ??
                  '',
                sessionToken:
                  this.config.sessionToken ??
                  (typeof process !== 'undefined' ? process.env.AWS_SESSION_TOKEN : undefined),
              }
            : undefined,
      })
    }
    return this._client
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const from =
      params.from ?? this.config.from ?? (typeof process !== 'undefined' ? process.env.COURIER_EMAIL_FROM : undefined)
    if (!from) {
      throw new Error('[courier.email] Missing from address. Set modules.courier.email.from or params.from.')
    }

    const { html, text } = await resolveEmailContent(params)
    const { default: nodemailer } = await import('nodemailer')

    const rawTransporter = nodemailer.createTransport({ jsonTransport: true })
    const rawInfo = await rawTransporter.sendMail({
      from,
      to: toAddressList(params.to),
      subject: params.subject,
      html,
      text,
      cc: toAddressList(params.cc),
      bcc: toAddressList(params.bcc),
      replyTo: params.replyTo,
      headers: params.headers,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: typeof a.content === 'string' ? a.content : (Buffer.from(a.content) as any),
        contentType: a.contentType,
        cid: a.cid,
      })),
    })

    const { SendEmailCommand } = await import('@aws-sdk/client-sesv2')
    const c = await this.client()
    const result = await c.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {
          ToAddresses: toAddressList(params.to),
          CcAddresses: toAddressList(params.cc),
          BccAddresses: toAddressList(params.bcc),
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
        Content: {
          Raw: { Data: new Uint8Array((rawInfo as any).message as Uint8Array) },
        },
        ConfigurationSetName: this.config.configurationSetName,
      })
    )

    return {
      id: result.MessageId,
      provider: 'ses',
    }
  }
}
