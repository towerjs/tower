import { courier } from 'towerjs/courier'

export async function POST(request: Request) {
  const body = (await request.json()) as {
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
    title?: string
    body?: string
    data?: Record<string, unknown>
  }

  if (!body.subscription?.endpoint || !body.subscription?.keys?.p256dh || !body.subscription?.keys?.auth) {
    return Response.json({ error: 'Missing required field: subscription with endpoint and keys' }, { status: 400 })
  }

  const result = await courier.push.send({
    subscription: body.subscription,
    title: body.title ?? 'Tower Courier test push',
    body: body.body ?? 'Push channel is active.',
    data: body.data ?? { source: 'with-nextjs-example' },
  })

  return Response.json({ ok: true, provider: result.provider, status: result.status ?? null })
}
