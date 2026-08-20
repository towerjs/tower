# `@towerjs/foundation`

[![npm version](https://img.shields.io/npm/v/@towerjs/foundation?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/foundation)

Core runtime for Tower applications. Manages the application lifecycle, dependency injection, configuration discovery, and runtime environment detection.

## Installation

```bash
pnpm add @towerjs/foundation
```

## Usage

```ts
import { createTower } from '@towerjs/foundation'

const app = await createTower()
```

`createTower()` discovers `tower.config.ts` from the working directory and initializes all registered modules.

## API

### `createTower(config?)`

Discovers `tower.config.ts` from the working directory, initializes all registered modules, and returns the `TowerApp` with each module attached.

### `createTowerApp(config, getModuleFactory?)`

Creates a `TowerApp` from an explicit config and module factory registry. Used by the meta-package and CLI.

### `detectRuntime()`

Detects the deployment environment (Vercel, AWS Lambda, Netlify, Cloudflare) and returns a `TowerRuntime`: `{ name: 'node-server' | 'vercel-serverless' | 'edge', isServerless: boolean }`.

### `ServiceContainer`

Lightweight DI container for registering and resolving services across modules.

## Included in

- [@towerjs/tower](https://www.npmjs.com/package/@towerjs/tower) — meta-package
