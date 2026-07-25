import webpush from "web-push"
import type { PushSendParams, PushSendResult, WebPushConfig } from "../types.js"

export class WebPushProvider {
  constructor(config: WebPushConfig) {
    const subject = config.vapid?.subject ?? process.env.WEB_PUSH_VAPID_SUBJECT
    const publicKey = config.vapid?.publicKey ?? process.env.WEB_PUSH_VAPID_PUBLIC_KEY
    const privateKey = config.vapid?.privateKey ?? process.env.WEB_PUSH_VAPID_PRIVATE_KEY

    if (!subject || !publicKey || !privateKey) {
      throw new Error(
        "[messenger.push] Missing VAPID config. Set modules.messenger.push.vapid.{subject,publicKey,privateKey}.",
      )
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)
  }

  async send(params: PushSendParams): Promise<PushSendResult> {
    const payload = buildPayload(params)
    const result = await webpush.sendNotification(params.subscription, payload, {
      TTL: params.ttl,
      urgency: params.urgency,
      topic: params.topic,
    })

    return {
      status: result.statusCode,
      provider: "web-push",
    }
  }
}

function buildPayload(params: PushSendParams): string {
  if (typeof params.payload === "string") return params.payload
  if (params.payload) return JSON.stringify(params.payload)

  if (!params.title && !params.body && !params.data) {
    throw new Error("[messenger.push] Missing payload. Provide payload or title/body/data fields.")
  }

  return JSON.stringify({
    title: params.title,
    body: params.body,
    data: params.data,
  })
}

