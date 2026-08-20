'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { changePassword, updateProfile } from '@towerjs/tower/gatehouse/actions'

import { useActionState } from 'react'

type SettingsContentProps = {
  user: { name: string; email: string }
}

export function SettingsContent({ user }: SettingsContentProps) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, undefined)
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, undefined)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and public information</CardDescription>
        </CardHeader>
        <form action={profileAction} className="space-y-4">
          {(profileState as any)?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {(profileState as any).error}
            </div>
          )}
          {(profileState as any)?.ok && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              Profile updated
            </div>
          )}
          <Input id="name" name="name" label="Name" defaultValue={user.name} required />
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{user.email}</p>
          </div>
          <Button type="submit" pending={profilePending}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <form action={passwordAction} className="space-y-4">
          {(passwordState as any)?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {(passwordState as any).error}
            </div>
          )}
          {(passwordState as any)?.ok && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              Password updated
            </div>
          )}
          <Input id="currentPassword" name="currentPassword" type="password" label="Current password" required />
          <Input id="newPassword" name="newPassword" type="password" label="New password" required minLength={8} />
          <Button type="submit" pending={passwordPending}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  )
}
