import { createRequire } from "node:module";
import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { Kysely } from "kysely";

const _require = createRequire(import.meta.url);
import { magicLink, emailOTP, twoFactor, organization, admin, phoneNumber } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { apiKey } from "@better-auth/api-key";
import type {
  AuthMethod,
  GatehouseConfig,
  GatehouseContext,
  GatehouseSession,
  GatehouseUser,
  Identity,
  PasswordChangeParams,
  PasswordForgotParams,
  PasswordResetConfirmParams,
  PasswordConfirmParams,
  Session,
  SignUpParams,
  UpdateUserData,
  EmailVerifySendParams,
  EmailVerifyConfirmParams,
  EmailOtpSendParams,
  EmailOtpConfirmParams,
  TwoFactorInfo,
  TwoFactorVerifyResult,
  OrganizationCreateParams,
  OrganizationUpdateParams,
  OrganizationInviteParams,
  Organization,
  OrganizationFull,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationRoleCreateParams,
  OrganizationRoleUpdateParams,
  AccessToken,
  ProxyOptions,
  ProxyResult,
  PhoneOtpSendParams,
  PhoneOtpConfirmParams,
  PasskeyInfo,
  PasskeyCreateParams,
  PasskeyUpdateParams,
  AdminUserCreateParams,
  AdminUpdateUserParams,
  AdminUserBanParams,
  AdminSetRoleParams,
  AdminListUsersOptions,
  AdminImpersonationResult,
  AdminUserSession,
  AdminCheckPermissionParams,
  ApiKeyInfo,
  ApiKeyCreateParams,
  ApiKeyUpdateParams,
  ApiKeyListOptions,
  ApiKeyVerifyParams,
  TwoFactorOtpSendParams,
  TwoFactorOtpVerifyParams,
} from "../types.js";
import { AuthenticationError } from "../types.js";

export class BetterAuthAdapter {
  private auth: any;
  private api: any;
  private db: Kysely<unknown>;
  private config: GatehouseConfig;

  constructor(config: GatehouseConfig, db: Kysely<unknown>) {
    this.db = db;
    this.config = config;

    const baseURL = config.baseURL || process.env.BETTER_AUTH_URL;

    const creds =
      config.credentials === true
        ? { enabled: true }
        : config.credentials
          ? { enabled: true, ...config.credentials }
          : undefined;

    const allPlugins = [...(config.plugins || [])];

    if (config.magicLinks) {
      const sendMagicLink = typeof config.magicLinks === "object" && config.magicLinks.sendMagicLink
        ? config.magicLinks.sendMagicLink
        : async ({ email, url }: { email: string; url: string }) => {
            throw new Error(
              `sendMagicLink not implemented — provide a sendMagicLink callback in the magicLinks config`,
            );
          };
      allPlugins.push(magicLink({ sendMagicLink }));
    }
    if (config.emailOtp) {
      const sendVerificationOTP = typeof config.emailOtp === "object" && config.emailOtp.sendVerificationOTP
        ? config.emailOtp.sendVerificationOTP
        : async ({ email, otp, type }: { email: string; otp: string; type: string }) => {
            throw new Error(
              `sendVerificationOTP not implemented — provide a sendVerificationOTP callback in the emailOtp config`,
            );
          };
      allPlugins.push(emailOTP({ sendVerificationOTP }));
    }
    if (config.phoneNumber) {
      const sendOTP = typeof config.phoneNumber === "object" && config.phoneNumber.sendOTP
        ? config.phoneNumber.sendOTP
        : async ({ phoneNumber: _phone, code }: { phoneNumber: string; code: string }) => {
            throw new Error(
              `sendOTP not implemented — provide a sendOTP callback in the phoneNumber config`,
            );
          };
      allPlugins.push(phoneNumber({ sendOTP }));
    }
    if (config.passkeys) {
      allPlugins.push(passkey(
        typeof config.passkeys === "object" ? config.passkeys : undefined
      ));
    }
    if (config.apiKey) {
      allPlugins.push(apiKey(
        typeof config.apiKey === "object" ? config.apiKey : undefined
      ));
    }
    if (config.admin) {
      allPlugins.push(admin());
    }
    if (config.twoFactor) {
      allPlugins.push(twoFactor());
    }
    if (config.organization) {
      allPlugins.push(organization());
    }

    const baOptions: Record<string, unknown> = {
      database: { db, type: "postgres" },
      secret: config.passThrough?.secret || process.env.BETTER_AUTH_SECRET,
      baseURL,
      basePath: config.passThrough?.basePath,
      appName: config.appName,
      emailAndPassword: creds,
      socialProviders: config.social,
      advanced: config.advanced,
      plugins: allPlugins,
    };
    if (config.passThrough) {
      for (const [k, v] of Object.entries(config.passThrough)) {
        baOptions[k] = v;
      }
    }
    this.auth = betterAuth(baOptions as any);
    this.api = this.auth.api;
  }

  async migrate(): Promise<void> {
    const { getMigrations } = _require("better-auth/dist/db/get-migration.mjs");
    const { runMigrations } = await getMigrations(this.auth.options);
    await runMigrations();
  }

  get provider(): any {
    return this.auth;
  }

  get routes() {
    return toNextJsHandler(this.auth);
  }

  // ─── From ─────────────────────────────────────────────────────────

