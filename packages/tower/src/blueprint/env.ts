/**
 * Read environment values from application configuration.
 *
 * Keep architecture in `tower.config.ts` and environment-specific values in
 * `.env` files or the deployment environment. These helpers intentionally
 * read lazily so importing a config remains safe in SSR and edge runtimes.
 */
function read(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined
}

function required(name: string): string {
  const value = read(name)
  if (!value) throw new Error(`Tower configuration error: ${name} is required.`)
  return value
}

export const env = Object.assign(
  (name: string, fallback?: string): string => read(name) ?? fallback ?? required(name),
  {
    string(name: string, fallback?: string): string {
      return read(name) ?? fallback ?? required(name)
    },
    optional(name: string): string | undefined {
      return read(name)
    },
    url(name: string, fallback?: string): string {
      const value = read(name) ?? fallback ?? required(name)
      try {
        const parsed = new URL(value)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol')
      } catch {
        throw new Error(`Tower configuration error: ${name} must be a valid URL. Received: ${value}`)
      }
      return value
    },
    boolean(name: string, fallback?: boolean): boolean {
      const value = read(name)
      if (value === undefined) return fallback ?? required(name) === 'true'
      if (value === 'true' || value === '1') return true
      if (value === 'false' || value === '0') return false
      throw new Error(`Tower configuration error: ${name} must be a boolean. Received: ${value}`)
    },
    number(name: string, fallback?: number): number {
      const value = read(name)
      if (value === undefined) return fallback ?? Number(required(name))
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        throw new Error(`Tower configuration error: ${name} must be a number. Received: ${value}`)
      }
      return parsed
    },
  }
)
