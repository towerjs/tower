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

export const gatehouseClient: ReactAuthClient<GatehouseClientOptions> = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
  plugins: [
    adminClient(),
    emailOTPClient(),
    magicLinkClient(),
    organizationClient(),
    phoneNumberClient(),
    twoFactorClient(),
  ],
})
