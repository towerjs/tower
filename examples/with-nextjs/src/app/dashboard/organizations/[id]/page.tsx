import { getOrganization } from 'towerjs/gatehouse/next'
import { notFound } from 'next/navigation'
import { updateOrganization, deleteOrganization, inviteMember, removeMember, cancelInvitation } from '@/app/actions'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const org = await getOrganization(id)
  if (!org) notFound()

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">{org.slug}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>Update organization details</CardDescription>
        </CardHeader>
        <form action={updateOrganization} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <Input id="edit-name" name="name" label="Name" defaultValue={org.name} required />
          <Input id="edit-slug" name="slug" label="Slug" defaultValue={org.slug} required />
          <div className="flex gap-3">
            <Button type="submit">Save</Button>
            <form action={deleteOrganization}>
              <input type="hidden" name="id" value={id} />
              <Button type="submit" variant="danger">
                Delete organization
              </Button>
            </form>
          </div>
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
            <div key={member.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{member.user?.name ?? 'Unknown'}</p>
                <p className="text-xs text-neutral-500">
                  {member.role} &middot; {member.user?.email ?? ''}
                </p>
              </div>
              <form action={removeMember}>
                <input type="hidden" name="orgId" value={id} />
                <input type="hidden" name="memberId" value={member.id} />
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
        <form action={inviteMember} className="space-y-4">
          <input type="hidden" name="orgId" value={id} />
          <Input
            id="invite-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="colleague@example.com"
            required
          />
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-neutral-700 mb-1.5">
              Role
            </label>
            <select
              id="invite-role"
              name="role"
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit">Send invitation</Button>
        </form>
      </Card>

      {org.invitations && org.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>Invitations that have been sent but not yet accepted</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {(org.invitations as any[]).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{inv.email}</p>
                  <p className="text-xs text-neutral-500">Role: {inv.role}</p>
                </div>
                <form action={cancelInvitation}>
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
