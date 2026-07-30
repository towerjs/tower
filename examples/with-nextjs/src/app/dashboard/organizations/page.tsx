import { gatehouse } from 'towerjs/gatehouse'
import { OrgsContent } from '@/components/orgs-content'

export default async function OrganizationsPage() {
  const orgs = await gatehouse.getOrganizations()

  return <OrgsContent orgs={orgs} />
}
