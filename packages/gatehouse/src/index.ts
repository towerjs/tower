import type { TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { registerModule, towerContext } from "@towerjs/blueprint";
import type { Kysely } from "kysely";
import type {
  GatehouseConfig,
  GatehouseModule,
  GatehouseInstance,
  GatehouseUser,
  Session,
  UpdateUserData,
  EmailOtpSendParams,
  EmailOtpConfirmParams,
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
  TwoFactorInfo,
  TwoFactorVerifyResult,
  Organization,
  OrganizationFull,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationCreateParams,
  OrganizationUpdateParams,
  OrganizationInviteParams,
  OrganizationRoleCreateParams,
  OrganizationRoleUpdateParams,
  Identity,
  AccessToken,
  TwoFactorOtpSendParams,
  TwoFactorOtpVerifyParams,
  ProxyOptions,
  ProxyResult,
} from "./types.js";
import { AuthenticationError, AuthorizationError } from "./types.js";
import { BetterAuthAdapter } from "./providers/better-auth.js";
import { ContextRequiredError } from "./context.js";
import type { CourierModule } from "@towerjs/courier"

export type {
  GatehouseConfig,
  GatehouseModule,
  GatehouseInstance,
  GatehouseUser,
  Session,
  UpdateUserData,
  EmailOtpSendParams,
} from "./types.js"

export type {
  MagicLinkOptions,
  EmailOTPOptions,
  PhoneNumberOptions,
  TwoFactorOptions,
  OrganizationOptions,
  AdminOptions,
} from "better-auth/plugins"
export type { SocialProviders } from "better-auth/types"
export type { PasskeyOptions } from "@better-auth/passkey"
export type { ApiKeyOptions } from "@better-auth/api-key"

export type {
  EmailOtpConfirmParams,
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
  TwoFactorInfo,
  TwoFactorVerifyResult,
  Organization,
  OrganizationFull,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationCreateParams,
  OrganizationUpdateParams,
  OrganizationInviteParams,
  OrganizationRoleCreateParams,
  OrganizationRoleUpdateParams,
  Identity,
  AccessToken,
  TwoFactorOtpSendParams,
  TwoFactorOtpVerifyParams,
  ProxyOptions,
  ProxyResult,
};
export { AuthenticationError, AuthorizationError, ContextRequiredError };

let _adapter: BetterAuthAdapter | undefined;

/** Returns the adapter's getSession method. Useful for server-side session checks. */
export function getAuth(): { getSession(request: { headers: Headers }): Promise<Session | null> } {
  if (!_adapter) throw new Error("Gatehouse not initialized");
  return _adapter;
}

/** Returns the adapter's route handlers for the auth API. */
export function getRoutes(): { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> } {
  if (!_adapter) throw new Error("Gatehouse not initialized");
  return _adapter.routes;
}

/**
 * Raw access to the gatehouse adapter.
 *
 * Use `Gatehouse.from()` to create a per-request instance outside of
 * an ALS context (e.g. in route handlers).
 */
export const Gatehouse = {
  from(request: Request | { headers: Headers }): Promise<GatehouseInstance> {
    if (!_adapter) throw new Error("Gatehouse not initialized");
    return _adapter.from(request);
  },
  migrate(): Promise<void> {
    if (!_adapter) throw new Error("Gatehouse not initialized");
    return _adapter.migrate();
  },
};

/** Runs a handler within a request-scoped gatehouse context. */
export async function runWithRequest<T>(
  request: Request | { headers: Headers },
  handler: () => Promise<T>,
): Promise<T> {
  if (!_adapter) throw new Error("Gatehouse not initialized");
  const instance = await _adapter.from(request);
  return towerContext.run({ gatehouse: instance }, handler);
}

type GatehouseAPI = GatehouseModule & GatehouseInstance;

/**
 * Proxy singleton for accessing gatehouse.
 *
 * Inside an ALS context (action, withGatehouse, runWithRequest) it delegates to
 * the per-request instance. Outside ALS, only module-level methods like
 * `from()`, `migrate()`, `proxy()`, and `routes` are available.
 */
export const gatehouse: GatehouseAPI = new Proxy({} as GatehouseAPI, {
  get(_, prop) {
    const instance = towerContext.get<GatehouseInstance>("gatehouse");
    if (instance && (prop in instance)) {
      const value = (instance as any)[prop];
      if (typeof value === "function") {
        return (...args: any[]) => (value as Function)(...args);
      }
      return value;
    }

    if (_adapter) {
      if (prop === "from") return (request: any) => _adapter!.from(request);
      if (prop === "migrate") return () => _adapter!.migrate();
      if (prop === "proxy") return (options?: any) => _adapter!.createProxy(options);
      if (prop === "provider") return _adapter!.provider;
      if (prop === "routes") return _adapter!.routes;
    }

    if (prop === Symbol.toPrimitive) return undefined;
    throw new ContextRequiredError(
      `gatehouse.${String(prop)} requires an active request context. `
      + `Use inside an action() or withGatehouse() wrapper, `
      + `or use gatehouse.from() directly in route handlers.`
    );
  },
}) as GatehouseAPI;

/**
 * Creates a Tower module that registers the gatehouse auth service.
 *
 * @example
 * ```ts
 * defineTower({
 *   modules: {
 *     vault: { connectionString: process.env.DATABASE_URL },
 *     gatehouse: {
 *       provider: "better-auth",
 *       credentials: true,
 *       social: ["google", "github"],
 *     },
 *   },
 * })
 * ```
 */
export function defineGatehouse(config: GatehouseConfig): TowerModule & GatehouseModule {
  return {
    name: "gatehouse",

    async init(ctx: TowerInitContext) {
      if (_adapter) {
        console.warn("[gatehouse] Re-initializing — previous adapter state discarded");
      }
      const vault = ctx.container.get<{ db: Kysely<unknown> }>("vault");
      const courier = ctx.container.has("courier")
        ? ctx.container.get<CourierModule>("courier")
        : undefined;
      _adapter = new BetterAuthAdapter(withCourierTransport(config, courier), vault.db);
    },

    get provider() {
      return _adapter!.provider;
    },

    get routes() {
      return _adapter!.routes;
    },

    async from(request: Request | { headers: Headers }) {
      return _adapter!.from(request);
    },

    proxy(options?: ProxyOptions) {
      return _adapter!.createProxy(options);
    },

    async migrate() {
      return _adapter!.migrate();
    },
  } satisfies TowerModule & GatehouseModule;
}

registerModule("gatehouse", (config) => defineGatehouse(config as unknown as GatehouseConfig));

function withCourierTransport(config: GatehouseConfig, courier?: CourierModule): GatehouseConfig {
  if (!courier) return config

  const appName = config.appName ?? "Tower"
  const next: any = { ...config }

  if (config.credentials) {
    const credentials = config.credentials === true
      ? { enabled: true }
      : { ...config.credentials }

    if (!credentials.sendResetPassword) {
      credentials.sendResetPassword = async ({ user, url }: { user: { email: string; name: string }; url: string }) => {
        await courier.email.send(buildAuthEmail({
          to: user.email,
          subject: `${appName} password reset`,
          heading: "Reset your password",
          intro: `A password reset was requested for your ${appName} account.`,
          actionLabel: "Reset password",
          actionUrl: url,
        }))
      }
    }

    next.credentials = credentials
  }

  if (config.emailVerification) {
    const emailVerification = { ...config.emailVerification }
    if (!emailVerification.sendVerificationEmail) {
      emailVerification.sendVerificationEmail = async ({ user, url }) => {
        await courier.email.send(buildAuthEmail({
          to: user.email,
          subject: `${appName} email confirmation`,
          heading: "Confirm your email",
          intro: `Confirm your email to finish setting up your ${appName} account.`,
          actionLabel: "Confirm email",
          actionUrl: url,
        }))
      }
    }
    next.emailVerification = emailVerification
  }

  if (config.magicLinks) {
    const magicLinks = config.magicLinks === true
      ? {}
      : { ...config.magicLinks }
    if (!(magicLinks as any).sendMagicLink) {
      ;(magicLinks as any).sendMagicLink = async ({ email, url }: { email: string; url: string }) => {
        await courier.email.send(buildAuthEmail({
          to: email,
          subject: `${appName} sign-in link`,
          heading: "Your sign-in link",
          intro: `Use this secure link to sign in to ${appName}.`,
          actionLabel: "Sign in",
          actionUrl: url,
        }))
      }
    }
    next.magicLinks = magicLinks
  }

  if (config.emailOtp) {
    const emailOtp = config.emailOtp === true
      ? {}
      : { ...config.emailOtp }
    if (!(emailOtp as any).sendVerificationOTP) {
      ;(emailOtp as any).sendVerificationOTP = async ({
        email,
        otp,
        type,
      }: {
        email: string
        otp: string
        type: string
      }) => {
        const subject = type === "forget-password"
          ? `${appName} password reset code`
          : `${appName} verification code`
        await courier.email.send({
          to: email,
          subject,
          text: `${appName} verification code: ${otp}`,
          html: `<p>${appName} verification code: <strong>${otp}</strong></p>`,
        })
      }
    }
    next.emailOtp = emailOtp
  }

  if (config.phoneNumber) {
    const phoneNumber = config.phoneNumber === true
      ? {}
      : { ...config.phoneNumber }
    if (!(phoneNumber as any).sendOTP) {
      ;(phoneNumber as any).sendOTP = async ({ phoneNumber, code }: { phoneNumber: string; code: string }) => {
        await courier.sms.send({
          to: phoneNumber,
          body: `${appName} verification code: ${code}`,
        })
      }
    }
    next.phoneNumber = phoneNumber
  }

  return next
}

function buildAuthEmail(params: {
  to: string
  subject: string
  heading: string
  intro: string
  actionLabel: string
  actionUrl: string
}): {
  to: string
  subject: string
  text: string
  html: string
} {
  const text = `${params.heading}\n\n${params.intro}\n\n${params.actionLabel}: ${params.actionUrl}`
  const html = [
    `<div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">`,
    `<h2 style="margin: 0 0 16px; font-size: 24px;">${escapeHtml(params.heading)}</h2>`,
    `<p style="margin: 0 0 20px; line-height: 1.5;">${escapeHtml(params.intro)}</p>`,
    `<p style="margin: 0 0 24px;">`,
    `<a href="${escapeHtml(params.actionUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">`,
    `${escapeHtml(params.actionLabel)}`,
    `</a>`,
    `</p>`,
    `<p style="margin: 0; font-size: 12px; color: #6b7280;">`,
    `If the button does not work, use this URL: <br />`,
    `<a href="${escapeHtml(params.actionUrl)}">${escapeHtml(params.actionUrl)}</a>`,
    `</p>`,
    `</div>`,
  ].join("")

  return {
    to: params.to,
    subject: params.subject,
    text,
    html,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
}
