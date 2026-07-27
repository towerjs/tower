'use client'

import { useState } from 'react'
import { sendCourierEmail } from '@/app/actions'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SendResult = {
  id?: string
  provider: string
}

export default function CourierDemoPage() {
  const [emailResult, setEmailResult] = useState<SendResult | null>(null)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Courier</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Test Tower&apos;s email channel</p>
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
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
            Sent via {emailResult.provider} (id: {emailResult.id ?? 'N/A'})
          </div>
        )}
      </Card>
    </div>
  )
}
