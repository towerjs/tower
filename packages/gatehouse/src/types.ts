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

/** Combined user and session returned by auth operations. */
export interface Session {
  user: GatehouseUser
  session: GatehouseSession
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
  permission?: Record<string, string[]>
  roleName?: string
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

export interface PasskeyCreateParams {
  name?: string
  domain?: string
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

export interface AdminCheckPermissionParams {
  userId?: string
  role?: string
  permissions: Record<string, string[]>
}

export interface AdminUpdateUserParams {
  name?: string
  email?: string
  role?: string
  data?: Record<string, unknown>
}

/** Options for the admin user listing endpoint. */
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
  type?: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
}

export interface EmailOtpConfirmParams {
  email: string
  code: string
  type?: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
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

import type {
  MagicLinkOptions,
  EmailOTPOptions,
  PhoneNumberOptions,
  TwoFactorOptions,
  OrganizationOptions,
  AdminOptions,
} from 'better-auth/plugins'
import type { PasskeyOptions } from '@better-auth/passkey'
import type { ApiKeyOptions } from '@better-auth/api-key'

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

type BetterAuthGenerateIdFn = (options: { model: string; size?: number | undefined }) => string | false

/**
 * Configuration for the gatehouse auth module backed by better-auth.
 *
 * Controls which authentication features are enabled (email/password, social,
 * magic links, OTP, passkeys, TOTP, organizations, admin, API keys) and how
 * they behave. Each feature maps to a better-auth plugin.
 *
 * Most config fields are optional — omit a feature to disable it.
 */
export interface GatehouseConfig {
  provider: 'better-auth'

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

  emailVerification?: {
    sendVerificationEmail?: (
      data: { user: { id: string; email: string; name: string }; url: string; token: string },
      request?: Request
    ) => void | Promise<void>
    sendOnSignUp?: boolean
    autoSignInAfterVerification?: boolean
    expiresIn?: number
  }

  social?: GatehouseSocialConfig
  passkeys?: boolean | PasskeyOptions
  magicLinks?: boolean | Partial<MagicLinkOptions>
  emailOtp?: boolean | Partial<EmailOTPOptions>
  phoneNumber?: boolean | Partial<PhoneNumberOptions>
  twoFactor?: boolean | TwoFactorOptions
  organization?: boolean | OrganizationOptions
  admin?: boolean | AdminOptions
  apiKey?: boolean | ApiKeyOptions

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

  advanced?: {
    useSecureCookies?: boolean
    disableCSRFCheck?: boolean
    cookiePrefix?: string
    database?: {
      generateId?: BetterAuthGenerateIdFn | false | 'serial' | 'uuid'
      defaultFindManyLimit?: number
    }
  }

  passThrough?: Record<string, unknown>
}

/** Controls which paths the gatehouse proxy protects and where redirects go. */
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
  readonly provider: any

  /**
   * Returns the current session or throws AuthenticationError.
   * Use this in route handlers and server actions where a user must be logged in.
   */
  requireUser(): Promise<Session>

  signIn: {
    email(params: { email: string; password: string }): Promise<Session>
    emailOtp(params: { email: string; code: string; type?: string }): Promise<Session>
    magicLink(params: { email: string; callbackURL?: string }): Promise<void>
    phone(params: { phoneNumber: string; code: string }): Promise<Session>
    social(params: { provider: string; callbackURL?: string; disableRedirect?: boolean }): Promise<Session>
  }

  signUp: {
    email(params: { name: string; email: string; password: string }): Promise<Session>
  }

  sessions: {
    list(): Promise<GatehouseSession[]>
    revoke(token: string): Promise<void>
    revokeOther(): Promise<void>
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
      confirm(params: EmailOtpConfirmParams): Promise<Session>
    }
  }

  phone: {
    otp: {
      send(params: PhoneOtpSendParams): Promise<void>
      confirm(params: PhoneOtpConfirmParams): Promise<Session>
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
    add(params?: PasskeyCreateParams): Promise<PasskeyInfo>
    list(): Promise<PasskeyInfo[]>
    update(id: string, params: PasskeyUpdateParams): Promise<PasskeyInfo>
    remove(id: string): Promise<void>
  }

  admin: {
    createUser(params: AdminUserCreateParams): Promise<GatehouseUser>
    updateUser(userId: string, params: AdminUpdateUserParams): Promise<GatehouseUser>
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
    revokeUserSession(userId: string, sessionToken: string): Promise<void>
    revokeUserSessions(userId: string): Promise<void>
    hasPermission(params: AdminCheckPermissionParams): Promise<boolean>
  }

  apiKeys: {
    create(params: ApiKeyCreateParams): Promise<ApiKeyInfo>
    list(userId: string, options?: ApiKeyListOptions): Promise<{ keys: ApiKeyInfo[]; total?: number }>
    get(keyId: string): Promise<ApiKeyInfo | null>
    update(id: string, params: ApiKeyUpdateParams): Promise<ApiKeyInfo>
    delete(id: string): Promise<void>
    verify(params: ApiKeyVerifyParams): Promise<ApiKeyInfo | null>
    deleteAllExpired(): Promise<number>
  }

  identities: {
    list(): Promise<Identity[]>
    unlink(id: string): Promise<void>
    link(input: string | { provider: string; redirect?: string }): Promise<void>
    getAccessToken(provider: string): Promise<AccessToken>
  }

  totp: {
    enable(password: string, issuer?: string): Promise<TwoFactorInfo>
    disable(password: string): Promise<void>
    verify(code: string, trustDevice?: boolean): Promise<TwoFactorVerifyResult>
    uri(password: string): Promise<string>
    otp: {
      send(params?: TwoFactorOtpSendParams): Promise<void>
      verify(params: TwoFactorOtpVerifyParams): Promise<TwoFactorVerifyResult>
    }
  }

  backupCodes: {
    generate(password: string): Promise<string[]>
    verify(code: string): Promise<TwoFactorVerifyResult>
  }

  organizations: {
    create(params: OrganizationCreateParams): Promise<Organization>
    list(): Promise<Organization[]>
    get(id: string): Promise<Organization | null>
    getFull(id: string): Promise<OrganizationFull | null>
    setActive(organizationId: string): Promise<void>
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
      get(invitationId: string): Promise<OrganizationInvitation | null>
      accept(invitationId: string): Promise<void>
      reject(invitationId: string): Promise<void>
      cancel(invitationId: string): Promise<void>
    }
    roles: {
      create(params: OrganizationRoleCreateParams): Promise<OrganizationRole>
      list(organizationId?: string): Promise<OrganizationRole[]>
      get(organizationId: string, roleName: string): Promise<OrganizationRole | null>
      update(organizationId: string, roleName: string, params: OrganizationRoleUpdateParams): Promise<OrganizationRole>
      delete(organizationId: string, roleName: string): Promise<void>
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
  provider: any

  routes: {
    GET: (req: Request) => Promise<Response>
    POST: (req: Request) => Promise<Response>
  }

  from(request: Request | { headers: Headers }): Promise<GatehouseInstance>

  proxy(options?: ProxyOptions): ProxyResult

  migrate(): Promise<void>
}
