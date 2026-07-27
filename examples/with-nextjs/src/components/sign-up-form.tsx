'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signUp } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SignUpForm() {
  const [pending, setPending] = useState(false)

  return (
    <form action={signUp} onSubmit={() => setPending(true)} className="space-y-4">
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
        <Link href="/sign-in" className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100">
          Sign in
        </Link>
      </p>
    </form>
  )
}
