export interface GatehouseUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
  twoFactorEnabled?: boolean
}

export interface GatehouseSession {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface Session {
  user: GatehouseUser
  session: GatehouseSession
}

export interface UpdateUserData {
  name?: string
  image?: string | null
}

export interface Identity {
  id: string
  provider: string
  accountId: string
  userId: string
  email?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: string
  createdAt: Date
  user?: GatehouseUser
}

export interface OrganizationInvitation {
  id: string
  organizationId: string
  email: string
  role: string
  status: string
  inviterId: string
  expiresAt: Date
  createdAt: Date
}

export interface TwoFactorInfo {
  totpURI: string
  backupCodes: string[]
}

export interface TwoFactorVerifyResult {
  token: string
  user: GatehouseUser
}

export interface AccessToken {
  token: string
  provider: string
  expiresAt?: Date
}

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message)
    this.name = "AuthenticationError"
  }
}

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message)
    this.name = "AuthorizationError"
  }
}

export type AuthMethod =
  | { method: "credentials"; email: string; password: string }
  | { method: "google" }
  | { method: "github" }
  | { method: "discord" }
  | { method: "social"; provider: string }
  | { method: "magic-link"; email: string; name?: string; callbackURL?: string }
  | { method: "email-otp"; email: string; type?: "sign-in" | "email-verification" | "forget-password" | "change-email" }

export interface SignUpParams {
  name: string
  email: string
  password: string
}

export interface PasswordForgotParams {
  email: string
}

export interface PasswordResetConfirmParams {
  token: string
  newPassword: string
}

export interface PasswordChangeParams {
  currentPassword: string
  newPassword: string
}

export interface PasswordConfirmParams {
  password: string
}

export interface EmailVerifySendParams {
  email: string
}

export interface EmailVerifyConfirmParams {
  token: string
}

export interface EmailOtpSendParams {
  email: string
  type?: "sign-in" | "email-verification" | "forget-password" | "change-email"
}

export interface EmailOtpConfirmParams {
  email: string
  code: string
  type?: "sign-in" | "email-verification" | "forget-password" | "change-email"
}

export interface TwoFactorEnableParams {
  password: string
}

export interface TwoFactorVerifyTotpParams {
  code: string
  trustDevice?: boolean
}

export interface TwoFactorVerifyBackupCodeParams {
  code: string
}

export interface OrganizationCreateParams {
  name: string
  slug: string
  logo?: string
  metadata?: Record<string, unknown>
}

export interface OrganizationUpdateParams {
  name?: string
  slug?: string
  logo?: string | null
  metadata?: Record<string, unknown>
}

export interface OrganizationInviteParams {
  email: string
  role: string
}

export interface SocialProviderConfig {
  clientId?: string
  clientSecret?: string
}

export interface GatehouseConfig {
  provider: "better-auth"
  credentials?: boolean | {
    enabled?: boolean
    disableSignUp?: boolean
    requireEmailVerification?: boolean
    minPasswordLength?: number
    maxPasswordLength?: number
  }
  social?: Record<string, SocialProviderConfig>
  passkeys?: boolean
  magicLinks?: boolean
  emailOtp?: boolean
  baseURL?: string
  appName?: string
  plugins?: import("better-auth").BetterAuthPlugin[]
  advanced?: {
    useSecureCookies?: boolean
    disableCSRFCheck?: boolean
    cookiePrefix?: string
  }
  passThrough?: Record<string, unknown>
}

export interface ProxyOptions {
  /** Path patterns that don't require authentication */
  public?: string[]
  /** Path patterns that redirect to `redirectAfterSignIn` when already authenticated (e.g. login page) */
  redirectIfAuthenticated?: string[]
  /** Where unauthenticated users are sent (default: /sign-in) */
  redirectTo?: string
  /** Where already-authenticated users are sent when visiting a guest page (default: /) */
  redirectAfterSignIn?: string
}

export interface ProxyResult {
  /**
   * Call this from your framework's middleware/proxy.
   * Returns a redirect Response if the request should be redirected,
   * or `undefined` to continue.
   */
  handler: (request: Request) => Promise<Response | undefined>
  /** Next.js matcher config — computed from the path patterns */
  config: { matcher: string[] }
}

export interface GatehouseModule {
  /**
   * Escape hatch to the underlying auth provider.
   * Use this when Gatehouse's curated API doesn't cover your use case.
   * `any` by design — you're past the guard rails.
   */
  provider: any

  routes: {
    GET: (req: Request) => Promise<Response>
    POST: (req: Request) => Promise<Response>
  }

