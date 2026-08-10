import { z } from 'zod'
import type {
  CourierConfig,
  EmailConfig,
  EmailSendParams,
  PushConfig,
  PushSendParams,
  ReactEmailTemplate,
  SmsConfig,
  SmsSendParams,
} from './types.js'

function validateReactElement(value: unknown): value is { $$typeof: unknown } {
  return typeof value === 'object' && value !== null && '$$typeof' in value
}

/**
 * zod schemas backing Courier's send params and module config.
 *
 * Send params are validated at the module boundary (before provider SDKs),
 * and config is validated when the module initializes — failing fast with
 * a clear message instead of surfacing provider-specific errors.
 */

const emailAddressSchema = z.union([z.string(), z.array(z.string())])

const attachmentSchema = z.object({
  filename: z.string(),
  content: z.union([z.string(), z.custom<Uint8Array>((v) => v instanceof Uint8Array)]),
  contentType: z.string().optional(),
  cid: z.string().optional(),
})

const reactElementSchema = z.custom<ReactEmailTemplate>(validateReactElement, 'must be a React element')

export const emailSendSchema: z.ZodType<EmailSendParams> = z
  .object({
    to: emailAddressSchema,
    subject: z.string(),
    from: z.string().optional(),
    cc: emailAddressSchema.optional(),
    bcc: emailAddressSchema.optional(),
    replyTo: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    react: reactElementSchema.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    attachments: z.array(attachmentSchema).optional(),
  })
  .refine((params) => Boolean(params.text || params.html || params.react), {
    message: 'Email must include text, html, or a react template.',
  })

export const smsSendSchema: z.ZodType<SmsSendParams> = z.object({
  to: z.string(),
  body: z.string(),
  from: z.string().optional(),
})

export const pushSendSchema: z.ZodType<PushSendParams> = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
  payload: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  ttl: z.number().int().nonnegative().optional(),
  urgency: z.enum(['very-low', 'low', 'normal', 'high']).optional(),
  topic: z.string().optional(),
})

const emailConfigSchema: z.ZodType<EmailConfig> = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('resend'),
      apiKey: z.string().optional(),
      from: z.string().optional(),
    })
    .strict(),
  z
    .object({
      provider: z.literal('smtp'),
      host: z.string().optional(),
      port: z.number().int().nonnegative().optional(),
      secure: z.boolean().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      ignoreTLS: z.boolean().optional(),
      from: z.string().optional(),
    })
    .strict(),
  z
    .object({
      provider: z.literal('ses'),
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      sessionToken: z.string().optional(),
      configurationSetName: z.string().optional(),
      from: z.string().optional(),
    })
    .strict(),
  z
    .object({
      provider: z.literal('console'),
      from: z.string().optional(),
    })
    .strict(),
])

const smsConfigSchema: z.ZodType<SmsConfig> = z
  .object({
    provider: z.literal('twilio'),
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    messagingServiceSid: z.string().optional(),
    from: z.string().optional(),
  })
  .strict()

const pushConfigSchema: z.ZodType<PushConfig> = z
  .object({
    provider: z.literal('web-push'),
    vapid: z
      .object({
        subject: z.string().optional(),
        publicKey: z.string().optional(),
        privateKey: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const courierConfigSchema: z.ZodType<CourierConfig> = z
  .object({
    email: emailConfigSchema.optional(),
    sms: smsConfigSchema.optional(),
    push: pushConfigSchema.optional(),
  })
  .strict()

/** Validates courier module config, prefixing errors with the module name. */
export function parseCourierConfig(config: CourierConfig): CourierConfig {
  try {
    return courierConfigSchema.parse(config)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`[courier] Invalid configuration: ${err.message}`)
    }
    throw err
  }
}

/** Validates send params for a single channel, prefixing errors with the channel. */
export function parseSendParams<T>(schema: z.ZodType<T>, channel: 'email' | 'sms' | 'push', params: unknown): T {
  const result = schema.safeParse(params)
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'params'}: ${issue.message}`)
      .join('; ')
    throw new Error(`[courier.${channel}] Invalid send params — ${detail}`)
  }
  return result.data
}
