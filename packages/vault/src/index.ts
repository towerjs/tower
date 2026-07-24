import type { TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { registerModule } from "@towerjs/blueprint";
import { Kysely, PostgresDialect } from "kysely";
import type { Migrator } from "kysely/migration";
import type { VaultConfig, VaultDb, VaultModule } from "./types.js";
import { createMigrator, migrateToLatest } from "./migrate.js";

export type { VaultConfig, VaultDb, VaultModule } from "./types.js";
export { createMigrator, migrateToLatest } from "./migrate.js";

function resolveConnectionString(config?: VaultConfig): string {
  return config?.connectionString ?? process.env.DATABASE_URL ?? "";
}

function resolveProvider(config?: VaultConfig): "neon" | "pg" {
  const url = resolveConnectionString(config);
  if (config?.provider) return config.provider;
  if (url.includes(".neon.tech")) return "neon";
  return "pg";
}

async function createPool(
  connectionString: string,
  provider: "neon" | "pg",
  poolConfig?: VaultConfig["pool"],
): Promise<any> {
  const config: Record<string, unknown> = {
    connectionString,
  };
  if (poolConfig?.max) config.max = poolConfig.max;
  if (poolConfig?.idleTimeoutMillis) config.idleTimeoutMillis = poolConfig.idleTimeoutMillis;
  if (poolConfig?.connectionTimeoutMillis) config.connectionTimeoutMillis = poolConfig.connectionTimeoutMillis;

  if (provider === "neon") {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    neonConfig.fetchConnectionCache = true;
    return new Pool(config);
  }

  const { Pool: PgPool } = await import("pg");
  return new PgPool(config);
}

export function vault(options?: VaultConfig): TowerModule {
  let db: VaultDb;
  let migrator: Migrator;

  return {
    name: "vault",

    async init(ctx: TowerInitContext) {
      const connectionString = resolveConnectionString(options);

      if (!connectionString) {
        db = new Proxy({} as VaultDb, {
          get() {
            throw new Error("Vault not configured. Set DATABASE_URL or pass connectionString to vault().");
          },
        });
        migrator = null as unknown as Migrator;
        ctx.container.register("vault", {
          db,
          transaction<T>() {
            throw new Error("Vault not configured. Set DATABASE_URL or pass connectionString to vault().");
          },
          async migrate() {
            throw new Error("Vault not configured. Set DATABASE_URL or pass connectionString to vault().");
          },
          migrator,
        } satisfies VaultModule);
        return;
      }

      const provider = resolveProvider(options);
      const pool = await createPool(connectionString, provider, options?.pool);
      db = new Kysely<any>({ dialect: new PostgresDialect({ pool }) });

      const migrationFolder = options?.migrations?.folder ?? "./src/vault/migrations";
      migrator = createMigrator(db, { folder: migrationFolder });

      ctx.container.register("vault", {
        db,
        async transaction<T>(fn: (trx: VaultDb) => Promise<T>): Promise<T> {
          return db.transaction().execute(fn);
        },
        async migrate(): Promise<void> {
          await migrateToLatest(db, { folder: migrationFolder });
        },
        migrator,
      } satisfies VaultModule);
    },
  };
}

registerModule("vault", (config) => vault(config as VaultConfig));

declare module "@towerjs/foundation" {
  interface TowerModules {
    vault: VaultModule
  }
}
