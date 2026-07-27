'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { gatehouse } from '../gatehouse.js'

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
  const h = await headers()
  const gh = await gatehouse.from({ headers: h })

  const redirectTo = (formData.get('redirectTo') as string) ?? '/dashboard'
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const result = await gh.signIn.email({ email, password })

  if (result?.session?.token) {
    await setSessionCookie(result.session.token)
  }

  redirect(redirectTo)
}

export async function signUp(formData: FormData) {
  const h = await headers()
  const gh = await gatehouse.from({ headers: h })

  const redirectTo = (formData.get('redirectTo') as string) ?? '/dashboard'
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const result = await gh.signUp.email({ name, email, password })

  if (result?.session?.token) {
    await setSessionCookie(result.session.token)
  }

  redirect(redirectTo)
}

export async function signOut(formData?: FormData) {
  const h = await headers()
  const gh = await gatehouse.from({ headers: h })

  const redirectTo = (formData?.get('redirectTo') as string) ?? '/sign-in'

  await gh.sessions.signOut()

  await setSessionCookie(null)

  redirect(redirectTo)
}
