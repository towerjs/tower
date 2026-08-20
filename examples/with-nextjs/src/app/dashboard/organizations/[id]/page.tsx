import { OrgDetailContent } from '@/components/org-detail-content'

import { gatehouse } from '@towerjs/tower/gatehouse'

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const org = await gatehouse.getOrganization(id)

  if (!org) return null

  return <OrgDetailContent org={org} id={id} />
}
