import type { GatehouseInstance, ProxyOptions, ProxyResult, Session } from './types.js'

/**
 * The Gatehouse provider contract.
 *
 * Gatehouse knows what authentication means; a provider knows how a
 * particular auth system implements it. Applications program against the
 * public API (`gatehouse.user()`, `instance.signIn.email(...)`) and never
 * against a provider SDK. Adding a curated provider (Clerk, WorkOS, …) means
 * implementing this contract — not redesigning the public API.
 *
 * The contract is deliberately web-standard only: `Request`, `Headers`,
 * `Response`. No Node APIs, no framework imports, no provider assumptions —
 * so a provider whose own stack is Edge-compatible runs Gatehouse on Edge.
 */

/** Web-standard per-request context handed to provider methods. */
export interface AuthContext {
  headers: Headers
}

/** Which runtimes the provider can execute on. */
export interface ProviderRuntimeCapabilities {
  node: boolean
  edge: boolean
}

/**
 * Which authentication capabilities the provider implements. Absent/false
 * capabilities produce an UnsupportedCapabilityError when invoked through
 * Gatehouse rather than a silent no-op.
 */
export interface ProviderAuthenticationCapabilities {
  password?: boolean
  social?: boolean
  magicLink?: boolean
  emailVerification?: boolean
  emailOtp?: boolean
  phoneOtp?: boolean
  passkeys?: boolean
  twoFactor?: boolean
  organizations?: boolean
  apiKeys?: boolean
  admin?: boolean
}

export interface ProviderSessionCapabilities {
  /** Sessions stored server-side (database/redis) vs stateless tokens. */
  database?: boolean
  stateless?: boolean
}

export interface GatehouseProviderCapabilities {
  runtime: ProviderRuntimeCapabilities
  authentication: ProviderAuthenticationCapabilities
  sessions: ProviderSessionCapabilities
}

export interface GatehouseProviderInitOptions {
  /** The application's Kysely database instance, when one is configured. */
  db?: unknown
}

export interface GatehouseProviderRoutes {
  GET: (req: Request) => Promise<Response>
  POST: (req: Request) => Promise<Response>
}

/**
 * Level 3 of the Gatehouse API surface: the raw provider SDK.
 *
 * Explicitly outside the portability contract — using it ties application
 * code to one provider.
 */
export interface RawProviderAccess {
  readonly name: string
  readonly instance: unknown
}

export interface GatehouseProvider {
  readonly name: string
  readonly capabilities: GatehouseProviderCapabilities

  /** Prepares the provider. Called once during app initialization. */
  init(options?: GatehouseProviderInitOptions): Promise<void>

  /** Runs any database migrations the provider requires. */
  migrate(): Promise<void>

  /** Resolves the current session from request headers, or null. */
  getSession(request: AuthContext): Promise<Session | null>

  /** Resolves the current session or throws AuthenticationError. */
  requireAuth(request: AuthContext): Promise<Session>

  /** Builds the per-request Gatehouse API bound to the caller's session. */
  from(request: Request | { headers: Headers }): Promise<GatehouseInstance>

  /** Framework route handlers for the auth API, if the provider serves them. */
  routes?: GatehouseProviderRoutes

  /** Optional middleware hook that guards paths and redirects. */
  createProxy?(options?: ProxyOptions): ProxyResult
}

/** Thrown when invoking a capability the configured provider does not implement. */
export class UnsupportedCapabilityError extends Error {
  readonly capability: string
  readonly provider: string

  constructor(capability: string, provider: string) {
    super(
      `The "${provider}" provider does not support the "${capability}" capability. ` +
        `Check gatehouse.capabilities before calling capability-specific APIs.`
    )
    this.name = 'UnsupportedCapabilityError'
    this.capability = capability
    this.provider = provider
  }
}

/** Runtime helper: throws UnsupportedCapabilityError unless enabled. */
export function requireCapability(
  provider: { name: string; capabilities: GatehouseProviderCapabilities },
  path: string,
  capability: keyof ProviderAuthenticationCapabilities
): void {
  if (!provider.capabilities.authentication[capability]) {
    throw new UnsupportedCapabilityError(capability, provider.name)
  }
}
