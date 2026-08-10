/** @internal Runs better-auth database migrations. Exported separately to avoid bundler resolution issues. */
export async function runBetterAuthMigrations(authOptions: any): Promise<void> {
  const { getMigrations } = (await import('better-auth/db/migration')) as {
    getMigrations: (options: any) => Promise<{ runMigrations: () => Promise<void> }>
  }
  const { runMigrations } = await getMigrations(authOptions)
  await runMigrations()
}
