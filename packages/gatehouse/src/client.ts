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

const client = createAuthClient({
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

/** Session-reading members whose user shape Gatehouse pins. */
type SessionMembers = 'useSession' | 'getSession'

/**
 * The browser client.
 *
 * Vendor inference drift: better-auth's plugin-inferred client enriches the
 * session user with plugin fields (twoFactorEnabled, banned, …). Gatehouse's
 * public contract exposes the base user shape, so the session-reading members
 * are pinned here — while the plugin surfaces (magic links, email OTP, two
 * factor, organizations) keep their inferred types, because that is what
 * browser code calls.
 */
export const gatehouseClient = client as unknown as Omit<typeof client, SessionMembers> &
  Pick<ReactAuthClient<GatehouseClientOptions>, SessionMembers>
