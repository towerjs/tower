# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-30

### Breaking Changes

This is the **Application Experience Layer** release. `v0.1` shipped the primitives; `v0.2` layers the application experience above them — nothing is replaced, but the package structure is.

- **`@towerjs/foundation` and `@towerjs/blueprint` are no longer published** — they now live as internal layers inside `@towerjs/tower` (`src/foundation/`, `src/blueprint/`). The publish set goes from 9 packages to 7 (`tower`, `vault`, `gatehouse`, `courier`, `edge`, `scribe`, `create-tower`). Remove them from your dependencies; import core helpers from `@towerjs/tower/foundation` and `@towerjs/tower/blueprint` instead.

- **Subpaths under `@towerjs/tower` for modules are gone** — `import { vault } from '@towerjs/tower/vault'`, `gatehouse` from `@towerjs/tower/gatehouse`, etc. no longer exist. Import modules from their own packages:

  ```ts
  import { vault } from '@towerjs/vault'
  import { gatehouse } from '@towerjs/gatehouse'
  import { courier } from '@towerjs/courier'
  ```

  Only `@towerjs/tower/blueprint`, `@towerjs/tower/foundation`, and `@towerjs/tower/runtime` remain as core subpaths.

- **`tower.config.ts` `modules` is now an explicit array of callable module definitions** — string-keyed objects and the `MODULE_DEFS` registry are deleted.

  ```ts
  // before (v0.1)
  export default defineTower({ modules: { vault: {}, gatehouse: { provider: 'better-auth' } } })
  // after (v0.2)
  import { vault } from '@towerjs/vault'
  import { gatehouse } from '@towerjs/gatehouse'
  export default defineTower({ modules: [vault(), gatehouse({ provider: 'better-auth', credentials: true })] })
  ```

  Each module's canonical export is a callable: `vault()` returns the `TowerModule` (call face), `vault.selectFrom` is the runtime API (property face). Missing declared dependency now throws an actionable error (e.g. `Gatehouse requires the Vault module. Add vault()`).

  Static imports make the graph tree-shakeable; no `Function('return import(...)')` indirection.

### Added

