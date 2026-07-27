export { signIn, signUp, signOut } from './actions'

export function action<TResult, TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<TResult>,
  config?: { sessionCookie?: string }
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const ghAction = await loadGatehouseAction()
    return ghAction(handler, config)(...args)
  }
}

async function loadGatehouseAction(): Promise<typeof import('@towerjs/gatehouse/next').action> {
  const mod = await (Function('return import("@towerjs/gatehouse/next")')() as Promise<
    typeof import('@towerjs/gatehouse/next')
  >)
  return mod.action
}

export const withGatehouse: typeof import('@towerjs/gatehouse/next').withGatehouse = (
  handler: any,
  config?: { sessionCookie?: string }
) => {
  return (request: Request, context: any) =>
    Function('return import("@towerjs/gatehouse/next")')().then((mod: any) =>
      mod.withGatehouse(handler, config)(request, context)
    )
}

export const GET: (req: Request) => Promise<Response> = (req: Request) =>
  Function('return import("@towerjs/gatehouse/next")')().then((mod: any) => mod.GET(req))

export const POST: (req: Request) => Promise<Response> = (req: Request) =>
  Function('return import("@towerjs/gatehouse/next")')().then((mod: any) => mod.POST(req))
