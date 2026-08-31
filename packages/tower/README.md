<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/towerjs/tower/main/.github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/towerjs/tower/main/.github/logo-light.svg">
    <img alt="Tower" src="https://raw.githubusercontent.com/towerjs/tower/main/.github/logo-light.svg" height="70" style="max-width: 100%;">
  </picture>
</div>

<p align="center">
  The composable, monolithic stack for JavaScript.
</p>

<p align="center">
  <a href="https://github.com/towerjs/tower/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/towerjs/tower/ci.yml?style=for-the-badge&labelColor=000" alt="Build"></a>
  <a href="https://www.npmjs.com/package/@towerjs/tower"><img src="https://img.shields.io/npm/v/@towerjs/tower?style=for-the-badge&labelColor=000" alt="NPM version"></a>
  <a href="https://github.com/towerjs/tower/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@towerjs/tower?style=for-the-badge&labelColor=000" alt="License"></a>
</p>

---

Tower gives JavaScript and TypeScript applications a consistent architecture for everything beyond the web framework: databases, authentication, communication, and more. It provides the APIs, conventions, and tooling for building an application around those capabilities while keeping the infrastructure underneath replaceable.

`@towerjs/tower` is the **application core** — the place to explain Tower on npm. It owns Foundation and Blueprint as internal layers and is where every Tower app is composed. Modules (`@towerjs/vault`, `@towerjs/gatehouse`, etc.) are separate packages that depend on the core.

## Quick start

Create a new Tower app:

```bash
pnpm create tower
```

Or add the core to an existing project:

```bash
pnpm add @towerjs/tower @towerjs/vault @towerjs/gatehouse
```

Then start the dev server:

```bash
pnpm dev
```

## What it looks like

Define the application once — the core composes explicit module definitions (no registry, no string keys):

```ts
// tower.config.ts
import { courier } from '@towerjs/courier'
import { gatehouse } from '@towerjs/gatehouse'
import { defineTower, env } from '@towerjs/tower/blueprint'
import { vault } from '@towerjs/vault'

export default defineTower({
  modules: [
    vault({ provider: 'neon', connectionString: env.string('DATABASE_URL') }),
    gatehouse({ provider: 'better-auth' }),
    courier({ email: { provider: 'resend', apiKey: env.string('RESEND_API_KEY') } }),
  ],
})
```

Use Tower's application APIs directly — the core resolves them from the initialized app:

```ts
import { gatehouse } from '@towerjs/gatehouse'
import { vault } from '@towerjs/vault'

const session = await gatehouse.session()
const users = await vault.selectFrom('users').selectAll().execute()
```

Your application code uses Tower. The infrastructure underneath is configured separately.

## What `@towerjs/tower` does

- **Composition root** — `defineTower({ modules: [vault(), gatehouse(...)] })` is the application. There is no module registry or dynamic import.
- **Foundation + Blueprint (internal)** — `src/foundation/` (lifecycle, DI, config discovery, runtime detection) and `src/blueprint/` (app definition) live inside this package. They are not separate npm packages.
- **Lazy initialization** — first use of any module triggers `tower.config.ts` discovery and initialization. Works on Node.js, serverless, and Edge (Gatehouse providers declare their runtime capabilities).
- **Static, tree-shakeable graph** — `vault()` returns a `TowerModule` (call face); `vault.selectFrom` resolves from the container (property face, via `getTowerService`).

## Installation

```bash
pnpm add @towerjs/tower
# add the modules you need
pnpm add @towerjs/vault @towerjs/gatehouse @towerjs/courier @towerjs/edge
```

## Exports

| Export           | Description                                        |
| ---------------- | -------------------------------------------------- |
| `initTower`      | Programmatic initialization (with optional config) |
| `getTowerApp`    | Async access to the initialized `TowerApp`         |
| `createTower`    | Low-level app builder                              |
| `createTowerApp` | Foundation-level app builder                       |
| `defineTower`    | Configuration helper                               |
| `TowerApp`       | Type for the initialized Tower object              |

## Subpaths

| Subpath                       | Exports                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `@towerjs/tower/blueprint`    | `defineTower`, types                                        |
| `@towerjs/tower/foundation`   | `createTower`, `createTowerApp`, `initTower`, `getTowerApp` |
| `@towerjs/tower/runtime`      | `initTower`, `getTowerApp`                                  |
| `@towerjs/tower/runtime/node` | Node-specific context helpers                               |

Modules are imported from their own packages: `@towerjs/vault`, `@towerjs/gatehouse`, `@towerjs/courier`, `@towerjs/edge`. The `@towerjs/tower/<module>` subpaths no longer exist as of v0.2.

## Modules

| Module                                                                     | Description                                                                      | Integrations                        |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| [Vault](https://github.com/towerjs/tower/tree/main/packages/vault)         | Database API, queries, migrations, transactions, models                          | PostgreSQL, Neon, Kysely            |
| [Gatehouse](https://github.com/towerjs/tower/tree/main/packages/gatehouse) | Authentication and authorization                                                 | Better Auth                         |
| [Courier](https://github.com/towerjs/tower/tree/main/packages/courier)     | Communication layer for email, SMS, push notifications                           | Resend, SES, SMTP, Twilio, Web Push |
| [Edge](https://github.com/towerjs/tower/tree/main/packages/edge)           | Edge runtime integration — `withTowerEdge` for Next.js                           | Vercel Edge                         |
| [Scribe](https://github.com/towerjs/tower/tree/main/packages/scribe)       | CLI for creating and managing Tower applications (`create`, `db`, `make`, `dev`) | —                                   |

More application modules for storage, realtime, jobs, billing, search, and observability are planned.

## Why Tower?

A web framework gives you the foundation for serving a web app. The rest is usually a collection of libraries and conventions. Tower brings databases, auth, communication, and more into one coherent application model — provider-agnostic, framework-first, and typed — so your app isn't built directly around a single provider.

See [Infrastructure](https://github.com/towerjs/tower/blob/main/docs/01-introduction/05-infrastructure.mdx) for how PostgreSQL/Kysely and scoped provider portability fit together, and [docs](https://github.com/towerjs/tower/tree/main/docs) for the full reference.

## Framework support

Tower currently supports **Next.js App Router** (`withTowerEdge`, `gatehouse` Next adapter). Framework adapters live in `packages/*/src/frameworks/` — adding a new framework means adding an adapter file per package.

## Example application

The [Next.js example](https://github.com/towerjs/tower/tree/main/examples/with-nextjs) is a complete Tower app demonstrating auth, email verification, sessions, organizations, 2FA, and passkeys.

## Contributing

See the [contributing guide](https://github.com/towerjs/tower/blob/main/CONTRIBUTING.md) to get started.

## License

[MIT](https://github.com/towerjs/tower/blob/main/LICENSE.md)
