import { execSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function globalSetup() {
  const script = resolve(__dirname, 'migrate-for-tests.ts')
  execSync(`npx tsx "${script}"`, {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  })

  const response = await fetch('http://localhost:3000/dashboard', { redirect: 'manual' })
  if (response.status < 300 || response.status >= 400 || !response.headers.get('location')?.endsWith('/sign-in')) {
    throw new Error(
      `E2E preflight expected /dashboard to redirect to /sign-in, received ${response.status} ${response.headers.get('location') ?? ''}`
    )
  }
}

export default globalSetup
