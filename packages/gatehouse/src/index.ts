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
  EmailOtpSendParams,
  EmailOtpConfirmParams,
  PhoneOtpSendParams,
  PhoneOtpConfirmParams,
  TwoFactorOtpSendParams,
  TwoFactorOtpVerifyParams,
  ProxyOptions,
  ProxyResult,
} from "./types.js";
import { AuthenticationError, AuthorizationError } from "./types.js";
import { BetterAuthAdapter } from "./providers/better-auth.js";
import { ContextRequiredError } from "./context.js";

export type {
  GatehouseConfig,
  GatehouseModule,
  GatehouseInstance,
  GatehouseUser,
  Session,
  UpdateUserData,
  EmailOtpSendParams,
} from "./types.js"

// ─── Better Auth plugin option types ──────────────────────────────
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

export function getAuth(): { getSession(request: { headers: Headers }): Promise<Session | null> } {
  if (!_adapter) throw new Error("Gatehouse not initialized");
  return _adapter;
}

export function getRoutes(): { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> } {
  if (!_adapter) throw new Error("Gatehouse not initialized");
  return _adapter.routes;
}

// ─── Escape hatch ─────────────────────────────────────────────────

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

// ─── Request-scoped facade ────────────────────────────────────────

export async function runWithRequest<T>(
  request: Request | { headers: Headers },
  handler: () => Promise<T>,
): Promise<T> {
  if (!_adapter) throw new Error("Gatehouse not initialized");
  const instance = await _adapter.from(request);
  return towerContext.run({ gatehouse: instance }, handler);
}

type GatehouseAPI = GatehouseModule & GatehouseInstance;

export const gatehouse: GatehouseAPI = new Proxy({} as GatehouseAPI, {
  get(_, prop) {
    // 1. ALS context (per-request instance)
    const instance = towerContext.get<GatehouseInstance>("gatehouse");
    if (instance && (prop in instance)) {
      const value = (instance as any)[prop];
      if (typeof value === "function") {
        return (...args: any[]) => (value as Function)(...args);
      }
      return value;
    }

    // 2. Module-level fallback (works outside ALS context)
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

// ─── Tower module registration ────────────────────────────────────

export function defineGatehouse(config: GatehouseConfig): TowerModule & GatehouseModule {
  return {
    name: "gatehouse",

    async init(ctx: TowerInitContext) {
      if (_adapter) {
        console.warn("[gatehouse] Re-initializing — previous adapter state discarded");
      }
      const vault = ctx.container.get<{ db: Kysely<unknown> }>("vault");
      _adapter = new BetterAuthAdapter(config, vault.db);
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