- **Vault provider abstraction** (`#93`) — `VaultProvider` / `VaultPoolConfig` boundary, `resolveProviderName` / `resolveVaultProvider`, `pgProvider` / `neonProvider`. Application code swaps `provider: 'neon'` vs `provider: 'pg'` without changing queries.
- **Curated infrastructure philosophy** (`#95`) — documented in `docs/03-modules/01-vault.mdx` and `docs/01-introduction/05-infrastructure.mdx`; Postgres-first with a scoped provider boundary.
- **Tower model API** (`#75`–`#79`, `#97`) — `@towerjs/vault/model` (`defineModel`, `belongsTo`/`hasMany`, eager loading via `.with()`, `ModelQueryBuilder`, `PaginatedResult`) and `@towerjs/vault/factory` (`defineFactory`, `states`, `make`/`create`/`createMany`). Supports `casts` (`string`/`number`/`boolean`/`datetime`/`json` + custom), `hidden` fields, `scopes`, model-scoped transactions, and `toJSON`/`toArray`. `vault.db` remains the Kysely escape hatch. Documented in `docs/03-modules/02-models.mdx`; used by the generated app scaffold.
- **Vault ergonomics** — re-export `sql` and `Generated<T>` from `@towerjs/vault` so apps don't need a direct `kysely` dependency; `vault<Database>(opts)` is now generic and `vault as VaultModule<Database>` is documented.
- **Gatehouse user API** (`#81`) — `gatehouse.user()` / `requireUser()` / `session()` / `getSession()`, `signIn` / `signOut`, `getUserSessions` / `getApiKeys` / `getOrganizations` — typed, contract-tested, and documented in `docs/03-modules/02-gatehouse/09-sessions.mdx`.
- **Gatehouse edge-compatible provider boundary** (`#92`) — `GatehouseProvider` interface + `capabilities.runtime.edge`; Node-only providers throw `does not support Edge runtimes` when initialized on Edge. `better-auth` stays Node-only; custom providers can be Edge-compatible. Documented in `docs/06-advanced/05-edge.mdx`.
- **Tower policies** (`#80`) — `definePolicy` / `definePolicyRegistration`, `PolicyRegistry` with `can()` (boolean, unauthenticated → `false`) and `authorize()` (`AuthenticationError` / `AuthorizationError`). Composed via `gatehouse({ policies: [...] })` in `tower.config.ts`. Documented in `docs/03-modules/02-gatehouse/13-authorization.mdx`.
- **Gatehouse social provider API** (`#82`) — `social: ['google','github']` array form, `GATEHOUSE_*` / `AUTH_*` / `BETTER_AUTH_*` env var prefixes, per-provider options (`disableSignUp`, `scope`, `overrideUserInfoOnSignIn`, etc.).
- **Gatehouse social account linking** (`#83`) — `identities.list` / `link` / `unlink` / `getAccessToken`, duplicate-identity handling, session issuance; provider-independent contract tested via `social-contract` and `social-lifecycle` suites.
- **Authentication starter + model-backed scaffold** (`#84`, `#97`) — `pnpm create tower --template auth` now generates pages, actions, route handlers, verification/reset flows, and a working dashboard backed by Tower models.
- **Generators** (`#85`–`#87`) — `tower make model <Name>` / `migration <name>` / `policy <Name>` / `factory <Name>` / `job <Name>` with kebab/plural normalization and timestamped migration files. Tested in `packages/scribe/src/generators/make.test.ts`.
- **CLI: `tower db` command group** (`#88`) — `tower db migrate` / `rollback` / `refresh` / `fresh` / `status` / `seed` / `setup` (stepped migrations, isolated transactions, `kysely_migration` bookkeeping).
- **Migration safety controls** (`#89`) — `--pretend` (DummyDriver SQL preview), production confirmation (`--force` or interactive `yes`), isolated execution.
- **CLI: `tower config` show** (`#90`) — `tower config show` with secret redaction (`*_SECRET`, `*_KEY`, `DATABASE_URL`, etc.) and scoped inspection.
- **CLI: `tower dev`** (`#91`) — validates config + diagnostics, then runs `next dev`; always serves on `3000` and falls back to the next free port.
- **Public API contract tests** (`#94`) — `tests/api/*` now asserts export lists for every package, runtime/type agreement (`apiKeys.verify → {valid,error,key}`), vault/model/factory exports, and provider boundaries; `docs/`, `tarball`, and `dependency-rules` all run in CI.
- **Scribe噪音 clean-up** (`#100`) — `create-next-app` output is captured (`stdio: pipe`, shown only on failure); three dev-dep `pnpm add` passes collapsed to a single `pnpm install --prod=false` with `--reporter=silent`; `tower dev` port-fallback handles single-interface holds.
- **Create-tower branding** (`#101`) — default page now shows Tower + Next.js branding and stack summary.
- **`@towerjs/tower` as npm front door** (`#102`) — `packages/tower/README.md` is now the Tower-level product README (not the meta-package re-export list), so the npm page renders the project overview; `files` + `verify-tarball.sh` guard the published content.
- **Documentation baseline** (`#112`, `#114`, `#115`) — docs rewritten for the core architecture (`modules: [vault()]`, no `@towerjs/foundation`/`@towerjs/blueprint` package imports), and every ` ```ts verify` block now compiles via `scripts/verify-docs.sh` (run in CI).

### Changed

- `@towerjs/tower` is no longer a meta-package that re-exports every module — it is the application core. Modules are installed and imported separately (`@towerjs/vault`, `@towerjs/gatehouse`, etc.).
- `AGENTS.md`, dependency rules (`tests/dependency-rules.test.ts`), and `packages/tower/package.json` `exports` updated to reflect the core architecture.
- `scripts/verify-docs.sh` and `tests/docs.test.ts` now compile examples inside `examples/with-nextjs` so documented imports are verified as a real consumer would see them.
- `scaffold` now sets the system font stack with plain CSS instead of Tailwind's `@theme` at-rule when Tailwind is off (fixes Turbopack `Invalid CSS`).

### Fixed

- `gatehouse.apiKeys.verify` declared type (`ApiKeyInfo | null`) disagreed with the Better Auth runtime (`{valid,error,key}`) — widened to `ApiKeyVerifyResult` and fixed the `verifyApiKey` body builder (`#121`).
- `vault` typing required a cast and had no insert/select distinction — added `vault<Database>(opts)` generic factory and re-exported `Generated<T>` (`#122`).
- Scaffolded `tower.config` files now import only the selected modules (previously they always imported vault/gatehouse/courier, breaking `next build` when a module was omitted).
- `tower` CLI errors now include the stack trace.
- Docs examples that previously never compiled now compile under the repaired contract gate.

## [0.1.1] - 2026-08-19

### Fixed

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
