import { describe, expect, it, vi, beforeEach } from "vitest"
import { defineCourier, courier } from "./index.js"

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

function mockCtx() {
  return {
    container: {
      register: vi.fn(),
      registerFactory: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
    },
    config: { modules: {} },
    runtime: { name: "node-server" as const, isServerless: false },
  }
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.COURIER_EMAIL_FROM
  delete process.env.SMTP_HOST
  delete process.env.SMTP_PORT
  delete process.env.AWS_REGION
  delete process.env.TWILIO_ACCOUNT_SID
  delete process.env.TWILIO_AUTH_TOKEN
  delete process.env.TWILIO_MESSAGING_SERVICE_SID
  delete process.env.WEB_PUSH_VAPID_SUBJECT
  delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY
  delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY
})

function initAndGetModule(config: any) {
  const mod = defineCourier(config)
  const ctx = mockCtx()
  return { mod, ctx }
}

describe("courier singleton proxy", () => {
  it("throws if accessed before init", () => {
    expect(() => courier.email).toThrow("Courier not initialized")
    expect(() => courier.sms).toThrow("Courier not initialized")
    expect(() => courier.push).toThrow("Courier not initialized")
  })

  it("forwards property access through proxy after init", async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: "resend", apiKey: "re_test", from: "noreply@example.com" },
    })
    await mod.init?.(ctx as any)

    expect(typeof courier.email.send).toBe("function")
    expect(typeof courier.sms.send).toBe("function")
    expect(typeof courier.push.send).toBe("function")
  })
})

describe("defineCourier", () => {
  it("returns a module with name and init", () => {
    const mod = defineCourier({})
    expect(mod.name).toBe("courier")
    expect(typeof mod.init).toBe("function")
    expect(typeof mod.email).toBe("object")
    expect(typeof mod.sms).toBe("object")
    expect(typeof mod.push).toBe("object")
  })

  it("registers courier in the container on init", async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.init?.(ctx as any)
    expect(ctx.container.register).toHaveBeenCalledWith("courier", expect.any(Object))
  })

  it("throws unconfigured errors for email when not configured", async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.init?.(ctx as any)
    await expect(courier.email.send({ to: "a@b.com", subject: "x", text: "y" })).rejects.toThrow(
      "[courier.email] Not configured",
    )
  })

  it("throws unconfigured errors for sms when not configured", async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.init?.(ctx as any)
    await expect(courier.sms.send({ to: "+1234", body: "hello" })).rejects.toThrow(
      "[courier.sms] Not configured",
    )
  })

  it("throws unconfigured errors for push when not configured", async () => {
    const { mod, ctx } = initAndGetModule({})
    await mod.init?.(ctx as any)
    await expect(courier.push.send({ subscription: {} as any, payload: "hi" })).rejects.toThrow(
      "[courier.push] Not configured",
    )
  })
})

describe("email provider resolution", () => {
  it("creates Resend provider from config", () => {
    const { mod } = initAndGetModule({
      email: { provider: "resend", apiKey: "re_key", from: "noreply@example.com" },
    })
    expect(mod.email.send).toBeDefined()
  })

  it("creates SMTP provider from config", () => {
    const { mod } = initAndGetModule({
      email: { provider: "smtp", host: "smtp.example.com", port: 587 },
    })
    expect(mod.email.send).toBeDefined()
  })

  it("creates SES provider from config", () => {
    const { mod } = initAndGetModule({
      email: { provider: "ses", region: "us-east-1" },
    })
    expect(mod.email.send).toBeDefined()
  })

  it("throws during init for unsupported email provider", async () => {
    const { mod, ctx } = initAndGetModule({ email: { provider: "mailgun" as any } })
    await expect(mod.init?.(ctx as any)).rejects.toThrow("Unsupported courier email provider")
  })
})

describe("sms provider resolution", () => {
  it("creates Twilio provider from config", () => {
    const { mod } = initAndGetModule({
      sms: { provider: "twilio", accountSid: "ACx", authToken: "tok", messagingServiceSid: "MGx" },
    })
    expect(mod.sms.send).toBeDefined()
  })

  it("throws during init for unsupported sms provider", async () => {
    const { mod, ctx } = initAndGetModule({ sms: { provider: "vonage" as any } })
    await expect(mod.init?.(ctx as any)).rejects.toThrow("Unsupported courier sms provider")
  })
})

describe("push provider resolution", () => {
  it("creates Web Push provider from config", () => {
    const { mod } = initAndGetModule({
      push: { provider: "web-push", vapid: { subject: "mailto:x@y.com", publicKey: "pub", privateKey: "priv" } },
    })
    expect(mod.push.send).toBeDefined()
  })

  it("throws during init for unsupported push provider", async () => {
    const { mod, ctx } = initAndGetModule({ push: { provider: "firebase" as any } })
    await expect(mod.init?.(ctx as any)).rejects.toThrow("Unsupported courier push provider")
  })
})

describe("multiple channels", () => {
  it("configures all three channels simultaneously", async () => {
    const { mod, ctx } = initAndGetModule({
      email: { provider: "resend", apiKey: "re_test", from: "noreply@example.com" },
      sms: { provider: "twilio", accountSid: "ACx", authToken: "tok", messagingServiceSid: "MGx" },
      push: { provider: "web-push", vapid: { subject: "mailto:x@y.com", publicKey: "pub", privateKey: "priv" } },
    })
    await mod.init?.(ctx as any)

    expect(typeof courier.email.send).toBe("function")
    expect(typeof courier.sms.send).toBe("function")
    expect(typeof courier.push.send).toBe("function")
  })
})
