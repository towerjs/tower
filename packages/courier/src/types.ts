import type { ReactElement } from "react"

/** A single email address or an array of email addresses. */
export type EmailAddress = string | string[]

/** A React component used as an email template (via @react-email/render). */
export type ReactEmailTemplate = ReactElement

/** A file attached to an email. */
export interface EmailAttachment {
  /** Attachment filename shown to the recipient. */
  filename: string
  /** Raw content as a string or binary Uint8Array. */
  content: string | Uint8Array
  /** MIME type (e.g. "image/png"). Inferred from filename if omitted. */
  contentType?: string
  /** Content-ID for inline images (e.g. "logo@tower"). */
  cid?: string
}

/** Parameters for sending an email. */
export interface EmailSendParams {
  /** Primary recipient(s). */
  to: EmailAddress
  /** Email subject line. */
  subject: string
  /** Sender address. Falls back to provider config, then COURIER_EMAIL_FROM. */
  from?: string
  /** Carbon-copy recipient(s). */
  cc?: EmailAddress
  /** Blind carbon-copy recipient(s). */
  bcc?: EmailAddress
  /** Reply-to address. */
  replyTo?: string
  /** Plain-text body. Derived from html if omitted. */
  text?: string
  /** HTML body. Derived from react if omitted. */
  html?: string
  /** React email template (rendered via @react-email/render). */
  react?: ReactEmailTemplate
  /** Custom SMTP headers. */
  headers?: Record<string, string>
  /** File attachments. */
  attachments?: EmailAttachment[]
}

/** Result returned after sending an email. */
export interface EmailSendResult {
  /** Provider-specific message ID. */
  id?: string
  /** Name of the provider that handled the send. */
  provider: EmailProviderName
}

/** Parameters for sending an SMS. */
export interface SmsSendParams {
  /** E.164 recipient phone number. */
  to: string
  /** Message body. */
  body: string
  /** Sender phone number or alphanumeric sender ID. */
  from?: string
}

/** Result returned after sending an SMS. */
export interface SmsSendResult {
  /** Provider-specific message SID. */
  id?: string
  /** Provider-specific status string. */
  status?: string
  /** Name of the provider that handled the send. */
  provider: SmsProviderName
}

/** A Web Push subscription, as returned by the Push API. */
export interface PushSubscription {
  /** Push service endpoint URL. */
  endpoint: string
  /** Cryptographic keys for message encryption. */
  keys: {
    p256dh: string
    auth: string
  }
}

/** Parameters for sending a push notification. */
export interface PushSendParams {
  /** The recipient's push subscription. */
  subscription: PushSubscription
  /** Raw payload string or object. Mutually exclusive with title/body/data. */
  payload?: string | Record<string, unknown>
  /** Notification title (used with body/data when payload is omitted). */
  title?: string
  /** Notification body text. */
  body?: string
  /** Custom data payload. */
  data?: Record<string, unknown>
  /** Time-to-live in seconds. */
  ttl?: number
  /** Urgency hint to the push service. */
  urgency?: "very-low" | "low" | "normal" | "high"
  /** Topic identifier for coalescing notifications. */
  topic?: string
}

/** Result returned after sending a push notification. */
export interface PushSendResult {
  /** HTTP status code from the push service. */
  status?: number
  /** Name of the provider that handled the send. */
  provider: PushProviderName
}

/** Supported email provider names. */
export type EmailProviderName = "resend" | "smtp" | "ses"
/** Supported SMS provider names. */
export type SmsProviderName = "twilio"
/** Supported push provider names. */
export type PushProviderName = "web-push"

interface EmailConfigBase {
  provider: EmailProviderName
  from?: string
}

/** Configuration for the Resend email provider. */
export interface ResendEmailConfig extends EmailConfigBase {
  provider: "resend"
  /** Resend API key. Falls back to RESEND_API_KEY env var. */
  apiKey?: string
}

/** Configuration for the SMTP email provider. */
export interface SmtpEmailConfig extends EmailConfigBase {
  provider: "smtp"
  /** SMTP hostname. Falls back to SMTP_HOST env var. */
  host?: string
  /** SMTP port (default 587). Falls back to SMTP_PORT env var. */
  port?: number
  /** Use TLS (defaults to true when port is 465). */
  secure?: boolean
  /** SMTP username. Falls back to SMTP_USER env var. */
  user?: string
  /** SMTP password. Falls back to SMTP_PASSWORD env var. */
  password?: string
  /** Skip TLS verification. */
  ignoreTLS?: boolean
}

/** Configuration for the AWS SES email provider. */
export interface SesEmailConfig extends EmailConfigBase {
  provider: "ses"
  /** AWS region. Falls back to AWS_REGION or AWS_DEFAULT_REGION. */
  region?: string
  /** AWS access key ID. Falls back to AWS_ACCESS_KEY_ID. */
  accessKeyId?: string
  /** AWS secret access key. Falls back to AWS_SECRET_ACCESS_KEY. */
  secretAccessKey?: string
  /** AWS session token (for temporary credentials). Falls back to AWS_SESSION_TOKEN. */
  sessionToken?: string
  /** SES configuration set name for event tracking. */
  configurationSetName?: string
}

/** Union of all email provider configs. */
export type EmailConfig = ResendEmailConfig | SmtpEmailConfig | SesEmailConfig

interface SmsConfigBase {
  provider: SmsProviderName
  from?: string
}

/** Configuration for the Twilio SMS provider. */
export interface TwilioSmsConfig extends SmsConfigBase {
  provider: "twilio"
  /** Twilio Account SID. Falls back to TWILIO_ACCOUNT_SID. */
  accountSid?: string
  /** Twilio Auth Token. Falls back to TWILIO_AUTH_TOKEN. */
  authToken?: string
  /** Messaging Service SID (alternative to from). Falls back to TWILIO_MESSAGING_SERVICE_SID. */
  messagingServiceSid?: string
}

/** Union of all SMS provider configs. */
export type SmsConfig = TwilioSmsConfig

interface PushConfigBase {
  provider: PushProviderName
}

/** Configuration for the Web Push provider. */
export interface WebPushConfig extends PushConfigBase {
  provider: "web-push"
  /** VAPID keys for push subscription authentication. */
  vapid?: {
    /** Contact URI (mailto: or https://). Falls back to WEB_PUSH_VAPID_SUBJECT. */
    subject?: string
    /** VAPID public key. Falls back to WEB_PUSH_VAPID_PUBLIC_KEY. */
    publicKey?: string
    /** VAPID private key. Falls back to WEB_PUSH_VAPID_PRIVATE_KEY. */
    privateKey?: string
  }
}

/** Union of all push provider configs. */
export type PushConfig = WebPushConfig

/** Top-level courier configuration passed to defineCourier. */
export interface CourierConfig {
  /** Email channel config. Omit to leave email unconfigured. */
  email?: EmailConfig
  /** SMS channel config. Omit to leave SMS unconfigured. */
  sms?: SmsConfig
  /** Push channel config. Omit to leave push unconfigured. */
  push?: PushConfig
}

/** Service interface for sending emails. */
export interface EmailService {
  send(params: EmailSendParams): Promise<EmailSendResult>
}

/** Service interface for sending SMS messages. */
export interface SmsService {
  send(params: SmsSendParams): Promise<SmsSendResult>
}

/** Service interface for sending push notifications. */
export interface PushService {
  send(params: PushSendParams): Promise<PushSendResult>
}

/** Complete courier module exposing all notification channels. */
export interface CourierModule {
  email: EmailService
  sms: SmsService
  push: PushService
}
