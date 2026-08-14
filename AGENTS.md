# Tower — AI Agents Guide

## Philosophy

Tower is a **composable monolithic stack** for JavaScript applications. The project follows a layered architecture where each module lives in its own package under `packages/`, can be used independently, and communicates through well-defined interfaces.

**Key principles:**

- **Provider-agnostic** — Modules abstract over specific providers (Neon, Better Auth, Resend, etc.) behind a stable API.
- **Framework-first** — Works alongside the user's framework (Next.js initially) rather than replacing it.
- **Lazy initialization** — Tower apps are initialized on first use, not at import time. This is critical for edge/SSR compatibility.
- **Minimal API surface** — Modules export only what users need. Internal implementation details stay in the module.
- **No runtime dependencies on user-facing frameworks** — Framework adapters (`packages/*/src/frameworks/`) are separate from core logic.

## Repository structure

```
tower/
├── packages/
│   ├── foundation/       # Core runtime: lifecycle, DI, config discovery, runtime detection
│   ├── blueprint/        # App definition, module registration, context
│   ├── vault/            # Database ORM (Kysely), migrations, seeds
│   ├── gatehouse/        # Auth: social, magic links, OTP, passkeys, 2FA, orgs, API keys
│   │   └── frameworks/   # Framework adapters (next.ts, etc.)
│   ├── courier/          # Multi-channel communication: email, SMS, push
│   ├── towerjs/          # Meta-package that bundles all modules for convenient access
│   │   └── gatehouse/    # Re-exports for gatehouse subpaths (actions, next, client)
│   ├── edge/             # Edge runtime integration (Vercel Edge, etc.)
│   ├── scribe/           # CLI: scaffolding (create), migrations and seeding (migrate/seed)
│   └── create-tower/     # `pnpm create tower` entry point
├── examples/
│   └── with-nextjs/      # Reference Next.js application using all modules
├── tests/                # Root-level tests (acceptance, dependency rules)
└── scripts/              # Dev scripts (dependency checks, etc.)
```

## Dependency rules

These rules are enforced by `tests/dependency-rules.test.ts`:

| Package      | Can depend on                                                   | Cannot depend on                        |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| `foundation` | (nothing)                                                       | any `@towerjs/*`                        |
| `blueprint`  | `@towerjs/foundation`                                           | vault, gatehouse, courier, edge, scribe |
| `vault`      | `@towerjs/blueprint`, `@towerjs/foundation`                     | gatehouse, courier                      |
| `courier`    | `@towerjs/blueprint`, `@towerjs/foundation`                     | vault, gatehouse                        |
| `gatehouse`  | `@towerjs/blueprint`, `@towerjs/foundation`, `@towerjs/courier` | vault                                   |

The `towerjs` meta-package re-exports from all others and can depend on anything. It also owns the composition root: the module-factory registry (`MODULE_DEFS`), the app singleton (`getTowerApp`/`initTower`), and the lazy-initialization orchestration (`runtime.ts`). Per-module feature logic stays in the individual `@towerjs/*` packages; `towerjs` wires them together.

**Never** create circular dependencies between packages. If two packages need to share types, put them in a common dependency (foundation or a new shared package).

## Import conventions

### Within a package

Use relative imports with `.js` extension (Node.js ESM convention):

```ts
import { thing } from './sibling.js'
import { thing } from '../parent/file.js'
```

### Between packages

Import from the package name (resolved by workspace references):

```ts
import { registerModule } from '@towerjs/blueprint'
import { towerContext } from '@towerjs/foundation'
import { gatehouse } from '@towerjs/gatehouse'
```

### User-facing meta-package

User code in generated projects imports from `towerjs`:

```ts
import { gatehouse } from 'towerjs/gatehouse'
import { defineTower } from 'towerjs/blueprint'
import { getSession } from 'towerjs/gatehouse/next'
```

The `towerjs` meta-package re-exports from the individual `@towerjs/*` packages, adding lazy initialization where needed.

**Exception**: The proxy middleware file (`src/proxy.ts`) imports directly from `@towerjs/gatehouse` because the proxy module is evaluated at cold-start and needs synchronous access to `gatehouse.proxy()`.

## Commands (use these, don't run tools manually)

