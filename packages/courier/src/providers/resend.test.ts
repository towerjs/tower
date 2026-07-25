import { describe, expect, it, vi, beforeEach } from "vitest"
import { ResendEmailProvider } from "./resend.js"

const { mockResendCreate } = vi.hoisted(() => ({
  mockResendCreate: vi.fn(),
}))

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mockResendCreate }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.RESEND_API_KEY
  delete process.env.COURIER_EMAIL_FROM
})

describe("ResendEmailProvider", () => {
  describe("constructor", () => {
    it("uses apiKey from config", () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_config123" })
      expect(p).toBeInstanceOf(ResendEmailProvider)
    })

    it("uses apiKey from env", () => {
      process.env.RESEND_API_KEY = "re_env456"
      const p = new ResendEmailProvider({ provider: "resend" })
      expect(p).toBeInstanceOf(ResendEmailProvider)
    })

    it("throws when apiKey missing", () => {
      expect(() => new ResendEmailProvider({ provider: "resend" })).toThrow("[courier.email] Missing RESEND_API_KEY")
    })
  })

  describe("send", () => {
    it("uses from from config when params omit it", async () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_key", from: "config@example.com" })
      mockResendCreate.mockResolvedValue({ data: { id: "email_123" }, error: null })

      await p.send({ to: "a@b.com", subject: "hi", text: "hello" })
      expect(mockResendCreate).toHaveBeenCalledWith(
        expect.objectContaining({ from: "config@example.com" }),
      )
    })

    it("uses from from params", async () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_key", from: "noreply@config.com" })
      mockResendCreate.mockResolvedValue({ data: { id: "email_123" }, error: null })

      await p.send({ from: "custom@example.com", to: "a@b.com", subject: "hi", text: "hello" })
      expect(mockResendCreate).toHaveBeenCalledWith(
        expect.objectContaining({ from: "custom@example.com" }),
      )
    })

    it("throws when both config and params lack from", async () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_key" })
      await expect(p.send({ to: "a@b.com", subject: "hi", text: "hello" })).rejects.toThrow(
        "[courier.email] Missing from address. Set modules.courier.email.from or params.from.",
      )
    })

    it("returns id on success", async () => {
      process.env.RESEND_API_KEY = "re_key"
      process.env.COURIER_EMAIL_FROM = "noreply@example.com"
      const p = new ResendEmailProvider({ provider: "resend" } as any)
      mockResendCreate.mockResolvedValue({ data: { id: "email_abc" }, error: null })

      const result = await p.send({ to: "a@b.com", subject: "hi", text: "world" })
      expect(result).toEqual({ id: "email_abc", provider: "resend" })
    })

    it("throws on Resend error", async () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_key", from: "noreply@example.com" })
      mockResendCreate.mockResolvedValue({ data: null, error: { message: "Rate limited" } })

      await expect(
        p.send({ to: "a@b.com", subject: "hi", text: "world" }),
      ).rejects.toThrow("[courier.email] Rate limited")
    })

    it("passes html and text correctly", async () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_key", from: "noreply@example.com" })
      mockResendCreate.mockResolvedValue({ data: { id: "1" }, error: null })

      await p.send({ to: "a@b.com", subject: "s", html: "<p>html</p>", text: "text" })
      expect(mockResendCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>html</p>",
          text: "text",
        }),
      )
    })

    it("passes attachments", async () => {
      const p = new ResendEmailProvider({ provider: "resend", apiKey: "re_key", from: "noreply@example.com" })
      mockResendCreate.mockResolvedValue({ data: { id: "1" }, error: null })

      await p.send({
        to: "a@b.com",
        subject: "s",
        text: "body",
        attachments: [
          { filename: "file.pdf", content: Buffer.from("pdf data"), contentType: "application/pdf" },
        ],
      })
      expect(mockResendCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [{ filename: "file.pdf", content: expect.any(Buffer), contentType: "application/pdf" }],
        }),
      )
    })
  })
})
