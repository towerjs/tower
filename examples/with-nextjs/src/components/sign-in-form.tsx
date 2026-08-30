'use client'

import { requestMagicLink, sendVerificationOTP, signIn, signInWithOTP } from '@/actions/gatehouse'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { ActionResult } from '@towerjs/gatehouse/next'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

const TABS = [
  { id: 'password', label: 'Password' },
  { id: 'magic-link', label: 'Magic Link' },
  { id: 'email-otp', label: 'Email OTP' },
] as const

export function SignInForm() {
  const router = useRouter()
  const [tab, setTab] = useState<string>('password')
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const [pw, pwAction, pwPending] = useActionState<ActionResult | undefined, FormData>(signIn, undefined)
  const [magic, magicAction, magicPending] = useActionState<ActionResult | undefined, FormData>(
    requestMagicLink,
    undefined
  )
  const [otpSend, otpSendAction, otpSendPending] = useActionState<ActionResult | undefined, FormData>(
    sendVerificationOTP,
    undefined
  )
  const [otpVerify, otpVerifyAction, otpVerifyPending] = useActionState<ActionResult | undefined, FormData>(
    signInWithOTP,
    undefined
  )

  useEffect(() => {
    if (pw?.ok || otpVerify?.ok) router.push('/dashboard')
  }, [pw, otpVerify, router])

  useEffect(() => {
    if (otpSend?.ok) setOtpSent(true)
  }, [otpSend])

  const isEmailOtp = tab === 'email-otp'
  const firstStepAction = tab === 'password' ? pwAction : tab === 'magic-link' ? magicAction : otpSendAction
  const firstStepPending = tab === 'password' ? pwPending : tab === 'magic-link' ? magicPending : otpSendPending
  const firstStepState: ActionResult | undefined = tab === 'password' ? pw : tab === 'magic-link' ? magic : otpSend
  const secondStepState: ActionResult | undefined = otpVerify

  const error = (state: ActionResult | undefined) =>
    state?.error && (
      <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
        {state.error}
      </div>
    )

  const socialButtons = (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
            Or continue with
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <>
          <a
            href="/api/auth/sign-in/google?callbackURL=/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </a>
          <a
            href="/api/auth/sign-in/github?callbackURL=/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </>
      </div>
    </div>
  )

  const switchTab = (next: string) => {
    setTab(next)
    setOtpSent(false)
  }

  return (
    <div>
      <div className="mb-6 flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isEmailOtp && otpSent ? (
        <form action={otpVerifyAction} className="space-y-4">
          {error(secondStepState)}
          <input type="hidden" name="email" value={email} />
          <Input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            label="Verification code"
            placeholder="Enter the code sent to your email"
            required
          />
          <Button type="submit" pending={otpVerifyPending} className="mt-6 w-full">
            Verify code
          </Button>
        </form>
      ) : (
        <form action={firstStepAction} className="space-y-4">
          {error(firstStepState)}
          {magic?.ok && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              If an account exists for that email, we&apos;ve sent you a magic link.
            </div>
          )}
          <input type="hidden" name="type" value="sign-in" />
          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {tab === 'password' && (
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="Your password"
              required
            />
          )}

          <Button type="submit" pending={firstStepPending} className="mt-6 w-full">
            {tab === 'magic-link' ? 'Send magic link' : isEmailOtp ? 'Send code' : 'Sign in'}
          </Button>
        </form>
      )}

      {socialButtons}

      <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        No account?{' '}
        <Link
          href="/sign-up"
          className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100"
        >
          Sign up
        </Link>
      </p>
    </div>
  )
}
