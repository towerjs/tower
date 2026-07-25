# `@towerjs/vault`

[![npm version](https://img.shields.io/npm/v/@towerjs/vault?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/vault)

Database and ORM layer for Tower. Built on [Kysely](https://kysely.dev) with support for PostgreSQL providers including Neon, Supabase, and Railway. Provides migrations, seeds, and connection management.

## Installation

```bash
pnpm add @towerjs/vault
```

## Usage

Configure Vault in your `tower.config.ts`:

```ts
import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  modules: {
    vault: {
      provider: "pg",
      connectionString: process.env.DATABASE_URL,
    },
  },
});
```

Run queries:

```ts
import { tower } from "towerjs";

await tower.vault.db
  .insertInto("users")
  .values({ name: "Alice", email: "alice@example.com" })
  .execute();
```

## Migrations

Place migration files in `src/vault/migrations/`:

```ts
// src/vault/migrations/001_create_users.ts
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("email", "varchar(255)", (c) => c.notNull().unique())
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("users").execute();
}
```

Run migrations via the CLI:

```bash
tower migrate
```

Or programmatically:

```ts
import { migrateToLatest } from "@towerjs/vault";
await migrateToLatest(tower.vault);
```

## Seeds

Place seed files in `src/vault/seeds/` and run:

```bash
tower seed
```

## Providers

| Provider | Connection |
|----------|-----------|
| Neon | Serverless connection via `@neondatabase/serverless` |
| pg | Standard PostgreSQL via `pg` (Supabase, Railway, RDS, etc.) |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | auto-detect | `"pg"` or `"neon"` |
| `connectionString` | `DATABASE_URL` env | Full connection string |
| `pool.min` | `0` | Minimum pool connections |
| `pool.max` | `10` | Maximum pool connections |
| `pool.ssl` | auto | SSL configuration |

## CLI

```
tower migrate    — Run pending migrations
tower seed       — Execute seed files
```

## Included in

- [towerjs](https://www.npmjs.com/package/towerjs) — meta-package
