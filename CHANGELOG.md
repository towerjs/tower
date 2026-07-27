# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Tower, a composable monolithic stack for JavaScript applications.
  - **Foundation** — Core runtime with AsyncLocalStorage request context, dependency injection, config auto-discovery, and runtime detection.
  - **Blueprint** — App definition via `defineTower()` and module registration via `registerModule()` with dependency validation and two-phase lifecycle.
  - **Vault** — Database ORM (Kysely) with migrations and seeds. Provider: PostgreSQL (Neon or direct).
  - **Gatehouse** — Authentication with `gatehouse.requireUser()`, `gatehouse.getSession()`, and `gatehouse.user()` on a framework-agnostic facade. Features: email/password, social auth (Google, GitHub, Discord, Apple, Microsoft), magic links, email/phone OTP, passkeys, TOTP 2FA, session management, API keys, organizations with RBAC and invitations.
  - **Courier** — Multi-channel communication. Providers: email (Resend, SES, SMTP), SMS (Twilio), push (Web Push). Auto-wires with Gatehouse for auth emails.
  - **towerjs** — Meta-package bundling all modules with lazy initialization and the framework-agnostic `gatehouse` facade.
  - **Next.js framework adapter** — Next.js App Router is currently the only supported framework. Server action wrapper with automatic cookie sync, route handler wrapper, auto-registered request context, and Better Auth route handlers.
  - **Edge** — `withTowerEdge()` plugin for `next.config.ts` for Vercel Edge compatibility.
  - **Scribe CLI** — Interactive scaffolding via `pnpm create tower`.
  - **Examples** — Reference Next.js app with dashboard, auth flows, org management, security settings, courier demo.
  - **CI/CD** — GitHub Actions for lint, typecheck, test, and build.
  - **Linting** — oxlint with 97 rules, compatible with TypeScript 7.
