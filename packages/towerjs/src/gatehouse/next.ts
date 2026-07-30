import { getTowerApp } from '../runtime'
import {
  action as realAction,
  withGatehouse as realWithGatehouse,
  GET as realGET,
  POST as realPOST,
} from '@towerjs/gatehouse/next'

type FormActionFn = {
  (formData: FormData): Promise<void>
  (prevState: ActionResult | undefined, formData: FormData): Promise<ActionResult>
}

type ActionResult = { error: string } | { ok: true }

async function ensureReady(): Promise<void> {
  await getTowerApp()
}

function withReady<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    return ensureReady().then(() => fn(...args))
  }) as T
}

export const action: {
  <TResult, TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<TResult>): (...args: TArgs) => Promise<TResult>
  form: (handler: (data: Record<string, string>) => Promise<void>) => FormActionFn
} = Object.assign(
  <TResult, TArgs extends unknown[]>(handler: (...args: TArgs) => Promise<TResult>): (...args: TArgs) => Promise<TResult> => {
    const wrapped = realAction(handler)
    return withReady(wrapped)
  },
  {
    form: (handler: (data: Record<string, string>) => Promise<void>) => {
      const formAction = realAction.form(handler)
      return ((arg0: unknown, arg1?: FormData): Promise<ActionResult> => {
        return ensureReady().then(() => (formAction as any)(arg0, arg1))
      }) as FormActionFn
    },
  },
)

export const withGatehouse: typeof realWithGatehouse = ((handler: any) => {
  const wrapped = realWithGatehouse(handler)
  return (request: Request, context: any) => ensureReady().then(() => wrapped(request, context))
}) as typeof realWithGatehouse

export const GET: (req: Request) => Promise<Response> = (req: Request) => {
  return ensureReady().then(() => realGET(req))
}

export const POST: (req: Request) => Promise<Response> = (req: Request) => {
  return ensureReady().then(() => realPOST(req))
}