  async from(request: { headers: Headers } | Request): Promise<GatehouseContext> {
    const headers = request instanceof Request ? request.headers : request.headers;
    const session = await this.getSession({ headers });

    return {
      session,
      user: session?.user ?? null,
      headers,
      provider: this.auth,

      signOut: () => this.signOut({ headers }),

      sessions: {
        list: () => this.listSessions({ headers }),
        revoke: (token) => this.revokeSession({ headers }, token),
        revokeOther: () => this.revokeOtherSessions({ headers }),
      },

      account: {
        update: (data) => this.updateUser({ headers }, data),
        delete: () => this.deleteUser({ headers }),
        setPassword: (newPassword) => this.setPassword({ headers }, newPassword),
        changeEmail: (email) => this.changeEmail({ headers }, email),
      },

      password: {
        change: (params) => this.changePassword({ headers }, params),
        confirm: (params) => this.verifyPassword({ headers }, params),
      },

      email: {
        verify: {
          confirm: (params) => this.verifyEmail({ headers }, params),
        },
        otp: {
          send: (params) => this.sendEmailOTP({ headers }, params),
          confirm: (params) => this.verifyEmailOTP({ headers }, params),
        },
      },

      phone: {
        otp: {
          send: (params) => this.sendPhoneOTP({ headers }, params),
          confirm: (params) => this.verifyPhoneOTP({ headers }, params),
        },
      },

      passkeys: {
        add: (params) => this.addPasskey({ headers }, params),
        list: () => this.listPasskeys({ headers }),
        update: (id, params) => this.updatePasskey({ headers }, id, params),
        remove: (id) => this.removePasskey({ headers }, id),
      },

      admin: {
        createUser: (params) => this.createUserByAdmin({ headers }, params),
        updateUser: (userId, params) => this.updateUserByAdmin({ headers }, userId, params),
        getUser: (userId) => this.getUserByAdmin({ headers }, userId),
        listUsers: (options) => this.listUsersByAdmin({ headers }, options),
        removeUser: (userId) => this.removeUserByAdmin({ headers }, userId),
        setUserPassword: (userId, newPassword) => this.setUserPasswordByAdmin({ headers }, userId, newPassword),
        setRole: (params) => this.setRoleByAdmin({ headers }, params),
        banUser: (userId, params) => this.banUserByAdmin({ headers }, userId, params),
        unbanUser: (userId) => this.unbanUserByAdmin({ headers }, userId),
        impersonateUser: (userId) => this.impersonateUserByAdmin({ headers }, userId),
        stopImpersonating: () => this.stopImpersonatingByAdmin({ headers }),
        listUserSessions: (userId) => this.listUserSessionsByAdmin({ headers }, userId),
        revokeUserSession: (userId, sessionToken) => this.revokeUserSessionByAdmin({ headers }, userId, sessionToken),
        revokeUserSessions: (userId) => this.revokeUserSessionsByAdmin({ headers }, userId),
        hasPermission: (params) => this.userHasPermissionByAdmin({ headers }, params),
      },

      apiKeys: {
        create: (params) => this.createApiKey({ headers }, params),
        list: (userId, options) => this.listApiKeys({ headers }, userId, options),
        get: (keyId) => this.getApiKey({ headers }, keyId),
        update: (id, params) => this.updateApiKey({ headers }, id, params),
        delete: (id) => this.deleteApiKey({ headers }, id),
        verify: (params) => this.verifyApiKey({ headers }, params),
        deleteAllExpired: () => this.deleteAllExpiredApiKeys({ headers }),
      },

      identities: {
        list: () => this.listIdentities({ headers }),
        unlink: (id) => this.unlinkIdentity({ headers }, id),
        link: (input) => {
          const provider = typeof input === "string" ? input : input.provider
          const redirect = typeof input === "string"
            ? (headers.get("referer") || "/settings")
            : (input.redirect ?? headers.get("referer") ?? "/settings")
          return this.linkIdentity({ headers }, provider, redirect)
        },
        getAccessToken: (provider) => this.getAccessToken({ headers }, provider),
      },

      totp: {
        enable: (password, issuer) => this.enableTwoFactor({ headers }, password, issuer),
        disable: (password) => this.disableTwoFactor({ headers }, password),
        verify: (code, trustDevice) => this.verifyTwoFactorTotp({ headers }, code, trustDevice),
        uri: (password) => this.getTotpUri({ headers }, password),
        otp: {
          send: (params) => this.sendTwoFactorOTP({ headers }, params),
          verify: (params) => this.verifyTwoFactorOTP({ headers }, params),
        },
      },

      backupCodes: {
        generate: (password) => this.generateBackupCodes({ headers }, password),
        verify: (code) => this.verifyTwoFactorBackupCode({ headers }, code),
      },

      organizations: {
        create: (params) => this.createOrganization({ headers }, params),
        list: () => this.listOrganizations({ headers }),
        get: (id) => this.getOrganization({ headers }, id),
        getFull: (id) => this.getOrganizationFull({ headers }, id),
        setActive: (orgId) => this.setActiveOrganization({ headers }, orgId),
        update: (id, params) => this.updateOrganization({ headers }, id, params),
        delete: (id) => this.deleteOrganization({ headers }, id),
        members: {
          list: (orgId) => this.listOrganizationMembers({ headers }, orgId),
          add: (orgId, userId, role) => this.addOrganizationMember({ headers }, orgId, userId, role),
          update: (orgId, memberId, role) => this.updateOrganizationMember({ headers }, orgId, memberId, role),
          remove: (orgId, memberId) => this.removeOrganizationMember({ headers }, orgId, memberId),
        },
        invitations: {
          create: (orgId, params) => this.createOrganizationInvitation({ headers }, orgId, params),
          list: (orgId) => this.listOrganizationInvitations({ headers }, orgId),
          get: (invId) => this.getOrganizationInvitation({ headers }, invId),
          accept: (invId) => this.acceptInvitation({ headers }, invId),
          reject: (invId) => this.rejectInvitation({ headers }, invId),
          cancel: (invId) => this.cancelInvitation({ headers }, invId),
        },
        roles: {
          create: (params) => this.createOrganizationRole({ headers }, params),
          list: (orgId) => this.listOrganizationRoles({ headers }, orgId),
          get: (orgId, roleName) => this.getOrganizationRole({ headers }, orgId, roleName),
          update: (orgId, roleName, params) => this.updateOrganizationRole({ headers }, orgId, roleName, params),
          delete: (orgId, roleName) => this.deleteOrganizationRole({ headers }, orgId, roleName),
        },
      },

      can: (params) => this.checkPermission(params),
    };
  }

