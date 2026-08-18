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

Prompts for project name, TypeScript or JavaScript, Tailwind, framework (Next.js), modules (Vault, Gatehouse, Courier, etc.), and deployment target.

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

### `about`

Shows the current Tower version, configuration path, environment, runtime, enabled modules, providers, and required environment-variable presence. It never prints secret values.

```bash
npx tower about        # in a Tower project (resolves the local @towerjs/scribe bin)
pnpm dlx @towerjs/scribe about  # standalone, without installing
```

> Note: a package named `tower` also exists on npm, and `pnpm dlx` always fetches the package named on the command line (it does not check local bins). So in a project use `npx tower` or `pnpm exec tower`; with `dlx`, always name the package explicitly: `pnpm dlx @towerjs/scribe`.

### `help` / `--version`

`tower help` shows usage; `tower --version` (or `-v`) prints the version.

## Programmatic API

```ts
import { createCommand } from '@towerjs/scribe/commands/create'

await createCommand()
```

## Included in

- [create-tower](https://www.npmjs.com/package/create-tower) — `pnpm create tower`
