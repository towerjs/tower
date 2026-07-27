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
│   ├── scribe/           # CLI for scaffolding Tower applications
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

The `towerjs` meta-package re-exports from all others and can depend on anything. It should NOT contain logic — only re-exports and thin wrappers for lazy initialization.

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
pnpm version      # Apply changesets and bump versions
pnpm release      # Build, publish to npm, and create GitHub release
```

Always prefer `pnpm build` over `turbo build` and `pnpm test` over `vitest run`. The package.json scripts are the canonical interface.

The `pnpm build` pipeline runs monorepo packages first (via Turborepo), then the example app. If the example app build fails, check for client bundling errors — likely a static `import { cookies } from 'next/headers'` in a module re-exported from a `'use server'` file

### Release workflow

1. `pnpm changeset` — select bumped packages and describe changes
2. `pnpm version` — applies changesets, bumps versions, updates changelogs
3. `pnpm release` — builds all packages and publishes to npm

All changesets should be committed before running `pnpm version`. After release, push the generated version bump commit and tag.

**⚠️ Critical: Never publish to npm, create a GitHub release, or tag a release on GitHub unless the user explicitly instructs you to do so and confirms.** Publishing to npm is irreversible — a mistaken release would publish all packages to the public registry. Always wait for explicit, confirmed user instruction before running any release commands.

## TypeScript

The monorepo uses **TypeScript 7** (root `tsconfig.json` references). Each package has its own `tsconfig.json` with project references. Build output goes to `packages/*/dist/`.

Individual packages may use older TypeScript versions for compatibility (e.g., `examples/with-nextjs` uses TS 5.9 because Next.js pins it).

## Framework adapters

Framework-specific code lives in `packages/*/src/frameworks/`. Currently only Next.js is supported:

- `packages/gatehouse/src/frameworks/next.ts` — Auth: `getSession`, `action`, `withGatehouse`, `GET`, `POST`
- `packages/scribe/src/frameworks/next.ts` — Project scaffolding for Next.js
- `packages/edge/src/next.ts` — `withTowerEdge()` for next.config.ts

When adding a new framework (e.g., Express, Hono), create a new adapter file in each package's `frameworks/` directory.

## Testing

- Unit tests: `packages/*/src/**/*.test.ts` — run via `pnpm test`
- Acceptance tests: `tests/*.test.ts` — boot test, build test
- Tests should NOT require external services unless tagged with `{ skip }` when unavailable
- Database-dependent tests check for `DATABASE_URL` and skip gracefully

## Linting

We use **oxlint** (not ESLint or Biome, which are incompatible with TypeScript 7).

Config is in `oxlint.json` at the root. Run via `pnpm lint`.

## The meta-package pattern (towerjs)

`packages/towerjs` is the user-facing entry point. It re-exports from all `@towerjs/*` packages and adds:

1. **Lazy initialization** — The `towerjs` wrappers call `getTowerApp()` before delegating, ensuring the app is initialized on first use.
2. **Convenience re-exports** — Users import from `towerjs/*` subpaths instead of remembering individual package names.

The wrappers in `packages/towerjs/src/gatehouse.ts` and similar files use `Proxy` objects to intercept property access and add initialization logic.
