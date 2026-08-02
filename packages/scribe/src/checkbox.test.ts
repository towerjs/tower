import { describe, it, expect } from 'vitest'
import { toggleLinked } from './checkbox.js'

describe('toggleLinked', () => {
  const link = { gatehouse: ['courier'] }

  it('checks linked choices when a choice is toggled on', () => {
    const items = [
      { value: 'vault', checked: false },
      { value: 'gatehouse', checked: false },
      { value: 'courier', checked: false },
    ]

    const result = toggleLinked(items, 1, link)

    expect(result[1].checked).toBe(true)
    expect(result[2].checked).toBe(true)
    expect(result[0].checked).toBe(false)
  })

  it('does not uncheck linked choices when a choice is toggled off', () => {
    const items = [
      { value: 'vault', checked: false },
      { value: 'gatehouse', checked: true },
      { value: 'courier', checked: true },
    ]

    const result = toggleLinked(items, 1, link)

    expect(result[1].checked).toBe(false)
    expect(result[2].checked).toBe(true)
  })

  it('toggles the active choice and leaves others untouched', () => {
    const items = [
      { value: 'vault', checked: false },
      { value: 'gatehouse', checked: false },
      { value: 'courier', checked: false },
    ]

    const result = toggleLinked(items, 0, link)

    expect(result[0].checked).toBe(true)
    expect(result[1].checked).toBe(false)
    expect(result[2].checked).toBe(false)
  })

  it('cannot uncheck a choice required by a checked choice', () => {
    const items = [
      { value: 'vault', checked: false },
      { value: 'gatehouse', checked: true },
      { value: 'courier', checked: true },
    ]

    const result = toggleLinked(items, 2, link)

    expect(result[2].checked).toBe(true)
    expect(result[1].checked).toBe(true)
  })

  it('can uncheck a linked choice once its requirer is unchecked', () => {
    const items = [
      { value: 'vault', checked: false },
      { value: 'gatehouse', checked: false },
      { value: 'courier', checked: true },
    ]

    const result = toggleLinked(items, 2, link)

    expect(result[2].checked).toBe(false)
  })
})
