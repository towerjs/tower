import { setRequestContextResolver, towerContext } from '@towerjs/tower/foundation'

import { Gatehouse, getRoutes } from '../index.js'

setRequestContextResolver(async () => {
  const { unstable_noStore } = await import('next/cache.js')
  unstable_noStore()
  const { headers } = await import('next/headers.js')
  const h = await headers()
  return { headers: h }
})

type NextRouteContext = {
  params: Promise<Record<string, string>>
}

export type ActionResult = { error?: string; ok?: true }

function withGatehouseContext<TResult, TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const { headers } = await import('next/headers.js')
    const h = await headers()
    const gh = await Gatehouse.from({ headers: h })
    return towerContext.run({ gatehouse: gh }, () => handler(...args))
  }
}

/**
 * Wraps a Next.js server action with gatehouse context.
 *
 * Inside the handler, use the `gatehouse` proxy (imported from
 * `@towerjs/gatehouse`) — it reads from the request-scoped context.
 *
 * Session cookies are synced automatically via better-auth's `nextCookies` plugin.
 *
 * @example
 * ```ts
 * "use server"
 * import { action } from "@towerjs/gatehouse/next"
 * import { gatehouse } from "@towerjs/gatehouse"
 *
 * export const signIn = action(async (formData: FormData) => {
 *   await gatehouse.signIn.email({ email: formData.get("email"), password: formData.get("password") })
 * })
 * ```
 *
 * For FormData actions with automatic extraction:
 * @example
 * ```ts
 * export const signUp = action.form(async ({ name, email, password }) => {
 *   await gatehouse.signUp.email({ name, email, password })
 * })
 * ```
 */
export type FormActionFn = (prevState: ActionResult | undefined, formData: FormData) => Promise<ActionResult | undefined>

export const action = withGatehouseContext as typeof withGatehouseContext & {
  form: (handler: (data: Record<string, string>) => Promise<void>) => FormActionFn
}

action.form = (handler: (data: Record<string, string>) => Promise<void>): FormActionFn => {
  const inner = withGatehouseContext(async (_prevState: unknown, formData: FormData): Promise<ActionResult> => {
    const data: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') data[key] = value
    }
    await handler(data)
    return { ok: true } as const
  })

  const fn = async (arg0: unknown, arg1?: FormData): Promise<ActionResult> => {
    const formData = arg0 instanceof FormData ? arg0 : (arg1 as FormData)
    const prevState = arg0 instanceof FormData ? undefined : arg0
    try {
      return await inner(prevState, formData)
    } catch (e) {
      return { error: (e as Error)?.message ?? 'Action failed' }
    }
  }

  return fn
}

/**
 * Wraps a Next.js route handler with the gatehouse ALS context.
 *
 * Session cookies are synced automatically via better-auth's `nextCookies` plugin.
 * Use this for mutations that change auth state. For read-only
 * routes, use `gatehouse.from({ headers })` directly.
 */
export function withGatehouse<T extends Response>(
  handler: (request: Request, context: NextRouteContext) => Promise<T>
): (request: Request, context: NextRouteContext) => Promise<T> {
  return async (request, context) => {
    const gh = await Gatehouse.from({ headers: request.headers })
    return towerContext.run({ gatehouse: gh }, () => handler(request, context))
  }
}

// ─── Route handler (lazily resolved) ───

function lazy(method: 'GET' | 'POST'): (req: Request) => Promise<Response> {
  return (req: Request) => getRoutes()[method](req)
}

/**
 * Lazy GET handler that delegates to the gatehouse auth routes.
 * Imported by `app/api/auth/[...all]/route.ts` in user projects.
 */
export const GET = lazy('GET') as (req: Request) => Promise<Response>

/**
 * Lazy POST handler that delegates to the gatehouse auth routes.
 * Imported by `app/api/auth/[...all]/route.ts` in user projects.
 */
export const POST = lazy('POST') as (req: Request) => Promise<Response>