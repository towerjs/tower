# Contributing

## Commit style

This project uses [conventional commits](https://www.conventionalcommits.org/) with the package name as scope:

```
feat(gatehouse): add passkey update action
fix(vault): handle pool close on shutdown
refactor(towerjs): extract facade builder
chore(deps): upgrade vitest
docs(vault): document kysely-neon provider
docs(root): update README
```

### Scopes

Scopes match package directory names:

| Scope | Package |
|---|---|
| `foundation` | `@towerjs/foundation` |
| `blueprint` | `@towerjs/blueprint` |
| `vault` | `@towerjs/vault` |
| `gatehouse` | `@towerjs/gatehouse` |
| `courier` | `@towerjs/courier` |
| `scribe` | `@towerjs/scribe` |
| `create-tower` | `create-tower` |
| `towerjs` | `towerjs` |
| `edge` | `@towerjs/edge` |
| `root` | Root-level changes (config, CI, README) |

### Types

- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — maintenance tasks, dependency updates, tooling
- `docs` — documentation only (READMEs, module docs, guides). Scope is the package the docs describe: `docs(vault)` for the vault README or module page, `docs(root)` for root-level docs.
- `test` — adding or fixing tests
- `style` — formatting, linting (no logic change)

## Changesets

Version bumps are managed by [Changesets](https://github.com/changesets/changesets). After making changes:

```bash
pnpm changeset
```

This prompts you to select bumped packages and write a summary. The summary should be plain English describing what changed (not conventional commit format). Commit the generated changeset file before running `pnpm version`.

## Development

```bash
pnpm install        # install all dependencies
pnpm build          # build all packages
pnpm test           # run unit tests
pnpm lint           # lint with oxlint
pnpm typecheck      # TypeScript type checking
pnpm test:e2e       # E2E tests (requires Docker Postgres)
```

## Project structure

```
tower/
├── packages/           # Monorepo packages
│   ├── foundation/     # Core runtime, DI, config
│   ├── blueprint/      # App definition, module registration
│   ├── vault/          # Database ORM (Kysely + PostgreSQL)
│   ├── gatehouse/      # Authentication (Better Auth)
│   ├── courier/        # Email, SMS, push
│   ├── towerjs/        # Meta-package (user-facing)
│   ├── scribe/         # CLI tooling
│   ├── create-tower/   # Project scaffolding
│   └── edge/           # Edge runtime integration
├── examples/
│   └── with-nextjs/    # Reference Next.js application
├── tests/              # Cross-package acceptance tests
└── scripts/            # Development scripts
```

## Testing

- **Unit tests** — colocated with source in `packages/*/src/**/*.test.ts`
- **Acceptance tests** — in `tests/` — boot test, build test, dependency rules
- **E2E tests** — in `examples/with-nextjs/e2e/` — Playwright tests against the demo app

## Dependency rules

| Package | Can depend on | Cannot depend on |
|---|---|---|
| `foundation` | (nothing) | any `@towerjs/*` |
| `blueprint` | `foundation` | vault, gatehouse, courier, edge, scribe |
| `vault` | `blueprint`, `foundation` | gatehouse, courier |
| `courier` | `blueprint`, `foundation` | vault, gatehouse |
| `gatehouse` | `blueprint`, `foundation`, `courier` | vault |
| `towerjs` | anything | — |

These are enforced by `tests/dependency-rules.test.ts`. No circular dependencies between packages.
