import type { SmsSendParams, SmsSendResult, TwilioSmsConfig } from '../types.js'

export class TwilioSmsProvider {
  private config: TwilioSmsConfig
  private _client: any

  constructor(config: TwilioSmsConfig) {
    this.config = config
  }

  private async client(): Promise<any> {
    if (!this._client) {
      const { default: twilio } = await import('twilio')
      const accountSid =
        this.config.accountSid ?? (typeof process !== 'undefined' ? process.env.TWILIO_ACCOUNT_SID : undefined)
      const authToken =
        this.config.authToken ?? (typeof process !== 'undefined' ? process.env.TWILIO_AUTH_TOKEN : undefined)
      if (!accountSid || !authToken) {
        throw new Error('[courier.sms] Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
      }
      this._client = twilio(accountSid, authToken)
    }
    return this._client
  }

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const body = params.body.trim()
    if (!body) {
      throw new Error('[courier.sms] Message body must not be empty.')
    }

    const from =
      params.from ?? this.config.from ?? (typeof process !== 'undefined' ? process.env.COURIER_SMS_FROM : undefined)
    const messagingServiceSid =
      this.config.messagingServiceSid ??
      (typeof process !== 'undefined' ? process.env.TWILIO_MESSAGING_SERVICE_SID : undefined)

    if (!from && !messagingServiceSid) {
      throw new Error(
        '[courier.sms] Missing sender. Set modules.courier.sms.from or modules.courier.sms.messagingServiceSid.'
      )
    }

    const c = await this.client()
    const result = await c.messages.create({
      to: params.to,
      body,
      from,
      messagingServiceSid,
    })

    return {
      id: result.sid,
      status: result.status,
      provider: 'twilio',
    }
  }
}
