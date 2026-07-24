import type { TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { registerModule } from "@towerjs/blueprint";
import type {
  GatehouseConfig,
  GatehouseModule,
  GatehouseUser,
  Session,
  UpdateUserData,
  AuthMethod,
  SignUpParams,
  PasswordForgotParams,
  PasswordResetConfirmParams,
  PasswordChangeParams,
  PasswordConfirmParams,
  EmailVerifySendParams,
  EmailVerifyConfirmParams,
  EmailOtpSendParams,
  EmailOtpConfirmParams,
  TwoFactorEnableParams,
  TwoFactorVerifyTotpParams,
  TwoFactorVerifyBackupCodeParams,
  OrganizationCreateParams,
  OrganizationUpdateParams,
  OrganizationInviteParams,
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  AccessToken,
  TwoFactorInfo,
  TwoFactorVerifyResult,
  GatehouseContext,
  ProxyOptions,
  ProxyResult,
} from "./types.js";
import { AuthenticationError, AuthorizationError } from "./types.js";
import { BetterAuthAdapter } from "./providers/better-auth.js";

export type {
  GatehouseConfig,
  GatehouseModule,
  GatehouseContext,
  GatehouseUser,
  Session,
  UpdateUserData,
  AuthMethod,
  SignUpParams,
  PasswordForgotParams,
  PasswordResetConfirmParams,
  PasswordChangeParams,
  PasswordConfirmParams,
  EmailVerifySendParams,
  EmailVerifyConfirmParams,
  EmailOtpSendParams,
  EmailOtpConfirmParams,
  TwoFactorEnableParams,
  TwoFactorVerifyTotpParams,
  TwoFactorVerifyBackupCodeParams,
  OrganizationCreateParams,
  OrganizationUpdateParams,
  OrganizationInviteParams,
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  AccessToken,
  TwoFactorInfo,
  TwoFactorVerifyResult,
  ProxyOptions,
  ProxyResult,
};
export { AuthenticationError, AuthorizationError };

export function gatehouse(config: GatehouseConfig): TowerModule & GatehouseModule {
  let adapter: BetterAuthAdapter;

  return {
    name: "gatehouse",

    async init(ctx: TowerInitContext) {
      const vault = ctx.container.get<{ db: unknown }>("vault");
      adapter = new BetterAuthAdapter(config, vault.db as any);
    },

    get provider() {
      return adapter!.provider;
    },

    get routes() {
      return adapter!.routes;
    },

    async from(request: Request | { headers: Headers }) {
      return adapter!.from(request);
    },

    proxy(options?: ProxyOptions) {
      return adapter!.createProxy(options);
    },

    async signIn(params: AuthMethod) {
      return adapter!.signIn(params);
    },

    async signUp(params: SignUpParams) {
      return adapter!.signUp(params);
    },

    password: {
      async forgot(params: PasswordForgotParams) {
        return adapter!.requestPasswordReset(params);
      },
      async reset(params: PasswordResetConfirmParams) {
        return adapter!.resetPasswordWithToken(params);
      },
    },

    email: {
      verify: {
        async send(params: EmailVerifySendParams) {
          return adapter!.sendVerification(params);
        },
        async confirm(params: EmailVerifyConfirmParams) {
          return adapter!.verifyEmail({ headers: new Headers() }, params);
        },
      },
      otp: {
        async send(params: EmailOtpSendParams) {
          return adapter!.sendOTP(params);
        },
        async confirm(params: EmailOtpConfirmParams) {
          return adapter!.verifyOTP(params);
        },
      },
    },

    users: {
      async get(id: string) {
        return adapter!.findUser(id);
      },
      async findByEmail(email: string) {
        return adapter!.findUserByEmail(email);
      },
    },

    async can(params: { user: GatehouseUser; action: string; resource: unknown }) {
      return adapter!.checkPermission(params);
    },

    roles: {
      async assign(userId: string, role: string) {
        return adapter!.assignRole(userId, role);
      },
      async remove(userId: string) {
        return adapter!.removeRole(userId);
      },
    },

    async migrate() {
      return adapter!.migrate();
    },
  } satisfies TowerModule & GatehouseModule;
}

registerModule("gatehouse", (config) => gatehouse(config as unknown as GatehouseConfig));

declare module "@towerjs/foundation" {
  interface TowerModules {
    gatehouse: GatehouseModule
  }
}
