'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Gatehouse } from '@towerjs/gatehouse'
import { getTowerApp } from '../runtime'

type RedirectConfig = {
  afterSignIn?: string
  afterSignUp?: string
  afterSignOut?: string
}

async function getRedirectConfig(): Promise<RedirectConfig> {
  const app = await getTowerApp()
  const ghConfig = app.config.modules.gatehouse ?? {}
  return (ghConfig as { redirects?: RedirectConfig }).redirects ?? {}
}

async function setSessionCookie(token: string | null | undefined) {
  const c = await cookies()
  const name = 'better-auth.session_token'
  if (token) {
    c.set(name, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
  } else {
    c.set(name, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
  }
}

export async function signIn(formData: FormData) {
  await getTowerApp()

  const redirectConfig = await getRedirectConfig()
  const redirectTo = (formData.get('redirectTo') as string) ?? redirectConfig.afterSignIn ?? '/dashboard'
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const h = await headers()
  const gh = await Gatehouse.from({ headers: h })

  const result = await gh.signIn.email({ email, password })

  if (result?.session?.token) {
    await setSessionCookie(result.session.token)
  }

  redirect(redirectTo)
}

export async function signUp(formData: FormData) {
  await getTowerApp()

  const redirectConfig = await getRedirectConfig()
  const redirectTo = (formData.get('redirectTo') as string) ?? redirectConfig.afterSignUp ?? '/dashboard'
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const h = await headers()
  const gh = await Gatehouse.from({ headers: h })

  const result = await gh.signUp.email({ name, email, password })

  if (result?.session?.token) {
    await setSessionCookie(result.session.token)
  }

  redirect(redirectTo)
}

export async function signOut(formData?: FormData) {
  await getTowerApp()

  const redirectConfig = await getRedirectConfig()
  const redirectTo = (formData?.get('redirectTo') as string) ?? redirectConfig.afterSignOut ?? '/sign-in'

  const h = await headers()
  const gh = await Gatehouse.from({ headers: h })

  await gh.sessions.signOut()

  await setSessionCookie(null)

  redirect(redirectTo)
}
