import Link from 'next/link'
import { gatehouse } from 'towerjs/gatehouse'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function DashboardPage() {
  const session = await gatehouse.getSession()
  if (!session) return null
  const { user } = session

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-neutral-500 mt-1 dark:text-neutral-400">Welcome back, {user.name}</p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-lg font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</p>
          </div>
          {user.emailVerified && <Badge variant="success">Verified</Badge>}
        </div>
        <div className="flex gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <span>ID: {user.id.slice(0, 12)}…</span>
          {user.twoFactorEnabled && <Badge>2FA on</Badge>}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/settings" className="card-link">
          <Card className="p-5 space-y-1">
            <h3 className="font-medium">Settings</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Update your name and password</p>
          </Card>
        </Link>
        <Link href="/dashboard/security" className="card-link">
          <Card className="p-5 space-y-1">
            <h3 className="font-medium">Security</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Two-factor auth, passkeys, and sessions</p>
          </Card>
        </Link>
        <Link href="/dashboard/organizations" className="card-link">
          <Card className="p-5 space-y-1">
            <h3 className="font-medium">Organizations</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage teams and members</p>
          </Card>
        </Link>
        <Link href="/dashboard/courier" className="card-link">
          <Card className="p-5 space-y-1">
            <h3 className="font-medium">Courier</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Send test emails through the configured provider
            </p>
          </Card>
        </Link>
      </div>
    </div>
  )
}
