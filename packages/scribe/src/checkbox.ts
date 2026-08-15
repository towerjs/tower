import {
  createPrompt,
  isDownKey,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  makeTheme,
  useKeypress,
  usePagination,
  usePrefix,
  useState,
} from '@inquirer/core'
import type { Prompt } from '@inquirer/type'

export type Choice = {
  name: string
  value: string
  checked?: boolean
  description?: string
}

type Config = {
  message: string
  choices: Choice[]
  /**
   * When a choice is toggled on, the linked choices are also toggled on.
   * Toggling a choice off never unchecks its linked choices, and a choice
   * that is required by a checked choice cannot be unchecked.
   */
  link?: Record<string, string[]>
  pageSize?: number
  loop?: boolean
}

const theme = makeTheme({})

function isChecked(item: { checked: boolean }): boolean {
  return item.checked
}

/** Returns true when some checked choice links to `value`, making it required. */
function isRequired(
  value: string,
  items: { value: string; checked: boolean }[],
  link: Record<string, string[]>
): boolean {
  return Object.entries(link).some(
    ([source, linked]) => linked.includes(value) && items.some((item) => item.value === source && item.checked)
  )
}

export function toggleLinked<T extends { value: string; checked: boolean }>(
  items: T[],
  index: number,
  link: Record<string, string[]>
): T[] {
  const active = items[index]
  const nextChecked = !active.checked

  if (!nextChecked && isRequired(active.value, items, link)) {
    return items
  }

  const linked = nextChecked ? (link[active.value] ?? []) : []

  return items.map((item, i) => {
    if (i === index) return { ...item, checked: nextChecked }
    if (linked.includes(item.value)) return { ...item, checked: true }
    return item
  })
}

export const checkbox: Prompt<string[], Config> = createPrompt<string[], Config>((config, done) => {
  const { pageSize = 7, loop = true } = config
  const link = config.link ?? {}
  const [status, setStatus] = useState<'idle' | 'done'>('idle')
  const prefix = usePrefix({ status, theme })
  const [items, setItems] = useState(
    config.choices.map((choice) => ({ value: choice.value, name: choice.name, checked: choice.checked ?? false }))
  )
  const [active, setActive] = useState(0)

  useKeypress(async (key) => {
    if (isEnterKey(key)) {
      const selection = items.filter(isChecked)
      setStatus('done')
      done(selection.map((choice) => choice.value))
    } else if (isUpKey(key) || isDownKey(key)) {
      const offset = isUpKey(key) ? -1 : 1
      setActive((active + offset + items.length) % items.length)
    } else if (isSpaceKey(key)) {
      setItems(toggleLinked(items, active, link))
    }
  })

  const page = usePagination({
    items,
    active,
    renderItem({ item, isActive }) {
      const cursor = isActive ? '❯' : ' '
      const check = item.checked ? '◉' : '○'
      const color = isActive ? theme.style.highlight : (x: string) => x
      const locked = item.checked && isRequired(item.value, items, link)
      const suffix = locked ? ' ' + theme.style.help('(required)') : ''
      return color(`${cursor} ${check} ${item.name}${suffix}`)
    },
    pageSize,
    loop,
  })

  if (status === 'done') {
    const answer = items
      .filter(isChecked)
      .map((c) => c.name)
      .join(', ')
    return `${prefix} ${theme.style.message(config.message, status)} ${theme.style.answer(answer)}`
  }

  const help = theme.style.help('  ↑↓ navigate · space select · ⏎ submit')
  const lines = [prefix, theme.style.message(config.message, status), page, ' ', help].filter(Boolean)
  return lines.join('\n')
})
