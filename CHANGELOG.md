# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Scaffolded `tower.config` files now import only the selected modules — previously they always imported vault, gatehouse, and courier, so apps created without all three failed `next build` type checking.
- Scaffolds without Tailwind now set the system font stack with plain CSS instead of Tailwind's `@theme` at-rule, which Turbopack flagged as invalid CSS.
- `tower` CLI errors now include the stack trace, making scaffold and migration failures debuggable.

- Republished all packages at 0.1.1 with tarballs built from the current codebase — the 0.1.0 tarballs shipped stale pre-rename output that broke `pnpm create tower` by installing the never-published `towerjs` package ([#98](https://github.com/towerjs/tower/issues/98)).

## [0.1.0] - 2026-08-19

### Added

- **Foundation** — Core application composition, configuration, dependency injection, service registration, application context, and serverless-compatible initialization.
- **Blueprint** — Central application definition and configuration for Tower modules, providers, and environments.
- **Vault** — Typed database access through Kysely, with PostgreSQL support, migrations, seeds, transactions, and Neon integration.
- **Gatehouse** — Authentication and authorization with email/password authentication, social login, magic links, OTP, email verification, password management, TOTP two-factor authentication, backup codes, API keys, passkeys, and organizations with roles and invitations — currently built on Better Auth.
- **Courier** — Email, SMS, and push notification APIs with Resend, Amazon SES, SMTP, Twilio, and Web Push integrations, including integration with Gatehouse for authentication emails.
- **Next.js integration** — Server action wrappers, route handler wrappers, and automatic request context for Next.js App Router applications.
- **Edge support** — `withTowerEdge()` for running Tower applications in Vercel Edge-compatible environments.
- **Scribe CLI** — `pnpm create tower` project scaffolding and commands for migrations, seeding, and application information.
- **Example application** — A complete Next.js reference application demonstrating authentication, email verification, organizations, two-factor authentication, and passkeys.
