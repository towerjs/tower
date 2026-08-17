'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

import { useState } from 'react'
import {
  disableTwoFactor,
  enableTwoFactor,
  generateBackupCodes,
  revokeOtherSessions,
  revokeSession,
  verifyTwoFactor,
} from 'towerjs/gatehouse/actions'

type SecurityContentProps = {
  user: {
    id: string
    email: string
    twoFactorEnabled?: boolean
  }
  sessions: Array<{
    id: string
    token: string
    ipAddress?: string | null
    userAgent?: string | null
    createdAt?: Date | string
  }>
}

export function SecurityContent({ user, sessions }: SecurityContentProps) {
  const [tab, setTab] = useState<string>('2fa')
  const [totpQr, setTotpQr] = useState<string | null>(null)
  const [backupCodesList, setBackupCodesList] = useState<string[] | null>(null)

  const TABS = [
    { id: '2fa', label: 'Two-factor' },
    { id: 'passkeys', label: 'Passkeys' },
    { id: 'sessions', label: 'Sessions' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Manage your security settings</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === '2fa' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authenticator app</CardTitle>
              <CardDescription>
                {user.twoFactorEnabled
                  ? 'Two-factor authentication is enabled'
                  : 'Add an extra layer of security to your account'}
              </CardDescription>
            </CardHeader>

            {!user.twoFactorEnabled && !totpQr && (
              <form
                action={async (fd: FormData) => {
                  const result = await enableTwoFactor(fd)
                  setTotpQr(result.totpURI)
                }}
                className="space-y-4"
              >
                <Input id="password-2fa" name="password" type="password" label="Confirm your password" required />
                <Button type="submit">Enable two-factor</Button>
              </form>
            )}

            {totpQr && (
              <div className="space-y-4">
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                  <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Scan this QR code in your authenticator app:
                  </p>
                  <p className="break-all rounded bg-white p-3 text-xs text-neutral-600 font-mono dark:bg-neutral-950 dark:text-neutral-400">
                    {totpQr}
                  </p>
                </div>
                <form
                  action={async (fd: FormData) => {
                    await verifyTwoFactor(fd)
                    setTotpQr(null)
                  }}
                  className="space-y-4"
                >
                  <Input
                    id="code-2fa"
                    name="code"
                    label="Verification code"
                    placeholder="Enter the 6-digit code"
                    required
                  />
                  <Button type="submit">Verify and enable</Button>
                </form>
              </div>
            )}

            {user.twoFactorEnabled && (
              <form
                action={async (fd: FormData) => {
                  await disableTwoFactor(fd)
                  setTotpQr(null)
                }}
                className="space-y-4"
              >
                <Input
                  id="password-disable-2fa"
                  name="password"
                  type="password"
                  label="Confirm your password"
                  required
                />
                <Button type="submit" variant="danger">
                  Disable two-factor
                </Button>
              </form>
            )}
          </Card>

          {user.twoFactorEnabled && !backupCodesList && (
            <Card>
              <CardHeader>
                <CardTitle>Backup codes</CardTitle>
                <CardDescription>Generate recovery codes in case you lose access</CardDescription>
              </CardHeader>
              <form
                action={async (fd: FormData) => {
                  const codes = await generateBackupCodes(fd)
                  setBackupCodesList(codes)
                }}
                className="space-y-4"
              >
                <Input id="password-backup" name="password" type="password" label="Confirm your password" required />
                <Button type="submit">Generate backup codes</Button>
              </form>
            </Card>
          )}

          {backupCodesList && (
            <Card>
              <CardHeader>
                <CardTitle>Your backup codes</CardTitle>
                <CardDescription>Save these somewhere safe. Each code can be used only once.</CardDescription>
              </CardHeader>
              <div className="space-y-2">
                {backupCodesList.map((code, i) => (
                  <div key={i} className="rounded bg-neutral-100 px-3 py-2 font-mono text-sm dark:bg-neutral-800">
                    {code}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBackupCodesList(null)
                  }}
                >
                  Done — I saved them
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'passkeys' && (
        <Card>
          <CardHeader>
            <CardTitle>Passkeys</CardTitle>
            <CardDescription>Use biometric or security key authentication</CardDescription>
          </CardHeader>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Passkey registration requires the WebAuthn browser API. Add a passkey from your browser&apos;s autofill
            settings.
          </p>
        </Card>
      )}

      {tab === 'sessions' && (
        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>Sessions signed into your account</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {s.userAgent ? s.userAgent.split('/')[0] || 'Unknown device' : 'Unknown device'}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.ipAddress || 'Unknown IP'}</p>
                </div>
                <form
                  action={(formData) => {
                    revokeSession(formData)
                  }}
                >
                  <input type="hidden" name="token" value={s.token} />
                  <Button type="submit" variant="ghost" size="sm">
                    Revoke
                  </Button>
                </form>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <form
              action={(formData) => {
                revokeOtherSessions(formData)
              }}
            >
              <Button type="submit" variant="secondary" size="sm">
                Revoke all other sessions
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  )
}
