'use client'

import { useState } from 'react'
import { sendCourierEmail, sendCourierSms, sendCourierPush } from '@/app/actions'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function CourierDemoPage() {
  const [emailResult, setEmailResult] = useState<any>(null)
  const [smsResult, setSmsResult] = useState<any>(null)
  const [pushResult, setPushResult] = useState<any>(null)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Courier</h1>
        <p className="mt-1 text-sm text-neutral-500">Test Tower&apos;s communication channels</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Send an email through the configured provider</CardDescription>
        </CardHeader>
        <form
          action={async (fd: FormData) => {
            const result = await sendCourierEmail(fd)
            setEmailResult(result)
          }}
          className="space-y-4"
        >
          <Input id="email-to" name="to" type="email" label="Recipient" placeholder="user@example.com" required />
          <Input id="email-subject" name="subject" label="Subject" placeholder="Test email from Tower" />
          <Input id="email-body" name="body" label="Body text" placeholder="This is a test." />
          <Button type="submit">Send email</Button>
        </form>
        {emailResult && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Sent via {emailResult.provider} (id: {emailResult.id ?? 'N/A'})
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMS</CardTitle>
          <CardDescription>Send an SMS through the configured provider</CardDescription>
        </CardHeader>
        <form
          action={async (fd: FormData) => {
            const result = await sendCourierSms(fd)
            setSmsResult(result)
          }}
          className="space-y-4"
        >
          <Input id="sms-to" name="to" type="tel" label="Phone number" placeholder="+1234567890" required />
          <Input id="sms-body" name="body" label="Message" placeholder="Hello from Tower!" />
          <Button type="submit">Send SMS</Button>
        </form>
        {smsResult && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Sent via {smsResult.provider} (status: {smsResult.status ?? 'N/A'})
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Web Push</CardTitle>
          <CardDescription>Send a push notification (requires a stored subscription)</CardDescription>
        </CardHeader>
        <form
          action={async (fd: FormData) => {
            const result = await sendCourierPush(fd)
            setPushResult(result)
          }}
          className="space-y-4"
        >
          <Input id="push-title" name="title" label="Title" placeholder="Tower Notification" />
          <Input id="push-body" name="body" label="Body" placeholder="Hello from Tower Push!" />
          <Input
            id="push-sub"
            name="subscription"
            label="Push subscription (JSON)"
            placeholder='{"endpoint":"...","keys":{"p256dh":"...","auth":"..."}}'
          />
          <Button type="submit">Send push</Button>
        </form>
        {pushResult && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Sent via {pushResult.provider} (status: {pushResult.status ?? 'N/A'})
          </div>
        )}
      </Card>
    </div>
  )
}
