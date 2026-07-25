# `towerjs`

[![npm version](https://img.shields.io/npm/v/towerjs?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/towerjs)

Meta-package that bundles all Tower modules. Import `towerjs` to get a fully initialized Tower application with auto-discovered configuration.

## Installation

```bash
pnpm add towerjs
```

## Usage

```ts
import { tower } from "towerjs";

// Access any registered module
await tower.vault.db.selectFrom("users").selectAll().execute();
const session = await tower.gatehouse.getSession();
await tower.courier.email.send({ to: "user@example.com", subject: "Hello", text: "World" });
```

## Exports

| Export | Description |
|--------|-------------|
| `tower` | Pre-initialized Tower instance (auto-discovers `tower.config.ts`) |
| `createTower` | Programmatic initialization |
| `defineTower` | Configuration helper from `@towerjs/blueprint` |
| `TowerInstance` | Type for the initialized Tower object |

## What's included

- `@towerjs/foundation` — Core runtime and DI
- `@towerjs/blueprint` — Application definition
- `@towerjs/vault` — Database ORM
- `@towerjs/gatehouse` — Authentication
- `@towerjs/courier` — Communications
