import { createAuthClient } from 'better-auth/react'

export const gatehouseClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
})
