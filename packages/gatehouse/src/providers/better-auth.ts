import { createRequire } from "node:module";
import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { Kysely } from "kysely";

const _require = createRequire(import.meta.url);
import { magicLink, emailOTP, twoFactor, organization } from "better-auth/plugins";
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
  OrganizationMember,
  OrganizationInvitation,
  AccessToken,
  ProxyOptions,
  ProxyResult,
} from "../types.js";
import { AuthenticationError } from "../types.js";

interface SocialProviderConfig {
  clientId?: string
  clientSecret?: string
}

export class BetterAuthAdapter {
  private auth: any;
  private api: any;
  private db: Kysely<unknown>;

  constructor(config: GatehouseConfig, db: Kysely<unknown>) {
    this.db = db;

    const baseURL = config.baseURL || process.env.BETTER_AUTH_URL;

    const creds =
      config.credentials === true
        ? { enabled: true }
        : config.credentials
          ? { enabled: true, ...config.credentials }
          : undefined;

    const providers: Record<string, SocialProviderConfig> = {};
    if (config.social) {
      for (const [name, cfg] of Object.entries(config.social)) {
        const key = name.toUpperCase();
        providers[name] = {
          clientId: cfg.clientId || process.env[`AUTH_${key}_CLIENT_ID`] || "",
          clientSecret: cfg.clientSecret || process.env[`AUTH_${key}_CLIENT_SECRET`] || "",
        };
      }
    }

    const allPlugins = [...(config.plugins || [])];

    if (config.magicLinks) {
      allPlugins.push(
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            throw new Error(
              `sendMagicLink not implemented — configure it via the "plugins" option: magicLink({ sendMagicLink: ... })`,
            );
          },
        }),
      );
    }
    if (config.emailOtp) {
      allPlugins.push(
        emailOTP({
          sendVerificationOTP: async ({ email, otp, type }) => {
            throw new Error(
              `sendVerificationOTP not implemented — configure it via the "plugins" option: emailOTP({ sendVerificationOTP: ... })`,
            );
          },
        }),
      );
    }
    if (config.passThrough?.twoFactor === true || config.passThrough?.twoFactor !== false) {
      allPlugins.push(twoFactor());
    }
    if (config.passThrough?.organization !== false) {
      allPlugins.push(organization());
    }

    const baOptions: Record<string, unknown> = {
      database: { db, type: "postgres" },
      secret: config.passThrough?.secret || process.env.BETTER_AUTH_SECRET,
      baseURL,
      basePath: config.passThrough?.basePath,
      appName: config.appName,
      emailAndPassword: creds,
      socialProviders: Object.keys(providers).length > 0 ? providers : undefined,
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
  // Create an authenticated context — pass `request` once, get all
  // auth-aware operations without ever passing `request` again.

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
        enable: (password) => this.enableTwoFactor({ headers }, password),
        disable: (password) => this.disableTwoFactor({ headers }, password),
        verify: (code, trustDevice) => this.verifyTwoFactorTotp({ headers }, code, trustDevice),
        uri: (password) => this.getTotpUri({ headers }, password),
      },

      backupCodes: {
        generate: (password) => this.generateBackupCodes({ headers }, password),
        verify: (code) => this.verifyTwoFactorBackupCode({ headers }, code),
      },

      organizations: {
        create: (params) => this.createOrganization({ headers }, params),
        list: () => this.listOrganizations({ headers }),
        get: (id) => this.getOrganization({ headers }, id),
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
          accept: (invId) => this.acceptInvitation({ headers }, invId),
          reject: (invId) => this.rejectInvitation({ headers }, invId),
          cancel: (invId) => this.cancelInvitation({ headers }, invId),
        },
      },

      can: (params) => this.checkPermission(params),
    };
  }

  // ─── Proxy ────────────────────────────────────────────────────────
  // Request-level auth guard for use in middleware/proxy.ts.
  // Returns a redirect Response for unauthenticated requests to
  // protected routes, or `undefined` to continue.

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
        const ctx = await this.from(request)
        if (ctx.user) {
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

  // ─── Auth ────────────────────────────────────────────────────────

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
      throw new Error("OTP sent — verify with gatehouse.email.otp.confirm()");
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

  // ─── Verification ────────────────────────────────────────────────

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

  // ─── Two-Factor ──────────────────────────────────────────────────

  async enableTwoFactor(request: { headers: Headers }, password: string): Promise<TwoFactorInfo> {
    const result = await this.api.enableTwoFactor({
      headers: request.headers,
      body: { password },
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

  // ─── Authorization ───────────────────────────────────────────────

  async checkPermission(_params: {
    user: GatehouseUser;
    action: string;
    resource: unknown;
  }): Promise<boolean> {
    return true;
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

  // ─── Email OTP (used by auth.signIn with email-otp method) ─────

  async sendOTP(params: { email: string; type?: string }): Promise<void> {
    await this.api.sendVerificationOTP({
      email: params.email,
      type: params.type || "sign-in",
    });
  }

  async verifyOTP(params: EmailOtpConfirmParams): Promise<Session> {
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
