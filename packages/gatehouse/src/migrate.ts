import type { Kysely } from 'kysely'

/**
 * Runs better-auth database migrations.
 *
 * This is a separate entry point to avoid bundler issues with better-auth's
 * internal module resolution at build time.
 */
export async function runBetterAuthMigrations(authOptions: any, _db: Kysely<unknown>): Promise<void> {
  // @ts-ignore — better-auth does not export this module
  const { getMigrations } = (await import('better-auth/dist/db/get-migration.mjs')) as {
    getMigrations: (options: any) => Promise<{ runMigrations: () => Promise<void> }>
  }
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()
}
