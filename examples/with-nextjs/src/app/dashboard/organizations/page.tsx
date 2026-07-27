import Link from 'next/link'
import { gatehouse } from 'towerjs/gatehouse'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createOrganization } from '@/app/actions'

export default async function OrganizationsPage() {
  const orgs = await gatehouse.getOrganizations()

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
        <form action={createOrganization} className="space-y-4">
          <Input name="name" placeholder="Organization name" required />
          <Input name="slug" placeholder="slug" required />
          <Button type="submit">Create</Button>
        </form>
      </Card>
    </div>
  )
}
