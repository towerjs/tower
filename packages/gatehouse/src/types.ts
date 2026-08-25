/** A user managed by Gatehouse. */
export interface GatehouseUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date
  updatedAt: Date
  twoFactorEnabled?: boolean
  banned?: boolean
  banReason?: string | null
  banExpiresAt?: Date | null
  role?: string
}

export interface GatehouseSession {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

/** Combined user and session returned by `getSession()` and `requireUser()`. */
export interface Session {
  user: GatehouseUser
  session: GatehouseSession
}

/**
 * Result returned by sign-in / sign-up / OTP confirmation operations.
 *
 * Better Auth's server-side API returns the user, a session token, and redirect
 * metadata — but not the full session object (id, expiresAt, etc.), because the
 * session cookie is set in the response and isn't available to read back during
 * the same request. Use `getSession()` afterwards if you need the full session.
 */
export interface SignInResult {
  user: GatehouseUser
  token: string
  redirect: boolean
  url?: string | null
}

export interface UpdateUserData {
  name?: string
  image?: string | null
}

/** A linked social identity (OAuth account). */
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

export interface OrganizationFull extends Organization {
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
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

export interface OrganizationRole {
  id: string
  name: string
  organizationId: string
  permission: Record<string, string[]>
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationRoleCreateParams {
  organizationId?: string
  role: string
  permission: Record<string, string[]>
}

export interface OrganizationRoleUpdateParams {
  organizationId?: string
  roleName?: string
  permission?: Record<string, string[]>
}

/** TOTP setup data returned after enabling two-factor auth. */
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

export interface PhoneOtpSendParams {
  phoneNumber: string
}

export interface PhoneOtpConfirmParams {
  phoneNumber: string
  code: string
}

export interface PasskeyInfo {
  id: string
  name: string
  createdAt: Date
}

export interface PasskeyUpdateParams {
  name?: string
}

export interface AdminUserCreateParams {
  name: string
  email: string
  password: string
  role?: string
  data?: Record<string, unknown>
  keepCurrentActiveOrganization?: boolean
}

/** Parameters for temporarily restricting a user account. */
export interface AdminUserBanParams {
  banReason?: string
  banExpiresIn?: number
}

export interface AdminListUsersOptions {
  searchField?: string
  searchOperator?: 'eq' | 'ne' | 'starts_with' | 'ends_with' | 'contains'
  searchValue?: string
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AdminImpersonationResult {
  token: string
  user: GatehouseUser
}

export interface AdminSetRoleParams {
  userId: string
  role: string
}

export interface AdminUserSession {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ApiKeyInfo {
  id: string
  name: string
  key: string
  prefix: string
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
  permissions?: Record<string, string[]>
  configId?: string
  metadata?: Record<string, unknown>
  organizationId?: string | null
}

export interface ApiKeyCreateParams {
  name: string
  userId: string
  expiresIn?: number
  prefix?: string
  permissions?: Record<string, string[]>
  configId?: string
  metadata?: Record<string, unknown>
}

export interface ApiKeyUpdateParams {
  name?: string
  expiresIn?: number
  permissions?: Record<string, string[]>
}

export interface ApiKeyListOptions {
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  organizationId?: string
  configId?: string
}

export interface ApiKeyVerifyParams {
  key: string
}

/** Thrown when authentication is required but the user is not logged in. */
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/** Thrown when the current user lacks the required permissions. */
export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export interface EmailOtpSendParams {
  email: string
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
}

export interface EmailOtpConfirmParams {
  email: string
  otp: string
}

export interface TwoFactorEnableParams {
  password: string
  issuer?: string
}

export interface TwoFactorVerifyTotpParams {
  code: string
  trustDevice?: boolean
}

export interface TwoFactorVerifyBackupCodeParams {
  code: string
}

export interface TwoFactorOtpSendParams {
  trustDevice?: boolean
}

export interface TwoFactorOtpVerifyParams {
  code: string
  trustDevice?: boolean
}

export interface OrganizationCreateParams {
  name: string
  slug: string
  logo?: string
  metadata?: Record<string, unknown>
  userId?: string
  keepCurrentActiveOrganization?: boolean
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

/** Options for magic-link authentication. */
export type GatehouseMagicLinkOptions = {
  /** Custom magic-link email handler. Overrides Courier. */
  sendMagicLink?: (data: { email: string; url: string; token: string }) => void | Promise<void>
}

/** How users prove ownership of their email address. */
export type GatehouseEmailVerificationMethod = 'link' | 'otp'

/**
 * Configuration for email ownership verification.
 *
 * - `method: 'link'` (default) — a verification link is emailed to the user.
 * - `method: 'otp'` — a one-time code is emailed to the user.
 *
 * `required` gates password sign-in until the email is verified. `sendOnSignUp`
 * sends the verification (link or code) automatically at sign-up.
 */
export interface GatehouseEmailVerificationConfig {
  enabled?: boolean
  method?: GatehouseEmailVerificationMethod
  /** Block password sign-in until the email is verified. */
  required?: boolean
  /** Send the verification (link or OTP code) automatically at sign-up. */
  sendOnSignUp?: boolean
  /** Create a session when a link is verified. Applies to the `link` method. */
  autoSignInAfterVerification?: boolean
  /** Verification token/code lifetime in seconds. */
  expiresIn?: number
  /** Custom verification-link email handler. Overrides Courier. */
  sendVerificationEmail?: (
    data: { user: { id: string; email: string; name: string }; url: string; token: string },
    request?: Request
  ) => void | Promise<void>
  /** Custom OTP email handler. Overrides Courier. Applies to the `otp` method. */
  sendVerificationOTP?: (data: { email: string; otp: string; type: string }, ctx?: unknown) => void | Promise<void>
}
/** Options for phone number OTP authentication. */
export type GatehousePhoneNumberOptions = {
  /** Custom SMS handler. Overrides Courier. */
  sendOTP?: (data: { phoneNumber: string; code: string }) => void | Promise<void>
}

/** Options for passkey (WebAuthn) authentication. */
export type GatehousePasskeyOptions = {
  /** Relying party display name. Defaults to the app name. */
  rpName?: string
  /** Relying party ID (the site domain passkeys are bound to). */
  rpID?: string
}

/**
 * WebAuthn registration options returned by `passkeys.generateRegistrationOptions`.
 * Pass these directly to `navigator.credentials.create({ publicKey: opts })`.
 */
export interface PasskeyRegistrationOptions {
  challenge: string
  rp: { id?: string; name: string }
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<{ type: string; alg: number }>
  timeout?: number
  attestation?: string
  authenticatorSelection?: {
    authenticatorAttachment?: string
    residentKey?: string
    requireResidentKey?: boolean
    userVerification?: string
  }
  excludeCredentials?: Array<{ type: string; id: string; transports?: string[] }>
  extensions?: Record<string, unknown>
}

/**
 * WebAuthn request options returned by `passkeys.generateAuthenticationOptions`.
 * Pass these directly to `navigator.credentials.get({ publicKey: opts })`.
 */
export interface PasskeyAuthenticationOptions {
  challenge: string
  rpId?: string
  timeout?: number
  allowCredentials?: Array<{ type: string; id: string; transports?: string[] }>
  userVerification?: string
  extensions?: Record<string, unknown>
}

/** Params for completing a passkey registration ceremony. */
export interface PasskeyVerifyRegistrationParams {
  /** The credential returned by `navigator.credentials.create`. */
  response: Record<string, unknown>
  /** Optional display name for the passkey. */
  name?: string
}

/** Params for completing a passkey authentication ceremony. */
export interface PasskeyVerifyAuthenticationParams {
  /** The credential returned by `navigator.credentials.get`. */
  response: Record<string, unknown>
}

type SocialProviderEntry = {
  clientId?: string | string[]
  clientSecret?: string
  scope?: string[]
  redirectURI?: string
  disableSignUp?: boolean
  disableIdTokenSignIn?: boolean
  disableImplicitSignUp?: boolean
  disableDefaultScope?: boolean
  overrideUserInfoOnSignIn?: boolean
  prompt?: string
  responseMode?: string
  clientKey?: string
  [key: string]: unknown
}

export type GatehouseSocialConfig = string[] | Record<string, SocialProviderEntry | true>

/**
 * Configuration for the gatehouse auth module.
 *
 * Controls which authentication features are enabled (email/password, social,
 * magic links, OTP, passkeys, TOTP, organizations, admin, API keys) and how
 * they behave.
 *
 * The provider is selected with `provider: 'better-auth'` or by supplying a
 * GatehouseProvider instance (curated custom/test providers). Feature options
 * are Tower-owned; provider-specific settings (secrets, model names, custom
 * plugins) pass through via `passThrough` and `plugins`.
 */
export interface GatehouseConfig {
  provider: 'better-auth' | import('./provider.js').GatehouseProvider