  // ─── Proxy ────────────────────────────────────────────────────────

  createProxy(options?: ProxyOptions): ProxyResult {
    const publicPaths = options?.public ?? []
    const authPaths = options?.redirectIfAuthenticated ?? []
    const redirectTo = options?.redirectTo ?? "/sign-in"
    const redirectAfterSignIn = options?.redirectAfterSignIn ?? "/"

    const allPaths = [...publicPaths, ...authPaths].filter(p => p !== "/")
    const matcher = allPaths.length > 0
      ? allPaths
      : ["/((?!_next/static|favicon.ico).*)"]

    const handler = async (request: Request): Promise<Response | undefined> => {
      const url = new URL(request.url)
      const path = url.pathname

      try {
        const auth = await this.from(request)
        if (auth.user) {
          if (authPaths.some(p => matchPath(path, p))) {
            return Response.redirect(new URL(redirectAfterSignIn, url))
          }
          return
        }
      } catch {
        // Treat session failure as unauthenticated
      }

      if (publicPaths.some(p => matchPath(path, p))) return

      return Response.redirect(new URL(redirectTo, url))
    }

    return { handler, config: { matcher } }
  }

  // ─── Auth ─────────────────────────────────────────────────────────

  async signIn(params: AuthMethod): Promise<Session> {
    if (params.method === "credentials") {
      const res = await this.auth.handler(
        new Request("http://localhost/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: params.email, password: params.password }),
        }),
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Sign in failed");
      return {
        user: mapUser(body.user || body),
        session: mapSession(body.session || body),
      };
    }
    if (params.method === "google" || params.method === "github" || params.method === "discord" || params.method === "social") {
      const provider = params.method === "social" ? params.provider : params.method;
      throw new Error(
        `Sign-in via "${provider}" requires a browser redirect to the auth route handler (gatehouse.routes). Use method: "credentials" for server-side sign-in.`,
      );
    }
    if (params.method === "magic-link") {
      await this.api.signInMagicLink({
        email: params.email,
        name: params.name,
        callbackURL: params.callbackURL || "/",
      });
      throw new Error("Magic link sent — verify via the callback URL");
    }
    if (params.method === "email-otp") {
      await this.api.sendVerificationOTP({
        email: params.email,
        type: params.type || "sign-in",
      });
      throw new Error("OTP sent — verify via gatehouse.email.otp.confirm()");
    }
    throw new Error("Sign in method not supported");
  }