```bash
pnpm build        # Build all packages via Turborepo
pnpm test         # Run all unit tests (vitest)
pnpm test:watch   # Vitest watch mode
pnpm lint         # Lint with oxlint (--deny-warnings)
pnpm typecheck    # TypeScript type checking (tsc --noEmit)
pnpm format       # Format with Prettier
pnpm clean        # Remove all dist directories
pnpm check:deps   # Validate dependency rules across packages
pnpm changeset    # Create a new changeset for release
pnpm version      # Apply changesets, bump versions, update changelogs, re-sync lockfile
pnpm release      # Verify lockstep versions, build, and publish to npm
```

Always prefer `pnpm build` over `turbo build` and `pnpm test` over `vitest run`. The package.json scripts are the canonical interface.

The `pnpm build` pipeline runs monorepo packages first (via Turborepo), then the example app. If the example app build fails, check for client bundling errors — likely a static `import { cookies } from 'next/headers'` in a module re-exported from a `'use server'` file

### Release workflow

Releases are automated by Changesets in CI. The flow is:

1. `pnpm changeset` — select bumped packages and describe changes, then commit and push the changeset.
2. The **Release** GitHub Action (`.github/workflows/release.yml`) opens or updates a `release: version packages` PR on `main` whenever changesets are present.
3. Merging that PR publishes the bumped versions to npm, pushes the git tags (e.g. `@towerjs/gatehouse@0.2.0`), and creates GitHub releases from the package changelogs.

Details:

- Publishing only runs when the push is a `release: version packages` merge (or an explicit `workflow_dispatch` run with `force-publish`). Unrelated pushes to `main` never trigger a publish.
- `pnpm version` applies changesets and then runs `pnpm install` so the pnpm lockfile stays in sync with the version bumps; `pnpm release` verifies lockstep versions with `check:versions`, builds, and runs `changeset publish`.
- The `@towerjs` npm scope must be owned by the account that performs the manual first publish; otherwise publishing fails with `E404 Not Found`.
- The **first** release is manual: npm only allows configuring a trusted publisher for a package that already exists, so each new package is published once from a local machine (interactive `npm publish`, 2FA) before its trusted publisher can be configured on npmjs.com for `hyphenzero/tower` + `release.yml` (allowed action `npm publish`). The workflow declares `id-token: write` so that after bootstrapping, `changeset publish` → `pnpm publish` publishes tokenlessly via OIDC automatically (pnpm 11+ does the exchange) — a `release: version packages` merge publishes automatically (or run the workflow manually with `force-publish`). Provenance attestations are only generated once the repository is public.

**⚠️ Critical: Never run `pnpm release`, publish to npm, push release tags, or create GitHub releases yourself unless the user explicitly instructs you to do so and confirms.** Publishing to npm is irreversible — a mistaken release would publish all packages to the public registry. The human gate on automated releases is merging the version PR or manually triggering the workflow; always wait for explicit, confirmed user instruction before running any release commands.

## TypeScript

The monorepo uses **TypeScript 7** (root `tsconfig.json` references). Each package has its own `tsconfig.json` with project references. Build output goes to `packages/*/dist/`.

Individual packages may use older TypeScript versions for compatibility (e.g., `examples/with-nextjs` uses TS 5.9 because Next.js pins it).

## Framework adapters

Framework-specific code lives in `packages/*/src/frameworks/`. Currently only Next.js is supported:

- `packages/gatehouse/src/frameworks/next.ts` — Auth: `getSession`, `action`, `withGatehouse`, `GET`, `POST`
- `packages/scribe/src/frameworks/next.ts` — Project scaffolding for Next.js
- `packages/edge/src/next.ts` — `withTowerEdge()` for next.config.ts

When adding a new framework (e.g., Express, Hono), create a new adapter file in each package's `frameworks/` directory.

## Edge Runtime Limitations

Tower is designed for portable application architecture across Node.js, serverless, and edge environments. However, the current Gatehouse implementation (which wraps Better Auth) requires Node.js-compatible runtime APIs (`headers()`, `cookies()` from Next.js) for session/cookie handling. This means:

