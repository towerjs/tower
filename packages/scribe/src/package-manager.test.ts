import { describe, it, expect } from 'vitest'
import { detectPackageManager, nextAppFlag, addCommand, devCommand } from './package-manager.js'

describe('detectPackageManager', () => {
  it('detects yarn from npm_config_user_agent', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'yarn/4.5.0 npm/? node/v20.0.0 darwin arm64' })).toBe('yarn')
  })

  it('detects pnpm from npm_config_user_agent', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'pnpm/9.12.0 npm/? node/v20.0.0 darwin arm64' })).toBe('pnpm')
  })

  it('detects bun from npm_config_user_agent', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'bun/1.1.30 npm/? node/v20.0.0 darwin arm64' })).toBe('bun')
  })

  it('detects npm from npm_config_user_agent', () => {
    expect(detectPackageManager({ npm_config_user_agent: 'npm/11.0.0 node/v20.0.0 darwin arm64' })).toBe('npm')
  })

  it('defaults to npm when no user agent is present', () => {
    expect(detectPackageManager({})).toBe('npm')
  })
})

describe('nextAppFlag', () => {
  it('maps each package manager to its create-next-app flag', () => {
    expect(nextAppFlag('npm')).toBe('--use-npm')
    expect(nextAppFlag('pnpm')).toBe('--use-pnpm')
    expect(nextAppFlag('yarn')).toBe('--use-yarn')
    expect(nextAppFlag('bun')).toBe('--use-bun')
  })
})

describe('addCommand', () => {
  it('uses pnpm add for pnpm', () => {
    expect(addCommand('pnpm')).toEqual(['pnpm', 'add'])
  })

  it('uses yarn add for yarn', () => {
    expect(addCommand('yarn')).toEqual(['yarn', 'add'])
  })

  it('uses npm install for npm', () => {
    expect(addCommand('npm')).toEqual(['npm', 'install'])
  })

  it('uses bun add for bun', () => {
    expect(addCommand('bun')).toEqual(['bun', 'add'])
  })

  it('appends -D for dev dependencies', () => {
    expect(addCommand('npm', true)).toEqual(['npm', 'install', '-D'])
    expect(addCommand('pnpm', true)).toEqual(['pnpm', 'add', '-D'])
  })
})

describe('devCommand', () => {
  it('uses npm run dev for npm', () => {
    expect(devCommand('npm')).toBe('npm run dev')
  })

  it('uses the bare dev script for pnpm, yarn, and bun', () => {
    expect(devCommand('pnpm')).toBe('pnpm dev')
    expect(devCommand('yarn')).toBe('yarn dev')
    expect(devCommand('bun')).toBe('bun dev')
  })
})
