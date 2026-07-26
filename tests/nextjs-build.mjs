import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const EXAMPLE_DIR = new URL('../examples/with-nextjs', import.meta.url).pathname
const NEXT_DIR = resolve(EXAMPLE_DIR, '.next')

console.log('[acceptance] Next.js build test')
console.log('  example:', EXAMPLE_DIR)
console.log('')

if (!existsSync(resolve(EXAMPLE_DIR, 'node_modules'))) {
  console.log('[setup] Installing dependencies...')
  execSync('pnpm install', { cwd: EXAMPLE_DIR, stdio: 'inherit' })
}

console.log('[build] Running next build...')
execSync('pnpm build', { cwd: EXAMPLE_DIR, stdio: 'inherit' })

if (!existsSync(NEXT_DIR)) {
  console.error('[FAIL] .next directory not found — build did not produce output')
  process.exit(1)
}

if (!existsSync(resolve(NEXT_DIR, 'build-manifest.json'))) {
  console.error('[FAIL] build-manifest.json not found — build incomplete')
  process.exit(1)
}

console.log('[PASS] .next/ exists with build-manifest.json')
