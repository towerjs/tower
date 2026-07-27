import type { PushSendParams, PushSendResult, WebPushConfig } from '../types.js'

export class WebPushProvider {
  private config: WebPushConfig
  private _initialized = false

  constructor(config: WebPushConfig) {
    this.config = config
  }

  private async ensureInitialized(): Promise<void> {
    if (this._initialized) return
    const subject =
      this.config.vapid?.subject ?? (typeof process !== 'undefined' ? process.env.WEB_PUSH_VAPID_SUBJECT : undefined)
    const publicKey =
      this.config.vapid?.publicKey ??
      (typeof process !== 'undefined' ? process.env.WEB_PUSH_VAPID_PUBLIC_KEY : undefined)
    const privateKey =
      this.config.vapid?.privateKey ??
      (typeof process !== 'undefined' ? process.env.WEB_PUSH_VAPID_PRIVATE_KEY : undefined)

    if (!subject || !publicKey || !privateKey) {
      throw new Error(
        '[courier.push] Missing VAPID config. Set modules.courier.push.vapid.{subject,publicKey,privateKey}.'
      )
    }

    const webpush = await import('web-push')
    webpush.setVapidDetails(subject, publicKey, privateKey)
    this._initialized = true
  }

  async send(params: PushSendParams): Promise<PushSendResult> {
    await this.ensureInitialized()
    const webpush = await import('web-push')
    const payload = buildPayload(params)
    const result = await webpush.sendNotification(params.subscription, payload, {
      TTL: params.ttl,
      urgency: params.urgency,
      topic: params.topic,
    })

    return {
      status: result.statusCode,
      provider: 'web-push',
    }
  }
}

function buildPayload(params: PushSendParams): string {
  if (typeof params.payload === 'string') return params.payload
  if (params.payload) return JSON.stringify(params.payload)

  if (!params.title && !params.body && !params.data) {
    throw new Error('[courier.push] Missing payload. Provide payload or title/body/data fields.')
  }

  return JSON.stringify({
    title: params.title,
    body: params.body,
    data: params.data,
  })
}
