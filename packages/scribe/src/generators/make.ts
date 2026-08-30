import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const KINDS = ['model', 'migration', 'policy', 'factory', 'job'] as const

export type MakeKind = (typeof KINDS)[number]

function fail(message: string): never {
  throw new Error(message)
}

/** `Project` -> `project`; `TeamInvite` -> `team-invite`. */
export function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

/** Naive English pluralization for table names: `project` -> `projects`, `category` -> `categories`. */
export function pluralize(name: string): string {
  if (/(s|x|z|ch|sh)$/.test(name)) return `${name}es`
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`
  return `${name}s`
}

function pascal(input: string): string {
  return input
    .split(/[-_\s]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function assertKind(kind: string | undefined): asserts kind is MakeKind {
  if (!kind || !KINDS.includes(kind as MakeKind)) {
    fail(`Unknown generator "${kind ?? ''}". Available: ${KINDS.join(', ')}`)
  }
}

function requireName(name: string | undefined, kind: string): string {
  const cleaned = name?.trim()
  if (!cleaned) fail(`Usage: tower make ${kind} <Name>`)
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(cleaned)) {
    fail(`Invalid name "${cleaned}". Use letters, digits, dashes, or underscores.`)
  }
  return cleaned
}

export function modelTemplate(rawName: string): { file: string; content: string } {
  const Name = pascal(rawName)
  const table = pluralize(kebab(Name))
  return {
    file: join('src', 'models', `${kebab(Name)}.ts`),
    content: `import { Model } from '@towerjs/vault/model'

export type ${Name}Row = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export class ${Name} extends Model<${Name}Row> {
  static table = '${table}'
}
`,
  }
}

export function policyTemplate(rawName: string): { file: string; content: string } {
  const Name = pascal(rawName)
  return {
    file: join('src', 'policies', `${kebab(Name)}.ts`),
    content: `import { definePolicy, definePolicyRegistration } from '@towerjs/gatehouse'

/**
 * Authorization logic for ${Name}. Actions receive the authenticated
 * Gatehouse user and the resource being authorized — never fetch the user
 * yourself, so the policy stays unit-testable.
 *
 * Add ${Name}PolicyRegistration to gatehouse({ policies: [...] }) in
 * tower.config.ts so gatehouse.can()/authorize() can find it.
 */
export type ${Name}Record = {
  ownerId: string
}

export const ${Name}Policy = definePolicy<${Name}Record>({
  view: (user, record) => record.ownerId === user.id,
  update: (user, record) => record.ownerId === user.id,
  destroy: (user, record) => record.ownerId === user.id,
})

export const ${Name}PolicyRegistration = definePolicyRegistration('${kebab(Name)}', ${Name}Policy)
`,
  }
}

export function factoryTemplate(rawName: string): { file: string; content: string } {
  const Name = pascal(rawName)
  const modelName = kebab(Name)
  return {
    file: join('src', 'factories', `${modelName}.ts`),
    content: `import { defineFactory } from '@towerjs/vault/factory'
import { ${Name} } from '../models/${modelName}.js'

// Factories build valid rows through ${Name}.create(), so they honor casts
// and the provider boundary. Override any attribute per use:
//   await ${Name}Factory.create({ name: 'Override' })
export const ${Name}Factory = defineFactory(${Name}, ({ seq }) => ({
  name: \`${Name} \${seq}\`,
}))
`,
  }
}

export function jobTemplate(rawName: string): { file: string; content: string } {
  const Name = pascal(rawName)
  const fn = kebab(Name).replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
  return {
    file: join('src', 'jobs', `${kebab(Name)}.ts`),
    content: `/**
 * Job: ${Name}
 *
 * Jobs are deferred work. Tower's job runner (Crane) is planned; until it
 * ships, this module is the application-side convention — a plain async
 * entry point you can invoke from server actions, events, or a scheduler.
 */
export async function ${fn}(payload: Record<string, unknown>): Promise<void> {
  console.log('[job:${kebab(Name)}]', payload)
  // TODO: implement
}
`,
  }
}

/** Generates a timestamped Kysely migration stub in src/vault/migrations. */
export function migrationTemplate(migrationsDir: string, rawName: string): { file: string; content: string } {
  const table = pluralize(kebab(pascal(rawName)))
  const existing = safeReaddir(migrationsDir)
  const next = String(existing.length + 1).padStart(4, '0')
  return {
    file: join('src', 'vault', 'migrations', `${next}_${kebab(pascal(rawName))}.ts`),
    content: `import type { Vault } from '@towerjs/vault'

export async function up(db: Vault) {
  await db.schema
    .createTable('${table}')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(db.fn('gen_random_uuid')))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(db.fn('now')))
    .execute()
}

export async function down(db: Vault) {
  await db.schema.dropTable('${table}').execute()
}
`,
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.startsWith('.'))
  } catch {
    return []
  }
}

const GENERATORS: Record<MakeKind, (args: { name: string; cwd: string }) => { file: string; content: string }> = {
  model: ({ name }) => modelTemplate(name),
  policy: ({ name }) => policyTemplate(name),
  factory: ({ name }) => factoryTemplate(name),
  job: ({ name }) => jobTemplate(name),
  migration: ({ name, cwd }) => migrationTemplate(join(cwd, 'src', 'vault', 'migrations'), name),
}

/** Runs `tower make <kind> <Name>` — generates a starter file under src/. */
export function makeCommand(args: string[]): string[] {
  const [kind, name] = args
  assertKind(kind)
  const cleanName = requireName(name, kind)

  const cwd = process.cwd()
  const { file, content } = GENERATORS[kind]({ name: cleanName, cwd })
  const outPath = join(cwd, file)
  mkdirSync(join(cwd, file, '..'), { recursive: true })
  writeFileSync(outPath, content)
  return [`Created ${file}`]
}

export function makeHelp(): string[] {
  return [
    '',
    'Usage: tower make <generator> <Name>',
    '',
    'Generators:',
    '  model <Name>        src/models/<name>.ts — typed model class',
    '  migration <name>    src/vault/migrations/<n>_<name>.ts — Kysely up/down stub',
    '  policy <Name>       src/policies/<name>.ts — authorization policy',
    '  factory <Name>      src/factories/<name>.ts — test/seed data factory',
    '  job <Name>          src/jobs/<name>.ts — deferred work entry point',
    '',
  ]
}
