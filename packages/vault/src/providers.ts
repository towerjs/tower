import type { VaultPoolConfig } from './types.js'

export type VaultProviderName = 'neon' | 'pg'

/**
 * Vault provider abstraction.
 *
 * A provider owns how Tower creates a Kysely dialect for a given connection
 * string. Built-ins cover the curated infrastructure (Neon HTTP and standard
 * pg TCP); a custom provider can be supplied for other Postgres hosts without
 * changing application code.
 *
 * Application code never constructs a provider directly in the common case—
 * `provider: 'neon' | 'pg'` (or auto-detection) selects the built-in.
 */
export interface VaultProvider {
  readonly name: VaultProviderName
  /**
   * Creates a Kysely dialect for the provider.
   *
   * The dialect is the only provider-specific surface; the rest of Vault
   * (query builder, migrations, transactions) stays provider-agnostic.
   */
  createDialect(options: {
    connectionString: string
    poolConfig?: VaultPoolConfig
    runtime?: { name: string; isServerless: boolean }
  }): Promise<import('kysely').Dialect> | import('kysely').Dialect
}

export async function resolveVaultProvider(name: VaultProviderName): Promise<VaultProvider> {
  if (name === 'neon') return neonProvider
  return pgProvider
}

export function resolveProviderName(
  config: { provider?: VaultProviderName | VaultProvider; connectionString: string } | undefined,
  connectionString: string
): VaultProviderName {
  const provider = config?.provider
  if (typeof provider === 'string') return provider
  if (provider && typeof provider === 'object' && 'name' in provider) return provider.name
  if (connectionString.includes('.neon.tech')) return 'neon'
  return 'pg'
}

function resolveSsl(
  poolConfig: VaultPoolConfig | undefined,
  connectionString: string
): boolean | { rejectUnauthorized?: boolean } | undefined {
  if (poolConfig?.ssl !== undefined) return poolConfig.ssl
  const sslmode = /[?&]sslmode=([^&]+)/.exec(connectionString)?.[1]
  if (sslmode) {
    if (sslmode === 'disable' || sslmode === 'prefer') return false
    if (sslmode === 'no-verify') return { rejectUnauthorized: false }
    return true
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return true
  return undefined
}

export const pgProvider: VaultProvider = {
  name: 'pg',
  async createDialect({ connectionString, poolConfig, runtime }) {
    const isEdge = runtime?.name === 'edge'
    const ssl = resolveSsl(poolConfig, connectionString)

    if (isEdge) {
      throw new Error(
        'The pg provider requires a TCP connection which is not available on Edge Runtime. ' +
          'Use the neon provider instead (e.g., { provider: "neon" }).'
      )
    }

    const config: Record<string, unknown> = { connectionString }
    if (poolConfig?.max) config.max = poolConfig.max
    if (poolConfig?.idleTimeoutMillis) config.idleTimeoutMillis = poolConfig.idleTimeoutMillis
    if (poolConfig?.connectionTimeoutMillis) config.connectionTimeoutMillis = poolConfig.connectionTimeoutMillis

    const { Pool: PgPool } = await import('pg')
    const pool = new PgPool(ssl !== undefined ? { ...config, ssl } : config)

    pool.on('error', () => {
      /* pg pool errors are handled by query timeouts */
    })

    const { PostgresDialect } = await import('kysely')
    const dialect = new PostgresDialect({ pool: pool as any })
    // Stash pool on dialect for lifecycle management; index.ts extracts it.
    ;(dialect as any).__vaultPool = pool
    return dialect
  },
}

export const neonProvider: VaultProvider = {
  name: 'neon',
  async createDialect({ connectionString }) {
    const [{ NeonDialect }, { neon }] = await Promise.all([import('kysely-neon'), import('@neondatabase/serverless')])
    return new NeonDialect({ neon: neon(connectionString) })
  },
}

export function getPoolFromDialect(dialect: import('kysely').Dialect): { end(): Promise<void> } | undefined {
  return (dialect as any).__vaultPool
}
