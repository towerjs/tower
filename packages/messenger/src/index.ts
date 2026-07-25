import type { TowerInitContext, TowerModule } from "@towerjs/blueprint"
import { registerModule } from "@towerjs/blueprint"
import { ResendEmailProvider } from "./providers/resend.js"
import { SmtpEmailProvider } from "./providers/smtp.js"
import { SesEmailProvider } from "./providers/ses.js"
import { TwilioSmsProvider } from "./providers/twilio.js"
import { WebPushProvider } from "./providers/web-push.js"
import type {
  EmailConfig,
  EmailService,
  MessengerConfig,
  MessengerModule,
  PushConfig,
  PushService,
  SmsConfig,
  SmsService,
} from "./types.js"

export type {
  EmailAddress,
  EmailAttachment,
  EmailConfig,
  EmailProviderName,
  EmailSendParams,
  EmailSendResult,
  EmailService,
  MessengerConfig,
  MessengerModule,
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

let _messenger: MessengerModule | undefined

export const messenger: MessengerModule = new Proxy({} as MessengerModule, {
  get(_, prop) {
    if (!_messenger) {
      throw new Error("Messenger not initialized. Tower must be started first.")
    }
    const value = (_messenger as any)[prop]
    return typeof value === "function"
      ? (...args: any[]) => (value as Function)(...args)
      : value
  },
})

export function defineMessenger(config: MessengerConfig): TowerModule & MessengerModule {
  return {
    name: "messenger",

    async init(ctx: TowerInitContext) {
      _messenger = createMessenger(config)
      ctx.container.register("messenger", _messenger)
    },

    get email() {
      return requireMessenger().email
    },

    get sms() {
      return requireMessenger().sms
    },

    get push() {
      return requireMessenger().push
    },
  } satisfies TowerModule & MessengerModule
}

function createMessenger(config: MessengerConfig): MessengerModule {
  const emailProvider = config.email ? createEmailService(config.email) : undefined
  const smsProvider = config.sms ? createSmsService(config.sms) : undefined
  const pushProvider = config.push ? createPushService(config.push) : undefined

  return {
    email: emailProvider ?? unconfiguredChannel("email"),
    sms: smsProvider ?? unconfiguredChannel("sms"),
    push: pushProvider ?? unconfiguredChannel("push"),
  }
}

function requireMessenger(): MessengerModule {
  if (!_messenger) throw new Error("Messenger not initialized.")
  return _messenger
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
  throw new Error("Unsupported messenger email provider.")
}

function createSmsService(config: SmsConfig): SmsService {
  if (config.provider !== "twilio") {
    throw new Error(`Unsupported messenger sms provider: ${String(config.provider)}`)
  }
  return new TwilioSmsProvider(config)
}

function createPushService(config: PushConfig): PushService {
  if (config.provider !== "web-push") {
    throw new Error(`Unsupported messenger push provider: ${String(config.provider)}`)
  }
  return new WebPushProvider(config)
}

function unconfiguredChannel(name: "email" | "sms" | "push") {
  return {
    async send() {
      throw new Error(`[messenger.${name}] Not configured. Add modules.messenger.${name} to tower.config.ts.`)
    },
  }
}

registerModule("messenger", (config) => defineMessenger(config as MessengerConfig))
