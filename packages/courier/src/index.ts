import type { TowerContext, TowerModule } from '@towerjs/tower/foundation'
import { createLazyModule } from '@towerjs/tower/runtime'

import { z } from 'zod'

import { emailSendSchema, parseCourierConfig, parseSendParams, pushSendSchema, smsSendSchema } from './schemas.js'
import type {
  CourierConfig,
  CourierModule,
  EmailConfig,
  EmailService,
  PushConfig,
  PushService,
  SmsConfig,
  SmsService,
} from './types.js'

export type {
  ConsoleEmailConfig,
  CourierConfig,
  CourierModule,
  EmailAddress,
  EmailAttachment,
  EmailConfig,
  EmailProviderName,
  EmailSendParams,
  EmailSendResult,
  EmailService,
  PushConfig,
  PushProviderName,
  PushSendParams,
  PushSendResult,
  PushService,
  PushSubscription,
  ReactEmailTemplate,
  ResendEmailConfig,
  SesEmailConfig,
  SmsConfig,
  SmsProviderName,
  SmsSendParams,
  SmsSendResult,
  SmsService,
  SmtpEmailConfig,
  TwilioSmsConfig,
  WebPushConfig,
} from './types.js'

/** @internal Singleton courier instance, set during tower init. */
let _courier: CourierModule | undefined

/**
 * Creates a Tower module definition for Courier.
 *
 * @example
 * ```ts
 * import { courier } from '@towerjs/courier'
 * import { defineTower } from '@towerjs/tower'
 *
 * export default defineTower({
 *   modules: [
 *     courier({
 *       email: { provider: 'resend' },
 *       sms: { provider: 'twilio' },
 *       push: { provider: 'web-push' },
 *     }),
 *   ],
 * })
 * ```
 */
function createCourierModuleDefinition(
  config: CourierConfig
): TowerModule & CourierModule & { init: (ctx: TowerContext) => Promise<void> } {
  parseCourierConfig(config)

  return {
    name: 'courier',
    dependsOn: [],

    async initialize(ctx: TowerContext) {
      _courier = await createCourier(config)
      ctx.services.register('courier', courierRuntime)
    },

    get email() {
      return requireCourier().email
    },

    get sms() {
      return requireCourier().sms
    },

    get push() {
      return requireCourier().push
    },

    init(ctx: TowerContext) {
      return this.initialize!(ctx)
    },
  } satisfies TowerModule & CourierModule & { init: (ctx: TowerContext) => Promise<void> }
}

async function createCourier(config: CourierConfig): Promise<CourierModule> {
  const emailProvider = config.email ? await createEmailService(config.email) : undefined
  const smsProvider = config.sms ? await createSmsService(config.sms) : undefined
  const pushProvider = config.push ? await createPushService(config.push) : undefined

  return {
    email: emailProvider ? validateChannel('email', emailProvider) : unconfiguredChannel('email'),
    sms: smsProvider ? validateChannel('sms', smsProvider) : unconfiguredChannel('sms'),
    push: pushProvider ? validateChannel('push', pushProvider) : unconfiguredChannel('push'),
  }
}

type SendService = { send(params: unknown): Promise<unknown> }

function validateChannel<T extends SendService>(channel: 'email' | 'sms' | 'push', service: T): T {
  const schema = channel === 'email' ? emailSendSchema : channel === 'sms' ? smsSendSchema : pushSendSchema
  return {
    ...service,
    async send(params: unknown) {
      return service.send(parseSendParams(schema as z.ZodType<unknown>, channel, params))
    },
  } as T
}

function requireCourier(): CourierModule {
  if (!_courier) throw new Error('Courier not initialized.')
  return _courier
}

async function createEmailService(config: EmailConfig): Promise<EmailService> {
  switch (config.provider) {
    case 'resend': {
      const { ResendEmailProvider } = await import('./providers/resend.js')
      return new ResendEmailProvider(config)
    }
    case 'smtp': {
      const { SmtpEmailProvider } = await import('./providers/smtp.js')
      return new SmtpEmailProvider(config)
    }
    case 'ses': {
      const { SesEmailProvider } = await import('./providers/ses.js')
      return new SesEmailProvider(config)
    }
    case 'console': {
      const { ConsoleEmailProvider } = await import('./providers/console.js')
      return new ConsoleEmailProvider(config)
    }
  }
  throw new Error('Unsupported courier email provider.')
}

async function createSmsService(config: SmsConfig): Promise<SmsService> {
  if (config.provider !== 'twilio') {
    throw new Error(`Unsupported courier sms provider: ${String(config.provider)}`)
  }
  const { TwilioSmsProvider } = await import('./providers/twilio.js')
  return new TwilioSmsProvider(config)
}

async function createPushService(config: PushConfig): Promise<PushService> {
  if (config.provider !== 'web-push') {
    throw new Error(`Unsupported courier push provider: ${String(config.provider)}`)
  }
  const { WebPushProvider } = await import('./providers/web-push.js')
  return new WebPushProvider(config)
}

function unconfiguredChannel(name: 'email' | 'sms' | 'push') {
  return {
    async send() {
      throw new Error(`[courier.${name}] Not configured. Add modules.courier.${name} to tower.config.ts.`)
    },
  }
}

const courierRuntime = createLazyModule<CourierModule>('courier')

/**
 * Courier module - callable for config, property face for runtime API.
 *
 * Usage:
 * ```ts
 * // In tower.config.ts - config factory
 * import { courier } from '@towerjs/courier'
 * export default defineTower({ modules: [courier({ email: { provider: 'resend' } })] })
 * ```
 *
 * ```ts
 * // In application code - runtime API
 * import { courier } from '@towerjs/courier'
 * await courier.email.send({ to: 'user@example.com', subject: 'Hello', text: 'World' })
 * ```
 */
export const courier = new Proxy(createCourierModuleDefinition, {
  get(_target, prop) {
    // The call face returns the module definition
    if (prop === 'apply' || prop === 'name' || prop === 'length') {
      return (_target as any)[prop]
    }
    if (
      prop === 'then' ||
      typeof prop === 'symbol' ||
      prop === 'toString' ||
      prop === 'valueOf' ||
      prop === 'toJSON' ||
      prop === 'inspect'
    )
      return undefined
    // Hermetic tests set _courier directly via mod.init; use it if available
    if (_courier) return (_courier as any)[prop]
    if (prop === 'email' || prop === 'sms' || prop === 'push') {
      throw new Error('Courier not initialized.')
    }
    // Property face delegates to the lazy runtime proxy
    return (courierRuntime as any)[prop]
  },
  apply(_target, _thisArg, args: unknown[]) {
    return (_target as (...args: unknown[]) => unknown)(...args)
  },
}) as ((config: CourierConfig) => TowerModule & CourierModule & { init: (ctx: TowerContext) => Promise<void> }) &
  CourierModule

// Legacy aliases for hermetic tests — internal, not part of public contract
export const defineCourier = createCourierModuleDefinition
export const createCourierModule = createCourierModuleDefinition
