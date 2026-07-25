import type { TowerInitContext, TowerModule } from "@towerjs/blueprint"
import { registerModule } from "@towerjs/blueprint"
import { ResendEmailProvider } from "./providers/resend.js"
import { SmtpEmailProvider } from "./providers/smtp.js"
import { SesEmailProvider } from "./providers/ses.js"
import { TwilioSmsProvider } from "./providers/twilio.js"
import { WebPushProvider } from "./providers/web-push.js"
import type {
  CourierConfig,
  CourierModule,
  EmailConfig,
  EmailService,
  PushConfig,
  PushService,
  SmsConfig,
  SmsService,
} from "./types.js"

export type {
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
} from "./types.js"

/** @internal Singleton courier instance, set during tower init. */
let _courier: CourierModule | undefined

/**
 * Proxy that delegates to the initialized courier module.
 * Throws if accessed before tower is started.
 */
export const courier: CourierModule = new Proxy({} as CourierModule, {
  get(_, prop) {
    if (!_courier) {
      throw new Error("Courier not initialized. Tower must be started first.")
    }
    const value = (_courier as any)[prop]
    return typeof value === "function"
      ? (...args: any[]) => (value as Function)(...args)
      : value
  },
})

/**
 * Creates a tower module that registers the courier notification service.
 *
 * Pass the returned object to `modules` in your tower config.
 *
 * @example
 * ```ts
 * defineTower({
 *   modules: [
 *     defineCourier({
 *       email: { provider: "resend" },
 *       sms: { provider: "twilio" },
 *       push: { provider: "web-push" },
 *     }),
 *   ],
 * })
 * ```
 */
export function defineCourier(config: CourierConfig): TowerModule & CourierModule {
  return {
    name: "courier",

    async init(ctx: TowerInitContext) {
      _courier = createCourier(config)
      ctx.container.register("courier", _courier)
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
  } satisfies TowerModule & CourierModule
}

function createCourier(config: CourierConfig): CourierModule {
  const emailProvider = config.email ? createEmailService(config.email) : undefined
  const smsProvider = config.sms ? createSmsService(config.sms) : undefined
  const pushProvider = config.push ? createPushService(config.push) : undefined

  return {
    email: emailProvider ?? unconfiguredChannel("email"),
    sms: smsProvider ?? unconfiguredChannel("sms"),
    push: pushProvider ?? unconfiguredChannel("push"),
  }
}

function requireCourier(): CourierModule {
  if (!_courier) throw new Error("Courier not initialized.")
  return _courier
}

function createEmailService(config: EmailConfig): EmailService {
  switch (config.provider) {
    case "resend":
      return new ResendEmailProvider(config)
    case "smtp":
      return new SmtpEmailProvider(config)
    case "ses":
      return new SesEmailProvider(config)
  }
  throw new Error("Unsupported courier email provider.")
}

function createSmsService(config: SmsConfig): SmsService {
  if (config.provider !== "twilio") {
    throw new Error(`Unsupported courier sms provider: ${String(config.provider)}`)
  }
  return new TwilioSmsProvider(config)
}

function createPushService(config: PushConfig): PushService {
  if (config.provider !== "web-push") {
    throw new Error(`Unsupported courier push provider: ${String(config.provider)}`)
  }
  return new WebPushProvider(config)
}

function unconfiguredChannel(name: "email" | "sms" | "push") {
  return {
    async send() {
      throw new Error(`[courier.${name}] Not configured. Add modules.courier.${name} to tower.config.ts.`)
    },
  }
}

registerModule("courier", (config) => defineCourier(config as CourierConfig))
