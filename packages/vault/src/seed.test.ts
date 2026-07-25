import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddir: vi.fn(),
  seedCallback: vi.fn(),
  seedOrder: [] as string[],
}))

vi.mock("node:fs", () => ({
  existsSync: mocks.mockExistsSync,
  promises: { readdir: mocks.mockReaddir },
}))

vi.mock("node:path", () => ({
  resolve: vi.fn((...args: string[]) => `/resolved/${args.filter(Boolean).pop() ?? "unknown"}`),
  join: vi.fn((...parts: string[]) => parts.join("/")),
  default: {
    resolve: vi.fn((...args: string[]) => `/resolved/${args.filter(Boolean).pop() ?? "unknown"}`),
    join: vi.fn((...parts: string[]) => parts.join("/")),
  },
}))

vi.mock("/resolved/seeds/users.ts", () => ({
  default: mocks.seedCallback,
}))

vi.mock("/resolved/seeds/001_first.ts", () => ({
  default: vi.fn().mockImplementation(async () => { mocks.seedOrder.push("001_first") }),
}))

vi.mock("/resolved/seeds/002_second.ts", () => ({
  default: vi.fn().mockImplementation(async () => { mocks.seedOrder.push("002_second") }),
}))

vi.mock("/resolved/seeds/empty.ts", () => ({ default: "notafunction" }))

vi.mock("/resolved/seeds/crash.ts", () => ({
  default: vi.fn().mockRejectedValue(new Error("seed error")),
}))

import { runSeeds } from "./seed.js"

describe("runSeeds", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.seedOrder.length = 0
  })

  it("logs and returns when seed folder does not exist", async () => {
    mocks.mockExistsSync.mockReturnValue(false)
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})

    await runSeeds({} as any, { folder: "seeds" })

    expect(consoleLog).toHaveBeenCalledWith("Seed folder not found: /resolved/seeds")
    consoleLog.mockRestore()
  })

  it("logs and returns when no seed files found", async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue([])
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})

    await runSeeds({} as any, { folder: "seeds" })

    expect(consoleLog).toHaveBeenCalledWith("No seed files found")
    consoleLog.mockRestore()
  })

  it("logs when no seed files match the name filter", async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(["users.ts", "posts.ts"])
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})

    await runSeeds({} as any, { folder: "seeds" }, "nonexistent")

    expect(consoleLog).toHaveBeenCalledWith('No seed file matching "nonexistent"')
    consoleLog.mockRestore()
  })

  it("imports and executes default export", async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(["users.ts"])
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
    mocks.seedCallback.mockResolvedValue(undefined)

    await runSeeds({ some: "db" } as any, { folder: "seeds" })

    expect(consoleLog).toHaveBeenCalledWith("Running seed: users.ts")
    expect(mocks.seedCallback).toHaveBeenCalledWith({ some: "db" })
    expect(consoleLog).toHaveBeenCalledWith('Seed "users.ts" applied')
    consoleLog.mockRestore()
  })

  it("warns when seed file has no function default or named seed export", async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(["empty.ts"])
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await runSeeds({} as any, { folder: "seeds" })

    expect(consoleWarn).toHaveBeenCalledWith(
      'Seed "empty.ts" has no default export or named "seed" export',
    )
    consoleWarn.mockRestore()
  })

  it("logs and rethrows when seed execution throws", async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(["crash.ts"])
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    await expect(
      runSeeds({} as any, { folder: "seeds" }),
    ).rejects.toThrow("seed error")

    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("runs seed files in sorted order", async () => {
    mocks.mockExistsSync.mockReturnValue(true)
    mocks.mockReaddir.mockResolvedValue(["002_second.ts", "001_first.ts"])
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})

    await runSeeds({} as any, { folder: "seeds" })

    expect(mocks.seedOrder).toEqual(["001_first", "002_second"])
    consoleLog.mockRestore()
  })
})
