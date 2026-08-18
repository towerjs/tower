<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo-light.svg">
    <img alt="Tower" src=".github/logo-light.svg" height="70" style="max-width: 100%;">
  </picture>
</div>

<p align="center">
  The composable, monolithic stack for JavaScript.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/towerjs"><img src="https://img.shields.io/npm/v/towerjs?style=for-the-badge&labelColor=000" alt="NPM version"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/npm/l/towerjs?style=for-the-badge&labelColor=000" alt="License"></a>
  <a href="https://github.com/towerjs/tower/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/towerjs/tower/ci.yml?style=for-the-badge&labelColor=000&label=tests" alt="Tests"></a>
</p>

---

Tower gives JavaScript and TypeScript applications a consistent architecture for the parts of an application that sit beyond the web framework — database, authentication, communication, and more. It brings these capabilities together as integrated modules with consistent APIs, configuration, and tooling.

Choose the modules you need and the providers behind them. Tower works alongside your web framework rather than replacing it, so your application is built around Tower’s architecture without being tied to the infrastructure underneath.

## Quick start

```bash
pnpm create tower
```

Follow the prompts to configure your application. Tower scaffolds the project structure, configuration, environment contract, and selected integrations for you.

## What it looks like

```ts
// tower.config.ts
import { defineTower, env } from 'towerjs/blueprint'

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

Then use the modules directly in your application:

```ts
import { gatehouse } from 'towerjs/gatehouse'
import { vault } from 'towerjs/vault'

const session = await gatehouse.getSession()
const users = await vault.selectFrom('user').selectAll().execute()
```

Tower currently supports **Next.js (App Router)**.

## Modules

| Module                             | Description                                                         | Providers                           |
| ---------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| [Foundation](/packages/foundation) | Core runtime, lifecycle, DI, config discovery, runtime detection    | —                                   |
| [Blueprint](/packages/blueprint)   | Application definition, module registration, context                | —                                   |
| [Vault](/packages/vault)           | PostgreSQL database API with Kysely, migrations, and seeds          | Neon, pg                            |
| [Gatehouse](/packages/gatehouse)   | Full auth — social, magic links, OTP, passkeys, 2FA, orgs, API keys | Better Auth                         |
| [Courier](/packages/courier)       | Multi-channel communication — email, SMS, push                      | Resend, SES, SMTP, Twilio, Web Push |
| [Scribe](/packages/scribe)         | CLI for scaffolding and managing Tower applications                 | —                                   |

More modules for AI, storage, realtime, jobs, billing, search, and observability are planned.

## Why Tower?

Most JavaScript frameworks handle the web layer well but leave the rest of your application architecture to you. Tower provides a consistent way to build the application around it.

- **Provider-agnostic** — Choose supported infrastructure without coupling your application to the provider.
- **Framework-first** — Works alongside your web framework rather than replacing it.
- **Composable** — Use the modules you need while keeping them part of one application architecture.
- **Type-safe** — Built for TypeScript with strict types throughout.

## Contributing

If you’re interested in contributing, please read our [contributing guide](CONTRIBUTING.md) first.

## Status

Tower is in active development. APIs may change as we approach 1.0.

## License

[MIT](CONTRIBUTING.md)
