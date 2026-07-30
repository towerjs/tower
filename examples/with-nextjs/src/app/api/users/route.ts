import { vault } from 'towerjs/vault'
import type { Vault } from '@towerjs/vault'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: Date
  updated_at: Date
}

export async function GET() {
  const projects = await (
    vault.db as unknown as Vault<{ projects: Project }>
  ).selectFrom('projects').selectAll().execute()

  return Response.json({ projects })
}
