import { tower } from "@/tower";

export async function GET() {
  const users = await tower.gatehouse.users.list();

  const projects = await tower.vault.db
    .selectFrom("projects")
    .selectAll()
    .execute();

  return Response.json({ users, projects });
}
