import { describe, expect, it, vi } from "vitest"
import { defineCourier, courier } from "./index.js"

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

describe("courier", () => {
  it("throws if used before init", () => {
    expect(() => courier.email).toThrow("Courier not initialized")
  })

  it("registers and exposes unconfigured channel errors", async () => {
    const mod = defineCourier({})
    const ctx = mockCtx()
    await mod.init?.(ctx as any)

    expect(ctx.container.register).toHaveBeenCalledWith("courier", expect.any(Object))
    await expect(courier.email.send({
      to: "person@example.com",
      subject: "hello",
      text: "world",
    })).rejects.toThrow("[courier.email] Not configured")
  })
})
