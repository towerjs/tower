import {
  type SocialCallbackParams,
  type SocialIdentity,
  type SocialProvider,
  type SocialProviderCapabilities,
  SocialProviderError,
  type SocialRedirect,
  type SocialRedirectOptions,
  mergeScopes,
} from '../../social.js'

export interface GoogleSocialOptions {
  clientId?: string
  clientSecret?: string
  /** Registered OAuth redirect URI; defaults to `<baseURL>/api/auth/social/google/callback`. */
  redirectUri?: string
  /** Base URL of the Tower application (used to derive redirectUri). */
  baseURL?: string
  /** Extra authorization parameters (e.g. access_type, prompt). */
  extraAuthorizeParams?: Record<string, string>
}

const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/**
 * Google social provider — the first real adapter behind Tower's social
 * contract. Speaks plain OAuth2/OIDC over fetch; knows nothing about Better
 * Auth or any other Gatehouse provider. Identity linking is NOT this
 * adapter's job: it returns a normalized SocialIdentity and Gatehouse's
 * lifecycle (#83) decides what that identity means.
 */
export class GoogleSocialProvider implements SocialProvider {
  readonly id = 'google'
  readonly capabilities: SocialProviderCapabilities = {
    scopes: true,
    state: true,
    oidc: true,
    emailVerified: true,
  }
  readonly requiredScopes = ['openid', 'email', 'profile'] as const

  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor(options: GoogleSocialOptions = {}) {
    const clientId = options.clientId ?? env('GOOGLE_CLIENT_ID')
    const clientSecret = options.clientSecret ?? env('GOOGLE_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment, ' +
          'or pass clientId/clientSecret to the google() social provider.'
      )
    }
    this.clientId = clientId
    this.clientSecret = clientSecret

    const base = options.baseURL ?? env('GATEHOUSE_URL') ?? 'http://localhost:3000'
    this.redirectUri = options.redirectUri ?? `${base.replace(/\/$/, '')}/api/auth/social/${this.id}/callback`
  }

  redirect(options: SocialRedirectOptions = {}): SocialRedirect {
    const state = options.state ?? randomState()
    const url = new URL(AUTHORIZE_ENDPOINT)
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', this.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', mergeScopes(this.requiredScopes, options.scopes).join(' '))
    // Offline access so refresh tokens are issued when the app needs them.
    url.searchParams.set('access_type', 'offline')
    const extra = (options as SocialRedirectOptions & { extraAuthorizeParams?: Record<string, string> })
      .extraAuthorizeParams
    for (const [key, value] of Object.entries(extra ?? {})) {
      url.searchParams.set(key, value)
    }
    return { url: url.toString(), state }
  }

  async callback(params: SocialCallbackParams): Promise<SocialIdentity> {
    const tokens = await this.exchangeCode(params.code)
    const userinfo = await this.fetchUserinfo(tokens.access_token)

    return {
      provider: this.id,
      providerAccountId: String(userinfo.sub),
      ...(userinfo.email
        ? { email: { value: String(userinfo.email), verified: userinfo.email_verified === true } }
        : {}),
      ...(userinfo.name ? { name: String(userinfo.name) } : {}),
      ...(userinfo.picture ? { avatarUrl: String(userinfo.picture) } : {}),
      tokens: {
        accessToken: String(tokens.access_token),
        ...(tokens.refresh_token ? { refreshToken: String(tokens.refresh_token) } : {}),
        ...(tokens.expires_in != null ? { expiresAt: new Date(Date.now() + Number(tokens.expires_in) * 1000) } : {}),
        ...(tokens.token_type ? { tokenType: String(tokens.token_type) } : {}),
      },
      raw: userinfo,
    }
  }

  private async exchangeCode(code: string): Promise<Record<string, unknown>> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!response.ok) {
      throw new SocialProviderError(this.id, `Token exchange failed (${response.status})`)
    }
    return (await response.json()) as Record<string, unknown>
  }

  private async fetchUserinfo(accessToken: unknown): Promise<Record<string, any>> {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${String(accessToken)}` },
    })
    if (!response.ok) {
      throw new SocialProviderError(this.id, `Userinfo request failed (${response.status})`)
    }
    return (await response.json()) as Record<string, any>
  }
}

function randomState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function env(key: string): string | undefined {
  return process.env[key] || process.env[`GATEHOUSE_${key}`] || process.env[`${key.toUpperCase().replace(/-/g, '_')}`]
}
