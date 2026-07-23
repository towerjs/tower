import { Kysely, PostgresDialect } from "kysely";
import type { TowerModule, TowerInitContext } from "@towerjs/blueprint";
import { Pool, neonConfig } from "@neondatabase/serverless";

export type VaultDb = Kysely<any>;

export type VaultConfig = {
  provider?: "neon" | "pg";
  connectionString?: string;
};

export type VaultModule = {
  db: VaultDb;
  transaction<T>(fn: (trx: VaultDb) => Promise<T>): Promise<T>;
};

async function createDb(
  connectionString: string,
  provider: "neon" | "pg",
): Promise<VaultDb> {
  let pool: any;

  if (provider === "pg") {
    const { Pool: PgPool } = await import("pg");
    pool = new PgPool({ connectionString });
  } else {
    neonConfig.fetchConnectionCache = true;
    pool = new Pool({ connectionString });
  }

  return new Kysely<any>({
    dialect: new PostgresDialect({ pool }),
  });
}

export function vault(options?: VaultConfig): TowerModule {
  return {
    name: "vault",
    async init(ctx: TowerInitContext) {
      const connectionString =
        options?.connectionString ?? process.env.DATABASE_URL ?? "";

      if (!connectionString) {
        ctx.container.register("vault", {
          db: new Proxy(
            {} as VaultDb,
            {
              get() {
                throw new Error(
                  "Vault database not configured. Set DATABASE_URL or pass connectionString to vault().",
                );
              },
            },
          ),
          transaction<T>() {
            throw new Error(
              "Vault database not configured. Set DATABASE_URL or pass connectionString to vault().",
            );
          },
        } satisfies VaultModule);
        return;
      }

      const provider = options?.provider ?? "pg";
      const db = await createDb(connectionString, provider);

      ctx.container.register("vault", {
        db,
        async transaction<T>(fn: (trx: VaultDb) => Promise<T>): Promise<T> {
          return db.transaction().execute(fn);
        },
      } satisfies VaultModule);
    },
  };
}
