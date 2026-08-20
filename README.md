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

Tower gives JavaScript and TypeScript applications a consistent architecture for everything beyond the web framework: databases, authentication, communication, and more.

It provides the APIs, conventions, and tooling for building an application around those capabilities while keeping the infrastructure underneath replaceable. You choose the technologies that power your application without having to reinvent its architecture.

Tower works alongside your web framework rather than replacing it. The result is one coherent application model instead of a collection of disconnected libraries — a model that is easier for both developers and AI agents to understand, build on, and maintain.

## Quick start

```bash
pnpm create tower
```

Follow the prompts to configure your application. Tower creates the project structure, configuration, environment contract, and selected integrations for you.

Then start the development server:

```bash
pnpm dev
```

Using another package manager? Run `create tower` with it instead.

## What it looks like

Define the application once:

```ts
// tower.config.ts
import { defineTower, env } from '@towerjs/tower/blueprint'

export default defineTower({
  modules: {
    vault: {
      provider: 'neon',
      connectionString: env.string('DATABASE_URL'),
    },
    gatehouse: {
      provider: 'better-auth',
    },
    courier: {
      email: {
        provider: 'resend',
        apiKey: env.string('RESEND_API_KEY'),
      },
    },
  },
})
```

Use Tower's application APIs directly:

```ts
import { gatehouse } from '@towerjs/tower/gatehouse'
import { vault } from '@towerjs/tower/vault'

const session = await gatehouse.getSession()

const users = await vault.selectFrom('user').selectAll().execute()
```

Your application code uses Tower. The infrastructure underneath is configured separately.

## Why Tower?

A web framework gives you the foundation for building and serving a web application. The rest is usually left to a collection of libraries, providers, and project-specific conventions.

That often leads to an application like:

```text
Framework
├── database library
├── authentication library
├── email provider
├── storage SDK
├── realtime service
├── job system
└── your own conventions
```

Tower brings those application concerns into one architecture.

### Consistent architecture

Tower provides conventions and APIs for common application capabilities so they work together as parts of the same application.

### Replaceable foundations

Your application uses Tower's APIs rather than being built directly around a particular infrastructure provider. Supported providers can change without forcing your application architecture to change with them.

### Framework-first

Tower works with your web framework instead of replacing it. It provides the application layer around the framework.

### Type-safe

Tower is built for TypeScript, with typed configuration and APIs throughout the application.

### Opinionated by design

Tower is not an attempt to abstract every possible technology. It provides a curated set of integrations and conventions that work well together, while leaving the underlying infrastructure choices open where they matter.

## Modules

| Module                                                                       | Description                                                                          | Integrations                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| [Foundation](https://github.com/towerjs/tower/tree/main/packages/foundation) | Application composition, lifecycle, configuration, and shared primitives             | —                                   |
| [Blueprint](https://github.com/towerjs/tower/tree/main/packages/blueprint)   | Application definition, module registration, and provider configuration              | —                                   |
| [Vault](https://github.com/towerjs/tower/tree/main/packages/vault)           | Database API, queries, migrations, and transactions                                  | PostgreSQL, Neon, Kysely            |
| [Gatehouse](https://github.com/towerjs/tower/tree/main/packages/gatehouse)   | Authentication and authorization                                                     | Better Auth                         |
| [Courier](https://github.com/towerjs/tower/tree/main/packages/courier)       | Communication layer for email, SMS, push notifications, and other messaging services | Resend, SES, SMTP, Twilio, Web Push |
| [Scribe](https://github.com/towerjs/tower/tree/main/packages/scribe)         | CLI for creating and managing Tower applications                                     | —                                   |

More application modules for storage, realtime, jobs, billing, search, and observability are planned.

## Framework support

Tower currently supports **Next.js App Router**.

Tower is designed to work alongside the framework rather than replace it. Framework-specific integrations adapt Tower's application model to the runtime and conventions of the framework.

## Example application

The [Next.js example](https://github.com/towerjs/tower/tree/main/examples/with-nextjs) is a complete Tower application demonstrating authentication, email verification, sessions, profile management, organizations, 2FA, passkeys, and other application features.

## Contributing

See the [contributing guide](https://github.com/towerjs/tower/blob/main/CONTRIBUTING.md) to get started.

## Status

Tower is in active development. APIs may change as we approach 1.0.

## License

[MIT](https://github.com/towerjs/tower/blob/main/LICENSE.md)
