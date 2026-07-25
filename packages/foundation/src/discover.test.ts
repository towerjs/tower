import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerModule } from "@towerjs/blueprint"

const mocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}))

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal() as typeof import("node:fs")
  return { ...actual, existsSync: mocks.mockExistsSync }
})

import { createTower } from "./app.js"

describe("createTower with auto-discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws when no tower.config found", async () => {
    mocks.mockExistsSync.mockReturnValue(false)

    await expect(createTower()).rejects.toThrow(
      "Could not find tower.config.ts",
    )
  })

  it("accepts explicit config and skips discovery", async () => {
    registerModule("test", () => ({
      name: "test",
      async init() {},
    }))

    const result = await createTower({ modules: { test: {} } })

    expect(result).toBeDefined()
    expect(mocks.mockExistsSync).not.toHaveBeenCalled()
  })

  it("returns TowerInstance with runtime and module accessors", async () => {
    registerModule("alpha", () => ({
      name: "alpha",
      async init(ctx) {
        ctx.container.register("alpha", { val: 1 })
      },
    }))

    const result = await createTower({ modules: { alpha: {} } })

    expect(result.runtime).toEqual({ name: "node-server", isServerless: false })
    expect((result as any).alpha).toEqual({ val: 1 })
  })
})
