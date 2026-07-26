/** @internal Runs better-auth database migrations. Exported separately to avoid bundler resolution issues. */
export async function runBetterAuthMigrations(authOptions: any): Promise<void> {
  // @ts-ignore — better-auth does not export get-migration from its package entrypoint
  const { getMigrations } = (await import('better-auth/dist/db/get-migration.mjs')) as {
    getMigrations: (options: any) => Promise<{ runMigrations: () => Promise<void> }>
  }
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()
}