  /**
   * Social providers for Gatehouse-owned social sign-in and linking (#83).
   * Configured providers become available through `gatehouse.social.*`.
   */
  socialProviders?: import('./social.js').SocialProvider[]

  credentials?:
    | boolean
    | {
        enabled?: boolean
        disableSignUp?: boolean
        requireEmailVerification?: boolean
        minPasswordLength?: number
        maxPasswordLength?: number
        autoSignIn?: boolean
        revokeSessionsOnPasswordReset?: boolean
        resetPasswordTokenExpiresIn?: number
        sendResetPassword?: (
          data: { user: { id: string; email: string; name: string }; url: string; token: string },
          request?: Request
        ) => void | Promise<void>
        onPasswordReset?: (data: { user: { id: string; email: string; name: string } }) => void | Promise<void>
        onExistingUserSignUp?: (data: { user: { id: string; email: string; name: string } }) => void | Promise<void>
        customSyntheticUser?: (data: {
          coreFields: Record<string, unknown>
          additionalFields: Record<string, unknown>
          id: string
        }) => Record<string, unknown>
        password?: {
          hash?: (password: string) => Promise<string>
          verify?: (data: { hash: string; password: string }) => Promise<boolean>
        }
      }

  emailVerification?: boolean | GatehouseEmailVerificationConfig

