# `@towerjs/blueprint`

[![npm version](https://img.shields.io/npm/v/@towerjs/blueprint?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/blueprint)

Application definition layer for Tower. Provides module registration, type definitions, per-request context, and the `defineTower` configuration function.

## Installation

```bash
pnpm add @towerjs/blueprint
```

## Usage

```ts
import { defineTower } from '@towerjs/blueprint'

export default defineTower({
  modules: {
    vault: { provider: 'neon' },
    gatehouse: { provider: 'better-auth', credentials: true },
  },
})
```

## API

### `defineTower(config)`

Defines the Tower application configuration. Type-safe at compile time; a no-op at runtime.

### `registerModule(name, factory)` / `registerModule({ name, dependsOn, factory })`

Registers a module factory with Tower's lifecycle system. Modules may implement `register(ctx)` to publish services, `initialize(ctx)` to start up, and an optional `shutdown(ctx)` for cleanup.

### `towerContext`

Per-request scoped storage using `AsyncLocalStorage`. Provides `run(data, handler)` and `get(key)` for propagating context across async boundaries.

## Module interface

```ts
interface TowerModule {
  name: string
  dependsOn?: string[]
  register?(ctx: TowerContext): void
  initialize?(ctx: TowerContext): Promise<void>
  shutdown?(ctx: TowerContext): Promise<void>
}
```

## Included in

- [towerjs](https://www.npmjs.com/package/towerjs) — meta-package
