import { describe, it, expect, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  mockCollectProjectState: vi.fn(),
  mockGenerateProject: vi.fn(),
}))

vi.mock("../prompts.js", () => ({
  collectProjectState: mocks.mockCollectProjectState,
}))

vi.mock("../generators/project.js", () => ({
  generateProject: mocks.mockGenerateProject,
}))

import { createCommand } from "./create.js"

describe("createCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("collects project state and generates project", async () => {
    mocks.mockCollectProjectState.mockResolvedValue({
      projectName: "my-app",
      framework: "next",
      modules: { vault: { provider: "neon", brand: "neon" } },
      frameworkAnswers: {},
    })
    mocks.mockGenerateProject.mockResolvedValue(undefined)

    await createCommand()

    expect(mocks.mockCollectProjectState).toHaveBeenCalledOnce()
    expect(mocks.mockGenerateProject).toHaveBeenCalledOnce()
  })

  it("logs the project name and dev command on success", async () => {
    mocks.mockCollectProjectState.mockResolvedValue({
      projectName: "my-app",
      framework: "next",
      modules: {},
      frameworkAnswers: {},
    })
    mocks.mockGenerateProject.mockResolvedValue(undefined)
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {})

    await createCommand()

    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("my-app"))
    expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("pnpm dev"))

    consoleLog.mockRestore()
  })

  it("re-throws errors from generateProject", async () => {
    mocks.mockCollectProjectState.mockResolvedValue({
      projectName: "my-app",
      framework: "next",
      modules: {},
      frameworkAnswers: {},
    })
    mocks.mockGenerateProject.mockRejectedValue(new Error("Scaffold failed"))

    await expect(createCommand()).rejects.toThrow("Scaffold failed")
  })

  it("writes progress to stdout on success", async () => {
    mocks.mockCollectProjectState.mockResolvedValue({
      projectName: "my-app",
      framework: "next",
      modules: {},
      frameworkAnswers: {},
    })
    mocks.mockGenerateProject.mockResolvedValue(undefined)
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await createCommand()

    expect(stdoutWrite).toHaveBeenCalledWith("  Creating Tower application...")
    expect(stdoutWrite).toHaveBeenCalledWith(" done\n\n")

    stdoutWrite.mockRestore()
  })

  it("writes failure message to stdout on error", async () => {
    mocks.mockCollectProjectState.mockResolvedValue({
      projectName: "my-app",
      framework: "next",
      modules: {},
      frameworkAnswers: {},
    })
    mocks.mockGenerateProject.mockRejectedValue(new Error("fail"))
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await expect(createCommand()).rejects.toThrow("fail")
    expect(stdoutWrite).toHaveBeenCalledWith("  Creating Tower application...")
    expect(stdoutWrite).toHaveBeenCalledWith(" failed\n")

    stdoutWrite.mockRestore()
  })
})
