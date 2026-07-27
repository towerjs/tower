import { gatehouse } from 'towerjs/gatehouse'
import { updateProfile, changePassword } from '@/app/actions'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default async function SettingsPage() {
  const session = await gatehouse.getSession()
  if (!session) return null
  const { user } = session

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and public information</CardDescription>
        </CardHeader>
        <form action={updateProfile} className="space-y-4">
          <Input id="name" name="name" label="Name" defaultValue={user.name} required />
          <div>
            <label className="block text-sm font-medium text-neutral-700">Email</label>
            <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <form action={changePassword} className="space-y-4">
          <Input id="currentPassword" name="currentPassword" type="password" label="Current password" required />
          <Input id="newPassword" name="newPassword" type="password" label="New password" required minLength={8} />
          <Button type="submit">Update password</Button>
        </form>
      </Card>
    </div>
  )
}
