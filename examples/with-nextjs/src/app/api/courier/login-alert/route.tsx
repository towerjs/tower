import { courier } from 'towerjs/courier'
import { AuthEmailTemplate } from '@/lib/emails/auth-email'

export async function POST(request: Request) {
  const body = (await request.json()) as {
    to: string
    ipAddress?: string
    userAgent?: string
  }

  if (!body.to) {
    return Response.json({ error: 'Missing required field: to' }, { status: 400 })
  }

  const ip = body.ipAddress ?? 'unknown'
  const userAgent = body.userAgent ?? 'unknown'

  const result = await courier.email.send({
    to: body.to,
    subject: 'New login to your account',
    react: (
      <AuthEmailTemplate
        heading="New login detected"
        intro={`A new login was detected.\nIP: ${ip}\nDevice: ${userAgent}`}
        actionLabel="Review account activity"
        actionUrl="https://example.com/settings/security"
      />
    ),
  })

  return Response.json({ ok: true, provider: result.provider, id: result.id ?? null })
}
