import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const DOCS_DIR = resolve(ROOT_DIR, 'docs')

const TS_LANGS = new Set(['ts', 'tsx', 'typescript'])
const COMPILE_MARKERS = ['verify', 'executable']

interface DocBlock {
  name: string
  content: string
  source: string
  verify: boolean
}

function walkMdx(dir: string): string[] {
  const files: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) files.push(...walkMdx(full))
    else if (e.name.endsWith('.mdx')) files.push(full)
  }
  return files
}

function collectBlocks(files: string[]): { blocks: DocBlock[]; errors: string[] } {
  const blocks: DocBlock[] = []
  const errors: string[] = []
  let counter = 0

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    const rel = file.slice(DOCS_DIR.length + 1)
    let open: { lang?: string; attrs: string; start: number } | null = null
    let buf: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!open) {
        const m = line.match(/^\s*```(?!`)([a-zA-Z][a-zA-Z0-9_-]*)?(.*)$/)
        if (m) {
          open = { lang: m[1], attrs: (m[2] ?? '').trim(), start: i + 1 }
          buf = []
        }
        continue
      }
      if (/^\s*```\s*$/.test(line)) {
        const verify = open.attrs.split(/\s+/).some((t) => COMPILE_MARKERS.includes(t))
        if (verify && !(open.lang && TS_LANGS.has(open.lang))) {
          errors.push(
            `${rel}:${open.start}: 'verify'/'executable' fences must use a TypeScript language (ts, tsx, or typescript)`
          )
        }
        blocks.push({
          name: 'block-' + String(counter).padStart(3, '0') + '.tsx',
          content: buf.join('\n') + '\n',
          source: `${rel}:${open.start}`,
          verify,
        })
        counter++
        open = null
        continue
      }
      buf.push(line)
    }
    if (open) {
      errors.push(`${rel}:${open.start}: unclosed code fence`)
    }
  }
  return { blocks, errors }
}

describe('documentation code blocks', () => {
  let tmpDir: string
  let blocks: DocBlock[]
  let blockErrors: string[]

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tower-docs-'))
    const files = walkMdx(DOCS_DIR)
    const collected = collectBlocks(files)
    blocks = collected.blocks
    blockErrors = collected.errors
  })

  afterAll(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('extracts code blocks from the docs', () => {
    expect(blocks.length).toBeGreaterThan(0)
  })

  it('every fenced code block is well-formed', () => {
    expect(blockErrors).toEqual([])
  })

  it('verify-marked examples compile against Tower types', () => {
    const verifyBlocks = blocks.filter((b) => b.verify)
    if (verifyBlocks.length === 0) return

    const blocksDir = join(tmpDir, 'blocks')
    mkdirSync(blocksDir, { recursive: true })
    for (const block of verifyBlocks) {
      writeFileSync(join(blocksDir, block.name), block.content)
    }

    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'esnext',
            moduleResolution: 'bundler',
            strict: false,
            noEmit: true,
            skipLibCheck: true,
            esModuleInterop: true,
            jsx: 'react-jsx',
            lib: ['ES2022', 'DOM'],
            types: [],
            paths: {
              '@towerjs/tower': [join(ROOT_DIR, 'packages/tower/src/index.ts')],
              '@towerjs/tower/*': [join(ROOT_DIR, 'packages/tower/src/*')],
              '@towerjs/*': [join(ROOT_DIR, 'packages/*/src/index.ts')],
            },
          },
          include: ['blocks/*.tsx'],
        },
        null,
        2
      )
    )

    let output = ''
    try {
      execSync(`tsc --project ${join(tmpDir, 'tsconfig.json')} --noEmit`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: 'pipe',
      })
    } catch (err) {
      output =
        err instanceof Error
          ? `${String((err as { stdout?: string }).stdout ?? '')}${String((err as { stderr?: string }).stderr ?? '')}`
          : String(err)
    }
    const errors = output.split('\n').filter((l) => /block-\d+\.tsx/.test(l))

    const failures = errors.map((line) => {
      const match = line.match(/block-\d+\.tsx/)
      const name = match ? match[0] : line
      const block = verifyBlocks.find((b) => b.name === name)
      return `${line}  [${block?.source ?? 'unknown'}]`
    })
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })
})
