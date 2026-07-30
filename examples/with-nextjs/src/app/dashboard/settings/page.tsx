import { gatehouse } from 'towerjs/gatehouse'
import { SettingsContent } from '@/components/settings-content'

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