  async signUp(params: { name: string; email: string; password: string }): Promise<Session> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: params.name,
          email: params.email,
          password: params.password,
        }),
      }),
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Sign up failed");
    return {
      user: mapUser(body.user || body),
      session: mapSession(body.session || body),
    };
  }

  async signOut(request: { headers: Headers }): Promise<void> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: request.headers,
      }),
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Sign out failed");
    }
  }

  // ─── Sessions ─────────────────────────────────────────────────────

  async getSession(request: { headers: Headers }): Promise<Session | null> {
    const result = await this.api.getSession({
      headers: request.headers,
    });
    if (!result) return null;
    return {
      user: mapUser(result.user),
      session: mapSession(result.session),
    };
  }

  async requireAuth(request: { headers: Headers }): Promise<Session> {
    const session = await this.getSession(request);
    if (!session) throw new AuthenticationError();
    return session;
  }

  async listSessions(request: { headers: Headers }): Promise<GatehouseSession[]> {
    const result = await this.api.listSessions({
      headers: request.headers,
    });
    return (result || []).map(mapSession);
  }

  async revokeSession(request: { headers: Headers }, token: string): Promise<void> {
    await this.api.revokeSession({
      headers: request.headers,
      body: { token },
    });
  }

  async revokeOtherSessions(request: { headers: Headers }): Promise<void> {
    await this.api.revokeOtherSessions({
      headers: request.headers,
    });
  }

  // ─── Users ────────────────────────────────────────────────────────

  async findUser(id: string): Promise<GatehouseUser | null> {
    const user = await (this.db as any)
      .selectFrom("user")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirst();
    if (!user) return null;
    return mapUser(user);
  }

  async findUserByEmail(email: string): Promise<GatehouseUser | null> {
    const user = await (this.db as any)
      .selectFrom("user")
      .where("email", "=", email)
      .selectAll()
      .executeTakeFirst();
    if (!user) return null;
    return mapUser(user);
  }

  async updateUser(request: { headers: Headers }, data: UpdateUserData): Promise<GatehouseUser> {
    const result = await this.api.updateUser({
      headers: request.headers,
      body: { ...data },
    });
    return mapUser(result.user || result);
  }

  async deleteUser(request: { headers: Headers }): Promise<void> {
    await this.api.deleteUser({
      headers: request.headers,
    });
  }

  async setPassword(request: { headers: Headers }, newPassword: string): Promise<void> {
    await this.api.setPassword({
      headers: request.headers,
      body: { newPassword },
    });
  }

  async changeEmail(request: { headers: Headers }, email: string): Promise<void> {
    await this.api.changeEmail({
      headers: request.headers,
      body: { email },
    });
  }

  // ─── Identities ───────────────────────────────────────────────────

  async listIdentities(request: { headers: Headers }): Promise<Identity[]> {
    const result = await this.api.listUserAccounts({
      headers: request.headers,
    });
    return (result.accounts || []).map((r: any) => ({
      id: r.id,
      provider: r.providerId,
      accountId: r.accountId,
      userId: r.userId,
      email: r.email || undefined,
    }));
  }

  async unlinkIdentity(request: { headers: Headers }, id: string): Promise<void> {
    await this.api.unlinkAccount({
      headers: request.headers,
      body: { accountId: id },
    });
  }

  async linkIdentity(request: { headers: Headers }, provider: string, callbackURL: string): Promise<void> {
    await this.api.linkSocialAccount({
      headers: request.headers,
      body: { provider, callbackURL },
    });
  }

  async getAccessToken(request: { headers: Headers }, provider: string): Promise<AccessToken> {
    const result = await this.api.getAccessToken({
      headers: request.headers,
      body: { provider },
    });
    return {
      token: result.token?.accessToken || result.token,
      provider: result.token?.provider || provider,
      expiresAt: result.token?.expiresAt ? new Date(result.token.expiresAt) : undefined,
    };
  }

  // ─── Password ─────────────────────────────────────────────────────

  async requestPasswordReset(params: PasswordForgotParams): Promise<void> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: params.email }),
      }),
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Password reset request failed");
    }
  }

  async resetPasswordWithToken(params: { newPassword: string; token: string }): Promise<void> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword: params.newPassword,
          token: params.token,
        }),
      }),
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Password reset failed");
    }
  }

  async changePassword(request: { headers: Headers }, params: PasswordChangeParams): Promise<void> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(request.headers),
        },
        body: JSON.stringify({
          currentPassword: params.currentPassword,
          newPassword: params.newPassword,
        }),
      }),
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Password change failed");
    }
  }

  async verifyPassword(request: { headers: Headers }, params: { password: string }): Promise<boolean> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/verify-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(request.headers),
        },
        body: JSON.stringify({ password: params.password }),
      }),
    );
    if (!res.ok) return false;
    const body = await res.json();
    return body.valid === true;
  }

  // ─── Verification ─────────────────────────────────────────────────

  async sendVerification(params: EmailVerifySendParams): Promise<void> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: params.email }),
      }),
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Verification email failed");
    }
  }

  async verifyEmail(request: { headers: Headers }, params: { token: string }): Promise<void> {
    const res = await this.auth.handler(
      new Request("http://localhost/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(request.headers),
        },
        body: JSON.stringify({ token: params.token }),
      }),
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Email verification failed");
    }
  }

  // ─── Email OTP ────────────────────────────────────────────────────

  async sendEmailOTP(request: { headers: Headers }, params: EmailOtpSendParams): Promise<void> {
    await this.api.sendVerificationOTP({
      headers: request.headers,
      body: { email: params.email, type: params.type || "sign-in" },
    });
  }

  async verifyEmailOTP(request: { headers: Headers }, params: EmailOtpConfirmParams): Promise<Session> {
    const result = await this.api.verifyVerificationOTP({
      headers: request.headers,
      body: { email: params.email, code: params.code, type: params.type || "sign-in" },
    });
    return {
      user: mapUser(result.user),
      session: mapSession(result.session),
    };
  }

  // ─── Phone OTP ────────────────────────────────────────────────────

  async sendPhoneOTP(request: { headers: Headers }, params: PhoneOtpSendParams): Promise<void> {
    await this.api.sendPhoneNumberOTP({
      headers: request.headers,
      body: { phoneNumber: params.phoneNumber },
    });
  }

  async verifyPhoneOTP(request: { headers: Headers }, params: PhoneOtpConfirmParams): Promise<Session> {
    const result = await this.api.verifyPhoneNumberOTP({
      headers: request.headers,
      body: { phoneNumber: params.phoneNumber, code: params.code },
    });
    return {
      user: mapUser(result.user),
      session: mapSession(result.session),
    };
  }

  // ─── Passkeys ─────────────────────────────────────────────────────

  async addPasskey(request: { headers: Headers }, params?: PasskeyCreateParams): Promise<PasskeyInfo> {
    const result = await this.api.addPasskey({
      headers: request.headers,
      body: { name: params?.name, domain: params?.domain },
    });
    return {
      id: result.id,
      name: result.name,
      createdAt: result.createdAt,
    };
  }

  async listPasskeys(request: { headers: Headers }): Promise<PasskeyInfo[]> {
    const result = await this.api.listPasskeys({
      headers: request.headers,
    });
    return (result.passkeys || result || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
    }));
  }

  async updatePasskey(request: { headers: Headers }, id: string, params: PasskeyUpdateParams): Promise<PasskeyInfo> {
    const result = await this.api.updatePasskey({
      headers: request.headers,
      body: { id, name: params.name },
    });
    return {
      id: result.id,
      name: result.name,
      createdAt: result.createdAt,
    };
  }

  async removePasskey(request: { headers: Headers }, id: string): Promise<void> {
    await this.api.removePasskey({
      headers: request.headers,
      body: { id },
    });
  }

  // ─── Admin ────────────────────────────────────────────────────────

  async createUserByAdmin(request: { headers: Headers }, params: AdminUserCreateParams): Promise<GatehouseUser> {
    const result = await this.api.createUser({
      headers: request.headers,
      body: {
        name: params.name,
        email: params.email,
        password: params.password,
        role: params.role,
        data: params.data,
      },
    });
    return mapUser(result.user || result);
  }

  async updateUserByAdmin(request: { headers: Headers }, userId: string, params: AdminUpdateUserParams): Promise<GatehouseUser> {
    const result = await this.api.adminUpdateUser?.({
      headers: request.headers,
      body: { userId, ...params },
    }) ?? await this.api.updateUser?.({
      headers: request.headers,
      body: { userId, ...params },
    });
    return mapUser(result.user || result);
  }

  async getUserByAdmin(request: { headers: Headers }, userId: string): Promise<GatehouseUser | null> {
    const result = await this.api.getUser?.({
      headers: request.headers,
      query: { userId },
    }) ?? await (this.db as any)
      .selectFrom("user")
      .where("id", "=", userId)
      .selectAll()
      .executeTakeFirst();
    if (!result) return null;
    return mapUser(result);
  }

  async listUsersByAdmin(request: { headers: Headers }, options?: AdminListUsersOptions): Promise<{ users: GatehouseUser[]; total?: number }> {
    const result = await this.api.listUsers({
      headers: request.headers,
      query: options as any,
    });
    return {
      users: (result.users || result || []).map(mapUser),
      total: result.total,
    };
  }

  async removeUserByAdmin(request: { headers: Headers }, userId: string): Promise<void> {
    await this.api.removeUser?.({
      headers: request.headers,
      body: { userId },
    }) ?? await this.api.deleteUser?.({
      headers: request.headers,
      body: { userId },
    });
  }

  async setUserPasswordByAdmin(request: { headers: Headers }, userId: string, newPassword: string): Promise<void> {
    await this.api.setUserPassword?.({
      headers: request.headers,
      body: { userId, newPassword },
    });
  }

  async setRoleByAdmin(request: { headers: Headers }, params: AdminSetRoleParams): Promise<void> {
    await this.api.setRole?.({
      headers: request.headers,
      body: { userId: params.userId, role: params.role },
    });
  }

  async banUserByAdmin(request: { headers: Headers }, userId: string, params?: AdminUserBanParams): Promise<void> {
    await this.api.banUser({
      headers: request.headers,
      body: { userId, banReason: params?.banReason, banExpiresIn: params?.banExpiresIn },
    });
  }

  async unbanUserByAdmin(request: { headers: Headers }, userId: string): Promise<void> {
    await this.api.unbanUser({
      headers: request.headers,
      body: { userId },
    });
  }

  async impersonateUserByAdmin(request: { headers: Headers }, userId: string): Promise<AdminImpersonationResult> {
    const result = await this.api.impersonateUser({
      headers: request.headers,
      body: { userId },
    });
    return {
      token: result.token,
      user: mapUser(result.user),
    };
  }

  async stopImpersonatingByAdmin(request: { headers: Headers }): Promise<void> {
    await this.api.stopImpersonating({
      headers: request.headers,
    });
  }

  async listUserSessionsByAdmin(request: { headers: Headers }, userId: string): Promise<AdminUserSession[]> {
    const result = await this.api.listUserSessions({
      headers: request.headers,
      query: { userId },
    });
    return (result.sessions || result || []).map((s: any) => ({
      id: s.id,
      userId: s.userId,
      expiresAt: s.expiresAt,
      token: s.token,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  async revokeUserSessionByAdmin(request: { headers: Headers }, userId: string, sessionToken: string): Promise<void> {
    await this.api.revokeUserSession({
      headers: request.headers,
      body: { userId, sessionToken },
    });
  }

  async revokeUserSessionsByAdmin(request: { headers: Headers }, userId: string): Promise<void> {
    await this.api.revokeUserSessions({
      headers: request.headers,
      body: { userId },
    });
  }

  async userHasPermissionByAdmin(request: { headers: Headers }, params: AdminCheckPermissionParams): Promise<boolean> {
    const result = await this.api.userHasPermission({
      headers: request.headers,
      body: {
        userId: params.userId,
        role: params.role,
        permissions: params.permissions,
      },
    });
    return result === true;
  }

  // ─── API Keys ─────────────────────────────────────────────────────

  async createApiKey(request: { headers: Headers }, params: ApiKeyCreateParams): Promise<ApiKeyInfo> {
    const result = await this.api.createApiKey({
      headers: request.headers,
      body: {
        name: params.name,
        userId: params.userId,
        expiresIn: params.expiresIn,
        prefix: params.prefix,
        permissions: params.permissions,
        configId: params.configId,
        metadata: params.metadata,
      },
    });
    return mapApiKey(result);
  }

  async listApiKeys(request: { headers: Headers }, userId: string, options?: ApiKeyListOptions): Promise<{ keys: ApiKeyInfo[]; total?: number }> {
    const body: Record<string, unknown> = { userId };
    if (options?.limit) body.limit = options.limit;
    if (options?.offset) body.offset = options.offset;
    if (options?.sortBy) body.sortBy = options.sortBy;
    if (options?.sortDirection) body.sortDirection = options.sortDirection;
    if (options?.organizationId) body.organizationId = options.organizationId;
    if (options?.configId) body.configId = options.configId;
    const result = await this.api.listApiKeys({
      headers: request.headers,
      body: body as any,
    });
    return {
      keys: (result.apiKeys || result?.data || result || []).map(mapApiKey),
      total: result.total,
    };
  }

  async getApiKey(request: { headers: Headers }, keyId: string): Promise<ApiKeyInfo | null> {
    const result = await this.api.getApiKey?.({
      headers: request.headers,
      query: { keyId },
    });
    if (!result) return null;
    return mapApiKey(result);
  }

  async updateApiKey(request: { headers: Headers }, id: string, params: ApiKeyUpdateParams): Promise<ApiKeyInfo> {
    const result = await this.api.updateApiKey({
      headers: request.headers,
      body: { keyId: id, name: params.name, expiresIn: params.expiresIn, permissions: params.permissions },
    });
    return mapApiKey(result);
  }

  async deleteApiKey(request: { headers: Headers }, id: string): Promise<void> {
    await this.api.deleteApiKey({
      headers: request.headers,
      body: { keyId: id },
    });
  }

  async verifyApiKey(request: { headers: Headers }, params: ApiKeyVerifyParams): Promise<ApiKeyInfo | null> {
    try {
      const result = await this.api.verifyApiKey?.({
        headers: request.headers,
        body: { key: params.key },
      });
      if (!result) return null;
      return mapApiKey(result);
    } catch {
      return null;
    }
  }

  async deleteAllExpiredApiKeys(request: { headers: Headers }): Promise<number> {
    const result = await this.api.deleteAllExpiredApiKeys?.({
      headers: request.headers,
    });
    return result?.count ?? 0;
  }

  // ─── Two-Factor ───────────────────────────────────────────────────

  async enableTwoFactor(request: { headers: Headers }, password: string, issuer?: string): Promise<TwoFactorInfo> {
    const result = await this.api.enableTwoFactor({
      headers: request.headers,
      body: { password, ...(issuer ? { issuer } : {}) },
    });
    return {
      totpURI: result.totpURI,
      backupCodes: result.backupCodes || [],
    };
  }

  async disableTwoFactor(request: { headers: Headers }, password: string): Promise<void> {
    await this.api.disableTwoFactor({
      headers: request.headers,
      body: { password },
    });
  }

  async verifyTwoFactorTotp(request: { headers: Headers }, code: string, trustDevice?: boolean): Promise<TwoFactorVerifyResult> {
    const result = await this.api.verifyTOTP({
      headers: request.headers,
      body: { code, trustDevice },
    });
    return {
      token: result.token,
      user: mapUser(result.user),
    };
  }

  async verifyTwoFactorBackupCode(request: { headers: Headers }, code: string): Promise<TwoFactorVerifyResult> {
    const result = await this.api.verifyBackupCode({
      headers: request.headers,
      body: { code },
    });
    return {
      token: result.token,
      user: mapUser(result.user),
    };
  }

  async generateBackupCodes(request: { headers: Headers }, password: string): Promise<string[]> {
    const result = await this.api.generateBackupCodes({
      headers: request.headers,
      body: { password },
    });
    return result.backupCodes || [];
  }

  async getTotpUri(request: { headers: Headers }, password: string): Promise<string> {
    const result = await this.api.getTOTPURI({
      headers: request.headers,
      body: { password },
    });
    return result.totpURI;
  }

  async sendTwoFactorOTP(request: { headers: Headers }, params?: TwoFactorOtpSendParams): Promise<void> {
    await this.api.sendTwoFactorOTP?.({
      headers: request.headers,
      body: { trustDevice: params?.trustDevice },
    });
  }

  async verifyTwoFactorOTP(request: { headers: Headers }, params: TwoFactorOtpVerifyParams): Promise<TwoFactorVerifyResult> {
    const result = await this.api.verifyTwoFactorOTP?.({
      headers: request.headers,
      body: { code: params.code, trustDevice: params?.trustDevice },
    });
    return {
      token: result?.token,
      user: mapUser(result?.user || result),
    };
  }

  // ─── Organizations ──────────────────────────────────────────────

  async createOrganization(request: { headers: Headers }, params: OrganizationCreateParams): Promise<Organization> {
    const result = await this.api.createOrganization({
      headers: request.headers,
      body: {
        name: params.name,
        slug: params.slug,
        logo: params.logo,
        metadata: params.metadata,
      },
    });
    return mapOrganization(result);
  }

  async listOrganizations(request: { headers: Headers }): Promise<Organization[]> {
    const result = await this.api.listOrganizations({
      headers: request.headers,
    });
    return (result.organizations || result || []).map(mapOrganization);
  }

  async getOrganization(request: { headers: Headers }, id: string): Promise<Organization | null> {
    const result = await this.api.getOrganization({
      headers: request.headers,
      query: { organizationId: id },
    });
    if (!result) return null;
    return mapOrganization(result);
  }

  async updateOrganization(request: { headers: Headers }, id: string, params: OrganizationUpdateParams): Promise<Organization> {
    const result = await this.api.updateOrganization({
      headers: request.headers,
      body: {
        data: { name: params.name, slug: params.slug, logo: params.logo, metadata: params.metadata },
        organizationId: id,
      },
    });
    return mapOrganization(result);
  }

  async deleteOrganization(request: { headers: Headers }, id: string): Promise<void> {
    await this.api.deleteOrganization({
      headers: request.headers,
      body: { organizationId: id },
    });
  }

  async listOrganizationMembers(request: { headers: Headers }, organizationId: string): Promise<OrganizationMember[]> {
    const result = await this.api.listMembers({
      headers: request.headers,
      query: { organizationId },
    });
    return (result.members || []).map(mapOrganizationMember);
  }

  async addOrganizationMember(request: { headers: Headers }, organizationId: string, userId: string, role?: string): Promise<OrganizationMember> {
    const result = await this.api.addMember({
      headers: request.headers,
      body: { organizationId, userId, role: role || "member" },
    });
    return mapOrganizationMember(result);
  }

  async updateOrganizationMember(request: { headers: Headers }, organizationId: string, memberId: string, role: string): Promise<OrganizationMember> {
    const result = await this.api.updateMemberRole({
      headers: request.headers,
      body: { organizationId, memberId, role },
    });
    return mapOrganizationMember(result);
  }

  async removeOrganizationMember(request: { headers: Headers }, organizationId: string, memberId: string): Promise<void> {
    await this.api.removeMember({
      headers: request.headers,
      body: { organizationId, memberIdOrUserId: memberId },
    });
  }

  async createOrganizationInvitation(request: { headers: Headers }, organizationId: string, params: OrganizationInviteParams): Promise<OrganizationInvitation> {
    const result = await this.api.createInvitation({
      headers: request.headers,
      body: { organizationId, email: params.email, role: params.role },
    });
    return mapInvitation(result);
  }

  async listOrganizationInvitations(request: { headers: Headers }, organizationId: string): Promise<OrganizationInvitation[]> {
    const result = await this.api.listInvitations({
      headers: request.headers,
      query: { organizationId },
    });
    return (result.invitations || []).map(mapInvitation);
  }

  async acceptInvitation(request: { headers: Headers }, invitationId: string): Promise<void> {
    await this.api.acceptInvitation({
      headers: request.headers,
      body: { invitationId },
    });
  }

  async rejectInvitation(request: { headers: Headers }, invitationId: string): Promise<void> {
    await this.api.rejectInvitation({
      headers: request.headers,
      body: { invitationId },
    });
  }

  async cancelInvitation(request: { headers: Headers }, invitationId: string): Promise<void> {
    await this.api.cancelInvitation({
      headers: request.headers,
      body: { invitationId },
    });
  }

  // ─── Organization Extras ─────────────────────────────────────────

  async getOrganizationFull(request: { headers: Headers }, id: string): Promise<OrganizationFull | null> {
    const result = await this.api.getFullOrganization?.({
      headers: request.headers,
      query: { organizationId: id },
    });
    if (!result) return null;
    return {
      ...mapOrganization(result),
      members: (result.members || []).map(mapOrganizationMember),
      invitations: (result.invitations || []).map(mapInvitation),
    };
  }

  async setActiveOrganization(request: { headers: Headers }, organizationId: string): Promise<void> {
    await this.api.setActiveOrganization({
      headers: request.headers,
      body: { organizationId },
    });
  }

  async getOrganizationInvitation(request: { headers: Headers }, invitationId: string): Promise<OrganizationInvitation | null> {
    const result = await this.api.getInvitation({
      headers: request.headers,
      query: { invitationId },
    });
    if (!result) return null;
    return mapInvitation(result);
  }

  // ─── Organization Roles ──────────────────────────────────────────

  async createOrganizationRole(request: { headers: Headers }, params: OrganizationRoleCreateParams): Promise<OrganizationRole> {
    const result = await this.api.createOrgRole?.({
      headers: request.headers,
      body: {
        organizationId: params.organizationId,
        role: params.role,
        permission: params.permission,
      },
    });
    return mapOrganizationRole(result);
  }

  async listOrganizationRoles(request: { headers: Headers }, organizationId?: string): Promise<OrganizationRole[]> {
    const result = await this.api.listOrgRoles?.({
      headers: request.headers,
      query: { organizationId },
    });
    return (result.roles || result || []).map(mapOrganizationRole);
  }

  async getOrganizationRole(request: { headers: Headers }, organizationId: string, roleName: string): Promise<OrganizationRole | null> {
    const result = await this.api.getOrgRole?.({
      headers: request.headers,
      query: { organizationId, roleName },
    });
    if (!result) return null;
    return mapOrganizationRole(result);
  }

  async updateOrganizationRole(request: { headers: Headers }, organizationId: string, roleName: string, params: OrganizationRoleUpdateParams): Promise<OrganizationRole> {
    const result = await this.api.updateOrgRole?.({
      headers: request.headers,
      body: {
        organizationId,
        roleName,
        data: {
          permission: params.permission,
          roleName: params.roleName,
        },
      },
    });
    return mapOrganizationRole(result);
  }

  async deleteOrganizationRole(request: { headers: Headers }, organizationId: string, roleName: string): Promise<void> {
    await this.api.deleteOrgRole?.({
      headers: request.headers,
      body: { organizationId, roleName },
    });
  }

  // ─── Authorization ───────────────────────────────────────────────

  async checkPermission(params: {
    user: GatehouseUser;
    permission: string | string[];
    organizationId?: string;
  }): Promise<boolean> {
    try {
      if (params.organizationId && this.api.hasPermission) {
        const result = await this.api.hasPermission({
          body: {
            userId: params.user.id,
            organizationId: params.organizationId,
            permission: Array.isArray(params.permission) ? params.permission : [params.permission],
          },
        });
        return result.hasPermission === true;
      }
      return true;
    } catch {
      return true;
    }
  }

  async assignRole(userId: string, role: string): Promise<void> {
    await (this.db as any)
      .updateTable("user")
      .set({ role })
      .where("id", "=", userId)
      .execute();
  }

  async removeRole(userId: string): Promise<void> {
    await (this.db as any)
      .updateTable("user")
      .set({ role: null })
      .where("id", "=", userId)
      .execute();
  }

  // -- OTP passthrough (used by module-level OTP methods) -----------

  async sendOTP(params: { email: string; type?: string }): Promise<void> {
    await this.api.sendVerificationOTP({
      email: params.email,
      type: params.type || "sign-in",
    });
  }

  async verifyOTP(params: { email: string; code: string; type?: string }): Promise<Session> {
    const result = await this.api.verifyVerificationOTP({
      email: params.email,
      code: params.code,
      type: params.type || "sign-in",
    });
    return {
      user: mapUser(result.user),
      session: mapSession(result.session),
    };
  }

  async sendPhoneOTPModule(params: PhoneOtpSendParams): Promise<void> {
    await this.api.sendPhoneNumberOTP({
      phoneNumber: params.phoneNumber,
    });
  }

  async verifyPhoneOTPModule(params: PhoneOtpConfirmParams): Promise<Session> {
    const result = await this.api.verifyPhoneNumberOTP({
      phoneNumber: params.phoneNumber,
      code: params.code,
    });
    return {
      user: mapUser(result.user),
      session: mapSession(result.session),
    };
  }
}

function mapUser(user: Record<string, unknown>): GatehouseUser {
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    emailVerified: user.emailVerified as boolean,
    image: (user.image as string) ?? null,
    createdAt: user.createdAt as Date,
    updatedAt: user.updatedAt as Date,
    twoFactorEnabled: user.twoFactorEnabled as boolean | undefined,
    banned: user.banned as boolean | undefined,
    banReason: user.banReason as string | null | undefined,
    role: user.role as string | undefined,
  };
}

function mapSession(session: Record<string, unknown>): GatehouseSession {
  return {
    id: session.id as string,
    userId: session.userId as string,
    expiresAt: session.expiresAt as Date,
    token: session.token as string,
    ipAddress: session.ipAddress as string | null | undefined,
    userAgent: session.userAgent as string | null | undefined,
  };
}

function mapOrganization(org: Record<string, unknown>): Organization {
  return {
    id: org.id as string,
    name: org.name as string,
    slug: org.slug as string,
    logo: org.logo as string | null | undefined,
    createdAt: org.createdAt as Date,
    updatedAt: org.updatedAt as Date,
    metadata: org.metadata as Record<string, unknown> | undefined,
  };
}

function mapOrganizationMember(member: Record<string, unknown>): OrganizationMember {
  return {
    id: member.id as string,
    organizationId: member.organizationId as string,
    userId: member.userId as string,
    role: member.role as string,
    createdAt: member.createdAt as Date,
    user: member.user ? mapUser(member.user as Record<string, unknown>) : undefined,
  };
}

function mapInvitation(inv: Record<string, unknown>): OrganizationInvitation {
  return {
    id: inv.id as string,
    organizationId: inv.organizationId as string,
    email: inv.email as string,
    role: inv.role as string,
    status: inv.status as string,
    inviterId: inv.inviterId as string,
    expiresAt: inv.expiresAt as Date,
    createdAt: inv.createdAt as Date,
  };
}

function mapOrganizationRole(role: Record<string, unknown>): OrganizationRole {
  return {
    id: role.id as string,
    name: role.name as string,
    organizationId: role.organizationId as string,
    permission: role.permission as Record<string, string[]>,
    createdAt: role.createdAt as Date,
    updatedAt: role.updatedAt as Date,
  };
}

function mapApiKey(k: Record<string, unknown>): ApiKeyInfo {
  return {
    id: k.id as string,
    name: k.name as string,
    key: k.key as string,
    prefix: k.prefix as string,
    expiresAt: k.expiresAt ? new Date(k.expiresAt as string) : undefined,
    createdAt: k.createdAt as Date,
    updatedAt: k.updatedAt as Date,
    permissions: k.permissions as Record<string, string[]> | undefined,
    configId: k.configId as string | undefined,
    metadata: k.metadata as Record<string, unknown> | undefined,
    organizationId: k.organizationId as string | null | undefined,
  };
}

function matchPath(pathname: string, pattern: string): boolean {
  let regex = ""
  let i = 0
  while (i < pattern.length) {
    const c = pattern[i]
    if (c === ":") {
      i++
      while (i < pattern.length && /[a-zA-Z0-9_]/.test(pattern[i])) i++
      if (pattern[i] === "*") { regex += "[^/]+"; i++ }
      else { regex += "[^/]+" }
    } else if (c === "*") {
      if (pattern[i + 1] === "*") { regex += ".*"; i += 2 }
      else { regex += "[^/]+"; i++ }
    } else {
      regex += c === "/" ? "\\/" : c
      i++
    }
  }
  return new RegExp("^" + regex + "$").test(pathname)
}
