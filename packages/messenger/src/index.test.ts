import { describe, expect, it, vi } from "vitest"
import { defineMessenger, messenger } from "./index.js"

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

describe("messenger", () => {
  it("throws if used before init", () => {
    expect(() => messenger.email).toThrow("Messenger not initialized")
  })

  it("registers and exposes unconfigured channel errors", async () => {
    const mod = defineMessenger({})
    const ctx = mockCtx()
    await mod.init?.(ctx as any)

    expect(ctx.container.register).toHaveBeenCalledWith("messenger", expect.any(Object))
    await expect(messenger.email.send({
      to: "person@example.com",
      subject: "hello",
      text: "world",
    })).rejects.toThrow("[messenger.email] Not configured")
  })
})

