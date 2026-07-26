# Tower

[![NPM version](https://img.shields.io/npm/v/towerjs?style=for-the-badge&labelColor=000)](https://www.npmjs.com/package/towerjs) [![License](https://img.shields.io/npm/l/towerjs?style=for-the-badge&labelColor=000)](LICENSE.md) [![Status](https://img.shields.io/badge/status-alpha-yellow?style=for-the-badge&labelColor=000)](#status)

Tower is the composable monolithic stack for JavaScript applications. It gives you a consistent architecture across routing, databases, authentication, realtime, jobs, storage, billing, search, and observability — choose the modules you need, and the providers behind them.

Tower separates application structure from implementation details, so the technology underneath a module can evolve without forcing you to rethink your application.

## Quick start

```bash
pnpm create tower
```

Follow the prompts to choose your modules — Vault (database), Gatehouse (auth), Courier (email/SMS/push), and more. A fully configured project is scaffolded with `tower.config.ts`, `.env`, auth routes, and database setup.

Currently supports **Next.js** with more frameworks coming.

## Modules

| Module                                 | Description                                                         | Providers                           |
| -------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| [Foundation](/packages/foundation)     | Core runtime, lifecycle, DI, config discovery, runtime detection    | —                                   |
| [Blueprint](/packages/blueprint)       | Application definition, module registration, context                | —                                   |
| [Vault](/packages/vault)               | Database ORM with Kysely, migrations, seeds                         | Neon, pg                            |
| [Gatehouse](/packages/gatehouse)       | Full auth — social, magic links, OTP, passkeys, 2FA, orgs, API keys | Better Auth                         |
| [Courier](/packages/courier)           | Multi-channel communication — email, SMS, push                      | Resend, SES, SMTP, Twilio, Web Push |
| [Scribe](/packages/scribe)             | CLI for scaffolding and managing Tower applications                 | —                                   |
| [create-tower](/packages/create-tower) | Quick-start project scaffolding                                     | —                                   |
| [towerjs](/packages/towerjs)           | Meta-package that bundles all Tower modules                         | —                                   |

### On the roadmap

| Module      | Description                                              | Providers            |
| ----------- | -------------------------------------------------------- | -------------------- |
| Beacon      | Realtime channels and events                             | Ably, Pusher         |
| Crane       | Background jobs and queues                               | Inngest, Trigger.dev |
| Keep        | File storage and assets                                  | S3, Cloudflare R2    |
| Treasury    | Billing and payments                                     | Stripe               |
| Observatory | Search and indexing                                      | Meilisearch, Algolia |
| Watchtower  | Logs, metrics, tracing, error tracking, health checks    | —                    |
| Atlas       | File-based routing for frameworks that don't provide it  | —                    |
| Forge       | Build and deployment for environments and infrastructure | —                    |

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