  /**
   * Create an authenticated context from a request.
   * Call this once at the top of your route handler, then use the returned
   * context for all auth-aware operations — never pass `request` again.
   */
  from(request: Request | { headers: Headers }): Promise<GatehouseContext>

  /**
   * Create a proxy/middleware handler for request authentication.
   * Use in Next.js 16 proxy.ts or middleware.ts.
   *
   * @example
   * ```ts
   * // proxy.ts
   * import { NextResponse } from "next/server"
   * import { tower } from "towerjs"
   *
   * export const { handler, config } = tower.gatehouse.proxy({
   *   public: ["/", "/sign-in", "/api/auth/:path*"],
   *   redirectTo: "/sign-in",
   * })
   *
   * export async function middleware(request: NextRequest) {
   *   return handler(request) ?? NextResponse.next()
   * }
   * ```
   */
  proxy(options?: ProxyOptions): ProxyResult

  signIn(params: AuthMethod): Promise<Session>
  signUp(params: SignUpParams): Promise<Session>

  password: {
    forgot(params: PasswordForgotParams): Promise<void>
    reset(params: PasswordResetConfirmParams): Promise<void>
  }

  email: {
    verify: {
      send(params: EmailVerifySendParams): Promise<void>
      confirm(params: EmailVerifyConfirmParams): Promise<void>
    }
    otp: {
      send(params: EmailOtpSendParams): Promise<void>
      confirm(params: EmailOtpConfirmParams): Promise<Session>
    }
  }

  users: {
    get(id: string): Promise<GatehouseUser | null>
    findByEmail(email: string): Promise<GatehouseUser | null>
  }

  can(params: { user: GatehouseUser; action: string; resource: unknown }): Promise<boolean>
  roles: {
    assign(userId: string, role: string): Promise<void>
    remove(userId: string, role: string): Promise<void>
  }

  /**
   * Create the auth database tables.
   * Uses Better Auth's migration internally. Idempotent — safe to
   * call on every deploy.
   *
   * @example
   * ```ts
   * await tower.gatehouse.migrate()
   * ```
   */
  migrate(): Promise<void>
}

export interface GatehouseContext {
  readonly session: Session | null
  readonly user: GatehouseUser | null
  readonly headers: Headers
  /**
   * Escape hatch to the underlying auth provider.
   * Same as `tower.gatehouse.provider`, but accessible from context
   * alongside `ctx.headers`.
   */
  readonly provider: any

  signOut(): Promise<void>

  sessions: {
    list(): Promise<GatehouseSession[]>
    revoke(token: string): Promise<void>
    revokeOther(): Promise<void>
  }

  account: {
    update(data: UpdateUserData): Promise<GatehouseUser>
    delete(): Promise<void>
    setPassword(newPassword: string): Promise<void>
    changeEmail(email: string): Promise<void>
  }

  password: {
    change(params: PasswordChangeParams): Promise<void>
    confirm(params: PasswordConfirmParams): Promise<boolean>
  }

  email: {
    verify: {
      confirm(params: EmailVerifyConfirmParams): Promise<void>
    }
  }

  identities: {
    list(): Promise<Identity[]>
    unlink(id: string): Promise<void>
    link(input: string | { provider: string; redirect?: string }): Promise<void>
    getAccessToken(provider: string): Promise<AccessToken>
  }

  totp: {
    enable(password: string): Promise<TwoFactorInfo>
    disable(password: string): Promise<void>
    verify(code: string, trustDevice?: boolean): Promise<TwoFactorVerifyResult>
    uri(password: string): Promise<string>
  }

  backupCodes: {
    generate(password: string): Promise<string[]>
    verify(code: string): Promise<TwoFactorVerifyResult>
  }

  organizations: {
    create(params: OrganizationCreateParams): Promise<Organization>
    list(): Promise<Organization[]>
    get(id: string): Promise<Organization | null>
    update(id: string, params: OrganizationUpdateParams): Promise<Organization>
    delete(id: string): Promise<void>
    members: {
      list(organizationId: string): Promise<OrganizationMember[]>
      add(organizationId: string, userId: string, role?: string): Promise<OrganizationMember>
      update(organizationId: string, memberId: string, role: string): Promise<OrganizationMember>
      remove(organizationId: string, memberId: string): Promise<void>
    }
    invitations: {
      create(organizationId: string, params: OrganizationInviteParams): Promise<OrganizationInvitation>
      list(organizationId: string): Promise<OrganizationInvitation[]>
      accept(invitationId: string): Promise<void>
      reject(invitationId: string): Promise<void>
      cancel(invitationId: string): Promise<void>
    }
  }

  can(params: { user: GatehouseUser; action: string; resource: unknown }): Promise<boolean>
}
