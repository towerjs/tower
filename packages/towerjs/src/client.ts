import { createAuthClient } from "better-auth/react"

/** Pre-configured better-auth client for browser usage. Base URL is auto-detected. */
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
})
