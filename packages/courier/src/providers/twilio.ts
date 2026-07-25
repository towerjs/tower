import twilio from "twilio"
import type { SmsSendParams, SmsSendResult, TwilioSmsConfig } from "../types.js"

/** SMS provider that sends via the Twilio API. */
export class TwilioSmsProvider {
  private from?: string
  private messagingServiceSid?: string
  private client: ReturnType<typeof twilio>

  constructor(config: TwilioSmsConfig) {
    const accountSid = config.accountSid ?? process.env.TWILIO_ACCOUNT_SID
    const authToken = config.authToken ?? process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      throw new Error("[courier.sms] Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.")
    }

    this.client = twilio(accountSid, authToken)
    this.from = config.from ?? process.env.COURIER_SMS_FROM
    this.messagingServiceSid = config.messagingServiceSid ?? process.env.TWILIO_MESSAGING_SERVICE_SID
  }

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const body = params.body.trim()
    if (!body) {
      throw new Error("[courier.sms] Message body must not be empty.")
    }

    const from = params.from ?? this.from
    if (!from && !this.messagingServiceSid) {
      throw new Error(
        "[courier.sms] Missing sender. Set modules.courier.sms.from or modules.courier.sms.messagingServiceSid.",
      )
    }

    const result = await this.client.messages.create({
      to: params.to,
      body,
      from,
      messagingServiceSid: this.messagingServiceSid,
    })

    return {
      id: result.sid,
      status: result.status,
      provider: "twilio",
    }
  }
}
