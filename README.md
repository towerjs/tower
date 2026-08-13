# Tower

[![NPM version](https://img.shields.io/npm/v/towerjs?style=for-the-badge&labelColor=000)](https://www.npmjs.com/package/towerjs) [![License](https://img.shields.io/npm/l/towerjs?style=for-the-badge&labelColor=000)](LICENSE.md) [![Status](https://img.shields.io/badge/status-alpha-yellow?style=for-the-badge&labelColor=000)](#status)

Tower is the composable, monolithic stack for JavaScript applications. It gives you a consistent architecture across routing, databases, authentication, realtime, jobs, storage, billing, search, and observability — choose the modules you need, and the providers behind them.

Tower separates application structure from implementation details, so the technology underneath a module can evolve without forcing you to rethink your application.

## Quick start

```bash
pnpm create tower
```

Follow the prompts to choose your modules — Vault (database), Gatehouse (auth), Courier (email/SMS/push), and more. A fully configured project is scaffolded with `tower.config.ts`, `.env`, auth routes, and database setup.

### Configuration contract

Tower keeps application architecture and environment-specific values separate:

- `tower.config.ts` defines which modules and providers the application uses. It must not contain secrets or environment-specific credentials.
- `.env` and deployment environment variables provide values such as `DATABASE_URL`, `GATEHOUSE_SECRET`, and provider API keys.
- `.env.example` is the generated, authoritative contract for the selected modules and providers. It is safe to commit and contains names, hints, and placeholders—not secrets.

Use `env` from `towerjs/blueprint` for validated, lazy environment access in configuration:

```ts
import { defineTower, env } from 'towerjs/blueprint'

export default defineTower({
  modules: {
    vault: { provider: 'neon', connectionString: env.string('DATABASE_URL') },
  },
})
```

Run `tower about` for a diagnostic view of the application, runtime, enabled modules, providers, and whether required environment variables are present. Values are never printed.

### Publishing v0.1.0

The first public release publishes nine packages together at `0.1.0`: `towerjs`, `create-tower`, and the seven `@towerjs/*` packages. The example app and the private root package are not published.

Before publishing, verify the initial release contract locally:

```bash
pnpm check:initial-version
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then add an `NPM_TOKEN` repository secret with permission to publish the `towerjs` package and the `@towerjs` organization scope. Push the release changes to `main`. The Release workflow uses Changesets to consume the initial release marker, creates or updates the release PR if needed, and publishes the packages after that release commit reaches `main`. `changeset publish` creates the corresponding Git tags and GitHub releases.

The initial Changeset intentionally produces no version bump: every publishable package is already set to `0.1.0`. This is deliberate for the first release. Future Changesets will calculate normal version bumps.

Currently supports **Next.js** with more frameworks coming.

## Modules

| Module                                 | Description                                                         | Providers                           |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| [Foundation](/packages/foundation)     | Core runtime, lifecycle, DI, config discovery, runtime detection    | —                                   |
| [Blueprint](/packages/blueprint)       | Application definition, module registration, context                | —                                   |
| [Vault](/packages/vault)               | PostgreSQL database API with Kysely, migrations, and seeds            | Neon, pg                            |
| [Gatehouse](/packages/gatehouse)       | Full auth — social, magic links, OTP, passkeys, 2FA, orgs, API keys | Better Auth                         |
| [Courier](/packages/courier)           | Multi-channel communication — email, SMS, push                      | Resend, SES, SMTP, Twilio, Web Push |
| [Scribe](/packages/scribe)             | CLI for scaffolding and managing Tower applications                 | —                                   |
| [create-tower](/packages/create-tower) | Quick-start project scaffolding                                     | —                                   |
| [towerjs](/packages/towerjs)           | Meta-package that bundles all Tower modules                         | —                                   |

### On the roadmap

| Module      | Description                                              | Providers                                   |
| ----------- | -------------------------------------------------------- | ------------------------------------------- |
| Beacon      | Realtime channels and events                             | Postgres (built-in), Redis, Ably, Pusher    |
| Crane       | Background jobs and queues                               | Postgres (built-in), Redis                  |
| Keep        | File storage and assets                                  | Local (built-in), S3, Cloudflare R2         |
| Treasury    | Billing and payments                                     | Stripe                                      |
| Compass     | Search and indexing                                      | Postgres (built-in), Meilisearch, Typesense |
| Observatory | Logs, metrics, tracing, health checks                    | Console (built-in)                          |
| Atlas       | File-based routing for frameworks that don't provide it  | —                                           |
| Forge       | Build and deployment for environments and infrastructure | —                                           |
| Sorcerer    | AI application layer — agents, chat, workflows           | Vercel AI SDK (any model provider)          |

## Why Tower?

Most JavaScript frameworks handle the view layer well but leave you to figure out everything else. Tower fills the gap with a consistent, modular architecture:

- **Provider-agnostic** — Swap databases, email services, or other providers without changing your application code. Auth currently ships with Better Auth as its single implementation detail; the module API stays stable regardless.
- **Framework-first** — Works alongside your framework of choice rather than replacing it.
- **Composable** — Use only the modules you need. Start small, grow as required.
- **Type-safe** — Full TypeScript with strict types throughout.

## Status

Tower is in active development. The core modules (Foundation, Blueprint, Vault, Gatehouse, Courier) are functional with test coverage. Module APIs may change as we approach 1.0.

## License

MIT
