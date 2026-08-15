import { describe, expect, it, vi } from 'vitest'

import { ConsoleEmailProvider } from './console.js'

describe('ConsoleEmailProvider', () => {
  it('logs email and returns result', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const provider = new ConsoleEmailProvider({ provider: 'console', from: 'test@example.com' })

    const result = await provider.send({
      to: 'user@example.com',
      subject: 'Hello',
      text: 'World',
    })

    expect(spy).toHaveBeenCalledOnce()
    const logged = JSON.parse(spy.mock.calls[0][1])
    expect(logged.to).toEqual('user@example.com')
    expect(logged.subject).toEqual('Hello')
    expect(logged.text).toEqual('World')
    expect(logged.from).toEqual('test@example.com')

    expect(result).toEqual({ provider: 'console' })

    spy.mockRestore()
  })

  it('works without from in config', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const provider = new ConsoleEmailProvider({ provider: 'console' })

    const result = await provider.send({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>hi</p>',
    })

    expect(spy).toHaveBeenCalledOnce()
    expect(result.provider).toBe('console')

    spy.mockRestore()
  })
})
