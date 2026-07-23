export type TowerFramework = "next";
export type DatabaseProvider = "postgres";
export type AuthProvider = "better-auth";
export type RealtimeProvider = "ably";
export type StorageProvider = "s3";

export type TowerApplicationConfig = {
  framework: TowerFramework;
  database: {
    provider: DatabaseProvider;
  };
  auth: {
    provider: AuthProvider;
  };
  realtime?: {
    provider: RealtimeProvider;
  };
  storage?: {
    provider: StorageProvider;
  };
};

/**
 * Defines the capabilities required by a Tower application.
 *
 * This function intentionally performs no validation. It preserves the typed
 * configuration so Foundation can construct an application kernel from it.
 */
export function defineApplication<const Config extends TowerApplicationConfig>(
  config: Config,
): Config {
  return config;
}