- **Gatehouse** works in Node.js and Vercel Serverless, but **not** in Vercel Edge or Cloudflare Workers.
- **Vault** with Neon provider works in all runtimes (including Edge).
- **Courier** with HTTP providers (Resend, SES, SMTP, Twilio, Web Push) works in all runtimes.
- **Foundation**, **Blueprint**, **Scribe** (CLI), **Edge** adapter are runtime-agnostic.

Edge support for Gatehouse is planned for v0.2.0 via a custom adapter that doesn't rely on Next.js runtime-specific APIs.

When writing application code, use the Tower APIs (`gatehouse.getSession()`, `vault.selectFrom()`, etc.) — the runtime/provider adapter layer handles the differences. Do not write runtime-specific branches in application code.

## Testing

- Unit tests: `packages/*/src/**/*.test.ts` — run via `pnpm test`
- Acceptance tests: `tests/*.test.ts` — boot test, build test
- E2E tests: `examples/with-nextjs/e2e/` — run via `pnpm test:e2e` (requires Docker Postgres)
- Tests should NOT require external services unless tagged with `{ skip }` when unavailable
- Database-dependent tests check for `DATABASE_URL` and skip gracefully

### E2E testing patterns (Playwright)

E2E tests live in `examples/with-nextjs/e2e/` and use Playwright against the demo Next.js app.

**Core auth flows tested:**

```
auth.spec.ts
  ✓ unauthenticated user redirected to sign in
  ✓ user can sign up
  ✓ email is verified after sign up
  ✓ user can sign out
  ✓ user can sign in after sign out
  ✓ session persists after reload

auth-extended.spec.ts
  ✓ incorrect sign-in shows error message
  ✓ update profile name with success feedback
  ✓ change password then sign in with new and old passwords
  ✓ create organization, invite member, cancel invitation
  ✓ revoke all other sessions from security page
  ✓ two-factor enable flow shows QR code
```

**Running E2E tests:**

```bash
# Start Postgres (root or examples/with-nextjs)
docker compose up postgres

# Run tests (auto-starts Next.js dev server via Playwright webServer)
pnpm test:e2e
```

**Database:** Reset between runs with `docker compose down -v && docker compose up postgres`.

**Email provider:** The demo app uses Courier's `console` provider (`provider: "console"`), which logs emails to stdout. No external credentials needed for development.

**OAuth:** OAuth tests (`e2e/oauth.spec.ts`) are skipped unless `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` env vars are set. This keeps the default test suite dependency-free.

**Test isolation:** Each test generates a unique email (`test-${Date.now()}@example.com`) to avoid database state conflicts. No database cleanup is needed between tests.

**Adding new E2E tests:**

1. Add `*.spec.ts` to `examples/with-nextjs/e2e/`
2. Use unique test data (timestamps, random values)
3. Add `test.skip()` for provider-dependent tests
4. Verify with `pnpm test:e2e`

## Commit style

Use conventional commits with the package name as scope:

```
feat(gatehouse): add passkey update action
fix(vault): handle pool close on shutdown
refactor(gatehouse): extract api builder
chore(deps): upgrade vitest
docs(vault): document kysely-neon provider
```

Scopes match package directory names: `foundation`, `blueprint`, `vault`, `gatehouse`, `courier`, `scribe`, `create-tower`, `towerjs`, `edge`. Use `root` for root-level changes (config, CI, README). Use `docs` with the owner package as scope for documentation — e.g. `docs(vault)` for the vault README or module page, `docs(root)` for root-level docs.

Human contributors and the `commit` skill should both follow this format. Changeset summaries are written in plain English, not conventional commit format.

## Linting

We use **oxlint** (not ESLint or Biome, which are incompatible with TypeScript 7).

Config is in `oxlint.json` at the root. Run via `pnpm lint`.

## The meta-package pattern (towerjs)

`packages/towerjs` is the user-facing entry point. It re-exports from all `@towerjs/*` packages and adds:

1. **Lazy initialization** — The `towerjs` wrappers call `getTowerApp()` before delegating, ensuring the app is initialized on first use.
2. **Convenience re-exports** — Users import from `towerjs/*` subpaths instead of remembering individual package names.

The wrappers in `packages/towerjs/src/gatehouse.ts` and similar files use `Proxy` objects to intercept property access and add initialization logic.
