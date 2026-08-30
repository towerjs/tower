'use server'

import { courier } from '@towerjs/courier'
import { createGatehouseAction } from '@towerjs/gatehouse/next'

import tower from '../../tower.config'

export const sendCourierEmail = createGatehouseAction(tower, async (formData: FormData) => {
  const result = await courier.email.send({
    to: formData.get('to') as string,
    subject: (formData.get('subject') as string) || 'Tower Courier test',
    text: (formData.get('body') as string) || 'This is a test email from Tower.',
  })
  return { id: result.id, provider: result.provider }
})
