import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function globalSetup() {
  const script = resolve(__dirname, 'migrate-for-tests.ts')
  execSync(`npx tsx "${script}"`, {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  })
}

export default globalSetup
