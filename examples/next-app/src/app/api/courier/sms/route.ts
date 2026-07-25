import { tower } from "towerjs";

type SendSmsBody = {
  to: string
  body?: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as SendSmsBody

  if (!body.to) {
    return Response.json(
      { error: "Missing required field: to" },
      { status: 400 },
    )
  }

  const result = await tower.courier.sms.send({
    to: body.to,
    body: body.body ?? "Tower Courier test SMS.",
  })

  return Response.json({
    ok: true,
    provider: result.provider,
    id: result.id ?? null,
    status: result.status ?? null,
  })
}

