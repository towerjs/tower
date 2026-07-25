import { tower } from "towerjs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    to: string
    ipAddress?: string
    userAgent?: string
  }

  if (!body.to) {
    return Response.json({ error: "Missing required field: to" }, { status: 400 })
  }

  const ip = body.ipAddress ?? "unknown"
  const userAgent = body.userAgent ?? "unknown"

  const result = await tower.courier.email.send({
    to: body.to,
    subject: "New login to your account",
    text: `A new login was detected.\nIP: ${ip}\nDevice: ${userAgent}`,
    html: `<p>A new login was detected.</p><p>IP: ${ip}<br>Device: ${userAgent}</p>`,
  })

  return Response.json({ ok: true, provider: result.provider, id: result.id ?? null })
}