  social?: GatehouseSocialConfig
  passkeys?: boolean | GatehousePasskeyOptions
  magicLinks?: boolean | Partial<GatehouseMagicLinkOptions>
  phoneNumber?: boolean | Partial<GatehousePhoneNumberOptions>
  twoFactor?: boolean
  organization?: boolean
  admin?: boolean
  apiKey?: boolean

  baseURL?:
    | string
    | {
        allowedHosts: string[]
        protocol?: 'http' | 'https' | 'auto'
        fallback?: string
      }

  appName?: string
  trustedOrigins?: string[]
  plugins?: import('better-auth').BetterAuthPlugin[]

  user?: {
    modelName?: string
    fields?: Record<string, string>
    additionalFields?: Record<string, { type: string; required?: boolean; defaultValue?: unknown; input?: boolean }>
    changeEmail?: {
      enabled: boolean
      sendChangeEmailConfirmation?: (data: {
        user: { id: string; email: string; name: string }
        newEmail: string
        url: string
        token: string
      }) => void | Promise<void>
      updateEmailWithoutVerification?: boolean
    }
    deleteUser?: {
      enabled: boolean
      sendDeleteAccountVerification?: (data: {
        user: { id: string; email: string; name: string }
        url: string
        token: string
      }) => void | Promise<void>
      beforeDelete?: (user: { id: string; email: string; name: string }) => void | Promise<void>
      afterDelete?: (user: { id: string; email: string; name: string }) => void | Promise<void>
    }
  }

  session?: {
    modelName?: string
    fields?: Record<string, string>
    expiresIn?: number
    updateAge?: number
    disableSessionRefresh?: boolean
    deferSessionRefresh?: boolean
    additionalFields?: Record<string, { type: string; required?: boolean; defaultValue?: unknown }>
    storeSessionInDatabase?: boolean
    preserveSessionInDatabase?: boolean
    cookieCache?: {
      enabled: boolean
      maxAge?: number
      strategy?: 'compact' | 'jwt' | 'jwe'
    }
  }

  account?: {
    modelName?: string
    fields?: Record<string, string>
    encryptOAuthTokens?: boolean
    updateAccountOnSignIn?: boolean
    storeStateStrategy?: 'cookie' | 'database'
    storeAccountCookie?: boolean
    accountLinking?: {
      enabled?: boolean
      trustedProviders?: string[] | ((request: Request) => string[] | Promise<string[]>)
      allowDifferentEmails?: boolean
      disableImplicitLinking?: boolean
      allowUnlinkingAll?: boolean
      updateUserInfoOnLink?: boolean
    }
  }

  rateLimit?: {
    enabled?: boolean
    window?: number
    max?: number
    storage?: 'memory' | 'database' | 'secondary-storage'
    customRules?: Record<string, { window: number; max: number } | false>
  }

  advanced?: {
    useSecureCookies?: boolean
    disableCSRFCheck?: boolean
    cookiePrefix?: string
    database?: {
      generateId?: ((options: { model: string; size?: number }) => string | false) | false | 'serial' | 'uuid'
      defaultFindManyLimit?: number
    }
  }

  passThrough?: Record<string, unknown>
}

/**
 * Controls which paths the gatehouse proxy protects and where redirects go.
 *
 * Set `public` to allow unauthenticated access to certain routes,
 * `redirectTo` to send unauthenticated users to the sign-in page,
 * and `redirectAfterSignIn` to send them back after login.
 */
export interface ProxyOptions {
  public?: string[]
  redirectIfAuthenticated?: string[]
  redirectTo?: string
  redirectAfterSignIn?: string
}

export interface ProxyResult {
  handler: (request: Request) => Promise<Response | undefined>
  config: { matcher: string[] }
}

/**
 * Per-request authentication API created by `gatehouse.from()`.
 *
 * Every method is bound to the request's session. Use this interface
 * to sign in/up users, manage sessions, organizations, API keys, etc.
 */
export interface GatehouseInstance {
  session(): Promise<Session | null>
  user(): Promise<GatehouseUser | null>
  readonly headers: Headers

