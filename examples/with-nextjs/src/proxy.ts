import { createGatehouseProxy } from '@towerjs/gatehouse/next'

import tower from '../tower.config'

const { handler } = createGatehouseProxy(tower, {
  public: ['/', '/sign-in', '/sign-up'],
  redirectIfAuthenticated: ['/sign-in', '/sign-up'],
  redirectTo: '/sign-in',
  redirectAfterSignIn: '/dashboard',
})

export const proxy = handler

export const config = {
  matcher: ['/((?!_next/static|favicon.ico|api/auth).*)'],
}
