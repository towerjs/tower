import { tower } from "towerjs";

export async function POST(request: Request) {
  const body = (await request.json()) as { to: string; subject?: string; text?: string; html?: string }

  if (!body.to) {
    return Response.json({ error: "Missing required field: to" }, { status: 400 })
  }

  const result = await tower.courier.email.send({
    to: body.to,
    subject: body.subject ?? "Tower Courier test email",
    text: body.text ?? "This email was sent through the provider-agnostic Tower Courier API.",
    html: body.html,
  })

  return Response.json({ ok: true, provider: result.provider, id: result.id ?? null })
}
