# `@towerjs/scribe`

[![npm version](https://img.shields.io/npm/v/@towerjs/scribe?style=for-the-badge&labelColor=000000)](https://www.npmjs.com/package/@towerjs/scribe)

CLI for scaffolding and managing Tower applications. Powers the `tower` command and the `create-tower` package.

## Installation

```bash
pnpm add -g @towerjs/scribe
```

Or use directly:

```bash
npx @towerjs/scribe <command>
```

## Commands

### `create`

Scaffolds a new Tower application with interactive prompts.

```bash
tower create
```

Prompts for project name, framework (Next.js), modules (Vault, Gatehouse, Courier, etc.), and deployment target.

### `migrate`

Runs database migrations for the Vault module.

```bash
tower migrate
```

### `seed`

Runs database seeds for the Vault module.

```bash
tower seed
```

## Programmatic API

```ts
import { createCommand } from "@towerjs/scribe/commands/create";

await createCommand();
```

## Included in

- [create-tower](https://www.npmjs.com/package/create-tower) — `pnpm create tower`
