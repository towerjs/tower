# `@towerjs/edge`

[![npm version](https://img.shields.io/npm/v/@towerjs/edge?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/edge)

Edge runtime integration for Tower. Resolves `tower.config.ts` in constrained environments like Vercel Edge Runtime where filesystem access is unavailable.

## Installation

```bash
pnpm add @towerjs/edge
```

## Usage

```ts
// next.config.ts
import { withTowerEdge } from "@towerjs/edge"

export default withTowerEdge({})
```

`withTowerEdge` bundles your `tower.config.ts` via webpack/Turbopack aliases so Tower can discover it at runtime in Edge Functions, Middleware, and other serverless environments.

## Included in

- [towerjs](https://www.npmjs.com/package/towerjs) — meta-package
