# `@towerjs/blueprint`

[![npm version](https://img.shields.io/npm/v/@towerjs/blueprint?color=blue)](https://www.npmjs.com/package/@towerjs/blueprint)

Application definition layer for Tower. Provides module registration, type definitions, per-request context, and the `defineTower` configuration function.

## Installation

```bash
pnpm add @towerjs/blueprint
```

## Usage

```ts
import { defineTower } from "@towerjs/blueprint";

export default defineTower({
  modules: {
    vault: { provider: "neon" },
    gatehouse: { provider: "better-auth", credentials: true },
  },
});
```

## API

### `defineTower(config)`

Defines the Tower application configuration. Returns a typed `TowerBlueprint` instance.

### `registerModule(meta, init)`

Registers a module with Tower's lifecycle system. Each module provides `init(context)` called during app startup, and optional `shutdown()` for cleanup.

### `towerContext`

Per-request scoped storage using `AsyncLocalStorage`. Provides `run(data, handler)` and `get(key)` for propagating context across async boundaries.

## Module interface

```ts
interface TowerModule {
  name: string;
  version: string;
  init(ctx: TowerInitContext): Promise<void>;
  shutdown?(): Promise<void>;
}
```

## Included in

- [towerjs](https://www.npmjs.com/package/towerjs) — meta-package
