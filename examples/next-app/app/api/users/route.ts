import { tower } from "../../../lib/tower";

export async function GET() {
  const users = await tower.vault.users.findMany();

  return Response.json({ users });
}
