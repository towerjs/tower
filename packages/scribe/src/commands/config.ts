import { readFileSync } from 'node:fs'

import type { CliResult } from '../cli.js'
import { fail, loadConfig, ok } from '../cli.js'

/**
 * `tower config show` — inspect the resolved Tower configuration.
 *
 * Secrets never enter CLI output twice over: option values live inside
 * module closures (not enumerable on the definitions), and any secret-shaped
 * key found in the config source is printed masked.
 */

const SECRET_KEY_PATTERN = /(pass(word)?|secret|token|api[-_]?key|credential|private[-_]?key)/i
const MASK = '••••••••'

/** True when a config key looks like it carries a secret. */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key)
}

/** Deeply masks secret-shaped string values while preserving structure. */
export function redactValue(value: unknown, key = ''): unknown {
  if (typeof value === 'string') return isSecretKey(key) ? MASK : value
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redactValue(v))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactValue(v, k)
  return out
}

export interface ConfigFileEntry {
  key: string
  /** The raw literal as written, with the value already masked. */
  preview: string
}

/**
 * Scans tower.config source text for secret-shaped assignments so the show
 * output can acknowledge them without printing their values.
 */
export function scanConfigFileSecrets(source: string): ConfigFileEntry[] {
  const entries: ConfigFileEntry[] = []
  const linePattern = /^\s*([A-Za-z_][\w]*):(?:\s*\{)?\s*$/ // nested object key like `secret: {`
  const assignmentPattern = /^\s*([A-Za-z_][\w]*):\s*(.+?),?\s*$/

  for (const line of source.split(/\r?\n/)) {
    const nested = line.match(linePattern)
    if (nested && isSecretKey(nested[1])) {
      entries.push({ key: nested[1], preview: `${nested[1]}: ${MASK}` })
      continue
    }
    const assignment = line.match(assignmentPattern)
    if (!assignment) continue
    const [, key, raw] = assignment
    if (!isSecretKey(key)) continue
    entries.push({ key, preview: `${key}: ${maskLiteral(raw)}` })
  }
  return dedupe(entries)
}

function maskLiteral(raw: string): string {
  const trimmed = raw.trim().replace(/,$/, '')
  // Function calls / identifiers stay visible (e.g. env.string(...)) — they
  // are not themselves secrets. Only literal values get masked.
  if (/^['"]/.test(trimmed)) return `'${MASK}'`
  if (/^(true|false|null|\d+)$/.test(trimmed)) return trimmed
  return trimmed
}

function dedupe(entries: ConfigFileEntry[]): ConfigFileEntry[] {
  const seen = new Set<string>()
  return entries.filter((e) => (seen.has(e.preview) ? false : (seen.add(e.preview), true)))
}

interface ModuleSummary {
  name: string
  dependsOn: string[]
}

function summarizeModules(config: { modules?: unknown }): ModuleSummary[] {
  const modules = config.modules
  if (Array.isArray(modules)) {
    return modules.map((m: any) => ({
      name: String(m?.name ?? '(unnamed)'),
      dependsOn: Array.isArray(m?.dependsOn) ? m.dependsOn.map(String) : [],
    }))
  }
  if (modules && typeof modules === 'object') {
    return Object.keys(modules).map((name) => ({ name, dependsOn: [] }))
  }
  return []
}

const ENV_KEYS_BY_MODULE: Record<string, string[]> = {
  vault: ['DATABASE_URL'],
  gatehouse: ['GATEHOUSE_SECRET', 'GATEHOUSE_URL'],
  courier: [],
}

/** Runs `tower config show [module] [--json]`. */
export async function configCommand(args: string[], configPath?: string): Promise<CliResult> {
  const [subcommand] = args
  const jsonFlag = args.includes('--json')
  if (!subcommand || subcommand === 'show') {
    return show(args.includes('show') ? args.slice(args.indexOf('show') + 1) : args.slice(1), configPath, jsonFlag)
  }
  if (subcommand === '--help' || subcommand === '-h' || !subcommand) return ok(configHelp())
  return fail(`Unknown config subcommand "${subcommand}". Available: show`)
}

export function configHelp(): string[] {
  return [
    '',
    'Usage: tower config show [module] [--json]',
    '',
    'Prints the resolved Tower configuration. Secret-shaped values are',
    'always redacted; use --json for machine-readable output.',
    '',
  ]
}

async function show(rest: string[], configPath?: string, jsonFlag = false): Promise<CliResult> {
  const moduleFilter = rest.find((arg) => !arg.startsWith('--'))
  let resolvedPath: string
  try {
    const { findConfig } = await import('../cli.js')
    resolvedPath = configPath ?? findConfig()
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err))
  }

  const config = await loadConfig(resolvedPath)
  let source = ''
  try {
    source = readFileSync(resolvedPath, 'utf8')
  } catch {}

  const modules = summarizeModules(config)
  const filtered = moduleFilter ? modules.filter((m) => m.name === moduleFilter) : modules
  if (moduleFilter && filtered.length === 0) {
    return fail(`Module "${moduleFilter}" is not configured.`)
  }

  const envEntries = buildEnvEntries(filtered)
  const fileSecrets = scanConfigFileSecrets(source)

  if (jsonFlag) {
    const payload = {
      configPath: resolvedPath,
      environment: process.env.NODE_ENV ?? 'development',
      modules: filtered,
      environmentVariables: Object.fromEntries(envEntries),
      redactedConfigEntries: fileSecrets.map((s) => s.key),
    }
    return ok([JSON.stringify(redactValue(payload), null, 2)])
  }

  const lines = [`Config       ${resolvedPath}`, `Environment  ${process.env.NODE_ENV ?? 'development'}`, '', 'Modules']
  if (filtered.length === 0) {
    lines.push('  (none)')
  }
  for (const mod of filtered) {
    const deps = mod.dependsOn.length > 0 ? ` depends on ${mod.dependsOn.join(', ')}` : ''
    lines.push(`  ${mod.name}${deps}`)
  }

  lines.push('', 'Environment variables')
  for (const [key, present] of envEntries) {
    lines.push(`  ${present ? '✓' : '—'} ${key}`)
  }

  if (fileSecrets.length > 0) {
    lines.push('', 'Redacted entries in config source')
    for (const entry of fileSecrets) {
      lines.push(`  ${entry.preview}`)
    }
  }

  return ok(lines)
}

function buildEnvEntries(modules: ModuleSummary[]): Array<[string, boolean]> {
  const keys = new Set<string>()
  for (const mod of modules) {
    for (const key of ENV_KEYS_BY_MODULE[mod.name] ?? []) keys.add(key)
  }
  return Array.from(keys).map((key) => [key, Boolean(process.env[key])] as [string, boolean])
}
