import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { closeModules, findConfig, getModule, helpText, run, versionText } from './cli.js'

const mockMigrate = vi.fn()
const mockSeed = vi.fn()
const mockClose = vi.fn()
const hoisted = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockRealpathSync: vi.fn((p: string) => p),
  mockCreateCommand: vi.fn(),
}))
const mockExistsSync = hoisted.mockExistsSync
const mockCreateCommand = hoisted.mockCreateCommand

const mockApp: any = {
  config: { modules: { vault: {}, gatehouse: {} } },
  container: {
    has: vi.fn(() => true),
    get: vi.fn((name: string) => {
      if (name === 'vault' || name === 'module.vault') {
        return { migrate: mockMigrate, seed: mockSeed, close: mockClose }
      }
      if (name === 'gatehouse' || name === 'module.gatehouse') {
        return { migrate: vi.fn() }
      }
      return undefined
    }),
  },
}

function resetMockApp() {
  mockApp.config = { modules: { vault: {}, gatehouse: {} } }
  mockApp.container = {
    has: vi.fn(() => true),
    get: vi.fn((name: string) => {
      if (name === 'vault' || name === 'module.vault') {
        return { migrate: mockMigrate, seed: mockSeed, close: mockClose }
      }
      if (name === 'gatehouse' || name === 'module.gatehouse') {
        return { migrate: vi.fn() }
      }
      return undefined
    }),
  }
}

vi.mock('@towerjs/foundation', () => ({
  createTowerApp: vi.fn(() => Promise.resolve(mockApp)),
  detectRuntime: vi.fn(() => ({ name: 'node', isServerless: false })),
}))

vi.mock('jiti', () => ({
  createJiti: vi.fn(() => ({
    import: vi.fn(() => Promise.resolve({ modules: { vault: {}, gatehouse: {} } })),
  })),
}))

vi.mock('node:fs', () => ({
  existsSync: hoisted.mockExistsSync,
  realpathSync: hoisted.mockRealpathSync,
  default: { existsSync: hoisted.mockExistsSync, realpathSync: hoisted.mockRealpathSync },
}))

vi.mock('./commands/create.js', () => ({
  createCommand: hoisted.mockCreateCommand,
}))

const cliPath = fileURLToPath(new URL('./cli.ts', import.meta.url))

describe('CLI entrypoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCreateCommand.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubProcess(argv: string[], exitMock = vi.fn()) {
    const stderrWrite = vi.fn()
    vi.stubGlobal('process', {
      ...process,
      argv: ['/node', cliPath, ...argv],
      exit: exitMock,
      stderr: { write: stderrWrite },
      stdout: { write: vi.fn() },
    })
    return { exitMock, stderrWrite }
  }

  it('shows help when no argument given', async () => {
    const { exitMock } = stubProcess([])

    await import('./cli.js')
    await vi.waitFor(() => expect(exitMock).toHaveBeenCalledWith(0))
  })

  it("calls createCommand when 'create' argument given", async () => {
    const { exitMock } = stubProcess(['create'])

    await import('./cli.js')
    await vi.waitFor(() => expect(mockCreateCommand).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(exitMock).toHaveBeenCalledWith(0))
  })

  it('outputs error and exits for unknown command', async () => {
    const { exitMock, stderrWrite } = stubProcess(['wat'])

    await import('./cli.js')
    await vi.waitFor(() => {
      expect(stderrWrite).toHaveBeenCalledWith('Unknown command: wat\n')
      expect(exitMock).toHaveBeenCalledWith(1)
    })
  })
})

