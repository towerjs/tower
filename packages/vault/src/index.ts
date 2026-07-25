import type { TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { registerModule } from "@towerjs/blueprint";
import { Kysely, PostgresDialect } from "kysely";
import type { Migrator } from "kysely/migration";
import type { VaultConfig, VaultDb, VaultModule } from "./types.js";
import { createMigrator, migrateToLatest } from "./migrate.js";
import { runSeeds } from "./seed.js";

export type { VaultConfig, VaultDb, VaultModule, VaultSeedConfig } from "./types.js";
export { createMigrator, migrateToLatest } from "./migrate.js";
export { runSeeds } from "./seed.js";

let _vault: VaultModule | undefined;

function resolveConnectionString(config?: VaultConfig): string {
  return config?.connectionString ?? process.env.DATABASE_URL ?? "";
}

function resolveProvider(config?: VaultConfig): "neon" | "pg" {
  const url = resolveConnectionString(config);
  if (config?.provider) return config.provider;
  if (url.includes(".neon.tech")) return "neon";
  return "pg";
}

function resolveSsl(
  poolConfig: VaultConfig["pool"],
  connectionString: string,
): boolean | { rejectUnauthorized?: boolean } | undefined {
  if (poolConfig?.ssl !== undefined) return poolConfig.ssl;
  if (connectionString.includes("sslmode=require") || connectionString.includes("sslmode=no-verify")) {
    return connectionString.includes("sslmode=no-verify")
      ? { rejectUnauthorized: false }
      : true;
  }
  if (process.env.NODE_ENV === "production") return true;
  return undefined;
}

async function createPool(
  connectionString: string,
  provider: "neon" | "pg",
  poolConfig?: VaultConfig["pool"],
  runtime?: { name: string; isServerless: boolean },
): Promise<any> {
  const config: Record<string, unknown> = {
    connectionString,
  };
  if (poolConfig?.max) config.max = poolConfig.max;
  if (poolConfig?.idleTimeoutMillis) config.idleTimeoutMillis = poolConfig.idleTimeoutMillis;
  if (poolConfig?.connectionTimeoutMillis) config.connectionTimeoutMillis = poolConfig.connectionTimeoutMillis;

  const isEdge = runtime?.name === "edge";
  const ssl = resolveSsl(poolConfig, connectionString);

  if (provider === "neon") {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    neonConfig.fetchConnectionCache = true;
    if (isEdge) neonConfig.poolQueryViaFetch = true;
    const neonPool = ssl !== undefined ? new Pool({ ...config, ssl }) : new Pool(config);
    neonPool.on("error", (err: Error) => {
      if (isEdge) return;
      console.error("[vault] Unexpected Neon database pool error:", err.message);
    });
    return neonPool;
  }

  if (isEdge) {
    throw new Error(
      'The pg provider requires a TCP connection which is not available on Edge Runtime. ' +
      'Use the neon provider instead (e.g., { provider: "neon" }).',
    )
  }

  const { Pool: PgPool } = await import("pg");
  const pool = new PgPool(ssl !== undefined ? { ...config, ssl } : config);

  pool.on("error", (err: Error) => {
    console.error("[vault] Unexpected database pool error:", err.message);
  });

  return pool;
}

async function validateConnection(pool: any, provider: "neon" | "pg"): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

/**
 * Proxy singleton that dispatches to the initialized vault module.
 *
 * Throws if accessed before Tower has started. Use `vault.db` to access
 * the underlying Kysely instance directly.
 */
export const vault: VaultModule = new Proxy({} as VaultModule, {
  get(_, prop) {
    if (!_vault) throw new Error("Vault not initialized. Tower must be started first.");
    const value = (_vault as any)[prop];
    return typeof value === "function"
      ? (...args: any[]) => (value as Function)(...args)
      : value;
  },
});

function buildProxyUnconfigured(): VaultModule {
  return new Proxy({} as VaultModule, {
    get(_, prop) {
      if (prop === "migrate" || prop === "migrator") {
        throw new Error("Vault not configured. Set DATABASE_URL or pass connectionString to vault().");
      }
      return () => { throw new Error("Vault not configured. Set DATABASE_URL or pass connectionString to vault().") };
    },
  });
}

function buildProxyConfigured(
  db: VaultDb,
  pool: { end(): Promise<void> },
  migrationFolder: string,
  seedFolder: string,
  _migrator: Migrator,
): VaultModule {
  return new Proxy(db as unknown as VaultModule, {
    get(target, prop) {
      if (prop === "db") return db;
      if (prop === "migrator") return _migrator;
      if (prop === "migrate") {
        return () => migrateToLatest(db, { folder: migrationFolder });
      }
      if (prop === "seed") {
        return (name?: string) => runSeeds(db, { folder: seedFolder }, name);
      }
      if (prop === "close") {
        return () => pool.end();
      }
      if (prop === "transaction") {
        return <T>(fn: (trx: VaultDb) => Promise<T>) =>
          db.transaction().execute(fn);
      }
      return (target as any)[prop];
    },
  });
}

/**
 * Creates a Tower module that registers the vault database service.
 *
 * @example
 * ```ts
 * defineTower({
 *   modules: {
 *     vault: { connectionString: process.env.DATABASE_URL },
 *   },
 * })
 * ```
 */
export function createVaultModule(options?: VaultConfig): TowerModule {
  return {
    name: "vault",

    async init(ctx: TowerInitContext) {
      if (_vault) {
        try { await _vault.close() } catch {}
        _vault = undefined;
      }

      const connectionString = resolveConnectionString(options);

      if (!connectionString) {
        _vault = buildProxyUnconfigured();
        ctx.container.register("vault", _vault);
        return;
      }

      const provider = resolveProvider(options);
      const isEdge = ctx.runtime.name === "edge";
      const pool = await createPool(connectionString, provider, options?.pool, ctx.runtime);

      if (!isEdge) {
        try {
          await validateConnection(pool, provider);
        } catch (err) {
          await pool.end().catch(() => {});
          throw new Error(
            `Could not connect to database at ${connectionString.replace(/\/\/.*@/, "//***@")}: ${(err as Error).message}`,
          );
        }
      }

      const db: VaultDb = new Kysely({ dialect: new PostgresDialect({ pool }) });

      const migrationFolder = options?.migrations?.folder ?? "./src/vault/migrations";
      const seedFolder = options?.seeds?.folder ?? "./src/vault/seeds";
      const migrator = createMigrator(db, { folder: migrationFolder });

      _vault = buildProxyConfigured(db, pool, migrationFolder, seedFolder, migrator);
      ctx.container.register("vault", _vault);
    },
  };
}

registerModule("vault", (config) => createVaultModule(config as VaultConfig));
