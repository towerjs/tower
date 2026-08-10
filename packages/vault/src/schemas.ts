import { z } from 'zod'
import type { VaultConfig } from './types.js'

/**
 * zod schema backing the vault module config.
 *
 * Validated when the module initializes so a malformed config fails fast
 * with a clear message instead of an opaque connection error.
 */
export const vaultConfigSchema: z.ZodType<VaultConfig> = z
  .object({
    provider: z.enum(['neon', 'pg']).optional(),
    connectionString: z.string().optional(),
    pool: z
      .object({
        max: z.number().int().nonnegative().optional(),
        idleTimeoutMillis: z.number().int().nonnegative().optional(),
        connectionTimeoutMillis: z.number().int().nonnegative().optional(),
        ssl: z.union([z.boolean(), z.object({ rejectUnauthorized: z.boolean().optional() }).strict()]).optional(),
      })
      .strict()
      .optional(),
    migrations: z.object({ folder: z.string() }).strict().optional(),
    seeds: z.object({ folder: z.string() }).strict().optional(),
  })
  .strict()

/** Validates vault module config, prefixing errors with the module name. */
export function parseVaultConfig(config: VaultConfig | undefined): VaultConfig {
  try {
    return vaultConfigSchema.parse(config ?? {})
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`[vault] Invalid configuration: ${err.message}`)
    }
    throw err
  }
}
