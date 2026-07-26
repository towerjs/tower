import { defineTower } from '@towerjs/blueprint'

const emailProvider = (process.env.COURIER_EMAIL_PROVIDER ?? 'resend') as 'resend' | 'smtp' | 'ses'
const smsEnabled = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
const webPushEnabled = Boolean(
  process.env.WEB_PUSH_VAPID_SUBJECT && process.env.WEB_PUSH_VAPID_PUBLIC_KEY && process.env.WEB_PUSH_VAPID_PRIVATE_KEY
)
const social: Record<string, Record<string, unknown>> = {}
if (process.env.GOOGLE_CLIENT_ID) social.google = {}
if (process.env.GITHUB_CLIENT_ID) social.github = {}

export default defineTower({
  modules: {
    vault: { provider: 'neon' },
    courier: {
      email: {
        provider: emailProvider,
        from: process.env.COURIER_EMAIL_FROM ?? 'Tower <no-reply@example.com>',
      },
      sms: smsEnabled ? { provider: 'twilio' } : undefined,
      push: webPushEnabled ? { provider: 'web-push' } : undefined,
    },
    gatehouse: {
      provider: 'better-auth',
      appName: 'Tower Example',
      credentials: {
        enabled: true,
        autoSignIn: true,
      },
      emailVerification: {
        sendOnSignUp: true,
      },
      magicLinks: true,
      emailOtp: true,
      phoneNumber: smsEnabled ? true : undefined,
      social: Object.keys(social).length > 0 ? social : undefined,
      passkeys: true,
      twoFactor: true,
      organization: true,
      admin: true,
      apiKey: true,
    },
  },
})
