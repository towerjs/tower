import { gatehouse } from 'towerjs/gatehouse'
import { SecurityContent } from '@/components/security-content'

export default async function SecurityPage() {
  const session = await gatehouse.getSession()
  if (!session) return null
  const userSessions = await gatehouse.getUserSessions()
  const apiKeys = await gatehouse.getApiKeys(session.user.id)

  return (
    <SecurityContent
      user={{
        id: session!.user.id,
        email: session!.user.email,
        twoFactorEnabled: session!.user.twoFactorEnabled,
      }}
      sessions={userSessions}
      apiKeys={apiKeys}
    />
  )
}
