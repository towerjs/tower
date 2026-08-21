import { SecurityContent } from '@/components/security-content'

import { gatehouse } from '@towerjs/gatehouse'

export default async function SecurityPage() {
  const session = await gatehouse.getSession()
  if (!session) return null
  const userSessions = await gatehouse.getUserSessions()

  return (
    <SecurityContent
      user={{
        id: session!.user.id,
        email: session!.user.email,
        twoFactorEnabled: session!.user.twoFactorEnabled,
      }}
      sessions={userSessions}
    />
  )
}
