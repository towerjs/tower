import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const DOCS_DIR = resolve(ROOT_DIR, 'docs')

interface DocBlock {
  name: string
  content: string
  source: string
  importsTower: boolean
}

function isPlanned(file: string): boolean {
  const head = readFileSync(file, 'utf8').split('\n').slice(0, 20).join('\n')
  return /badge:\s*'Coming Soon'/.test(head) || /Status:\s*Planned/.test(head)
}

function extractBlocks(dir: string): DocBlock[] {
  const files: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.mdx')) files.push(full)
    }
  }
  walk(dir)

  const blocks: DocBlock[] = []
  let counter = 0
  for (const file of files) {
    const planned = isPlanned(file)
    const lines = readFileSync(file, 'utf8').split('\n')
    let inBlock = false
    let buf: string[] = []
    let start = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const openMatch = line.match(/^\s*```([a-zA-Z]+)/)
      if (openMatch) {
        const lang = openMatch[1]
        inBlock = /^(ts|tsx|typescript)$/.test(lang)
        if (inBlock) {
          buf = []
          start = i + 1
        }
        continue
      }
      if (/^\s*```\s*$/.test(line) && inBlock) {
        inBlock = false
        if (planned) continue
        const content = buf.join('\n') + '\n'
        blocks.push({
          name: 'block-' + String(counter).padStart(3, '0') + '.tsx',
          content,
          source: `${file.slice(DOCS_DIR.length + 1)}:${start}`,
          importsTower: /from ['"](towerjs|@towerjs)/.test(content),
        })
        counter++
        continue
      }
      if (inBlock) buf.push(line)
    }
  }
  return blocks
}

describe('documentation code blocks', () => {
  let tmpDir: string
  let blocks: DocBlock[]

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'tower-docs-'))
    blocks = extractBlocks(DOCS_DIR)
  })

  afterAll(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  })

  it('extracts at least one executable Tower code block from docs', () => {
    const towerBlocks = blocks.filter((b) => b.importsTower)
    expect(towerBlocks.length).toBeGreaterThan(0)
  })

  it('every documented Tower API example compiles against Tower types', () => {
    const towerBlocks = blocks.filter((b) => b.importsTower)
    const blocksDir = join(tmpDir, 'blocks')
    mkdirSync(blocksDir, { recursive: true })
    for (const block of towerBlocks) {
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
              towerjs: [join(ROOT_DIR, 'packages/towerjs/src/index.ts')],
              'towerjs/*': [join(ROOT_DIR, 'packages/towerjs/src/*')],
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
      const block = blocks.find((b) => b.name === name)
      return `${line}  [${block?.source ?? 'unknown'}]`
    })
    expect(failures, `\n${failures.join('\n')}`).toEqual([])
  })
})
