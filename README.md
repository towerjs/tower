# Tower

[![NPM version](https://img.shields.io/npm/v/towerjs?style=for-the-badge&labelColor=000)](https://www.npmjs.com/package/towerjs) [![License](https://img.shields.io/npm/l/towerjs?style=for-the-badge&labelColor=000)](LICENSE)

Tower is the composable monolithic stack for JavaScript applications. It gives you a consistent architecture across routing, databases, authentication, realtime, jobs, storage, billing, search, and observability — choose the modules you need, and the providers behind them.

Tower separates application structure from implementation details, so the technology underneath a module can evolve without forcing you to rethink your application.

## Quick start

```bash
pnpm create tower
```

Follow the prompts to choose your modules — Vault (database), Gatehouse (auth), Courier (email/SMS/push), and more. A fully configured project is scaffolded with `tower.config.ts`, `.env`, auth routes, and database setup.

Currently supports **Next.js** with more frameworks coming.

## Modules

| Module | Description |
|--------|-------------|
| [Foundation](/packages/foundation) | Core runtime, application lifecycle, dependency injection, config discovery, runtime detection |
| [Blueprint](/packages/blueprint) | Application definition, module registration, service containers, context providers |
| [Vault](/packages/vault) | Database ORM with Kysely, migrations, seeds, auto-provisioning for PostgreSQL (Neon, pg) |
| [Gatehouse](/packages/gatehouse) | Full authentication via better-auth — email/password, social, magic links, OTP, passkeys, 2FA, organizations, API keys |
| [Courier](/packages/courier) | Multi-channel communication — email (Resend, SES, SMTP), SMS (Twilio), push (Web Push) |
| [Scribe](/packages/scribe) | CLI for scaffolding and managing Tower applications |
| [create-tower](/packages/create-tower) | Quick-start project scaffolding (`pnpm create tower`) |
| [towerjs](/packages/towerjs) | Meta-package that bundles all Tower modules |

### On the roadmap

| Module | Description |
|--------|-------------|
| Beacon | Realtime channels, subscriptions, broadcasts, and application events |
| Crane | Background jobs, queues, workers, and scheduled tasks |
| Keep | File storage for uploads, media, assets, and object storage providers |
| Treasury | Billing and payments — subscriptions, invoices, checkout flows |
| Observatory | Search indexing and querying across application data |
| Watchtower | Logs, metrics, tracing, error tracking, and health checks |
| Atlas | File-based routing for frameworks that don't provide it natively |
| Forge | Build and deployment for environments and infrastructure |

## Why Tower?

Most JavaScript frameworks handle the view layer well but leave you to figure out everything else. Tower fills the gap with a consistent, modular architecture:

- **Provider-agnostic** — Swap databases, auth providers, or email services without changing your application code.
- **Framework-first** — Works alongside your framework of choice rather than replacing it.
- **Composable** — Use only the modules you need. Start small, grow as required.
- **Type-safe** — Full TypeScript with strict types throughout.

## Status

Tower is in active development. The core modules (Foundation, Blueprint, Vault, Gatehouse, Courier) are functional with test coverage. Module APIs may change as we approach 1.0.

## License

MIT
