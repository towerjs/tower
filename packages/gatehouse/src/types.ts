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

export interface AdminListUsersOptions {
  searchField?: string
  searchOperator?: "eq" | "ne" | "starts_with" | "ends_with" | "contains"
  searchValue?: string
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
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
  sortDirection?: "asc" | "desc"
  organizationId?: string
  configId?: string
}

export interface ApiKeyVerifyParams {
  key: string
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
} from "better-auth/plugins"
import type { SocialProviders } from "better-auth/types"
import type { PasskeyOptions } from "@better-auth/passkey"
import type { ApiKeyOptions } from "@better-auth/api-key"

export interface GatehouseConfig {
  provider: "better-auth"
  credentials?: boolean | {
    enabled?: boolean
    disableSignUp?: boolean
    requireEmailVerification?: boolean
    minPasswordLength?: number
    maxPasswordLength?: number
  }
  social?: SocialProviders
  passkeys?: boolean | PasskeyOptions
  magicLinks?: boolean | Partial<MagicLinkOptions>
  emailOtp?: boolean | Partial<EmailOTPOptions>
  phoneNumber?: boolean | Partial<PhoneNumberOptions>
  twoFactor?: boolean | TwoFactorOptions
  organization?: boolean | OrganizationOptions
  admin?: boolean | AdminOptions
  apiKey?: boolean | ApiKeyOptions
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
  public?: string[]
  redirectIfAuthenticated?: string[]
  redirectTo?: string
  redirectAfterSignIn?: string
}

export interface ProxyResult {
  handler: (request: Request) => Promise<Response | undefined>
  config: { matcher: string[] }
}

export interface GatehouseModule {
  provider: any

  routes: {
    GET: (req: Request) => Promise<Response>
    POST: (req: Request) => Promise<Response>
  }

  from(request: Request | { headers: Headers }): Promise<GatehouseContext>

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

  can(params: { user: GatehouseUser; permission: string | string[]; organizationId?: string }): Promise<boolean>
  roles: {
    assign(userId: string, role: string): Promise<void>
    remove(userId: string): Promise<void>
  }

  migrate(): Promise<void>
}

export interface GatehouseContext {
  readonly session: Session | null
  readonly user: GatehouseUser | null
  readonly headers: Headers
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
