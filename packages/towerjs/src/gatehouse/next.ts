export { signIn, signUp, signOut } from './actions'

import { getTowerApp } from '../runtime'

async function ensureReady(): Promise<void> {
  await getTowerApp()
}

async function loadRaw() {
  await ensureReady()
  return Function('return import("@towerjs/gatehouse/next")')() as Promise<
    typeof import('@towerjs/gatehouse/next')
  >
}

export function action<TResult, TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<TResult>,
  config?: { sessionCookie?: string }
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    const mod = await loadRaw()
    return mod.action(handler, config)(...args)
  }
}

export const withGatehouse: typeof import('@towerjs/gatehouse/next').withGatehouse = (
  handler: any,
  config?: { sessionCookie?: string }
) => {
  return (request: Request, context: any) =>
    loadRaw().then((mod: any) => mod.withGatehouse(handler, config)(request, context))
}

export const GET: (req: Request) => Promise<Response> = async (req: Request) => {
  const mod = await loadRaw()
  return mod.GET(req)
}

export const POST: (req: Request) => Promise<Response> = async (req: Request) => {
  const mod = await loadRaw()
  return mod.POST(req)
}