  /**
   * Signs the current session out of the Tower application.
   *
   * Core API: portable across all providers.
   */
  signOut(): Promise<void>

  /**
   * Raw provider instance.
   *
   * Escape hatch only — not part of the stable contract. Accessing provider
   * internals bypasses Gatehouse's Tower-owned semantics.
   */
  readonly provider: any

  /**
   * Returns the current session or throws AuthenticationError.
   * Use this in route handlers and server actions where a user must be logged in.
   */
  requireUser(): Promise<GatehouseUser>

  signIn: {
    email(params: { email: string; password: string }): Promise<SignInResult>
    emailOtp(params: { email: string; otp: string }): Promise<SignInResult>
    magicLink(params: { email: string; callbackURL?: string }): Promise<void>
    phone(params: { phoneNumber: string; code: string }): Promise<SignInResult>
    social(params: { provider: string; callbackURL?: string; disableRedirect?: boolean }): Promise<SignInResult>
  }

  signUp: {
    email(params: { name: string; email: string; password: string }): Promise<SignInResult>
  }

  sessions: {
    list(): Promise<GatehouseSession[]>
    revoke(token: string): Promise<void>
    revokeOther(): Promise<void>
    revokeAll(): Promise<void>
    signOut(): Promise<void>
  }

  account: {
    update(data: UpdateUserData): Promise<GatehouseUser>
    delete(): Promise<void>
    setPassword(newPassword: string): Promise<void>
    changeEmail(email: string): Promise<void>
  }

  password: {
    forgot(params: { email: string }): Promise<void>
    reset(params: { newPassword: string; token: string }): Promise<void>
    change(params: { currentPassword: string; newPassword: string }): Promise<void>
    confirm(params: { password: string }): Promise<boolean>
  }

  email: {
    sendVerification(params: { email: string }): Promise<void>
    verify(params: { token: string }): Promise<void>
    otp: {
      send(params: EmailOtpSendParams): Promise<void>
      confirm(params: EmailOtpConfirmParams): Promise<SignInResult>
    }
  }

  phone: {
    otp: {
      send(params: PhoneOtpSendParams): Promise<void>
      confirm(params: PhoneOtpConfirmParams): Promise<SignInResult>
    }
  }

  users: {
    get(id: string): Promise<GatehouseUser | null>
    findByEmail(email: string): Promise<GatehouseUser | null>
  }

  roles: {
    assign(userId: string, role: string): Promise<void>
    remove(userId: string): Promise<void>
  }

  passkeys: {
    list(): Promise<PasskeyInfo[]>
    update(id: string, params: PasskeyUpdateParams): Promise<PasskeyInfo>
    delete(id: string): Promise<void>
    /** Starts the WebAuthn registration ceremony. Requires a session. */
    generateRegistrationOptions(params?: {
      authenticatorAttachment?: 'platform' | 'cross-platform'
      name?: string
      context?: string
    }): Promise<PasskeyRegistrationOptions>
    /** Completes the WebAuthn registration ceremony. Requires a session. */
    verifyRegistration(params: PasskeyVerifyRegistrationParams): Promise<PasskeyInfo>
    /** Starts the WebAuthn authentication ceremony. */
    generateAuthenticationOptions(): Promise<PasskeyAuthenticationOptions>
    /** Completes the WebAuthn authentication ceremony and signs the user in. */
    verifyAuthentication(params: PasskeyVerifyAuthenticationParams): Promise<Session>
  }

  admin: {
    createUser(params: AdminUserCreateParams): Promise<GatehouseUser>
    getUser(userId: string): Promise<GatehouseUser | null>
    listUsers(options?: AdminListUsersOptions): Promise<{ users: GatehouseUser[]; total?: number }>
    removeUser(userId: string): Promise<void>
    setUserPassword(userId: string, newPassword: string): Promise<void>
    setRole(params: AdminSetRoleParams): Promise<void>
    banUser(userId: string, params?: AdminUserBanParams): Promise<void>
    unbanUser(userId: string): Promise<void>
    impersonateUser(userId: string): Promise<AdminImpersonationResult>
    stopImpersonating(): Promise<void>
    listUserSessions(userId: string): Promise<AdminUserSession[]>
    revokeUserSession(sessionToken: string): Promise<void>
    revokeUserSessions(userId: string): Promise<void>
  }

