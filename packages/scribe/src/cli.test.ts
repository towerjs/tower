import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreateCommand = vi.fn()

vi.mock('./commands/create.js', () => ({
  createCommand: mockCreateCommand,
}))

describe('scribe CLI entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCreateCommand.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls createCommand when no argument given', async () => {
    const exitMock = vi.fn()
    vi.stubGlobal('process', { ...process, argv: ['/node', '/cli.ts'], exit: exitMock })

    await import('./cli.js')
    await vi.waitFor(() => expect(mockCreateCommand).toHaveBeenCalledOnce())
  })

  it("calls createCommand when 'create' argument given", async () => {
    const exitMock = vi.fn()
    vi.stubGlobal('process', { ...process, argv: ['/node', '/cli.ts', 'create'], exit: exitMock })

    await import('./cli.js')
    await vi.waitFor(() => expect(mockCreateCommand).toHaveBeenCalledOnce())
  })

  it('outputs error and exits for unknown command', async () => {
    const exitMock = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('process', { ...process, argv: ['/node', '/cli.ts', 'wat'], exit: exitMock })

    await import('./cli.js')
    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Unknown command: wat')
      expect(exitMock).toHaveBeenCalledWith(1)
    })

    consoleError.mockRestore()
  })
})
