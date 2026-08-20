import { SettingsContent } from '@/components/settings-content'

import { gatehouse } from '@towerjs/tower/gatehouse'

export default async function SettingsPage() {
  const session = await gatehouse.getSession()
  if (!session) return null

  return (
    <SettingsContent
      user={{
        name: session.user.name,
        email: session.user.email,
      }}
    />
  )
}
