/**
 * Tower's social identity contract (#82).
 *
 * The abstraction is OAuth/OIDC social identity — never a specific vendor.
 * Google is merely the first adapter. Borrowing Laravel Socialite's
 * ergonomics (redirect / callback / scopes / test double), but Tower-owned:
 *
 *   application
 *     -> Gatehouse social API
 *       -> SocialProvider        (knows how to talk to Google et al.)
 *         -> normalized SocialIdentity
 *           -> Gatehouse identity lifecycle (#83 owns user/session linking)
 *
 * Web-standard primitives only. No Node APIs, no framework imports, no
 * Better Auth types — a future Clerk/WorkOS adapter implements the exact
 * same contract without touching the public Gatehouse API.
 */

/** The external account's email, with the provider's verification claim. */
export interface SocialEmail {
  value: string
  verified: boolean
}

/** Provider tokens returned by the OAuth flow. Treat as sensitive. */
export interface SocialIdentityTokens {
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
  tokenType?: string
}

/**
 * The normalized, Tower-owned result of a social authentication.
 *
 * Deliberately minimal: enough to identify the external account, resolve or
 * create a Tower user, support linking, and optionally preserve provider
 * data. This is not Better Auth's account shape — do not add fields just
 * because a provider happens to return them; put those under `raw`.
 */
export interface SocialIdentity {
  /** Social provider id, e.g. 'google'. Matches {@link SocialProvider.id}. */
  provider: string
  /** The external account's unique id at the provider (stable, never an email). */
  providerAccountId: string
  email?: SocialEmail
  name?: string
  avatarUrl?: string
  /**
   * Sensitive provider tokens. Lifecycle code persists only what the app
   * configures; normalized public output should not casually expose these.
   */
  tokens?: SocialIdentityTokens
  /** Raw provider payload, for advanced/escape-hatch use. */
  raw?: unknown
}

export interface SocialProviderCapabilities {
  /** Provider accepts application-requested scopes. */
  scopes?: boolean
  /** Provider round-trips a CSRF `state` parameter. */
  state?: boolean
  /** Provider speaks OIDC (`openid` scope, ID token). */
  oidc?: boolean
  /** Provider guarantees accurate `email_verified` claims. */
  emailVerified?: boolean
}

export interface SocialRedirectOptions {
  /** Application-requested scopes, merged over the provider's required ones. */
  scopes?: string[]
  /** Opaque CSRF/state value; generated when omitted and supported. */
  state?: string
  /** Where the provider should land the browser after the callback. */
  redirectTo?: string
}

export interface SocialRedirect {
  url: string
  /** Echoed by the provider on callback; verify before trusting the result. */
  state?: string
}

export interface SocialCallbackParams {
  code: string
  state?: string
}

export interface SocialProvider {
  /** Canonical provider id ('google', 'github', …). */
  readonly id: string
  readonly capabilities: SocialProviderCapabilities
  /**
   * Scopes Tower requires to build a usable SocialIdentity (e.g. identity,
   * email, profile). Providers combine these with application-requested
   * scopes so an app cannot accidentally request an incomplete identity.
   */
  readonly requiredScopes: readonly string[]
  /** Builds the provider's authorization redirect. */
  redirect(options?: SocialRedirectOptions): Promise<SocialRedirect> | SocialRedirect
  /** Exchanges an OAuth callback for a normalized SocialIdentity. */
  callback(params: SocialCallbackParams): Promise<SocialIdentity>
}

/** Thrown when the upstream social provider fails (token exchange, userinfo). */
export class SocialProviderError extends Error {
  readonly provider: string

  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`)
    this.name = 'SocialProviderError'
    this.provider = provider
  }
}

/** Thrown when an OAuth callback's state fails verification (possible CSRF). */
export class SocialStateMismatchError extends Error {
  constructor(message = 'OAuth state verification failed') {
    super(message)
    this.name = 'SocialStateMismatchError'
  }
}

/** Merges Tower-required identity scopes with application-requested scopes. */
export function mergeScopes(required: readonly string[], requested?: string[]): string[] {
  const out = [...required]
  for (const scope of requested ?? []) {
    if (!out.includes(scope)) out.push(scope)
  }
  return out
}
