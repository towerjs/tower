# `@towerjs/tower`

[![npm version](https://img.shields.io/npm/v/@towerjs/tower?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/tower)

Application core for Tower. `defineTower` composes your modules; the core wires them together. Modules are imported from their own packages.

## Installation

```bash
pnpm add @towerjs/tower @towerjs/vault @towerjs/gatehouse
```

## Usage

```ts
// tower.config.ts
import { gatehouse } from '@towerjs/gatehouse'
import { defineTower } from '@towerjs/tower/blueprint'
import { vault } from '@towerjs/vault'

export default defineTower({
  modules: [vault(), gatehouse({ provider: 'better-auth', credentials: true })],
})
```

```ts
import { gatehouse } from '@towerjs/gatehouse'
import { vault } from '@towerjs/vault'

// Vault — direct database access
await vault.selectFrom('users').selectAll().execute()

// Gatehouse — authentication
const session = await gatehouse.session()
```

Access the initialized app itself for configuration, dependency injection, and shutdown:

```ts
import { getTowerApp } from '@towerjs/tower/runtime'

const app = await getTowerApp()
await app.shutdown()
```

## Exports

| Export           | Description                                        |
| ---------------- | -------------------------------------------------- |
| `initTower`      | Programmatic initialization (with optional config) |
| `getTowerApp`    | Async access to the initialized `TowerApp`         |
| `createTower`    | Low-level Tower app builder                        |
| `createTowerApp` | Foundation-level app builder                       |
| `defineTower`    | Configuration helper                               |
| `TowerApp`       | Type for the initialized Tower object              |

Each module import (`@towerjs/vault`, `@towerjs/gatehouse`) resolves through the initialized Tower app. For async initialization, await `getTowerApp()` first.

## Subpaths

| Subpath                     | Exports                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `@towerjs/tower/blueprint`  | `defineTower`, types                                        |
| `@towerjs/tower/foundation` | `createTower`, `createTowerApp`, `initTower`, `getTowerApp` |
| `@towerjs/tower/runtime`    | `initTower`, `getTowerApp`                                  |

Import modules from their own packages: `@towerjs/vault`, `@towerjs/gatehouse`, `@towerjs/courier`, `@towerjs/edge`.

## What's included

- Tower core runtime (Foundation and Blueprint layers — internal)
- `@towerjs/vault` — Database ORM (separate package)
- `@towerjs/gatehouse` — Authentication (separate package)
- `@towerjs/courier` — Communications (separate package)
