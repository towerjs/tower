'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/app/actions'

export function SignOutButton() {
  const router = useRouter()
  const [state, action, pending] = useActionState(signOut, undefined)

  useEffect(() => {
    if ((state as any)?.ok) router.push('/sign-in')
  }, [state, router])

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
    </form>
  )
}
