import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockMigrateToLatest, mockMigrator } = vi.hoisted(() => {
  const fn = vi.fn()
  return {
    mockMigrateToLatest: fn,
    mockMigrator: { migrateToLatest: fn },
  }
})

vi.mock("kysely/migration", () => ({
  Migrator: class {
    constructor() {
      return mockMigrator
    }
  },
  FileMigrationProvider: class {},
}))

vi.mock("node:path", () => ({
  resolve: vi.fn((_: string, folder: string) => `/resolved/${folder}`),
  default: { resolve: vi.fn((_: string, folder: string) => `/resolved/${folder}`) },
}))

import { createMigrator, migrateToLatest } from "./migrate.js"

describe("createMigrator", () => {
  it("creates a Migrator with FileMigrationProvider", () => {
    const db = {} as any
    const config = { folder: "migrations" }
    const result = createMigrator(db, config)

    expect(result).toBe(mockMigrator)
  })
})

describe("migrateToLatest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls migrator.migrateToLatest and logs results", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: [
        { migrationName: "001_create_users", status: "Success" },
        { migrationName: "002_add_roles", status: "Success" },
      ],
    })

    await migrateToLatest({} as any, { folder: "migrations" })

    expect(mockMigrateToLatest).toHaveBeenCalledOnce()
    expect(consoleLog).toHaveBeenCalledWith('Migration "001_create_users" applied')
    expect(consoleLog).toHaveBeenCalledWith('Migration "002_add_roles" applied')

    consoleLog.mockRestore()
  })

  it("logs errors for failed migrations", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: [
        { migrationName: "001_create_users", status: "Success" },
        { migrationName: "002_broken", status: "Error" },
      ],
    })

    await migrateToLatest({} as any, { folder: "migrations" })

    expect(consoleError).toHaveBeenCalledWith('Migration "002_broken" failed')

    consoleLog.mockRestore()
    consoleError.mockRestore()
  })

  it("throws when migrator returns an error", async () => {
    mockMigrateToLatest.mockResolvedValueOnce({
      error: new Error("Migration failed"),
      results: [],
    })

    await expect(
      migrateToLatest({} as any, { folder: "migrations" }),
    ).rejects.toThrow("Migration failed")
  })

  it("handles empty results array", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: [],
    })

    await migrateToLatest({} as any, { folder: "migrations" })

    expect(consoleLog).not.toHaveBeenCalled()

    consoleLog.mockRestore()
  })

  it("handles null results gracefully", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})
    mockMigrateToLatest.mockResolvedValueOnce({
      error: null,
      results: null,
    })

    await migrateToLatest({} as any, { folder: "migrations" })

    expect(consoleLog).not.toHaveBeenCalled()
    consoleLog.mockRestore()
  })
})