describe('help', () => {
  it('returns help text for no command', async () => {
    const result = await run(undefined, [])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Usage: tower <command>')
  })

  it('returns help text for help command', async () => {
    const result = await run('help', [])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Usage: tower <command>')
  })

  it('returns help text for --help', async () => {
    const result = await run('--help', [])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Usage: tower <command>')
  })

  it('returns helpText()', () => {
    const lines = helpText()
    expect(lines[1]).toBe('Usage: tower <command>')
  })

  it('shows help for create --help without scaffolding', async () => {
    const result = await run('create', ['--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.join('\n')).toContain('Usage: tower <command>')
  })
})

describe('version', () => {
  it('returns version for --version', async () => {
    const result = await run('--version', [])
    expect(result.exitCode).toBe(0)
    expect(result.stdout[0]).toContain('v0.1.0')
  })

  it('returns version for -v', async () => {
    const result = await run('-v', [])
    expect(result.exitCode).toBe(0)
    expect(result.stdout[0]).toContain('v0.1.0')
  })

  it('returns versionText()', () => {
    expect(versionText()).toContain('v0.1.0')
  })
})

describe('unknown command', () => {
  it('returns error for unknown command', async () => {
    const result = await run('wat', [])
    expect(result.exitCode).toBe(1)
    expect(result.stderr[0]).toBe('Unknown command: wat')
  })
})

describe('about', () => {
  it('reports runtime, modules, providers, and environment status', async () => {
    process.env.DATABASE_URL = 'postgres://example'
    const result = await run('about', [], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Application')
    expect(result.stdout.some((line) => line.includes('Runtime'))).toBe(true)
    expect(result.stdout.some((line) => line.includes('vault') && line.includes('configured'))).toBe(true)
    expect(result.stdout.some((line) => line.includes('DATABASE_URL') && line.includes('✓'))).toBe(true)
    delete process.env.DATABASE_URL
  })
})

describe('migrate', () => {
  beforeEach(() => {
    resetMockApp()
    mockMigrate.mockReset()
    mockSeed.mockReset()
    mockClose.mockReset()
  })

  it('runs vault and gatehouse migrations', async () => {
    const result = await run('migrate', [], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(mockMigrate).toHaveBeenCalled()
    expect(result.stdout).toContain('Done.')
  })

  it('runs seeds when --seed flag is passed', async () => {
    const result = await run('migrate', ['--seed'], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(mockSeed).toHaveBeenCalled()
  })

  it('runs seeds when -s flag is passed', async () => {
    const result = await run('migrate', ['-s'], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(mockSeed).toHaveBeenCalled()
  })

  it('propagates migrate error', async () => {
    mockMigrate.mockRejectedValueOnce(new Error('migration failed'))

    await expect(run('migrate', [], '/fake/tower.config.ts')).rejects.toThrow('migration failed')
  })

  it('propagates seed error during migrate --seed', async () => {
    mockSeed.mockRejectedValueOnce(new Error('seed failed'))

    await expect(run('migrate', ['--seed'], '/fake/tower.config.ts')).rejects.toThrow('seed failed')
  })

  it('skips vault migrate when vault has no migrate method', async () => {
    mockApp.container.get = vi.fn((name: string) => {
      if (name === 'vault' || name === 'module.vault') return {}
      if (name === 'gatehouse' || name === 'module.gatehouse') return { migrate: vi.fn() }
      return undefined
    })

    const result = await run('migrate', [], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('Running vault migrations')
  })
})

describe('seed', () => {
  beforeEach(() => {
    resetMockApp()
    mockMigrate.mockReset()
    mockSeed.mockReset()
    mockClose.mockReset()
  })

  it('runs seeds with migrations', async () => {
    const result = await run('seed', [], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(mockMigrate).toHaveBeenCalled()
    expect(mockSeed).toHaveBeenCalled()
  })

  it('skips migrations with --skip-migrate', async () => {
    const result = await run('seed', ['--skip-migrate'], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(0)
    expect(mockMigrate).not.toHaveBeenCalled()
    expect(mockSeed).toHaveBeenCalled()
  })

  it('fails when vault has no seed', async () => {
    mockApp.container.get = vi.fn((name: string) => {
      if (name === 'vault' || name === 'module.vault') return {}
      return undefined
    })

    const result = await run('seed', [], '/fake/tower.config.ts')
    expect(result.exitCode).toBe(1)
    expect(result.stderr[0]).toBe('Vault not configured or seeds not available.')
  })
})

describe('findConfig', () => {
  beforeEach(() => {
    mockExistsSync.mockReset()
  })

  it('throws when no config found', () => {
    mockExistsSync.mockReturnValue(false)

    expect(() => findConfig('/tmp')).toThrow('Could not find tower.config.ts')
  })

  it('finds tower.config.ts in the given directory', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/project/tower.config.ts')

    const result = findConfig('/project')
    expect(result).toBe('/project/tower.config.ts')
  })

  it('finds tower.config.mjs when .ts not present', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/project/tower.config.mjs')

    const result = findConfig('/project')
    expect(result).toBe('/project/tower.config.mjs')
  })

  it('finds tower.config.js as last resort', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/project/tower.config.js')

    const result = findConfig('/project')
    expect(result).toBe('/project/tower.config.js')
  })

  it('walks up parent directories', () => {
    mockExistsSync.mockImplementation((p: string) => p === '/parent/tower.config.ts')

    const result = findConfig('/parent/sub/nested')
    expect(result).toBe('/parent/tower.config.ts')
  })
})

describe('getModule', () => {
  beforeEach(() => {
    mockApp.container.has.mockReset()
    mockApp.container.get.mockReset()
  })

  it('returns module from container by name', () => {
    mockApp.container.has.mockReturnValue(true)
    mockApp.container.get.mockReturnValue({ name: 'vault' })

    const result = getModule(mockApp, 'vault')
    expect(result).toEqual({ name: 'vault' })
    expect(mockApp.container.get).toHaveBeenCalledWith('vault')
  })

  it('falls back to module. prefix', () => {
    mockApp.container.has.mockImplementation((name: string) => name === 'module.vault')
    mockApp.container.get.mockImplementation((name: string) => {
      if (name === 'module.vault') return { name: 'vault' }
      return undefined
    })

    const result = getModule(mockApp, 'vault')
    expect(result).toEqual({ name: 'vault' })
    expect(mockApp.container.get).toHaveBeenCalledWith('module.vault')
  })

  it('returns undefined when module not found', () => {
    mockApp.container.has.mockReturnValue(false)
    mockApp.container.get.mockReturnValue(undefined)

    const result = getModule(mockApp, 'missing')
    expect(result).toBeUndefined()
  })
})

describe('closeModules', () => {
  beforeEach(() => {
    mockClose.mockReset()
  })

  it('calls close on vault when available', async () => {
    const app: any = {
      config: { modules: { vault: {} } },
      container: {
        has: vi.fn(() => true),
        get: vi.fn(() => ({ close: mockClose })),
      },
    }

    await closeModules(app)
    expect(mockClose).toHaveBeenCalled()
  })

  it('skips close when vault has no close method', async () => {
    const app: any = {
      config: { modules: { vault: {} } },
      container: {
        has: vi.fn(() => true),
        get: vi.fn(() => ({})),
      },
    }

    await expect(closeModules(app)).resolves.toBeUndefined()
  })

  it('propagates close error', async () => {
    mockClose.mockRejectedValueOnce(new Error('close failed'))

    const app: any = {
      config: { modules: { vault: {} } },
      container: {
        has: vi.fn(() => true),
        get: vi.fn(() => ({ close: mockClose })),
      },
    }

    await expect(closeModules(app)).rejects.toThrow('close failed')
  })

  it('calls close on all modules that have it', async () => {
    const closeA = vi.fn()
    const closeB = vi.fn()
    const app: any = {
      config: { modules: { alpha: {}, beta: {}, gamma: {} } },
      container: {
        has: vi.fn((name: string) => name === 'alpha' || name === 'beta'),
        get: vi.fn((name: string) => {
          if (name === 'alpha') return { close: closeA }
          if (name === 'beta') return { close: closeB }
          return {}
        }),
      },
    }

    await closeModules(app)
    expect(closeA).toHaveBeenCalled()
    expect(closeB).toHaveBeenCalled()
  })
})
