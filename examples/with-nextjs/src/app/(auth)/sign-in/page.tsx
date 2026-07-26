import { SignInForm } from '@/components/sign-in-form'

const socialEnabled = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GITHUB_CLIENT_ID)

export default function SignInPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Welcome back</h1>
      <SignInForm socialEnabled={socialEnabled} />
    </div>
  )
}
