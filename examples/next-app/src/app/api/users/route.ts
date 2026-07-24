import { tower } from "towerjs";

export async function GET() {
  const projects = await tower.vault.db
    .selectFrom("projects")
    .selectAll()
    .execute();

  return Response.json({ projects });
}
