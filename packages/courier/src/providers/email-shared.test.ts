import { type ReactElement, createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { resolveEmailContent, toAddressList } from './email-shared.js'

vi.mock('@react-email/render', () => ({
  render: vi.fn(async (el: ReactElement) => `<html>${JSON.stringify(el)}</html>`),
  toPlainText: vi.fn(async (html: string) => html.replace(/<[^>]*>/g, '')),
}))

function h(children: string): ReactElement {
  return createElement('h1', null, children)
}

describe('toAddressList', () => {
  it('returns undefined for undefined', () => {
    expect(toAddressList(undefined)).toBeUndefined()
  })

  it('wraps a single string in an array', () => {
    expect(toAddressList('alice@example.com')).toEqual(['alice@example.com'])
  })

  it('returns an array as-is', () => {
    expect(toAddressList(['a@b.com', 'c@d.com'])).toEqual(['a@b.com', 'c@d.com'])
  })
})

describe('resolveEmailContent', () => {
  it('uses html when provided', async () => {
    const result = await resolveEmailContent({ to: 'a@b.com', subject: 'x', html: '<p>hi</p>' })
    expect(result.html).toBe('<p>hi</p>')
  })

  it('derives text from html when text is missing', async () => {
    const result = await resolveEmailContent({ to: 'a@b.com', subject: 'x', html: '<p>hello</p>' })
    expect(result.text).toBe('hello')
  })

  it('keeps explicit text when both html and text are provided', async () => {
    const result = await resolveEmailContent({ to: 'a@b.com', subject: 'x', html: '<p>html</p>', text: 'plain' })
    expect(result.text).toBe('plain')
  })

  it('renders react template when no html', async () => {
    const result = await resolveEmailContent({ to: 'a@b.com', subject: 'x', react: h('Hello') })
    expect(result.html).toContain('html')
    expect(result.html).toContain('h1')
    expect(result.html).toContain('Hello')
  })

  it('prefers explicit html over react template', async () => {
    const result = await resolveEmailContent({
      to: 'a@b.com',
      subject: 'x',
      html: '<p>explicit</p>',
      react: h('Hello'),
    })
    expect(result.html).toBe('<p>explicit</p>')
  })

  it('throws when no body is provided', async () => {
    await expect(resolveEmailContent({ to: 'a@b.com', subject: 'x' })).rejects.toThrow('[courier.email] Missing body')
  })
})
