import { OrgsContent } from '@/components/orgs-content'

import { gatehouse } from 'towerjs/gatehouse'

export default async function OrganizationsPage() {
  const orgs = await gatehouse.getOrganizations()

  return <OrgsContent orgs={orgs} />
}
