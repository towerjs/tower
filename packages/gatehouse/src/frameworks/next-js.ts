import { cookies, headers } from "next/headers"
import { towerContext } from "@towerjs/blueprint"
import { runWithRequest, getAuth, getRoutes, Gatehouse } from "../index.js"
import type { GatehouseInstance, Session } from "../types.js"

type NextRouteContext = {
  params: Promise<Record<string, string>>
}

type GatehouseNextConfig = {
  sessionCookie?: string
}

function sessionCookieName(config?: GatehouseNextConfig): string {
  return config?.sessionCookie ?? "better-auth.session_token"
}

function cookieString(token: string, config?: GatehouseNextConfig): string {
  const secure = process.env.NODE_ENV === "production"
  return [
    `${sessionCookieName(config)}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    secure && "Secure",
    "Max-Age=" + 60 * 60 * 24 * 7,
  ]
    .filter(Boolean)
    .join("; ")
}

function clearCookieString(config?: GatehouseNextConfig): string {
  return `${sessionCookieName(config)}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

/**
 * Wraps a Next.js server action with gatehouse context.
 *
 * Inside the handler, use the `gatehouse` proxy (imported from
 * `@towerjs/gatehouse`) — it reads from the request-scoped context.
 *
 * Session cookies are synced automatically on sign-in and sign-out.
 *
 * @example
 * ```ts
 * "use server"
 * import { action } from "@towerjs/gatehouse/next-js"
 * import { gatehouse } from "@towerjs/gatehouse"
 * import { redirect } from "next/navigation"
 *
 * export const signIn = action(async (formData: FormData) => {
 *   await gatehouse.signIn.email({ email: formData.get("email"), password: formData.get("password") })
 *   redirect("/dashboard")
 * })
 * ```
 */
export function action<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<void>,
  config?: GatehouseNextConfig,
): (...args: TArgs) => Promise<void> {
  return async (...args: TArgs) => {
    const h = await headers()
    const gh = await Gatehouse.from({ headers: h })

    let pendingToken: string | null | undefined = undefined

    const tracked: GatehouseInstance = {
      ...gh,
      signIn: {
        ...gh.signIn,
        email: async (params) => {
          const result = await gh.signIn.email(params as any)
          if (result?.session?.token) pendingToken = result.session.token
          return result
        },
      },
      signUp: {
        ...gh.signUp,
        email: async (params) => {
          const result = await gh.signUp.email(params as any)
          if (result?.session?.token) pendingToken = result.session.token
          return result
        },
      },
      sessions: {
        ...gh.sessions,
        signOut: async () => {
          await gh.sessions.signOut()
          pendingToken = null
        },
      },
    } as GatehouseInstance

    await towerContext.run({ gatehouse: tracked }, () => handler(...args))

    const c = await cookies()
    const name = sessionCookieName(config)
    if (pendingToken) {
      c.set(name, pendingToken, {
        httpOnly: true, sameSite: "lax", path: "/",
        maxAge: 60 * 60 * 24 * 7,
      })
    } else if (pendingToken === null) {
      c.set(name, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
    }
  }
}

/**
 * Reads the current session in a Server Component (RSC).
 */
export async function getSession(): Promise<Session | null> {
  const c = await cookies()
  const auth = await Gatehouse.from({
    headers: new Headers({ Cookie: c.toString() }),
  })
  return auth.session()
}

/**
 * Wraps a Next.js route handler with the gatehouse ALS context.
 *
 * Automatically syncs the session cookie on sign-in and sign-out.
 * Use this for mutations that change auth state. For read-only
 * routes, use `gatehouse.from({ headers })` directly.
 */
export function withGatehouse<T extends Response>(
  handler: (request: Request, context: NextRouteContext) => Promise<T>,
  config?: GatehouseNextConfig,
): (request: Request, context: NextRouteContext) => Promise<T> {
  return async (request, context) => {
    const auth = getAuth()
    const initial = await auth.getSession({ headers: request.headers })

    const response = await runWithRequest(request, () => handler(request, context))

    const current = await auth.getSession({ headers: request.headers })

    const initialToken = initial?.session?.token ?? null
    const currentToken = current?.session?.token ?? null

    if (currentToken && currentToken !== initialToken) {
      response.headers.append("Set-Cookie", cookieString(currentToken, config))
    } else if (!currentToken && initialToken) {
      response.headers.append("Set-Cookie", clearCookieString(config))
    }

    return response
  }
}

// ─── Route handler (lazily resolved) ──────────────────────────────

function lazy(method: "GET" | "POST") {
  return new Proxy({} as any, {
    apply(_, __, args: [Request]) {
      return getRoutes()[method](args[0]);
    },
  });
}

export const GET = lazy("GET") as (req: Request) => Promise<Response>;
export const POST = lazy("POST") as (req: Request) => Promise<Response>;
