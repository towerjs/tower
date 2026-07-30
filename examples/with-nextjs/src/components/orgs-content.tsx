'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createOrganization } from '@/app/actions'

type OrgsContentProps = {
  orgs: Array<{ id: string; name: string; slug: string }>
}

export function OrgsContent({ orgs }: OrgsContentProps) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(createOrganization, undefined)

  useEffect(() => {
    if (createState && 'ok' in createState) {
      router.refresh()
    }
  }, [createState, router])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {orgs.length > 0
            ? `You're a member of ${orgs.length} organization(s).`
            : 'Create your first organization to get started.'}
        </p>
      </div>

      {orgs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orgs.map((org) => (
            <Link key={org.id} href={`/dashboard/organizations/${org.id}`}>
              <Card className="p-5 hover:border-neutral-500 transition-colors dark:hover:border-neutral-400">
                <h3 className="font-medium">{org.name}</h3>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{org.slug}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h3 className="font-medium mb-4">Create Organization</h3>
        <form action={createAction} className="space-y-4">
          {(createState as any)?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {(createState as any).error}
            </div>
          )}
          <Input name="name" placeholder="Organization name" required />
          <Input name="slug" placeholder="slug" required />
          <Button type="submit" pending={createPending}>Create</Button>
        </form>
      </Card>
    </div>
  )
}
