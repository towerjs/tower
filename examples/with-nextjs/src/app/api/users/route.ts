import { vault } from 'towerjs/vault'

export async function GET() {
  const projects = await (vault as any).selectFrom('projects').selectAll().execute()

  return Response.json({ projects })
}
