'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { signUp } from '@towerjs/tower/gatehouse/actions'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

export function SignUpForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState(signUp, undefined)

  useEffect(() => {
    if ((state as any)?.ok) router.push('/dashboard')
  }, [state, router])

  return (
    <form action={action} className="space-y-4">
      {(state as any)?.error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {(state as any).error}
        </div>
      )}
      <Input id="name" name="name" type="text" label="Name" placeholder="Jane Doe" required />
      <Input id="email" name="email" type="email" label="Email" placeholder="you@example.com" required />
      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="At least 8 characters"
        required
        minLength={8}
      />

      <Button type="submit" pending={pending} className="w-full">
        Create account
      </Button>

      <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        Already have an account?{' '}
        <Link
          href="/sign-in"
          className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
