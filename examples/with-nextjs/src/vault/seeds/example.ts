import type { Vault } from '@towerjs/vault'

export default async function seed(db: Vault) {
  await (db as unknown as Vault<{ projects: { name: string; description: string | null } }>)
    .insertInto('projects')
    .values([
      { name: 'Acme Corp Website', description: 'Company website redesign' },
      { name: 'Internal Dashboard', description: 'Admin dashboard for the team' },
    ])
    .execute()
}
