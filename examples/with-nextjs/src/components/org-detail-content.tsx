'use client'

import {
  cancelInvitation,
  deleteOrganization,
  inviteMember,
  removeMember,
  updateOrganization,
} from '@/actions/gatehouse'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { useActionState } from 'react'

type OrgDetailContentProps = {
  org: any
  id: string
}

export function OrgDetailContent({ org, id }: OrgDetailContentProps) {
  const [updateState, updateAction, updatePending] = useActionState(updateOrganization, undefined)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteOrganization, undefined)
  const [inviteState, inviteAction, invitePending] = useActionState(inviteMember, undefined)
  const [removeState, removeAction] = useActionState(removeMember, undefined)
  const [_cancelState, cancelAction] = useActionState(cancelInvitation, undefined)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{org.slug}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>Update organization details</CardDescription>
        </CardHeader>
        <form action={updateAction} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          {(updateState as any)?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {(updateState as any).error}
            </div>
          )}
          {(updateState as any)?.ok && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              Organization updated
            </div>
          )}
          <Input id="edit-name" name="name" label="Name" defaultValue={org.name} required />
          <Input id="edit-slug" name="slug" label="Slug" defaultValue={org.slug} required />
          <Button type="submit" pending={updatePending}>
            Save
          </Button>
        </form>
        <form action={deleteAction} className="mt-4">
          <input type="hidden" name="id" value={id} />
          {(deleteState as any)?.ok && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              Deleted
            </div>
          )}
          <Button type="submit" variant="danger" pending={deletePending}>
            Delete organization
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {org.members?.length ?? 0} member{(org.members?.length ?? 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {(org.members ?? []).map((member: any) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {member.user?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {member.role} &middot; {member.user?.email ?? ''}
                </p>
              </div>
              <form action={removeAction}>
                <input type="hidden" name="orgId" value={id} />
                <input type="hidden" name="memberId" value={member.id} />
                {(removeState as any)?.ok && <span className="text-xs text-green-600 mr-2">Removed</span>}
                <Button type="submit" variant="ghost" size="sm">
                  Remove
                </Button>
              </form>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite member</CardTitle>
          <CardDescription>Send an invitation to join this organization</CardDescription>
        </CardHeader>
        <form action={inviteAction} className="space-y-4">
          <input type="hidden" name="orgId" value={id} />
          {(inviteState as any)?.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {(inviteState as any).error}
            </div>
          )}
          {(inviteState as any)?.ok && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              Invitation sent
            </div>
          )}
          <Input
            id="invite-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="colleague@example.com"
            required
          />
          <div>
            <label
              htmlFor="invite-role"
              className="block text-sm font-medium text-neutral-700 mb-1.5 dark:text-neutral-300"
            >
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-neutral-100 dark:focus:ring-neutral-100"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" pending={invitePending}>
            Send invitation
          </Button>
        </form>
      </Card>

      {org.invitations?.filter((inv: any) => inv.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Invitations that have been sent but not yet accepted</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {org.invitations
              .filter((inv: any) => inv.status === 'pending')
              .map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{inv.email}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Role: {inv.role}</p>
                  </div>
                  <form action={cancelAction}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Cancel
                    </Button>
                  </form>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}
