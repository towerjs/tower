import { tower } from "towerjs";
import { AuthEmailTemplate } from "@/lib/emails/auth-email";

type SendEmailBody = {
  to: string
  heading?: string
  intro?: string
  actionLabel?: string
  actionUrl?: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as SendEmailBody

  if (!body.to) {
    return Response.json(
      { error: "Missing required field: to" },
      { status: 400 },
    )
  }

  const result = await tower.messenger.email.send({
    to: body.to,
    subject: "Tower Messenger test email",
    react: (
      <AuthEmailTemplate
        heading={body.heading ?? "Tower Messenger is live"}
        intro={
          body.intro ??
          "This email was sent through the provider-agnostic Tower Messenger API."
        }
        actionLabel={body.actionLabel ?? "Open dashboard"}
        actionUrl={body.actionUrl ?? "https://example.com/dashboard"}
      />
    ),
  })

  return Response.json({
    ok: true,
    provider: result.provider,
    id: result.id ?? null,
  })
}