  apiKeys: {
    create(params: ApiKeyCreateParams): Promise<ApiKeyInfo>
    list(userId: string, options?: ApiKeyListOptions): Promise<{ keys: ApiKeyInfo[]; total?: number }>
    get(keyId: string): Promise<ApiKeyInfo | null>
    update(id: string, params: ApiKeyUpdateParams): Promise<ApiKeyInfo>
    delete(id: string): Promise<void>
    verify(params: ApiKeyVerifyParams): Promise<ApiKeyInfo | null>
  }

  identities: {
    list(): Promise<Identity[]>
    unlink(params: { providerId: string; accountId: string }): Promise<void>
    link(input: string | { provider: string; callbackURL?: string }): Promise<void>
    getAccessToken(providerId: string): Promise<AccessToken>
  }

  totp: {
    enable(password: string | { password: string; issuer?: string }): Promise<TwoFactorInfo>
    disable(password: string | { password: string }): Promise<void>
    verify(code: string | { code: string; trustDevice?: boolean }): Promise<TwoFactorVerifyResult>
    uri(password: string): Promise<string>
    otp: {
      send(params?: TwoFactorOtpSendParams): Promise<void>
      verify(params: TwoFactorOtpVerifyParams): Promise<TwoFactorVerifyResult>
    }
  }

  backupCodes: {
    generate(password: string | { password: string }): Promise<string[]>
    verify(code: string): Promise<TwoFactorVerifyResult>
  }

  organizations: {
    create(params: OrganizationCreateParams): Promise<Organization>
    list(): Promise<Organization[]>
    getFull(id: string): Promise<OrganizationFull | null>
    setActive(organizationId: string): Promise<void>
    update(id: string, params: OrganizationUpdateParams): Promise<Organization>
    delete(id: string): Promise<void>
    members: {
      list(organizationId: string): Promise<OrganizationMember[]>
      add(organizationId: string, userId: string, role?: string): Promise<OrganizationMember>
      update(memberId: string, role: string, organizationId?: string): Promise<OrganizationMember>
      remove(organizationId: string, memberId: string): Promise<void>
    }
    invitations: {
      create(organizationId: string, params: OrganizationInviteParams): Promise<OrganizationInvitation>
      list(organizationId: string): Promise<OrganizationInvitation[]>
      get(invitationId: string): Promise<OrganizationInvitation | null>
      accept(invitationId: string): Promise<void>
      reject(invitationId: string): Promise<void>
      cancel(invitationId: string): Promise<void>
    }
    roles: {
      create(params: OrganizationRoleCreateParams): Promise<OrganizationRole>
      list(organizationId?: string): Promise<OrganizationRole[]>
      get(params: { roleName: string; organizationId?: string }): Promise<OrganizationRole | null>
      update(roleId: string, params: OrganizationRoleUpdateParams): Promise<OrganizationRole>
      delete(params: { roleId?: string; roleName?: string; organizationId?: string }): Promise<void>
    }
  }

  can(params: { user: GatehouseUser; permission: string | string[]; organizationId?: string }): Promise<boolean>
}

/**
 * Module-level gatehouse API.
 *
 * Use `from()` to create a per-request instance, `proxy()` for the
 * auth middleware, and `migrate()` during deployment setup.
 */
export interface GatehouseModule {
  /**
   * Raw provider instance.
   *
   * Escape hatch only — not part of the stable contract. Accessing provider
   * internals bypasses Gatehouse's Tower-owned semantics.
   */
  provider: any

  /** Gatehouse-owned social sign-in / linking API (#83). */
  social: {
    redirect(
      providerId: string,
      options?: import('./social.js').SocialRedirectOptions
    ): Promise<import('./social.js').SocialRedirect>
    authenticate(params: {
      provider: string
      code: string
    }): Promise<import('./social-lifecycle.js').SocialSignInResult>
    linkCurrent(params: { provider: string; code: string }): Promise<import('./social-lifecycle.js').LinkResult>
  }

  /** Capability declaration of the configured provider. */
  readonly capabilities: import('./provider.js').GatehouseProviderCapabilities

  routes: {
    GET: (req: Request) => Promise<Response>
    POST: (req: Request) => Promise<Response>
  }

  from(request: Request | { headers: Headers }): Promise<GatehouseInstance>

  fromHeaders(headers: Headers): Promise<GatehouseInstance>

  proxy(options?: ProxyOptions): ProxyResult

  migrate(): Promise<void>
}
