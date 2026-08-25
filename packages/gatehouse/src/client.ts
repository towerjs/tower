import type { BetterAuthClientOptions } from 'better-auth/client'
import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  organizationClient,
  phoneNumberClient,
  twoFactorClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { ReactAuthClient } from 'better-auth/react'

export type GatehouseClientOptions = BetterAuthClientOptions & {
  baseURL?: string
  plugins: [
    ReturnType<typeof adminClient>,
    ReturnType<typeof emailOTPClient>,
    ReturnType<typeof magicLinkClient>,
    ReturnType<typeof organizationClient>,
    ReturnType<typeof phoneNumberClient>,
    ReturnType<typeof twoFactorClient>,
  ]
}

// Vendor inference drift: better-auth's plugin-inferred client enriches the
// session user with plugin fields (twoFactorEnabled, banned, …). Gatehouse's
// public client contract intentionally exposes the base user shape, so we
// pin the type at this boundary instead of leaking plugin fields.
export const gatehouseClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [
    adminClient(),
    emailOTPClient(),
    magicLinkClient(),
    organizationClient(),
    phoneNumberClient(),
    twoFactorClient(),
  ],
}) as unknown as ReactAuthClient<GatehouseClientOptions>
