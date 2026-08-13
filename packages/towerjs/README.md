# `towerjs`

[![npm version](https://img.shields.io/npm/v/towerjs?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/towerjs)

Meta-package that bundles all Tower modules for convenient access. Import individual modules from subpaths — each access lazily initializes the Tower app on first use.

## Installation

```bash
pnpm add towerjs
```

## Usage

Import the modules you need from their subpaths. First use triggers Tower initialization (and `tower.config.ts` discovery).

```ts
import { gatehouse } from 'towerjs/gatehouse'
import { vault } from 'towerjs/vault'
import { courier } from 'towerjs/courier'

// Gatehouse — authentication
const session = await gatehouse.getSession()

// Vault — direct database access
await vault.selectFrom('users').selectAll().execute()

// Courier — communications
await courier.email.send({ to: 'user@example.com', subject: 'Hello', text: 'World' })
```

Access the initialized app itself for configuration, dependency injection, and shutdown:

```ts
import { getTowerApp } from 'towerjs/runtime'

const app = await getTowerApp()
await app.container.get('gatehouse').migrate()
await app.shutdown()
```

## Exports

| Export           | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `tower`          | Lazy `TowerApp` proxy — exposes `config`, `container`, `runtime` |
| `initTower`      | Programmatic initialization (with optional config)               |
| `getTowerApp`    | Async access to the initialized `TowerApp`                       |
| `createTower`    | Initialization helper from `@towerjs/foundation`                 |
| `createTowerApp` | Low-level app builder from `@towerjs/foundation`                 |
| `defineTower`    | Configuration helper from `@towerjs/blueprint`                   |
| `TowerApp`       | Type for the initialized Tower object                            |

`tower` is a lazy proxy — the app (and its `tower.config.ts` discovery) initializes on first use. For async initialization, await `getTowerApp()` first.

## Subpaths

Import individual modules directly:

| Subpath                          | Exports                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `towerjs/blueprint`              | `defineTower`, types                                           |
| `towerjs/foundation`             | `createTower`, `createTowerApp`, `initTower`, `getTowerApp`    |
| `towerjs/gatehouse`              | `gatehouse` (incl. `getSession`, `user`, `requireUser`)        |
| `towerjs/gatehouse/actions`      | Pre-built auth server actions                                  |
| `towerjs/gatehouse/next`         | Next.js integration (`action`, `withGatehouse`, `GET`, `POST`) |
| `towerjs/gatehouse/client`       | `gatehouseClient` for the browser                              |
| `towerjs/gatehouse/react-server` | Gatehouse for React Server Components                          |
| `towerjs/vault`                  | `vault` (incl. `db`, `migrate`, `seed`), types                 |
| `towerjs/courier`                | `courier` (incl. `email`, `sms`)                               |
| `towerjs/runtime`                | `initTower`, `getTowerApp`, `getModuleFactory`                 |

## What's included

- `@towerjs/foundation` — Core runtime and DI
- `@towerjs/blueprint` — Application definition
- `@towerjs/vault` — Database ORM
- `@towerjs/gatehouse` — Authentication
- `@towerjs/courier` — Communications
