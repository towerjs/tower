'use server'

import { courier } from '@towerjs/courier'
import { action } from '@towerjs/gatehouse/next'

export const sendCourierEmail = action(async (formData: FormData) => {
  const result = await courier.email.send({
    to: formData.get('to') as string,
    subject: (formData.get('subject') as string) || 'Tower Courier test',
    text: (formData.get('body') as string) || 'This is a test email from Tower.',
  })
  return { id: result.id, provider: result.provider }
})
