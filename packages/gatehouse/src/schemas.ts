import { z } from 'zod'

/**
 * zod schema backing the gatehouse module config.
 *
 * Gatehouse config is intentionally loose — it maps almost one-to-one onto
 * better-auth options, including callbacks and plugin options we don't
 * enumerate. This schema validates the developer-facing surface (provider,
 * feature toggles, primitives) so common mistakes fail fast at init, while
 * unknown keys pass through to better-auth untouched.
 */
export const gatehouseConfigSchema = z
  .object({
    provider: z.literal('better-auth'),

    credentials: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),

    emailVerification: z
      .union([
        z.boolean(),
        z
          .object({
            enabled: z.boolean().optional(),
            method: z.enum(['link', 'otp']).optional(),
            required: z.boolean().optional(),
            sendOnSignUp: z.boolean().optional(),
            autoSignInAfterVerification: z.boolean().optional(),
            expiresIn: z.number().int().nonnegative().optional(),
            sendVerificationEmail: z.unknown().optional(),
            sendVerificationOTP: z.unknown().optional(),
          })
          .passthrough(),
      ])
      .optional(),

    social: z
      .union([z.array(z.string()), z.record(z.string(), z.union([z.boolean(), z.record(z.string(), z.unknown())]))])
      .optional(),

    passkeys: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    magicLinks: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    phoneNumber: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    twoFactor: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    organization: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    admin: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),
    apiKey: z.union([z.boolean(), z.record(z.string(), z.unknown())]).optional(),

    baseURL: z
      .union([
        z.string(),
        z
          .object({
            allowedHosts: z.array(z.string()),
            protocol: z.enum(['http', 'https', 'auto']).optional(),
            fallback: z.string().optional(),
          })
          .passthrough(),
      ])
      .optional(),

    appName: z.string().optional(),
    trustedOrigins: z.array(z.string()).optional(),
    plugins: z.array(z.unknown()).optional(),

    user: z.record(z.string(), z.unknown()).optional(),
    session: z.record(z.string(), z.unknown()).optional(),
    account: z.record(z.string(), z.unknown()).optional(),

    rateLimit: z
      .object({
        enabled: z.boolean().optional(),
        window: z.number().int().nonnegative().optional(),
        max: z.number().int().nonnegative().optional(),
        storage: z.enum(['memory', 'database', 'secondary-storage']).optional(),
        customRules: z
          .record(z.string(), z.union([z.object({ window: z.number(), max: z.number() }), z.boolean()]))
          .optional(),
      })
      .passthrough()
      .optional(),

    advanced: z.record(z.string(), z.unknown()).optional(),
    passThrough: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

/** Validates gatehouse module config, prefixing errors with the module name. */
export function parseGatehouseConfig(config: Record<string, unknown>): void {
  try {
    gatehouseConfigSchema.parse(config)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(`[gatehouse] Invalid configuration: ${err.message}`)
    }
    throw err
  }
}
