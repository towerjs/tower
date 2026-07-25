import type { ReactElement } from "react"

export type EmailAddress = string | string[]

/** A React email component rendered via @react-email/render. */
export type ReactEmailTemplate = ReactElement

/** A file attached to an email. */
export interface EmailAttachment {
  filename: string
  content: string | Uint8Array
  contentType?: string
  cid?: string
}

/** Parameters for sending an email. Supports plain text, HTML, React templates, and attachments. */
export interface EmailSendParams {
  to: EmailAddress
  subject: string
  from?: string
  cc?: EmailAddress
  bcc?: EmailAddress
  replyTo?: string
  text?: string
  html?: string
  react?: ReactEmailTemplate
  headers?: Record<string, string>
  attachments?: EmailAttachment[]
}

export interface EmailSendResult {
  id?: string
  provider: EmailProviderName
}

export interface SmsSendParams {
  to: string
  body: string
  from?: string
}

export interface SmsSendResult {
  id?: string
  status?: string
  provider: SmsProviderName
}

/** A Web Push subscription from the Push API. */
export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/** Parameters for sending a push notification. Supports a raw payload or title/body/data shorthand. */
export interface PushSendParams {
  subscription: PushSubscription
  payload?: string | Record<string, unknown>
  title?: string
  body?: string
  data?: Record<string, unknown>
  ttl?: number
  urgency?: "very-low" | "low" | "normal" | "high"
  topic?: string
}

export interface PushSendResult {
  status?: number
  provider: PushProviderName
}

export type EmailProviderName = "resend" | "smtp" | "ses"
export type SmsProviderName = "twilio"
export type PushProviderName = "web-push"

interface EmailConfigBase {
  provider: EmailProviderName
  from?: string
}

export interface ResendEmailConfig extends EmailConfigBase {
  provider: "resend"
  apiKey?: string
}

export interface SmtpEmailConfig extends EmailConfigBase {
  provider: "smtp"
  host?: string
  port?: number
  secure?: boolean
  user?: string
  password?: string
  ignoreTLS?: boolean
}

export interface SesEmailConfig extends EmailConfigBase {
  provider: "ses"
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  configurationSetName?: string
}

export type EmailConfig = ResendEmailConfig | SmtpEmailConfig | SesEmailConfig

interface SmsConfigBase {
  provider: SmsProviderName
  from?: string
}

export interface TwilioSmsConfig extends SmsConfigBase {
  provider: "twilio"
  accountSid?: string
  authToken?: string
  messagingServiceSid?: string
}

export type SmsConfig = TwilioSmsConfig

interface PushConfigBase {
  provider: PushProviderName
}

export interface WebPushConfig extends PushConfigBase {
  provider: "web-push"
  vapid?: {
    subject?: string
    publicKey?: string
    privateKey?: string
  }
}

export type PushConfig = WebPushConfig

/** Courier module configuration. Omit a channel to leave it unconfigured. */
export interface CourierConfig {
  email?: EmailConfig
  sms?: SmsConfig
  push?: PushConfig
}

export interface EmailService {
  send(params: EmailSendParams): Promise<EmailSendResult>
}

export interface SmsService {
  send(params: SmsSendParams): Promise<SmsSendResult>
}

export interface PushService {
  send(params: PushSendParams): Promise<PushSendResult>
}

/** Complete courier module with typed email, sms, and push channels. */
export interface CourierModule {
  email: EmailService
  sms: SmsService
  push: PushService
}
