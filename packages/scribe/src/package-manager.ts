export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

/** Detects the package manager that invoked the CLI via `npm_config_user_agent`. */
export function detectPackageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
  const agent = env.npm_config_user_agent ?? ''
  if (agent.includes('yarn')) return 'yarn'
  if (agent.includes('pnpm')) return 'pnpm'
  if (agent.includes('bun')) return 'bun'
  return 'npm'
}

const NEXT_APP_FLAGS: Record<PackageManager, string> = {
  pnpm: '--use-pnpm',
  yarn: '--use-yarn',
  npm: '--use-npm',
  bun: '--use-bun',
}

export function nextAppFlag(pm: PackageManager): string {
  return NEXT_APP_FLAGS[pm]
}

export function addCommand(pm: PackageManager, dev = false): string[] {
  const cmd: Record<PackageManager, string> = { pnpm: 'pnpm', yarn: 'yarn', npm: 'npm', bun: 'bun' }
  const verb: Record<PackageManager, string> = { pnpm: 'add', yarn: 'add', npm: 'install', bun: 'add' }
  return [cmd[pm], verb[pm], ...(dev ? ['-D'] : [])]
}

export function devCommand(pm: PackageManager): string {
  return pm === 'npm' ? 'npm run dev' : `${pm} dev`
}

export function migrateCommand(pm: PackageManager): string {
  if (pm === 'npm') return 'npm exec tower migrate'
  if (pm === 'bun') return 'bunx tower migrate'
  return `${pm} exec tower migrate`
}
