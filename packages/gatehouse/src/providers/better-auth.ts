import { createRequire } from "node:module";
import { betterAuth } from "better-auth";
import { toNextJsHandler } from "better-auth/next-js";
import type { Kysely } from "kysely";

const _require = createRequire(import.meta.url);
import { magicLink, emailOTP, twoFactor, organization, admin, phoneNumber } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { apiKey } from "@better-auth/api-key";
import type {
  GatehouseConfig,
  GatehouseInstance,
  GatehouseSession,
  GatehouseUser,
  Session,
  ProxyOptions,
  ProxyResult,
} from "../types.js";
import { AuthenticationError } from "../types.js";
import { buildProxiedApi, buildFacade } from "../facade-builder.js";

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

    const social = expandSocial(config.social)

    const baOptions: Record<string, unknown> = {
      database: { db, type: "postgres" },
      secret: config.passThrough?.secret || process.env.BETTER_AUTH_SECRET,
      baseURL,
      basePath: config.passThrough?.basePath,
      appName: config.appName,
      emailAndPassword: creds,
      emailVerification: config.emailVerification,
      socialProviders: social,
      user: config.user,
      session: config.session,
      account: config.account,
      trustedOrigins: config.trustedOrigins,
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

  async from(request: Request | { headers: Headers }): Promise<GatehouseInstance> {
    const headers = request instanceof Request ? request.headers : request.headers;
    const session = await this.getSession({ headers });
    const api = buildProxiedApi(this.api, headers);
    const built = buildFacade(api);

    return {
      session: async () => session,
      user: async () => session?.user ?? null,
      headers,
      provider: this.auth,
      requireUser: () => this.requireAuth({ headers }),

      // Tier 2 — goes through better-auth API (not direct DB)
      users: {
        get: (id) => this.findUser(id, headers),
        findByEmail: (email) => this.findUserByEmail(email, headers),
      },

      roles: {
        assign: (userId, role) => this.setRole(userId, role, headers),
        remove: (userId) => this.removeRole(userId, headers),
      },

      can: (params) => this.checkPermission(params),

      // Tier 3 — built from mapping
      ...built,
    } as GatehouseInstance;
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
        if (await auth.user()) {
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

  // ─── Users ────────────────────────────────────────────────────────

  async findUser(id: string, headers: Headers): Promise<GatehouseUser | null> {
    try {
      const result = await this.api.getUser({ headers, body: { userId: id } }) as Record<string, unknown> | null;
      if (!result) return null;
      return mapUser(result);
    } catch {
      return null;
    }
  }

  async findUserByEmail(email: string, headers: Headers): Promise<GatehouseUser | null> {
    const user = await (this.db as any)
      .selectFrom("user")
      .where("email", "=", email)
      .selectAll()
      .executeTakeFirst();
    if (!user) return null;
    return mapUser(user);
  }

  // ─── Role management (via better-auth admin API) ─────────────────

  async setRole(userId: string, role: string, headers: Headers): Promise<void> {
    await this.api.setRole({ headers, body: { userId, role } });
  }

  async removeRole(userId: string, headers: Headers): Promise<void> {
    // better-auth treats empty/null role as removal
    await this.api.setRole({ headers, body: { userId, role: "" } });
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
      return false;
    }
  }

}

function env(key: string): string | undefined {
  return process.env[key] || process.env[`AUTH_${key}`] || process.env[`BETTER_AUTH_${key}`]
}

function expandSocial(
  config: string[] | Record<string, Record<string, unknown> | true> | undefined,
): Record<string, Record<string, unknown>> | undefined {
  if (!config) return config
  const entries: [string, Record<string, unknown>][] = Array.isArray(config)
    ? config.map((p) => [p, {}])
    : Object.entries(config).map(([p, v]) => [p, v === true ? {} : v])
  const expanded: Record<string, Record<string, unknown>> = {}
  for (const [provider, opts] of entries) {
    const key = provider.toUpperCase().replace(/-/g, "_")
    const clientId = opts.clientId ?? env(`${key}_CLIENT_ID`)
    const clientSecret = opts.clientSecret ?? env(`${key}_CLIENT_SECRET`)
    if (!clientId || !clientSecret) {
      throw new Error(
        `Missing credentials for "${provider}" social provider. ` +
        `Set ${key}_CLIENT_ID and ${key}_CLIENT_SECRET in your environment, ` +
        `or pass clientId/clientSecret explicitly in tower.config.ts.`,
      )
    }
    expanded[provider] = { ...opts, clientId, clientSecret }
  }
  return expanded
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
