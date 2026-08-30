import type { VaultModule } from '@towerjs/vault'
import { vault } from '@towerjs/vault'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: Date
  updated_at: Date
}

type Database = {
  projects: Project
}

export async function GET() {
  const db = vault as unknown as VaultModule<Database>
  const projects = await db.selectFrom('projects').selectAll().execute()

  return Response.json({ projects })
}
