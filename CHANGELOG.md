# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Tower, a composable, monolithic stack for JavaScript applications.
  - **Foundation** — Core runtime with AsyncLocalStorage request context, dependency injection, config auto-discovery, and runtime detection.
  - **Blueprint** — App definition via `defineTower()` and module registration via `registerModule()` with dependency validation and two-phase lifecycle. Typed `env` helpers (`env.string`, `env.optional`, `env.url`, `env.boolean`, `env.number`) for reading configuration from the environment.
  - **Vault** — Database ORM (Kysely) with migrations and seeds. Provider: PostgreSQL (Neon or direct). Neon connections use the kysely-neon HTTP dialect.
  - **Gatehouse** — Authentication with `gatehouse.requireUser()`, `gatehouse.getSession()`, and `gatehouse.user()` on a framework-agnostic API. Features: email/password, social auth (Google, GitHub, Discord, Apple, Microsoft), magic links, passkeys, TOTP 2FA, session management, API keys, organizations with RBAC and invitations.
  - **Courier** — Multi-channel communication. Providers: email (Resend, SES, SMTP), SMS (Twilio), push (Web Push), plus a console provider for local development. Auto-wires with Gatehouse for auth emails.
  - **towerjs** — Meta-package bundling all modules with lazy initialization, the framework-agnostic `gatehouse` API, and a react-server entry for server-only facade access.
  - **Next.js framework adapter** — Next.js App Router is currently the only supported framework. Server action wrapper with automatic cookie sync, route handler wrapper, auto-registered request context, and Better Auth route handlers.
  - **Edge** — `withTowerEdge()` plugin for `next.config.ts` for Vercel Edge compatibility.
  - **Scribe CLI** — Interactive scaffolding via `pnpm create tower`, plus `tower migrate`, `tower migrate --seed`, `tower seed`, `tower seed --skip-migrate`, and `tower about` for app diagnostics. Scaffolded projects emit authoritative environment contracts from their module configuration.
  - **Examples** — Reference Next.js app with dashboard, auth flows, org management, security settings, courier demo.
  - **Tests** — Unit suites across all packages, dependency-rule acceptance tests, boot/build tests, and Playwright e2e tests against the example app.
  - **CI/CD** — GitHub Actions for lint, typecheck, test, build, and e2e.
  - **Docs** — Full documentation site with guides, module references, and tutorials.
  - **Linting** — oxlint with correctness and suspicious rule categories, compatible with TypeScript 7.

### Changed

- Email OTP is now part of the `emailVerification` options instead of a standalone `emailOtp` option — configure `method: 'link' | 'otp'`, `required`, and `sendVerificationOTP`.
- The `tower` CLI binary moved from the `towerjs` meta-package to `@towerjs/scribe`, which also installs itself in newly scaffolded projects.
- Scaffolding prompts now cover deployment target (Vercel, Cloudflare, other) and runtime (Node or Edge), detect the active package manager, and only install `@towerjs/edge` when the Edge runtime is chosen.
