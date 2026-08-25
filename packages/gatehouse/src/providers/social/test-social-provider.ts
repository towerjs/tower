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

export interface ScriptedSocialIdentity {
  providerAccountId?: string
  email?: { value: string; verified: boolean }
  name?: string
  avatarUrl?: string
}

export interface TestSocialProviderOptions {
  /**
   * Identities returned by successive callback() calls. When exhausted, the
   * last entry repeats. A thrown error entry simulates a provider failure.
   */
  identities?: Array<ScriptedSocialIdentity | Error>
  /** Provider id (defaults to 'test'). */
  id?: string
}

/**
 * In-memory social provider used by the contract suite and application
 * tests. Independent of Google and of Better Auth. Records redirect calls
 * so tests can assert scopes/state handling.
 */
export class TestSocialProvider implements SocialProvider {
  readonly id: string
  readonly capabilities: SocialProviderCapabilities = {
    scopes: true,
    state: true,
    oidc: false,
    emailVerified: true,
  }
  readonly requiredScopes = ['test.identity', 'test.email'] as const

  readonly redirectCalls: SocialRedirectOptions[] = []
  readonly callbackCalls: SocialCallbackParams[] = []

  private cursor = 0

  constructor(private readonly options: TestSocialProviderOptions = {}) {
    this.id = options.id ?? 'test'
  }

  redirect(options: SocialRedirectOptions = {}): SocialRedirect {
    this.redirectCalls.push(options)
    const state = options.state ?? `state-${this.redirectCalls.length}`
    const url = new URL('https://social.example.com/authorize')
    url.searchParams.set('client_id', 'test-client')
    url.searchParams.set('response_type', 'code')
    for (const scope of mergeScopes(this.requiredScopes, options.scopes)) {
      url.searchParams.append('scope', scope)
    }
    if (options.redirectTo) url.searchParams.set('redirect_uri', options.redirectTo)
    return { url: url.toString(), state }
  }

  async callback(params: SocialCallbackParams): Promise<SocialIdentity> {
    this.callbackCalls.push(params)
    const entry = this.options.identities?.[Math.min(this.cursor, (this.options.identities?.length ?? 1) - 1)]
    this.cursor += 1
    if (entry instanceof Error) throw new SocialProviderError(this.id, entry.message)
    const scripted = entry ?? {}
    return {
      provider: this.id,
      providerAccountId: scripted.providerAccountId ?? `ext-account-${this.cursor}`,
      ...(scripted.email ? { email: scripted.email } : {}),
      ...(scripted.name ? { name: scripted.name } : {}),
      ...(scripted.avatarUrl ? { avatarUrl: scripted.avatarUrl } : {}),
    }
  }
}
