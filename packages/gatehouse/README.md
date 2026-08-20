# `@towerjs/gatehouse`

[![npm version](https://img.shields.io/npm/v/@towerjs/gatehouse?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/gatehouse)

Authentication and authorization for Tower. Powered by [better-auth](https://better-auth.com) with support for email/password, social login, magic links, OTP, passkeys, two-factor authentication, organizations, and API keys.

## Installation

```bash
pnpm add @towerjs/gatehouse
```

## Usage

Configure Gatehouse in your `tower.config.ts`:

```ts
import { defineTower } from '@towerjs/blueprint'

export default defineTower({
  modules: {
    gatehouse: {
      provider: 'better-auth',
      credentials: true,
      social: { google: {}, github: {} },
    },
  },
})
```

Access auth in your application:

```ts
import { gatehouse } from '@towerjs/tower/gatehouse'

const session = await gatehouse.getSession()
if (session) {
  console.log(session.user.email)
}
```

## Features

| Feature            | Config key          | Description                      |
| ------------------ | ------------------- | -------------------------------- |
| Email / password   | `credentials`       | Sign in with email and password  |
| Social login       | `social`            | Google, GitHub, and more         |
| Magic links        | `magicLinks`        | Passwordless email sign-in       |
| Email verification | `emailVerification` | Verify email by link or OTP code |
| Phone auth         | `phoneNumber`       | SMS verification                 |
| Passkeys           | `passkeys`          | Biometric / hardware key login   |
| Two-factor auth    | `twoFactor`         | TOTP + backup codes              |
| Organizations      | `organization`      | Teams, invitations, roles        |
| API keys           | `apiKey`            | Programmatic access              |
| Admin panel        | `admin`             | User management dashboard        |

## Next.js integration

Gatehouse provides a framework-specific export for Next.js:

```ts
// src/app/api/auth/[...all]/route.ts
export { GET, POST } from '@towerjs/gatehouse/next'
```

`@towerjs/gatehouse/next` also exports `action` and `withGatehouse` wrappers for server actions and route handlers.

## Client

For the browser, use the pre-configured client:

```ts
import { gatehouseClient } from '@towerjs/gatehouse/client'

await gatehouseClient.signIn.email({ email, password })
```

## Proxy middleware

```ts
// src/proxy.ts
import { gatehouse } from '@towerjs/gatehouse'

const { handler } = gatehouse.proxy({
  public: ['/', '/sign-in', '/sign-up'],
  redirectIfAuthenticated: ['/sign-in', '/sign-up'],
  redirectTo: '/sign-in',
  redirectAfterSignIn: '/dashboard',
})

export function proxy(request: Request) {
  return handler(request)
}

export const config = {
  matcher: ['/((?!_next/static|favicon.ico|api/auth).*)'],
}
```

## Included in

- [@towerjs/tower](https://www.npmjs.com/package/@towerjs/tower) — meta-package
