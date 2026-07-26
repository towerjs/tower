import { getSession, getUserSessions, getApiKeys } from 'towerjs/gatehouse/next'
import { SecurityContent } from '@/components/security-content'

export default async function SecurityPage() {
  const session = await getSession()
  if (!session) return null
  const userSessions = await getUserSessions()
  const apiKeys = await getApiKeys(session.user.id)

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
