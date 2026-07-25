# `@towerjs/foundation`

[![npm version](https://img.shields.io/npm/v/@towerjs/foundation?color=blue)](https://www.npmjs.com/package/@towerjs/foundation)

Core runtime for Tower applications. Manages the application lifecycle, dependency injection, configuration discovery, and runtime environment detection.

## Installation

```bash
pnpm add @towerjs/foundation
```

## Usage

```ts
import { createTowerApp, defineTower } from "@towerjs/blueprint";

export default defineTower({
  modules: {
    vault: { provider: "pg" },
    gatehouse: { provider: "better-auth" },
  },
});
```

Then initialize:

```ts
import { tower } from "towerjs";
// or
import { createTower } from "@towerjs/foundation";
const app = await createTower();
```

## API

### `createTower(config?)`

Discovers `tower.config.ts` from the working directory and initializes all registered modules.

### `detectRuntime()`

Returns the current runtime environment: `"node"`, `"browser"`, `"edge"`, or `"workerd"`.

### `ServiceContainer`

Lightweight DI container for registering and resolving services across modules.

## Included in

- [towerjs](https://www.npmjs.com/package/towerjs) — meta-package
