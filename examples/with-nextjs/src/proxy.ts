import { gatehouse } from 'towerjs/gatehouse'

let _handler: ((request: Request) => Promise<Response | undefined>) | undefined

export async function proxy(request: Request) {
  if (!_handler) {
    const result = await gatehouse.proxy({
      public: ['/', '/sign-in', '/sign-up', '/api/courier'],
      redirectIfAuthenticated: ['/sign-in', '/sign-up'],
      redirectTo: '/sign-in',
      redirectAfterSignIn: '/dashboard',
    })
    _handler = result.handler
  }
  return _handler(request)
}

export const config = {
  matcher: ['/((?!_next/static|favicon.ico|api/auth).*)'],
}
