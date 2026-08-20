# `@towerjs/vault`

[![npm version](https://img.shields.io/npm/v/@towerjs/vault?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/vault)

Database layer for Tower. Vault's current public query API is built on [Kysely](https://kysely.dev), with PostgreSQL providers for Neon (HTTP) and standard `pg` connections. It provides migrations, seeds, and connection management. A future application-oriented model API may sit above this query API; it will not replace Kysely or remove the low-level escape hatch.

## Installation

```bash
pnpm add @towerjs/vault
```

## Usage

Configure Vault in your `tower.config.ts`:

```ts
import { defineTower } from '@towerjs/blueprint'
import { env } from '@towerjs/blueprint'

export default defineTower({
  modules: {
    vault: {
      provider: 'pg',
      connectionString: env.string('DATABASE_URL'),
    },
  },
})
```

Run queries:

```ts
import { vault } from '@towerjs/tower/vault'

await vault.insertInto('users').values({ name: 'Alice', email: 'alice@example.com' }).execute()
```

## Migrations

Place migration files in `src/vault/migrations/`:

```ts
// src/vault/migrations/001_create_users.ts
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'varchar(255)', (c) => c.notNull().unique())
    .execute()
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable('users').execute()
}
```

Run migrations via the CLI:

```bash
tower migrate
```

Or programmatically:

```ts
import { vault } from '@towerjs/tower/vault'
import { migrateToLatest } from '@towerjs/vault'

await migrateToLatest(vault, { folder: 'src/vault/migrations' })
```

## Seeds

Place seed files in `src/vault/seeds/` and run:

```bash
tower seed
```

## Providers

| Provider | Connection                                                  |
| -------- | ----------------------------------------------------------- |
| Neon     | HTTP dialect via `kysely-neon` (`@neondatabase/serverless`) |
| pg       | Standard PostgreSQL via `pg` (Supabase, Railway, RDS, etc.) |

## Configuration

| Option                         | Default            | Description                |
| ------------------------------ | ------------------ | -------------------------- |
| `provider`                     | auto-detect        | `"pg"` or `"neon"`         |
| `connectionString`             | `DATABASE_URL` env | Full connection string     |
| `pool.max`                     | `10`               | Maximum pool connections   |
| `pool.idleTimeoutMillis`       | —                  | Idle connection timeout    |
| `pool.connectionTimeoutMillis` | —                  | Connection attempt timeout |
| `pool.ssl`                     | auto               | SSL configuration          |

## CLI

```
tower migrate    — Run pending migrations
tower seed       — Execute seed files
tower about      — Diagnose application, modules, runtime, and environment configuration
```

## Edge Runtime

On Edge Runtime, the `pg` provider is unavailable (no TCP connections) — use the `neon` provider instead. Migrations and seeds are not available on Edge; run them locally or in a Node.js environment.

## Included in

- [@towerjs/tower](https://www.npmjs.com/package/@towerjs/tower) — meta-package
