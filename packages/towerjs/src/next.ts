import { Gatehouse } from '@towerjs/gatehouse'
import { towerContext } from '@towerjs/foundation'
import { getTowerApp } from './runtime'

export function action<TResult, TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    await getTowerApp()

    const normalized = args.map(normalizeArg) as TArgs

    try {
      const { headers } = await import('next/headers.js')
      const h = await headers()
      const gh = await Gatehouse.from({ headers: h })
      return await towerContext.run({ gatehouse: gh }, () => handler(...normalized))
    } catch {
      return handler(...normalized)
    }
  }
}

function normalizeArg(arg: unknown): unknown {
  if (arg instanceof FormData) {
    const obj: Record<string, unknown> = {}
    for (const [key, value] of arg.entries()) {
      obj[key] = value
    }
    return obj
  }
  return arg
}
