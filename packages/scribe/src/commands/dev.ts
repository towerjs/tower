import { existsSync } from 'node:fs'
import { createServer } from 'node:net'

import { type ResultPromise, execa } from 'execa'

import type { CliResult } from '../cli.js'
import { fail, findConfig, loadApp, ok } from '../cli.js'
import { type PackageManager, detectPackageManager } from '../package-manager.js'

/**
 * `tower dev` — validates the application, then orchestrates the framework
 * dev server. Serving starts on port 3000; when it's taken, tower dev walks
 * upward (3001, 3002, …) and reports which port it actually bound.
 */

export const DEV_PORT = 3000
/** How many consecutive ports tower dev will probe before giving up. */
export const MAX_PORT_PROBES = 10

/** Resolves the command that runs the framework dev server for a package manager. */
export function resolveDevCommand(pm: PackageManager, port = DEV_PORT): { cmd: string; args: string[] } {
  if (pm === 'npm') return { cmd: 'npx', args: ['next', 'dev', '--port', String(port)] }
  return { cmd: pm, args: ['exec', 'next', 'dev', '--port', String(port)] }
}

/**
 * Addresses a dev server can occupy: the loopback addresses a browser
 * reaches through `localhost`, plus the wildcard `next dev` binds by
 * default (`undefined`). Probing only the wildcard is not enough — macOS
 * lets a wildcard bind succeed while another process already holds
 * 127.0.0.1 on that port, so the port would look free and `next dev` would
 * end up shadowed by the other server.
 */
const PROBE_HOSTS: (string | undefined)[] = ['127.0.0.1', '::1', undefined]

/** Checks whether the port can be bound right now. */
export async function portInUse(port: number): Promise<boolean> {
  for (const host of PROBE_HOSTS) {
    if (await bindConflicts(port, host)) return true
  }
  return false
}

/**
 * Resolves true when something already holds the address. Errors that mean
 * the address itself is unavailable (no IPv6 stack, for instance) are not
 * conflicts — nothing can be serving there.
 */
function bindConflicts(port: number, host: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code === 'EADDRINUSE' || err.code === 'EACCES')
    })
    probe.once('listening', () => probe.close(() => resolve(false)))
    if (host === undefined) probe.listen(port)
    else probe.listen(port, host)
  })
}

/**
 * Picks the first free port starting at DEV_PORT, probing up to
 * MAX_PORT_PROBES candidates. Returns null when all of them are taken.
 */
export async function pickFreePort(): Promise<number | null> {
  let port = DEV_PORT
  for (let attempt = 0; attempt < MAX_PORT_PROBES; attempt++) {
    if (!(await portInUse(port))) return port
    port += 1
  }
  return null
}

interface DevValidation {
  configPath: string
}

/** Validates the app before spawning anything: config loads and modules resolve. */
async function validate(configPath?: string): Promise<DevValidation> {
  const configPath_ = configPath ?? findConfig()
  const app = await loadApp(configPath_)
  await app.shutdown()

  if (!existsSync('node_modules/.bin/next')) {
    throw new Error("Next.js is not installed. Run your package manager's install command first.")
  }
  return { configPath: configPath_ }
}

/** Runs `tower dev`. */
export async function devCommand(args: string[] = []): Promise<CliResult> {
  if (args.includes('--help') || args.includes('-h')) return ok(devHelp())

  try {
    await validate(args.find((a) => a.startsWith('--config='))?.split('=')[1])
  } catch (err) {
    return fail(devDiagnostic(err))
  }

  const port = await pickFreePort()
  if (port === null) {
    return fail(
      `No free port found between ${DEV_PORT} and ${DEV_PORT + MAX_PORT_PROBES - 1}. ` +
        'Stop the processes holding them and try again.'
    )
  }

  const pm = detectPackageManager()
  const { cmd, args: cmdArgs } = resolveDevCommand(pm, port)
  process.stdout.write(
    port === DEV_PORT
      ? `Starting Next.js dev server on http://localhost:${port}...\n`
      : `Port ${DEV_PORT} was in use — serving on http://localhost:${port} instead.\n`
  )

  let child: ResultPromise
  try {
    child = execa(cmd, cmdArgs, { stdio: 'inherit', cwd: process.cwd(), env: { ...process.env } })
  } catch (err) {
    return fail(devDiagnostic(err))
  }

  // Forward signals so Ctrl+C tears down the whole tree cleanly.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      child.kill(signal)
    })
  }

  try {
    const result = await child
    if (result.failed && result.exitCode !== 0) {
      return fail(`Dev server exited with code ${result.exitCode ?? 'unknown'}.`)
    }
    return ok([])
  } catch (err) {
    return fail(devDiagnostic(err))
  }
}

/** Wraps raw errors in actionable next-dev-style guidance. */
export function devDiagnostic(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/Could not find tower.config/i.test(message)) {
    return `${message}\nRun this command from a Tower project root, or scaffold one with \`tower create\`.`
  }
  if (/Unknown module/i.test(message)) {
    return `${message}\nCheck the modules array in tower.config.ts against installed @towerjs/* packages.`
  }
  return message
}

function devHelp(): string[] {
  return [
    '',
    'Usage: tower dev',
    '',
    'Validates the application, then starts the Next.js dev server.',
    'Serving starts on port 3000 and falls back to the next free ports',
    '(3001, 3002, …) when they are taken.',
    '',
    'Flags:',
    '  --config=<path>  Path to tower.config.ts (defaults to auto-discovery)',
    '  --help, -h       Show this message',
    '',
  ]
}
