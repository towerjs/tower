import { vault } from 'towerjs/vault'
import type { VaultModule } from '@towerjs/vault'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: Date
  updated_at: Date
}

const typedVault = vault as VaultModule<{ projects: Project }>

export async function GET() {
  const projects = await typedVault
    .selectFrom('projects')
    .selectAll()
    .execute()

  return Response.json({ projects })
}
